using System.Net;
using System.Text.Json;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.Extensions.DependencyInjection;
using static IdeaDiscovery.Api.Tests.ProjectsTestSupport;

namespace IdeaDiscovery.Api.Tests;

// What the A15 project tests do not cover: input rules, what creation sets up,
// what removal revokes, the audit trail, and that every project route goes
// through the one access check.
public class ProjectsTests
{
    private static object Body(string? titleEn = "Title", string? titleTr = "Baslik",
        string? introEn = "Intro", string? introTr = "Giris") =>
        new { titleEn, titleTr, introEn, introTr };

    private static List<AuditEvent> Audit(RoomsFactory f, string action) =>
        f.WithDb(db => db.AuditEvents.Where(a => a.Action == action).ToList());

    // ---- Create ----

    [Fact]
    public async Task Creating_a_project_trims_the_text_adds_Burak_as_consultant_and_opens_Conversation_1()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();

        var response = await burak.Post("/consultant/projects", Body("  Warehouse  ", " Depo ", "  Line one\nLine two ", " Giris "));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await burak.Json(response);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal("Warehouse", json.GetProperty("titleEn").GetString());
        Assert.Equal("Depo", json.GetProperty("titleTr").GetString());
        Assert.Equal("Line one\nLine two", json.GetProperty("introEn").GetString());
        Assert.Equal("Giris", json.GetProperty("introTr").GetString());

