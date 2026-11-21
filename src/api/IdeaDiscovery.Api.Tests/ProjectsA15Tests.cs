using System.Net;
using System.Text.Json;
using static IdeaDiscovery.Api.Tests.ProjectsTestSupport;

namespace IdeaDiscovery.Api.Tests;

// PRD A15 "Secure sharing", for project access: a person who is not authorised
// for a project cannot see or change it. Decided meaning (docs/decisions.md,
// 2026-11-21, "Projects and members (M1 PR 5)"): non-members get the same 404
// as for a project that does not exist; owners get 403 on every consultant
// endpoint; removing a member ends their sessions at once.
public class ProjectsA15Tests
{
    private static async Task AssertSignedOut(Person person) =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Me()).StatusCode);

    private static async Task AssertSignedIn(Person person) =>
        Assert.Equal(HttpStatusCode.OK, (await person.Me()).StatusCode);

    private static async Task<string?> UiLanguage(Person person) =>
        (await person.Json(await person.Me())).GetProperty("uiLanguage").GetString();

    private static bool HasMember(JsonElement project, Guid userId) =>
        project.GetProperty("members").EnumerateArray().Any(m => m.GetProperty("userId").GetGuid() == userId);

    private static bool ContainsProperty(JsonElement element, string name) => element.ValueKind switch
    {
        JsonValueKind.Object => element.EnumerateObject().Any(p =>
            string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase) || ContainsProperty(p.Value, name)),
        JsonValueKind.Array => element.EnumerateArray().Any(e => ContainsProperty(e, name)),
        _ => false,
    };

    // ---- 1 ----
    [Fact]
    public async Task An_owner_of_A_lists_only_A_and_gets_the_same_404_for_B_as_for_a_random_id()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Project A");
        var b = await burak.CreateProject("Project B");
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(a, ownerId);
        var owner = await f.SignedIn(ownerId);

        Assert.Equal([a], await owner.ListedProjectIds());
        Assert.Equal(HttpStatusCode.OK, (await owner.GetProject(a)).Status);

        var forB = await owner.GetProject(b);
        var forRandom = await owner.GetProject(Guid.NewGuid());
        Assert.Equal(HttpStatusCode.NotFound, forB.Status);
        Assert.Equal(forRandom.Status, forB.Status);
        Assert.Equal(forRandom.Body, forB.Body);
        Assert.DoesNotContain("Project B", forB.Body);
    }

    // ---- 2 ----
    [Fact]
    public async Task A_signed_in_person_with_no_membership_lists_nothing_and_gets_404_for_every_project()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Project A");
        var b = await burak.CreateProject("Project B");
        var stranger = await f.SignedIn(f.SeedOwner("stranger@example.com", "Stranger"));

        Assert.Empty(await stranger.ListedProjectIds());
        var unknown = await stranger.GetProject(Guid.NewGuid());
        foreach (var id in new[] { a, b })
        {
            var result = await stranger.GetProject(id);
            Assert.Equal(HttpStatusCode.NotFound, result.Status);
            Assert.Equal(unknown.Body, result.Body);
        }
    }

    // ---- 3 ----
    [Fact]
    public async Task Signed_out_the_project_endpoints_and_the_language_endpoint_answer_401()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject();
        var nobody = f.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Http.GetAsync("/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Http.GetAsync($"/projects/{a}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Http.GetAsync($"/projects/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Put("/me/language", new { language = "tr" })).StatusCode);
    }

    [Fact]
    public async Task Signed_out_every_consultant_project_endpoint_answers_401_and_changes_nothing()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Original");
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(a, ownerId);
        var nobody = f.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Post("/consultant/projects", ProjectBody("New"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Put($"/consultant/projects/{a}", ProjectBody("Changed"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Post($"/consultant/projects/{a}/members/{ownerId}/remove")).StatusCode);

        Assert.Equal([a], await burak.ListedProjectIds());
        var project = await burak.ProjectJson(a);
        Assert.Equal("Original", project.GetProperty("titleEn").GetString());
        Assert.True(HasMember(project, ownerId));
    }

    // ---- 4 ----
    [Fact]
    public async Task A_removed_owner_is_signed_out_at_once_and_after_signing_in_again_sees_nothing()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject();
        var removedId = f.SeedOwner("removed@example.com", "Removed Owner");
        var stayingId = f.SeedOwner("staying@example.com", "Staying Owner");
        f.AddOwnerMember(a, removedId);
        f.AddOwnerMember(a, stayingId);
        var removed = await f.SignedIn(removedId);
        var staying = await f.SignedIn(stayingId);
        Assert.Equal(HttpStatusCode.OK, (await removed.GetProject(a)).Status);

        var response = await burak.Post($"/consultant/projects/{a}/members/{removedId}/remove");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await AssertSignedOut(removed);
        Assert.Equal(HttpStatusCode.Unauthorized, (await removed.Http.GetAsync($"/projects/{a}")).StatusCode);

        var again = await f.SignedIn(removedId);
        Assert.Empty(await again.ListedProjectIds());
        var unknown = await again.GetProject(Guid.NewGuid());
        var result = await again.GetProject(a);
        Assert.Equal(HttpStatusCode.NotFound, result.Status);
        Assert.Equal(unknown.Body, result.Body);

        // The others are untouched.
        await AssertSignedIn(staying);
        await AssertSignedIn(burak);
        Assert.Equal([a], await staying.ListedProjectIds());
        var project = await staying.ProjectJson(a);
        Assert.True(HasMember(project, stayingId));
        Assert.False(HasMember(project, removedId));
        Assert.True(HasMember(await burak.ProjectJson(a), f.ConsultantId()));
    }

    [Fact]
    public async Task Removing_someone_who_is_not_a_member_or_in_an_unknown_project_is_404_and_ends_no_session()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Project A");
        var b = await burak.CreateProject("Project B");
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(a, ownerId);
        var owner = await f.SignedIn(ownerId);

        // A member of A, named in B; an unknown project; an unknown user.
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{b}/members/{ownerId}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{Guid.NewGuid()}/members/{ownerId}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{a}/members/{Guid.NewGuid()}/remove")).StatusCode);

        await AssertSignedIn(owner);
        Assert.Equal([a], await owner.ListedProjectIds());
    }

    // ---- 5 ----
    [Fact]
    public async Task An_owner_gets_403_from_create_edit_and_remove_and_nothing_changes()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Original");
        var ownerId = f.SeedOwner();
        var otherId = f.SeedOwner("other@example.com", "Other Owner");
        f.AddOwnerMember(a, ownerId);
        f.AddOwnerMember(a, otherId);
        var owner = await f.SignedIn(ownerId);
        var other = await f.SignedIn(otherId);

        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Post("/consultant/projects", ProjectBody("Mine"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Put($"/consultant/projects/{a}", ProjectBody("Changed"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Post($"/consultant/projects/{a}/members/{otherId}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Post($"/consultant/projects/{a}/members/{ownerId}/remove")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Post($"/consultant/projects/{a}/members/{f.ConsultantId()}/remove")).StatusCode);

        await AssertSignedIn(owner);
        await AssertSignedIn(other);
        await AssertSignedIn(burak);
        Assert.Equal([a], await burak.ListedProjectIds());
        var project = await burak.ProjectJson(a);
        Assert.Equal("Original", project.GetProperty("titleEn").GetString());
        Assert.True(HasMember(project, ownerId));
        Assert.True(HasMember(project, otherId));
        Assert.True(HasMember(project, f.ConsultantId()));
    }

    [Fact]
    public async Task An_owner_gets_403_even_for_unknown_ids_so_consultant_endpoints_reveal_nothing()
    {
        using var f = new RoomsFactory();
        var owner = await f.SignedIn(f.SeedOwner());

        Assert.Equal(HttpStatusCode.Forbidden,
            (await owner.Put($"/consultant/projects/{Guid.NewGuid()}", ProjectBody())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await owner.Post($"/consultant/projects/{Guid.NewGuid()}/members/{Guid.NewGuid()}/remove")).StatusCode);
    }

    // ---- 6 ----
    [Fact]
    public async Task An_owners_view_has_no_email_anywhere_and_Buraks_view_has_the_emails()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject();
        var ownerId = f.SeedOwner("owner.one@example.com", "Owner One");
        var otherId = f.SeedOwner("owner.two@example.com", "Owner Two");
        f.AddOwnerMember(a, ownerId);
        f.AddOwnerMember(a, otherId);
        var owner = await f.SignedIn(ownerId);

        var ownerResult = await owner.GetProject(a);
        Assert.Equal(HttpStatusCode.OK, ownerResult.Status);
        using (var doc = JsonDocument.Parse(ownerResult.Body))
        {
            Assert.False(ContainsProperty(doc.RootElement, "email"));
            Assert.Equal(3, doc.RootElement.GetProperty("members").GetArrayLength());
            Assert.True(HasMember(doc.RootElement, otherId));
        }
        Assert.DoesNotContain("owner.one@example.com", ownerResult.Body);
        Assert.DoesNotContain("owner.two@example.com", ownerResult.Body);
        Assert.DoesNotContain(RoomsFactory.ConsultantEmail, ownerResult.Body);

        var burakView = await burak.ProjectJson(a);
        var emails = burakView.GetProperty("members").EnumerateArray()
            .ToDictionary(m => m.GetProperty("userId").GetGuid(), m => m.GetProperty("email").GetString());
        Assert.Equal("owner.one@example.com", emails[ownerId]);
        Assert.Equal("owner.two@example.com", emails[otherId]);
        Assert.Equal(RoomsFactory.ConsultantEmail, emails[f.ConsultantId()]);

        // The project list never carries emails either.
        var listBody = await (await owner.Http.GetAsync("/projects")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", listBody);
    }

    // ---- 7 ----
    [Fact]
    public async Task Removing_Burak_is_409_and_he_is_still_a_member_and_still_signed_in()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject();
        var ownerId = f.SeedOwner();
        f.AddOwnerMember(a, ownerId);
        var owner = await f.SignedIn(ownerId);

        var response = await burak.Post($"/consultant/projects/{a}/members/{f.ConsultantId()}/remove");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertSignedIn(burak);
        await AssertSignedIn(owner);
        var members = (await owner.ProjectJson(a)).GetProperty("members").EnumerateArray().ToList();
        var consultant = Assert.Single(members, m => m.GetProperty("userId").GetGuid() == f.ConsultantId());
        Assert.Equal("consultant", consultant.GetProperty("role").GetString(), ignoreCase: true);
        Assert.Equal(2, members.Count);
    }

    // ---- 8 ----
    [Fact]
    public async Task An_owner_of_A_cannot_edit_or_remove_anything_in_B_and_Burak_editing_B_leaves_A_unchanged()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Project A");
        var b = await burak.CreateProject("Project B");
        var ownerAId = f.SeedOwner("a@example.com", "Owner A");
        var ownerBId = f.SeedOwner("b@example.com", "Owner B");
        f.AddOwnerMember(a, ownerAId);
        f.AddOwnerMember(b, ownerBId);
        var ownerA = await f.SignedIn(ownerAId);
        var ownerB = await f.SignedIn(ownerBId);

        Assert.Equal(HttpStatusCode.Forbidden, (await ownerA.Put($"/consultant/projects/{b}", ProjectBody("Hijacked"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ownerA.Post($"/consultant/projects/{b}/members/{ownerBId}/remove")).StatusCode);

        await AssertSignedIn(ownerB);
        var projectB = await ownerB.ProjectJson(b);
        Assert.Equal("Project B", projectB.GetProperty("titleEn").GetString());
        Assert.True(HasMember(projectB, ownerBId));

        // Burak edits B: A is unchanged.
        var edit = await burak.Put($"/consultant/projects/{b}", ProjectBody("Project B renamed"));
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        Assert.Equal("Project B renamed", (await ownerB.ProjectJson(b)).GetProperty("titleEn").GetString());
        var projectA = await ownerA.ProjectJson(a);
        Assert.Equal("Project A", projectA.GetProperty("titleEn").GetString());
        Assert.Equal("Project A (TR)", projectA.GetProperty("titleTr").GetString());
        Assert.True(HasMember(projectA, ownerAId));
        Assert.False(HasMember(projectA, ownerBId));
        Assert.Equal(HttpStatusCode.NotFound, (await ownerA.GetProject(b)).Status);

        // Burak removing the owner of B leaves A's owner signed in with A intact.
        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/projects/{b}/members/{ownerBId}/remove")).StatusCode);
        await AssertSignedOut(ownerB);
        await AssertSignedIn(ownerA);
        Assert.Equal([a], await ownerA.ListedProjectIds());
    }

    [Fact]
    public async Task Editing_an_unknown_project_is_404_for_Burak()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Project A");

        Assert.Equal(HttpStatusCode.NotFound,
            (await burak.Put($"/consultant/projects/{Guid.NewGuid()}", ProjectBody())).StatusCode);
        Assert.Equal("Project A", (await burak.ProjectJson(a)).GetProperty("titleEn").GetString());
    }

    // ---- 9 ----
    [Fact]
    public async Task Changing_the_language_changes_only_the_callers_own_language()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var otherId = f.SeedOwner("other@example.com", "Other Owner");
        var owner = await f.SignedIn(ownerId);
        var other = await f.SignedIn(otherId);
        var burak = await f.ConsultantSignedIn();
        var otherBefore = await UiLanguage(other);
        var burakBefore = await UiLanguage(burak);

        var response = await owner.Put("/me/language", new { language = "tr" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("tr", await UiLanguage(owner));
        Assert.Equal(otherBefore, await UiLanguage(other));
        Assert.Equal(burakBefore, await UiLanguage(burak));

        // It is remembered across a new sign-in, and can be changed back.
        Assert.Equal("tr", await UiLanguage(await f.SignedIn(ownerId)));
        Assert.Equal(HttpStatusCode.NoContent, (await owner.Put("/me/language", new { language = "en" })).StatusCode);
        Assert.Equal("en", await UiLanguage(owner));
    }

    [Theory]
    [InlineData("de")]
    [InlineData("EN-gb")]
    [InlineData("")]
    public async Task An_unsupported_language_is_400_and_changes_nothing(string language)
    {
        using var f = new RoomsFactory();
        var owner = await f.SignedIn(f.SeedOwner());
        Assert.Equal(HttpStatusCode.NoContent, (await owner.Put("/me/language", new { language = "tr" })).StatusCode);

        var response = await owner.Put("/me/language", new { language });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("tr", await UiLanguage(owner));
    }

    // ---- Writes need the CSRF proof ----
    [Fact]
    public async Task A_consultant_project_write_without_the_CSRF_proof_is_refused_and_changes_nothing()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("Original");

        Assert.Equal(HttpStatusCode.Forbidden, (await burak.Put($"/consultant/projects/{a}", ProjectBody("Changed"), csrf: false)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await burak.Put($"/consultant/projects/{a}", ProjectBody("Changed"), origin: "https://evil.example")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await burak.Post("/consultant/projects", ProjectBody("New"), csrf: false)).StatusCode);

        Assert.Equal([a], await burak.ListedProjectIds());
        Assert.Equal("Original", (await burak.ProjectJson(a)).GetProperty("titleEn").GetString());
    }
}
