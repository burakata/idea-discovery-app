using System.Net;
using IdeaDiscovery.Api.Data;

namespace IdeaDiscovery.Api.Tests;

// PRD A15, "Secure sharing": a link forwarded to a non-invited person gives no
// access unless that identity is authorised for the project. These tests cover
// the invitation path through the real endpoints.
public class InvitationsA15Tests
{
    private static List<Guid> MembershipsOf(RoomsFactory f, string email) =>
        f.WithDb(db => db.ProjectMembers
            .Where(m => db.Users.Any(u => u.Id == m.UserId && u.Email == email))
            .Select(m => m.ProjectId).ToList());

    private static async Task AssertNoAccess(Person person)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Me()).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Http.GetAsync("/projects")).StatusCode);
    }

    [Fact]
    public async Task A_new_persons_link_signs_them_in_once_as_a_member_of_that_project_only_and_a_forwarded_copy_is_refused()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject("Warehouse idea");
        var other = await burak.CreateProject("Another idea");

        var response = await burak.Invite(project, "new.owner@example.com", "Ayse Yilmaz", "tr");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("invited", (await burak.Json(response)).GetProperty("kind").GetString());
        var mail = Assert.Single(await h.Settled());
        Assert.Equal("new.owner@example.com", mail.To);

        var invitee = h.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await invitee.Redeem(mail.Token)).StatusCode);
        Assert.Equal(new[] { project }, await invitee.ListedProjectIds());
        Assert.Equal(new[] { project }, MembershipsOf(h.F, "new.owner@example.com"));
        Assert.DoesNotContain(other, MembershipsOf(h.F, "new.owner@example.com"));
        var user = h.F.WithDb(db => db.Users.Single(u => u.Email == "new.owner@example.com"));
        Assert.Equal("Ayse Yilmaz", user.DisplayName);
        Assert.Equal("tr", user.UiLanguage);

        // The same link, forwarded to somebody else.
        var stranger = h.NewPerson();
        await (await stranger.Redeem(mail.Token)).AssertRefused(stranger);
        await AssertNoAccess(stranger);
        Assert.Equal(1, h.F.WithDb(db => db.Users.Count(u => u.Email == "new.owner@example.com")));
    }

    [Fact]
    public async Task A_revoked_invitations_link_is_refused_and_creates_no_membership()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        var mail = Assert.Single(await h.Settled());

        var revoked = await burak.Revoke(id);
        Assert.Equal(HttpStatusCode.NoContent, revoked.StatusCode);
        Assert.Equal("revoked", await burak.StateOf(project, id));

        var person = h.NewPerson();
        var refused = await person.Redeem(mail.Token);
        await refused.AssertRefused(person);
        Assert.Equal("""{"error":"link_not_valid"}""", await refused.Content.ReadAsStringAsync());
        await AssertNoAccess(person);
        Assert.Empty(MembershipsOf(h.F, "new.owner@example.com"));
        Assert.False(h.F.WithDb(db => db.Users.Any(u => u.Email == "new.owner@example.com")));

        // A second revoke is a conflict; an unknown id is not found.
        Assert.Equal(HttpStatusCode.Conflict, (await burak.Revoke(id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Revoke(Guid.NewGuid())).StatusCode);
    }

    [Fact]
    public async Task An_invitation_link_is_refused_seven_days_and_a_minute_after_inviting_and_shows_as_expired()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        var mail = Assert.Single(await h.Settled());
        Assert.Equal("open", await burak.StateOf(project, id));

        h.F.Clock.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));

        var person = h.NewPerson();
        await (await person.Redeem(mail.Token)).AssertRefused(person);
        await AssertNoAccess(person);
        Assert.Empty(MembershipsOf(h.F, "new.owner@example.com"));
        Assert.Equal("expired", await burak.StateOf(project, id));
    }

    [Fact]
    public async Task An_invitation_link_still_works_a_little_before_seven_days()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        var mail = Assert.Single(await h.Settled());

        h.F.Clock.Advance(TimeSpan.FromDays(7) - TimeSpan.FromMinutes(1));

        Assert.Equal(HttpStatusCode.OK, (await h.NewPerson().Redeem(mail.Token)).StatusCode);
        Assert.Equal("accepted", await burak.StateOf(project, id));
    }

    [Fact]
    public async Task An_existing_account_is_added_at_once_and_gets_only_a_thirty_minute_link_refused_at_31_minutes()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var userId = h.F.SeedOwner("existing@example.com", "Existing Name");

        var response = await burak.Invite(project, "existing@example.com", "A Different Name", "tr");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await burak.Json(response);
        Assert.Equal("added", json.GetProperty("kind").GetString());
        Assert.Equal(userId, json.GetProperty("userId").GetGuid());
        Assert.Equal(new[] { project }, MembershipsOf(h.F, "existing@example.com"));
        Assert.Equal("Existing Name", h.F.WithDb(db => db.Users.Single(u => u.Id == userId).DisplayName));

        var mail = Assert.Single(await h.Settled());
        Assert.Equal("existing@example.com", mail.To);
        Assert.Single(mail.Links); // one link only, and never a second, 7-day one

        h.F.Clock.Advance(TimeSpan.FromMinutes(31));

        var person = h.NewPerson();
        await (await person.Redeem(mail.Token)).AssertRefused(person);
        await AssertNoAccess(person);
        // The membership stays: only the link has gone.
        Assert.Equal(new[] { project }, MembershipsOf(h.F, "existing@example.com"));
    }

    [Fact]
    public async Task An_existing_accounts_link_works_at_29_minutes_and_signs_in_that_account()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var userId = h.F.SeedOwner("existing@example.com", "Existing Name");
        Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, "existing@example.com")).StatusCode);
        var mail = Assert.Single(await h.Settled());

        h.F.Clock.Advance(TimeSpan.FromMinutes(29));

        var person = h.NewPerson();
        var redeemed = await person.Redeem(mail.Token);
        Assert.Equal(HttpStatusCode.OK, redeemed.StatusCode);
        Assert.Equal(userId, (await person.Json(redeemed)).GetProperty("id").GetGuid());
        Assert.Equal(new[] { project }, await person.ListedProjectIds());
    }

    [Theory]
    [InlineData("consultant@rooms.test")]
    [InlineData("  Consultant@Rooms.TEST ")]
    public async Task Inviting_the_consultants_own_email_is_refused_and_no_email_is_sent(string email)
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();

        Assert.Equal(HttpStatusCode.Conflict, (await burak.Invite(project, email)).StatusCode);

        Assert.Empty(await h.Settled());
        Assert.Empty(await burak.Invitations(project));
    }

    [Fact]
    public async Task An_invitation_to_one_project_gives_nothing_in_another()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var a = await burak.CreateProject("Project A");
        var b = await burak.CreateProject("Project B");
        await burak.InviteNew(a, "new.owner@example.com");
        var mail = Assert.Single(await h.Settled());

        var person = h.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(mail.Token)).StatusCode);

        Assert.DoesNotContain(b, MembershipsOf(h.F, "new.owner@example.com"));
        Assert.Equal(new[] { a }, await person.ListedProjectIds());
        Assert.Equal(HttpStatusCode.OK, (await person.GetProject(a)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await person.GetProject(b)).Status);
    }

    [Fact]
    public async Task An_owner_gets_403_from_invite_list_and_revoke_and_nothing_changes()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        await h.Settled();
        var ownerId = h.F.SeedOwner("owner@example.com");
        h.F.AddOwnerMember(project, ownerId);
        var owner = await h.SignIn(ownerId);

        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Invite(project, "someone@example.com")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Http.GetAsync($"/consultant/projects/{project}/invitations")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Revoke(id)).StatusCode);

        var list = await burak.Invitations(project);
        Assert.Equal("new.owner@example.com", Assert.Single(list).GetProperty("email").GetString());
        Assert.Equal("open", await burak.StateOf(project, id));
        Assert.Single(await h.Settled()); // only Burak's own invitation
        Assert.False(h.F.WithDb(db => db.Users.Any(u => u.Email == "someone@example.com")));
    }

    [Fact]
    public async Task Signed_out_gets_401_from_invite_list_and_revoke()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        await h.Settled();
        var nobody = h.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Invite(project, "someone@example.com")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Http.GetAsync($"/consultant/projects/{project}/invitations")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Revoke(id)).StatusCode);

        Assert.Equal("open", await burak.StateOf(project, id));
        Assert.Single(await h.Settled());
    }

    [Fact]
    public async Task Inviting_the_same_email_while_open_is_refused_and_after_revoking_it_works_with_the_old_link_still_refused()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var first = await burak.InviteNew(project, "new.owner@example.com");

        Assert.Equal(HttpStatusCode.Conflict, (await burak.Invite(project, "New.Owner@example.com")).StatusCode);
        Assert.Single(await h.Settled());

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Revoke(first)).StatusCode);
        var second = await burak.InviteNew(project, "new.owner@example.com");
        Assert.NotEqual(first, second);
        var mails = await h.Settled();
        Assert.Equal(2, mails.Count);

        var oldPerson = h.NewPerson();
        await (await oldPerson.Redeem(mails[0].Token)).AssertRefused(oldPerson);
        await AssertNoAccess(oldPerson);

        var newPerson = h.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await newPerson.Redeem(mails[1].Token)).StatusCode);
        Assert.Equal(new[] { project }, await newPerson.ListedProjectIds());
    }

    [Fact]
    public async Task The_email_is_in_the_invitations_language_and_names_the_project_in_that_language()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject("Warehouse idea"); // Turkish title: "Warehouse idea (TR)"
        await burak.InviteNew(project, "english@example.com", "John Smith", "en");
        await burak.InviteNew(project, "turkish@example.com", "Ayse Yilmaz", "tr");

        var mails = await h.Settled();
        var en = mails.Single(m => m.To == "english@example.com");
        var tr = mails.Single(m => m.To == "turkish@example.com");

        Assert.NotEqual(en.Subject, tr.Subject);
        Assert.Contains("Warehouse idea", en.Body);
        Assert.DoesNotContain("(TR)", en.Body);
        Assert.Contains("Warehouse idea (TR)", tr.Body);
    }

    [Fact]
    public async Task Someone_already_a_member_cannot_be_invited_again_and_gets_no_email()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        h.F.AddOwnerMember(project, h.F.SeedOwner("member@example.com"));

        Assert.Equal(HttpStatusCode.Conflict, (await burak.Invite(project, "member@example.com")).StatusCode);

        Assert.Empty(await h.Settled());
    }

    [Theory]
    [InlineData("not an email", "Ayse Yilmaz", "en")]
    [InlineData("a@example.com", "", "en")]
    [InlineData("a@example.com", "   ", "en")]
    [InlineData("a@example.com", "Ayse Yilmaz", "de")]
    [InlineData("a@example.com", "Ayse Yilmaz", "")]
    public async Task An_invalid_email_name_or_language_is_a_400_and_no_email_is_sent(string email, string name, string language)
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();

        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Invite(project, email, name, language)).StatusCode);

        Assert.Empty(await h.Settled());
        Assert.Empty(await burak.Invitations(project));
    }

    [Fact]
    public async Task An_unknown_project_is_a_404_for_invite_and_list()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var unknown = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await burak.Invite(unknown, "a@example.com")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Http.GetAsync($"/consultant/projects/{unknown}/invitations")).StatusCode);
        Assert.Empty(await h.Settled());
    }

    [Fact]
    public async Task A_fourth_invitation_email_in_a_day_to_the_same_address_is_a_429()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        for (var i = 0; i < 3; i++)
        {
            var id = await burak.InviteNew(project, "new.owner@example.com");
            await h.Settled();
            Assert.Equal(HttpStatusCode.NoContent, (await burak.Revoke(id)).StatusCode);
        }

        Assert.Equal((HttpStatusCode)429, (await burak.Invite(project, "new.owner@example.com")).StatusCode);

        Assert.Equal(3, (await h.Settled()).Count);
    }

    [Fact]
    public async Task The_list_shows_each_invitation_with_its_fields()
    {
        using var h = new InviteHarness();
        var burak = await h.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com", "Ayse Yilmaz", "tr");

        var item = Assert.Single(await burak.Invitations(project));

        Assert.Equal(id, item.GetProperty("id").GetGuid());
        Assert.Equal("new.owner@example.com", item.GetProperty("email").GetString());
        Assert.Equal("Ayse Yilmaz", item.GetProperty("displayName").GetString());
        Assert.Equal("tr", item.GetProperty("language").GetString());
        Assert.Equal("open", item.GetProperty("state").GetString());
        Assert.True(item.GetProperty("createdAt").GetDateTimeOffset() < item.GetProperty("expiresAt").GetDateTimeOffset());
    }
}
