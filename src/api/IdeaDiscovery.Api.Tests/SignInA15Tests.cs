using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IdeaDiscovery.Api.Data;

namespace IdeaDiscovery.Api.Tests;

// PRD A15 "Secure sharing": a forwarded link must not let a non-invited person
// in. Decided meaning (docs/decisions.md, 2026-11-20): a link works once,
// expires, and is used only by a POST. Every dead link gets the same answer.
public class SignInA15Tests
{
    private const string Refusal = "{\"error\":\"link_not_valid\"}";

    private static async Task AssertLinkNotValid(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(Refusal, (await response.Content.ReadAsStringAsync()).Trim());
    }

    private static async Task AssertSignedOut(Person person) =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Me()).StatusCode);

    private static async Task AssertSignedIn(Person person) =>
        Assert.Equal(HttpStatusCode.OK, (await person.Me()).StatusCode);

    // The consultant endpoints, as (method, url) for the given ids.
    private static List<(string Method, string Url)> ConsultantEndpoints(Guid userId, Guid sessionId, Guid invitationId) =>
    [
        ("GET", $"/consultant/users/{userId}/sessions"),
        ("POST", $"/consultant/sessions/{sessionId}/revoke"),
        ("POST", $"/consultant/users/{userId}/sign-in-link"),
        ("POST", $"/consultant/invitations/{invitationId}/link"),
    ];

    private static Task<HttpResponseMessage> Call(Person person, (string Method, string Url) endpoint) =>
        endpoint.Method == "GET" ? person.Http.GetAsync(endpoint.Url) : person.Post(endpoint.Url);

    // ---- 1 ----
    [Fact]
    public async Task A_forwarded_sign_in_link_does_not_work_after_the_owner_used_it()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var token = await f.UserToken(ownerId);
        var owner = f.NewPerson();
        var stranger = f.NewPerson();

        var first = await owner.Redeem(token);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var me = await owner.Json(await owner.Me());
        Assert.Equal(ownerId, me.GetProperty("id").GetGuid());

        await AssertLinkNotValid(await stranger.Redeem(token));
        await AssertSignedOut(stranger);
        await AssertSignedIn(owner);
    }

    // ---- 2 ----
    [Fact]
    public async Task Expired_sign_in_and_invitation_links_get_the_same_refusal()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var invitationId = f.SeedInvitation(f.SeedProject());
        var signInToken = await f.UserToken(ownerId);
        var invitationToken = await f.InvitationToken(invitationId);

        f.Clock.Advance(TimeSpan.FromMinutes(31));
        var signIn = await f.NewPerson().Redeem(signInToken);
        await AssertLinkNotValid(signIn);

        f.Clock.Advance(TimeSpan.FromDays(7));
        var invitation = await f.NewPerson().Redeem(invitationToken);
        await AssertLinkNotValid(invitation);

        Assert.Equal(await signIn.Content.ReadAsStringAsync(), await invitation.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_invitation_link_is_refused_seven_days_and_a_minute_after_it_was_issued()
    {
        using var f = new RoomsFactory();
        var invitationId = f.SeedInvitation(f.SeedProject());
        var token = await f.InvitationToken(invitationId);

        f.Clock.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));

        await AssertLinkNotValid(await f.NewPerson().Redeem(token));
    }

    [Fact]
    public async Task Links_still_work_inside_their_lifetime()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var invitationId = f.SeedInvitation(f.SeedProject());
        var signInToken = await f.UserToken(ownerId);
        var invitationToken = await f.InvitationToken(invitationId);

        f.Clock.Advance(TimeSpan.FromMinutes(29));
        Assert.Equal(HttpStatusCode.OK, (await f.NewPerson().Redeem(signInToken)).StatusCode);

        f.Clock.Advance(TimeSpan.FromDays(6));
        Assert.Equal(HttpStatusCode.OK, (await f.NewPerson().Redeem(invitationToken)).StatusCode);
    }

    // ---- 3 ----
    [Theory]
    [InlineData("not-a-token")]
    [InlineData("")]
    [InlineData("%%%;DROP TABLE Users;--")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task Unknown_and_garbage_tokens_get_the_same_refusal(string token)
    {
        using var f = new RoomsFactory();
        var person = f.NewPerson();

        var response = await person.Redeem(token);

        await AssertLinkNotValid(response);
        await AssertSignedOut(person);
    }

    [Fact]
    public async Task A_used_link_and_an_unknown_link_are_refused_with_identical_bodies()
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        Assert.Equal(HttpStatusCode.OK, (await f.NewPerson().Redeem(token)).StatusCode);

        var used = await f.NewPerson().Redeem(token);
        var unknown = await f.NewPerson().Redeem("unknown-token");

        await AssertLinkNotValid(used);
        await AssertLinkNotValid(unknown);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await used.Content.ReadAsStringAsync());
    }

    // ---- 4 ----
    [Fact]
    public async Task A_token_is_not_used_up_by_GET_requests()
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        var person = f.NewPerson();

        foreach (var url in new[]
                 {
                     $"/sign-in?t={token}",
                     $"/sign-in?token={token}",
                     $"/auth/redeem?token={token}",
                     $"/auth/redeem?t={token}",
                     $"/auth/me?token={token}",
                 })
        {
            var response = await person.Http.GetAsync(url);
            Assert.DoesNotContain("displayName", await response.Content.ReadAsStringAsync());
            Assert.False(response.Headers.Contains("Set-Cookie"), $"GET {url} must not start a session.");
        }

        await AssertSignedOut(person);
        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(token)).StatusCode);
        await AssertSignedIn(person);
    }

    // ---- 5 ----
    [Theory]
    [InlineData("no-csrf-token")]
    [InlineData("foreign-origin")]
    [InlineData("no-origin")]
    [InlineData("wrong-csrf-token")]
    public async Task A_redeem_POST_without_the_CSRF_proof_is_refused_and_the_link_still_works(string case_)
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        var person = f.NewPerson();

        HttpResponseMessage refused;
        switch (case_)
        {
            case "no-csrf-token":
                refused = await person.Redeem(token, csrf: false);
                break;
            case "foreign-origin":
                refused = await person.Redeem(token, origin: "https://evil.example");
                break;
            case "no-origin":
                refused = await person.Redeem(token, origin: null);
                break;
            default:
                await person.CsrfToken(); // sets the cookie
                var request = new HttpRequestMessage(HttpMethod.Post, "/auth/redeem")
                {
                    Content = JsonContent.Create(new { token }),
                };
                request.Headers.TryAddWithoutValidation("Origin", RoomsFactory.BaseUrl);
                request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", "not-the-issued-token");
                refused = await person.Http.SendAsync(request);
                break;
        }

        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        await AssertSignedOut(person);

        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(token)).StatusCode);
        await AssertSignedIn(person);
    }

    [Fact]
    public async Task A_consultant_POST_without_the_CSRF_proof_is_refused_and_changes_nothing()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var burak = await f.ConsultantSignedIn();
        var owner = await f.SignedIn(ownerId);
        var sessionId = f.WithDb(db => db.UserSessions.Single(s => s.UserId == ownerId).Id);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await burak.Post($"/consultant/sessions/{sessionId}/revoke", csrf: false)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await burak.Post($"/consultant/sessions/{sessionId}/revoke", origin: "https://evil.example")).StatusCode);

        await AssertSignedIn(owner);
    }

    // ---- 6 ----
    [Fact]
    public async Task Signed_out_nothing_is_visible_and_every_consultant_endpoint_answers_401()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var invitationId = f.SeedInvitation(f.SeedProject());
        var owner = await f.SignedIn(ownerId);
        var sessionId = f.WithDb(db => db.UserSessions.Single(s => s.UserId == ownerId).Id);
        var nobody = f.NewPerson();

        await AssertSignedOut(nobody);
        foreach (var endpoint in ConsultantEndpoints(ownerId, sessionId, invitationId))
            Assert.Equal(HttpStatusCode.Unauthorized, (await Call(nobody, endpoint)).StatusCode);

        // Nothing the signed-out calls did reached the owner.
        await AssertSignedIn(owner);
    }

    // ---- 7 ----
    [Fact]
    public async Task A_signed_in_owner_gets_403_from_every_consultant_endpoint()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var otherId = f.SeedOwner("other@example.com", "Other Owner");
        var invitationId = f.SeedInvitation(f.SeedProject());
        var owner = await f.SignedIn(ownerId);
        var burak = await f.ConsultantSignedIn();
        var other = await f.SignedIn(otherId);
        var otherSessionId = f.WithDb(db => db.UserSessions.Single(s => s.UserId == otherId).Id);

        var endpoints = ConsultantEndpoints(otherId, otherSessionId, invitationId)
            .Concat(ConsultantEndpoints(ownerId, otherSessionId, invitationId))
            .Concat(ConsultantEndpoints(f.ConsultantId(), otherSessionId, invitationId));
        foreach (var endpoint in endpoints)
        {
            var response = await Call(owner, endpoint);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.DoesNotContain("sign-in#t=", await response.Content.ReadAsStringAsync());
        }

        // Nothing the refused calls asked for happened.
        await AssertSignedIn(other);
        await AssertSignedIn(burak);
    }

    // ---- 8 ----
    [Fact]
    public async Task Burak_ends_an_owners_session_and_it_stops_at_once()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var burak = await f.ConsultantSignedIn();
        var owner = await f.SignedIn(ownerId, userAgent: "OwnerPhone/2.0");

        var list = await burak.Http.GetAsync($"/consultant/users/{ownerId}/sessions");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var sessions = (await burak.Json(list)).EnumerateArray().ToList();
        var session = Assert.Single(sessions);
        Assert.Contains("OwnerPhone/2.0", session.GetProperty("device").GetString());
        Assert.Equal(JsonValueKind.Null, session.GetProperty("endedAt").ValueKind);
        foreach (var field in new[] { "id", "createdAt", "lastSeenAt", "expiresAt", "ipAddress" })
            Assert.True(session.TryGetProperty(field, out _), $"missing {field}");
        var sessionId = session.GetProperty("id").GetGuid();

        await AssertSignedIn(owner);
        var revoke = await burak.Post($"/consultant/sessions/{sessionId}/revoke");
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        await AssertSignedOut(owner);
        await AssertSignedIn(burak);

        var after = await burak.Json(await burak.Http.GetAsync($"/consultant/users/{ownerId}/sessions"));
        Assert.NotEqual(JsonValueKind.Null, after.EnumerateArray().Single().GetProperty("endedAt").ValueKind);
    }

    // ---- 9 ----
    [Fact]
    public async Task Sign_out_ends_the_session_even_if_the_cookie_is_replayed()
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        var person = f.NewPerson();
        var redeem = await person.Redeem(token);
        Assert.Equal(HttpStatusCode.OK, redeem.StatusCode);
        var cookie = string.Join("; ", redeem.Headers.GetValues("Set-Cookie").Select(c => c.Split(';')[0]));

        var replay = f.NewPerson();
        replay.Http.DefaultRequestHeaders.Add("Cookie", cookie);
        await AssertSignedIn(replay); // the hand-made cookie is the real one

        var signOut = await person.Post("/auth/sign-out");
        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);

        await AssertSignedOut(person);
        await AssertSignedOut(replay);
    }

    // ---- 10 ----
    [Fact]
    public async Task An_invitation_link_creates_the_person_and_exactly_one_membership()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var otherProjectId = f.SeedProject("Another project");
        var invitationId = f.SeedInvitation(projectId, "Ayse@Example.com", "Ayse Demir");
        var token = await f.InvitationToken(invitationId);
        var person = f.NewPerson();

        var response = await person.Redeem(token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await person.Json(await person.Me());
        Assert.Equal("Ayse Demir", me.GetProperty("displayName").GetString());
        Assert.False(me.GetProperty("isConsultant").GetBoolean());
        var userId = me.GetProperty("id").GetGuid();
        var memberships = f.WithDb(db => db.ProjectMembers.Where(m => m.UserId == userId).ToList());
        var membership = Assert.Single(memberships);
        Assert.Equal(projectId, membership.ProjectId);
        Assert.NotEqual(otherProjectId, membership.ProjectId);
        Assert.Equal(MemberRole.Owner, membership.Role);
        Assert.Equal("ayse@example.com", f.WithDb(db => db.Users.Single(u => u.Id == userId).Email));
    }

    [Fact]
    public async Task An_invitation_for_an_existing_email_uses_that_person()
    {
        using var f = new RoomsFactory();
        var existingId = f.SeedOwner("known@example.com", "Known Owner");
        var projectId = f.SeedProject();
        var invitationId = f.SeedInvitation(projectId, "known@example.com", "Known Owner");
        var person = f.NewPerson();

        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(await f.InvitationToken(invitationId))).StatusCode);

        var me = await person.Json(await person.Me());
        Assert.Equal(existingId, me.GetProperty("id").GetGuid());
        Assert.Equal(1, f.WithDb(db => db.Users.Count(u => u.Email == "known@example.com")));
        Assert.Equal(1, f.WithDb(db => db.ProjectMembers.Count(m => m.UserId == existingId && m.ProjectId == projectId)));
    }

    [Fact]
    public async Task A_forwarded_invitation_link_is_refused_after_the_invitation_was_accepted()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var invitationId = f.SeedInvitation(projectId);
        var token = await f.InvitationToken(invitationId);
        var invited = f.NewPerson();
        var stranger = f.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await invited.Redeem(token)).StatusCode);

        await AssertLinkNotValid(await stranger.Redeem(token));
        // A second link for an already accepted invitation is no way in either.
        await AssertLinkNotValid(await stranger.Redeem(await f.InvitationToken(invitationId)));

        await AssertSignedOut(stranger);
        Assert.Equal(1, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == projectId)));
    }

    [Fact]
    public async Task A_forwarded_invitation_link_is_refused_after_the_invitation_was_revoked()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var invitationId = f.SeedInvitation(projectId);
        var token = await f.InvitationToken(invitationId);
        f.Change(invitationId, i => i.RevokedAt = f.Now);
        var stranger = f.NewPerson();

        await AssertLinkNotValid(await stranger.Redeem(token));

        await AssertSignedOut(stranger);
        Assert.Equal(0, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == projectId)));
        Assert.Equal(0, f.WithDb(db => db.Users.Count(u => u.Email == "invited@example.com")));
    }

    // Burak's invitation-link endpoint.
    [Fact]
    public async Task Burak_can_copy_a_link_for_an_open_invitation_and_it_works_once()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var invitationId = f.SeedInvitation(projectId);
        var burak = await f.ConsultantSignedIn();

        var response = await burak.Post($"/consultant/invitations/{invitationId}/link");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var link = (await burak.Json(response)).GetProperty("link").GetString()!;
        var token = RoomsFactory.TokenOf(link);
        Assert.Equal(HttpStatusCode.OK, (await f.NewPerson().Redeem(token)).StatusCode);
        await AssertLinkNotValid(await f.NewPerson().Redeem(token));
        Assert.Equal(1, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == projectId)));
    }

    [Theory]
    [InlineData("revoked")]
    [InlineData("expired")]
    [InlineData("accepted")]
    public async Task Burak_gets_409_for_the_link_of_an_invitation_that_is_no_longer_open(string state)
    {
        using var f = new RoomsFactory();
        var invitationId = f.SeedInvitation(f.SeedProject());
        var burak = await f.ConsultantSignedIn();
        switch (state)
        {
            case "revoked": f.Change(invitationId, i => i.RevokedAt = f.Now); break;
            case "expired": f.Clock.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1)); break;
            default:
                var ownerId = f.SeedOwner("someone@example.com");
                f.Change(invitationId, i => { i.AcceptedAt = f.Now; i.AcceptedUserId = ownerId; });
                break;
        }

        var response = await burak.Post($"/consultant/invitations/{invitationId}/link");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    // ---- 11 ----
    [Fact]
    public async Task A_link_copied_by_Burak_works_once()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var burak = await f.ConsultantSignedIn();

        var response = await burak.Post($"/consultant/users/{ownerId}/sign-in-link");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var link = (await burak.Json(response)).GetProperty("link").GetString()!;
        Assert.StartsWith("https://rooms.test/sign-in#t=", link);
        var token = RoomsFactory.TokenOf(link);

        var owner = f.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await owner.Redeem(token)).StatusCode);
        var me = await owner.Json(await owner.Me());
        Assert.Equal(ownerId, me.GetProperty("id").GetGuid());
        await AssertLinkNotValid(await f.NewPerson().Redeem(token));
    }

    // ---- 12 ----
    [Fact]
    public async Task A_user_who_stops_being_the_consultant_is_refused_at_once()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var burak = await f.ConsultantSignedIn();
        var burakId = f.ConsultantId();
        Assert.Equal(HttpStatusCode.OK, (await burak.Http.GetAsync($"/consultant/users/{ownerId}/sessions")).StatusCode);

        // The configured consultant moves to someone else.
        var changed = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Consultant:Email"] = "new-consultant@rooms.test" })
            .Build();
        f.WithDb(db =>
        {
            DatabaseSetup.SyncConsultant(db, changed, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
            return 0;
        });

        var response = await burak.Http.GetAsync($"/consultant/users/{ownerId}/sessions");
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
        var revoke = await burak.Post($"/consultant/users/{ownerId}/sign-in-link");
        Assert.Contains(revoke.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
        Assert.False(f.WithDb(db => db.Users.Single(u => u.Id == burakId).IsConsultant));
    }

    // ---- 13 ----
    [Fact]
    public async Task A_session_ends_thirty_days_after_sign_in()
    {
        using var f = new RoomsFactory();
        var owner = await f.SignedIn(f.SeedOwner());

        f.Clock.Advance(TimeSpan.FromDays(30) + TimeSpan.FromMinutes(1));

        await AssertSignedOut(owner);
    }
}
