using System.Net;

namespace IdeaDiscovery.Api.Tests;

// The browser calls the API under /api on its own origin (docs/decisions.md,
// M1 PR 7a). Every rule that holds at the root must hold there too.
public class PathBaseTests
{
    [Fact]
    public async Task Health_and_csrf_answer_under_api_like_at_the_root()
    {
        using var f = new RoomsFactory();
        var person = f.NewPerson();

        var root = await person.Http.GetAsync("/health");
        var prefixed = await person.Http.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, root.StatusCode);
        Assert.Equal(HttpStatusCode.OK, prefixed.StatusCode);
        Assert.Equal(await root.Content.ReadAsStringAsync(), await prefixed.Content.ReadAsStringAsync());

        var csrf = await person.Http.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, csrf.StatusCode);
        Assert.False(string.IsNullOrEmpty((await person.Json(csrf)).GetProperty("token").GetString()));
    }

    [Fact]
    public async Task Origin_and_csrf_checks_still_apply_under_api()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var token = await f.UserToken(ownerId);
        var person = f.NewPerson();

        Assert.Equal(HttpStatusCode.Forbidden, (await person.Post("/api/auth/redeem", new { token }, origin: null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await person.Post("/api/auth/redeem", new { token }, origin: "https://evil.test")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await person.Post("/api/auth/redeem", new { token }, csrf: false)).StatusCode);

        // The refused attempts did not use the link; the correct one signs in.
        Assert.Equal(HttpStatusCode.OK, (await person.Post("/api/auth/redeem", new { token })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await person.Http.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task A_signed_out_request_under_api_is_refused_like_at_the_root()
    {
        using var f = new RoomsFactory();
        var person = f.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Http.GetAsync("/api/projects")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Http.GetAsync("/projects")).StatusCode);
    }
}