        var (members, conversations) = f.WithDb(db => (
            db.ProjectMembers.Where(m => m.ProjectId == id).ToList(),
            db.Conversations.Where(c => c.ProjectId == id).ToList()));
        var member = Assert.Single(members);
        Assert.Equal(f.ConsultantId(), member.UserId);
        Assert.Equal(MemberRole.Consultant, member.Role);
        var conversation = Assert.Single(conversations);
        Assert.Equal(1, conversation.Number);
        Assert.Equal(ConversationState.Active, conversation.State);
        Assert.Equal(f.ConsultantId(), conversation.StartedById);
        Assert.Null(conversation.FinishedAt);
        Assert.Equal(f.WithDb(db => db.Projects.Single(p => p.Id == id).CreatedById), f.ConsultantId());
    }

    [Fact]
    public async Task Each_new_project_gets_its_own_Conversation_1()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");

        var all = f.WithDb(db => db.Conversations.ToList());
        Assert.Equal(2, all.Count);
        Assert.All(all, c => Assert.Equal(1, c.Number));
        Assert.Equal(new[] { a, b }.Order(), all.Select(c => c.ProjectId).Order());
    }

    public static IEnumerable<object?[]> BadCreateBodies()
    {
        var tooLongTitle = new string('t', 121);
        var tooLongIntro = new string('i', 2001);
        yield return ["titleEn missing", Body(titleEn: null)];
        yield return ["titleTr missing", Body(titleTr: null)];
        yield return ["introEn missing", Body(introEn: null)];
        yield return ["introTr missing", Body(introTr: null)];
        yield return ["titleEn blank", Body(titleEn: "   ")];
        yield return ["titleTr empty", Body(titleTr: "")];
        yield return ["introEn blank", Body(introEn: " \n ")];
        yield return ["introTr empty", Body(introTr: "")];
        yield return ["titleEn too long", Body(titleEn: tooLongTitle)];
        yield return ["titleTr too long", Body(titleTr: tooLongTitle)];
        yield return ["introEn too long", Body(introEn: tooLongIntro)];
        yield return ["introTr too long", Body(introTr: tooLongIntro)];
        yield return ["titleEn line break", Body(titleEn: "One\nTwo")];
        yield return ["titleTr tab", Body(titleTr: "One\tTwo")];
        yield return ["introEn NUL", Body(introEn: "One\0Two")];
        yield return ["introTr tab", Body(introTr: "One\tTwo")];
        yield return ["introEn escape", Body(introEn: "One\u001bTwo")];
        yield return ["no body", null];
    }

    [Theory]
    [MemberData(nameof(BadCreateBodies))]
    public async Task A_bad_create_is_400_and_creates_and_audits_nothing(string why, object? body)
    {
        _ = why;
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();

        var response = await burak.Post("/consultant/projects", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, f.WithDb(db => db.Projects.Count() + db.ProjectMembers.Count() + db.Conversations.Count()));
        Assert.Empty(Audit(f, "project_created"));
    }

    [Fact]
    public async Task The_longest_allowed_texts_are_accepted_and_the_intro_may_hold_line_breaks()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var intro = new string('i', 1000) + "\r\n" + new string('j', 998);
        Assert.Equal(2000, intro.Length);

        var response = await burak.Post("/consultant/projects", Body(new string('t', 120), new string('u', 120), intro, intro));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    // ---- Edit ----

    [Fact]
    public async Task Editing_replaces_the_four_texts_and_nothing_else_and_is_audited_without_the_text()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var id = await burak.CreateProject("Before");
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(id, ownerId);
        var before = f.WithDb(db => db.Projects.Single(p => p.Id == id));

        var response = await burak.Put($"/consultant/projects/{id}", Body(" After title ", "Sonra", "After intro secret-words", "Sonra giris"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var after = f.WithDb(db => db.Projects.Single(p => p.Id == id));
        Assert.Equal("After title", after.TitleEn);
        Assert.Equal("Sonra", after.TitleTr);
        Assert.Equal("After intro secret-words", after.IntroEn);
        Assert.Equal("Sonra giris", after.IntroTr);
        Assert.Equal(before.CreatedAt, after.CreatedAt);
        Assert.Equal(before.CreatedById, after.CreatedById);
        Assert.Equal(before.Status, after.Status);
        Assert.Equal(2, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == id)));
        Assert.Equal(1, f.WithDb(db => db.Conversations.Count(c => c.ProjectId == id)));

        var audit = Assert.Single(Audit(f, "project_edited"));
        Assert.Equal(f.ConsultantId(), audit.ActorUserId);
        Assert.Equal(id, audit.ProjectId);
        Assert.Null(audit.Details);
    }

    [Theory]
    [InlineData("titleEn")]
    [InlineData("titleTr")]
    [InlineData("introEn")]
    [InlineData("introTr")]
    public async Task A_bad_edit_is_400_and_changes_and_audits_nothing(string field)
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var id = await burak.CreateProject("Original");
        var body = new Dictionary<string, string?>
        {
            ["titleEn"] = "T", ["titleTr"] = "T", ["introEn"] = "I", ["introTr"] = "I",
        };
        body[field] = "  ";

        var response = await burak.Put($"/consultant/projects/{id}", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Original", (await burak.ProjectJson(id)).GetProperty("titleEn").GetString());
        Assert.Empty(Audit(f, "project_edited"));
    }

    [Fact]
    public async Task An_edit_with_a_control_character_or_a_too_long_text_is_400()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var id = await burak.CreateProject("Original");

        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Put($"/consultant/projects/{id}", Body(titleEn: "A\nB"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Put($"/consultant/projects/{id}", Body(introTr: new string('x', 2001)))).StatusCode);
        Assert.Equal("Original", (await burak.ProjectJson(id)).GetProperty("titleEn").GetString());
    }

    // ---- Remove ----

    [Fact]
    public async Task Removing_a_member_revokes_their_invitations_and_unused_tokens_for_that_project_only()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");
        var removedId = f.SeedOwner("Removed@Example.com", "Removed Owner");
        var otherId = f.SeedOwner("other@example.com", "Other Owner");
        f.AddOwnerMember(a, removedId);
        f.AddOwnerMember(a, otherId);
        f.AddOwnerMember(b, removedId);
        var removed = await f.SignedIn(removedId);

        var byEmail = f.SeedInvitation(a, "removed@example.com", "Removed Owner");
        var byAccount = f.SeedInvitation(a, "old-address@example.com", "Removed Owner");
        f.Change(byAccount, i => { i.AcceptedAt = f.Now; i.AcceptedUserId = removedId; });
        var otherPerson = f.SeedInvitation(a, "someone.else@example.com", "Someone Else");
        var otherProject = f.SeedInvitation(b, "removed@example.com", "Removed Owner");
        var emailToken = await f.InvitationToken(byEmail);
        var otherProjectToken = await f.InvitationToken(otherProject);
        var otherPersonToken = await f.InvitationToken(otherPerson);

        var response = await burak.Post($"/consultant/projects/{a}/members/{removedId}/remove");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var (invitations, tokens, sessions, members) = f.WithDb(db => (
            db.Invitations.ToDictionary(i => i.Id),
            db.SignInTokens.Where(t => t.InvitationId != null).ToList(),
            db.UserSessions.Where(s => s.UserId == removedId).ToList(),
            db.ProjectMembers.Where(m => m.UserId == removedId).Select(m => m.ProjectId).ToList()));
        Assert.NotNull(invitations[byEmail].RevokedAt);
        // An accepted invitation is not open: removal leaves it as it was.
        Assert.Null(invitations[byAccount].RevokedAt);
        Assert.Null(invitations[otherPerson].RevokedAt);
        Assert.Null(invitations[otherProject].RevokedAt);
        Assert.All(tokens.Where(t => t.InvitationId == byEmail), t => Assert.NotNull(t.RevokedAt));
        Assert.All(tokens.Where(t => t.InvitationId == otherProject || t.InvitationId == otherPerson),
            t => Assert.Null(t.RevokedAt));
        Assert.Equal(3, tokens.Count);
        // Sessions end everywhere; membership of the other project stays.
        Assert.All(sessions, s => Assert.NotNull(s.RevokedAt));
        Assert.Equal([b], members);
        Assert.False(string.IsNullOrEmpty(emailToken + otherProjectToken + otherPersonToken));
        Assert.Equal(HttpStatusCode.Unauthorized, (await removed.Me()).StatusCode);
    }

    [Fact]
    public async Task A_removed_members_unused_invitation_link_no_longer_signs_anyone_in()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var removedId = f.SeedOwner("removed@example.com", "Removed Owner");
        f.AddOwnerMember(a, removedId);
        var invitation = f.SeedInvitation(a, "removed@example.com", "Removed Owner");
        var token = await f.InvitationToken(invitation);

        await burak.Post($"/consultant/projects/{a}/members/{removedId}/remove");

        var visitor = f.NewPerson();
        Assert.NotEqual(HttpStatusCode.OK, (await visitor.Redeem(token)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.Me()).StatusCode);
    }

    [Fact]
    public async Task A_sign_in_link_issued_before_the_removal_no_longer_signs_the_person_in()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var removedId = f.SeedOwner("removed@example.com", "Removed Owner");
        var stayingId = f.SeedOwner("staying@example.com", "Staying Owner");
        f.AddOwnerMember(a, removedId);
        var link = await f.UserToken(removedId);
        var stayingLink = await f.UserToken(stayingId);

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/projects/{a}/members/{removedId}/remove")).StatusCode);

        var visitor = f.NewPerson();
        Assert.NotEqual(HttpStatusCode.OK, (await visitor.Redeem(link)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.Me()).StatusCode);
        // Someone else's link is untouched.
        Assert.Equal(HttpStatusCode.OK, (await f.NewPerson().Redeem(stayingLink)).StatusCode);
    }

    [Fact]
    public async Task A_member_without_an_email_is_removed_without_touching_other_invitations()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var joinerId = f.WithDb(db =>
        {
            var user = new User { Id = Guid.NewGuid(), Email = null, DisplayName = "Joined By Asking", CreatedAt = f.Now };
            db.Users.Add(user);
            db.SaveChanges();
            return user.Id;
        });
        f.AddOwnerMember(a, joinerId);
        var unrelated = f.SeedInvitation(a, "someone@example.com", "Someone");

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/projects/{a}/members/{joinerId}/remove")).StatusCode);

        Assert.Null(f.WithDb(db => db.Invitations.Single(i => i.Id == unrelated).RevokedAt));
        Assert.DoesNotContain(joinerId, (await burak.ProjectJson(a)).GetProperty("members").EnumerateArray()
            .Select(m => m.GetProperty("userId").GetGuid()));
    }

    [Fact]
    public async Task Removing_is_audited_with_only_the_removed_users_id()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var removedId = f.SeedOwner("removed@example.com", "Removed Owner");
        f.AddOwnerMember(a, removedId);

        await burak.Post($"/consultant/projects/{a}/members/{removedId}/remove");

        var audit = Assert.Single(Audit(f, "member_removed"));
        Assert.Equal(f.ConsultantId(), audit.ActorUserId);
        Assert.Equal(a, audit.ProjectId);
        Assert.Equal($"user:{removedId}", audit.Details);
        Assert.DoesNotContain("removed@example.com", audit.Details);
        Assert.DoesNotContain("Removed Owner", audit.Details);
    }

    [Fact]
    public async Task Refused_removals_write_no_audit_row_and_change_nothing()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");

        Assert.Equal(HttpStatusCode.Conflict, (await burak.Post($"/consultant/projects/{a}/members/{f.ConsultantId()}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{a}/members/{Guid.NewGuid()}/remove")).StatusCode);

        Assert.Empty(Audit(f, "member_removed"));
        Assert.Equal(1, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == a)));
        Assert.Equal(HttpStatusCode.OK, (await burak.Me()).StatusCode);
    }

    [Fact]
    public async Task Naming_Burak_without_a_membership_row_is_404_and_his_session_survives()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        f.WithDb(db => { db.ProjectMembers.RemoveRange(db.ProjectMembers.Where(m => m.ProjectId == a)); db.SaveChanges(); return 0; });

        // No row, so nothing to remove: 404, and nothing of his is touched.
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{a}/members/{f.ConsultantId()}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await burak.Me()).StatusCode);
    }

    // ---- Burak's access comes from the flag, not a row; a role gives no powers ----

    [Fact]
    public async Task Burak_lists_and_opens_every_project_without_a_membership_row()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var seeded = f.SeedProject("Seeded, no members");
        var made = await burak.CreateProject("Made");

        Assert.Equal(new[] { seeded, made }.Order(), (await burak.ListedProjectIds()).Order());
        Assert.Equal(HttpStatusCode.OK, (await burak.GetProject(seeded)).Status);
    }

    [Fact]
    public async Task A_person_with_a_consultant_role_row_but_no_consultant_flag_gets_no_consultant_powers()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");
        var impostorId = f.SeedOwner("impostor@example.com", "Impostor");
        f.WithDb(db =>
        {
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(), ProjectId = a, UserId = impostorId, Role = MemberRole.Consultant, JoinedAt = f.Now,
            });
            db.SaveChanges();
            return 0;
        });
        var impostor = await f.SignedIn(impostorId);

        Assert.Equal(HttpStatusCode.Forbidden, (await impostor.Put($"/consultant/projects/{a}", Body())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await impostor.Post("/consultant/projects", Body())).StatusCode);
        Assert.Equal([a], await impostor.ListedProjectIds());
        Assert.Equal(HttpStatusCode.NotFound, (await impostor.GetProject(b)).Status);
        Assert.DoesNotContain("email", (await impostor.GetProject(a)).Body, StringComparison.OrdinalIgnoreCase);
    }

    // ---- Every project route goes through the access check ----

    // Finds every route that names a project, so a route added later is
    // covered without editing this test. An owner of A must be refused (403
    // for Burak's routes, 404 for the rest) with B's id, and nothing changes.
    [Fact]
    public async Task An_owner_of_A_is_refused_on_every_route_that_names_a_project_when_it_is_B()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");
        var ownerAId = f.SeedOwner("a@example.com", "Owner A");
        var ownerBId = f.SeedOwner("b@example.com", "Owner B");
        f.AddOwnerMember(a, ownerAId);
        f.AddOwnerMember(b, ownerBId);
        var ownerA = await f.SignedIn(ownerAId);
        var ownerB = await f.SignedIn(ownerBId);
        var routes = ProjectRoutes(f);
        Assert.True(routes.Count >= 5, "The route scan found too few project routes.");
        var before = Snapshot(f);

        foreach (var (method, pattern) in routes)
        {
            var url = Fill(pattern, b, ownerBId);
            var response = await Send(ownerA, method, url);
            var expected = pattern.StartsWith("/consultant") ? HttpStatusCode.Forbidden : HttpStatusCode.NotFound;
            Assert.True(response.StatusCode == expected, $"{method} {pattern} gave {(int)response.StatusCode} for another project.");
            Assert.DoesNotContain("B", await response.Content.ReadAsStringAsync());
        }

        Assert.Equal(before, Snapshot(f));
        Assert.Equal(HttpStatusCode.OK, (await ownerB.Me()).StatusCode);
    }

    // Burak asking about a project that does not exist gets 404 on every
    // route: the same check runs for him, so a skipped check would show here.
    [Fact]
    public async Task Burak_gets_404_on_every_route_that_names_a_project_when_it_does_not_exist()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        await burak.CreateProject("A");
        var before = Snapshot(f);

        foreach (var (method, pattern) in ProjectRoutes(f))
        {
            var response = await Send(burak, method, Fill(pattern, Guid.NewGuid(), Guid.NewGuid()));
            Assert.True(response.StatusCode == HttpStatusCode.NotFound, $"{method} {pattern} gave {(int)response.StatusCode} for an unknown project.");
        }

        Assert.Equal(before, Snapshot(f));
    }

    // Signed out, every route that names a project is 401.
    [Fact]
    public async Task Signed_out_every_route_that_names_a_project_is_401()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var nobody = f.NewPerson();

        foreach (var (method, pattern) in ProjectRoutes(f))
        {
            var response = await Send(nobody, method, Fill(pattern, a, Guid.NewGuid()));
            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{method} {pattern} gave {(int)response.StatusCode} signed out.");
        }
    }

    // ---- No GET changes anything ----

    [Fact]
    public async Task No_GET_route_changes_any_table_even_with_real_ids()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(a, ownerId);
        var owner = await f.SignedIn(ownerId);
        var nobody = f.NewPerson();
        var routes = f.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("GET") == true)
            .Select(e => e.RoutePattern.RawText!).ToList();
        Assert.Contains("/projects", routes);
        Assert.Contains("/projects/{projectId:guid}", routes);
        var before = Snapshot(f);

        foreach (var route in routes)
        {
            var url = Fill(route, a, ownerId);
            foreach (var person in new[] { burak, owner, nobody })
                await person.Http.GetAsync(url);
        }

        Assert.Equal(before, Snapshot(f));
    }

    // ---- No new anonymous routes ----

    [Fact]
    public void The_project_and_language_routes_are_not_open_to_anonymous_requests()
    {
        using var f = new RoomsFactory();
        var open = f.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(e => e.RoutePattern.RawText!)
            .Where(r => r.StartsWith("/projects") || r.StartsWith("/me") || r.StartsWith("/consultant"))
            .ToList();
        var known = f.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>().Select(e => e.RoutePattern.RawText!).ToList();
        Assert.Contains("/me/language", known);
        Assert.Contains("/consultant/projects", known);

        Assert.Empty(open);
    }

    // ---- Helpers ----

    private static List<(string Method, string Pattern)> ProjectRoutes(RoomsFactory f) =>
        f.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText!.Contains("{projectId"))
            .SelectMany(e => e.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods
                .Select(m => (m, e.RoutePattern.RawText!)))
            .Where(r => !r.Item2.StartsWith("/join"))
            .ToList();

    private static string Fill(string pattern, Guid projectId, Guid otherId)
    {
        var url = System.Text.RegularExpressions.Regex.Replace(pattern, @"\{projectId[^}]*\}", projectId.ToString());
        return System.Text.RegularExpressions.Regex.Replace(url, @"\{[^}]+\}", otherId.ToString());
    }

    private static Task<HttpResponseMessage> Send(Person person, string method, string url) => method switch
    {
        "GET" => person.Http.GetAsync(url),
        "POST" => person.Post(url, url == "/projects" ? null : Body()),
        "PUT" => person.Put(url, Body()),
        _ => throw new InvalidOperationException($"{method} {url}: add this method to the project route tests."),
    };

    private static string Snapshot(RoomsFactory f) => f.WithDb(db => string.Join("\n",
        JsonSerializer.Serialize(db.Users.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Projects.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.ProjectMembers.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Invitations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.SignInTokens.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.UserSessions.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Conversations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Messages.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.JoinRequests.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.AuditEvents.OrderBy(x => x.Id).ToList())));
}
