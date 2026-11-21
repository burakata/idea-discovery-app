using System.Net.Http.Json;
using System.Text.Json;
using IdeaDiscovery.Api.Data;

namespace IdeaDiscovery.Api.Tests;

// Helpers for the project-access tests. They use only the public contract and
// the database rows the contract allows tests to seed.
public static class ProjectsTestSupport
{
    public static object ProjectBody(string title = "Warehouse idea", string intro = "A short introduction.") =>
        new { titleEn = title, titleTr = title + " (TR)", introEn = intro, introTr = intro + " (TR)" };

    // A PUT that carries the Origin and CSRF token, like Person.Post.
    public static async Task<HttpResponseMessage> Put(
        this Person person,
        string url,
        object? body = null,
        string? origin = RoomsFactory.BaseUrl,
        bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        if (body is not null) request.Content = JsonContent.Create(body);
        if (origin is not null) request.Headers.TryAddWithoutValidation("Origin", origin);
        if (csrf) request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", await person.CsrfToken());
        return await person.Http.SendAsync(request);
    }

    // Burak creates a project through the API and returns its id.
    public static async Task<Guid> CreateProject(this Person burak, string title = "Warehouse idea")
    {
        var response = await burak.Post("/consultant/projects", ProjectBody(title));
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return (await burak.Json(response)).GetProperty("id").GetGuid();
    }

    // Adds an owner membership directly: the invitation endpoint comes later.
    public static void AddOwnerMember(this RoomsFactory f, Guid projectId, Guid userId) =>
        f.WithDb(db =>
        {
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                UserId = userId,
                Role = MemberRole.Owner,
                JoinedAt = f.Now,
            });
            db.SaveChanges();
            return 0;
        });

    public static async Task<List<Guid>> ListedProjectIds(this Person person)
    {
        var response = await person.Http.GetAsync("/projects");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return (await person.Json(response)).EnumerateArray().Select(p => p.GetProperty("id").GetGuid()).ToList();
    }

    public static async Task<(System.Net.HttpStatusCode Status, string Body)> GetProject(this Person person, Guid projectId)
    {
        var response = await person.Http.GetAsync($"/projects/{projectId}");
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    public static async Task<JsonElement> ProjectJson(this Person person, Guid projectId)
    {
        var response = await person.Http.GetAsync($"/projects/{projectId}");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return await person.Json(response);
    }
}
