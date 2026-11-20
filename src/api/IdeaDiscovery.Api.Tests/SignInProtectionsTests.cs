// Needed by SignInA15Tests, which calls AddInMemoryCollection without importing the namespace.
global using Microsoft.Extensions.Configuration;

using System.Net;
using System.Text.Json;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace IdeaDiscovery.Api.Tests;

// What the A15 tests do not cover: races, what is stored, cookie flags,
// startup refusals, the rate limit, the audit trail and GET safety.
public class SignInProtectionsTests
{
    private const string GoodKey = "production-test-key-0123456789-abcdefghij";

    // An app in a chosen environment with chosen settings and a private database.
    private sealed class ConfiguredFactory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _keepAlive;
        private readonly Dictionary<string, string?> _settings;

        public ConfiguredFactory(Dictionary<string, string?> settings)
        {
            var connection = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
            _keepAlive = new SqliteConnection(connection);
            _keepAlive.Open();
            _settings = new Dictionary<string, string?>(settings) { ["ConnectionStrings:Default"] = connection };
        }

        public static Dictionary<string, string?> Good() => new()
        {
            ["Auth:TokenKey"] = GoodKey,
            ["App:PublicBaseUrl"] = "https://rooms.test",
            ["Consultant:Email"] = "consultant@rooms.test",
        };

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            foreach (var (key, value) in _settings)
                if (value is not null) builder.UseSetting(key, value);
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _keepAlive.Dispose();
        }
    }

    // ---- Two parallel uses of one link ----
    [Fact]
    public async Task Of_several_parallel_uses_of_one_link_exactly_one_signs_in()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var token = await f.UserToken(ownerId);
        var people = Enumerable.Range(0, 6).Select(_ => f.NewPerson()).ToList();

        var responses = await Task.WhenAll(people.Select(p => Task.Run(() => p.Redeem(token))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode));
        Assert.Equal(1, f.WithDb(db => db.UserSessions.Count(s => s.UserId == ownerId)));
    }

    [Fact]
    public async Task Of_several_parallel_uses_of_one_invitation_link_exactly_one_joins()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var token = await f.InvitationToken(f.SeedInvitation(projectId));
        var people = Enumerable.Range(0, 6).Select(_ => f.NewPerson()).ToList();

        var responses = await Task.WhenAll(people.Select(p => Task.Run(() => p.Redeem(token))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, f.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == projectId)));
        Assert.Equal(1, f.WithDb(db => db.UserSessions.Count()));
    }

    // ---- What is stored ----
    [Fact]
    public async Task Only_a_hash_of_the_token_is_stored_and_never_written_to_the_audit_log()
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        var person = f.NewPerson();
        await person.Redeem("wrong-" + token); // a failed use as well
        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(token)).StatusCode);

        var row = f.WithDb(db => db.SignInTokens.Single());
        Assert.NotEqual(token, row.TokenHash);
        Assert.DoesNotContain(token, row.TokenHash);
        Assert.Equal(64, row.TokenHash.Length); // hex of 32 bytes
        // The raw token is in no audit field.
        var audit = f.WithDb(db => db.AuditEvents.ToList());
        Assert.NotEmpty(audit);
        Assert.DoesNotContain(audit, a => (a.Details ?? "").Contains(token) || (a.Action).Contains(token));
        Assert.DoesNotContain(audit, a => (a.Details ?? "").Contains("wrong-"));
    }

    [Fact]
    public async Task Tokens_are_long_random_and_different_each_time()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();

        var first = await f.UserToken(ownerId);
        var second = await f.UserToken(ownerId);

        Assert.NotEqual(first, second);
        Assert.Equal(43, first.Length); // 256 bits in base64url
        Assert.Matches("^[A-Za-z0-9_-]+$", first);
    }

    // ---- Cookie flags ----
    [Fact]
    public async Task Outside_Development_the_session_cookie_is_Secure_HttpOnly_and_SameSite_Lax()
    {
        using var f = new ConfiguredFactory(ConfiguredFactory.Good());
        Guid userId;
        string token;
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            userId = db.Users.Single(u => u.Email == "consultant@rooms.test").Id;
            var link = await scope.ServiceProvider.GetRequiredService<SignInLinks>().ForUserAsync(userId);
            token = link[(link.IndexOf("#t=", StringComparison.Ordinal) + 3)..];
        }
        var person = new Person(f.CreateClient(new WebApplicationFactoryClientOptions
        {
            // Behind a TLS-terminating proxy the app itself sees plain http.
            BaseAddress = new Uri("http://rooms.test"),
            AllowAutoRedirect = false,
            HandleCookies = false,
        }));

        // Cookies are read by hand, so this does not depend on the cookie jar.
        var csrfResponse = await person.Http.GetAsync("/auth/csrf");
        var csrfCookie = csrfResponse.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("idr_csrf"));
        using var csrf = JsonDocument.Parse(await csrfResponse.Content.ReadAsStringAsync());
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/redeem")
        {
            Content = System.Net.Http.Json.JsonContent.Create(new { token }),
        };
        request.Headers.TryAddWithoutValidation("Origin", "https://rooms.test");
        request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", csrf.RootElement.GetProperty("token").GetString());
        request.Headers.TryAddWithoutValidation("Cookie", csrfCookie.Split(';')[0]);
        var response = await person.Http.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith(".AspNetCore.Cookies"));
        Assert.Contains("secure", session, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", session, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", session, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", session, StringComparison.OrdinalIgnoreCase); // persistent
    }

    // ---- Startup refusals ----
    [Theory]
    [InlineData("Auth:TokenKey", null, "Auth:TokenKey")]
    [InlineData("Auth:TokenKey", "", "Auth:TokenKey")]
    [InlineData("Auth:TokenKey", "too-short-key", "Auth:TokenKey")]
    [InlineData("Auth:TokenKey", AuthSettings.DevelopmentTokenKey, "Auth:TokenKey")]
    [InlineData("App:PublicBaseUrl", null, "App:PublicBaseUrl")]
    [InlineData("App:PublicBaseUrl", "http://rooms.test", "App:PublicBaseUrl")]
    [InlineData("App:PublicBaseUrl", "rooms.test", "App:PublicBaseUrl")]
    [InlineData("App:PublicBaseUrl", "/relative", "App:PublicBaseUrl")]
    public void Outside_Development_the_app_refuses_to_start_with_weak_or_missing_settings(
        string key, string? value, string named)
    {
        var settings = ConfiguredFactory.Good();
        settings[key] = value;
        using var f = new ConfiguredFactory(settings);

        var error = Assert.ThrowsAny<Exception>(() => f.CreateClient());

        var messages = new List<string>();
        for (var e = error; e is not null; e = e.InnerException) messages.Add(e.Message);
        Assert.Contains(messages, m => m.Contains(named));
    }

    [Fact]
    public void Outside_Development_good_settings_start_the_app()
    {
        using var f = new ConfiguredFactory(ConfiguredFactory.Good());

        using var client = f.CreateClient();

        Assert.NotNull(client);
    }

    // ---- Rate limit ----
    [Fact]
    public async Task The_eleventh_redeem_from_one_address_in_the_window_gets_429()
    {
        using var f = new RoomsFactory();
        var person = f.NewPerson();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await person.Redeem($"guess-{i}")).StatusCode);
        var limited = await person.Redeem("guess-10");

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }

    [Fact]
    public async Task A_real_link_is_also_refused_once_the_limit_is_used_up()
    {
        using var f = new RoomsFactory();
        var token = await f.UserToken(f.SeedOwner());
        var person = f.NewPerson();
        for (var i = 0; i < 10; i++) await person.Redeem($"guess-{i}");

        var response = await person.Redeem(token);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Me()).StatusCode);
    }

    // ---- Audit ----
    [Fact]
    public async Task Sign_in_failed_redeem_sign_out_revoke_and_copied_links_are_audited()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        var invitationId = f.SeedInvitation(projectId);
        var ownerId = f.SeedOwner();
        var burakId = f.ConsultantId();

        var burak = await f.ConsultantSignedIn();
        await f.NewPerson().Redeem("not-a-real-token");
        var owner = await f.SignedIn(ownerId);
        var sessionId = f.WithDb(db => db.UserSessions.Single(s => s.UserId == ownerId).Id);
        Assert.Equal(HttpStatusCode.OK, (await burak.Post($"/consultant/users/{ownerId}/sign-in-link")).StatusCode);
        var invitationLink = await burak.Json(await burak.Post($"/consultant/invitations/{invitationId}/link"));
        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/sessions/{sessionId}/revoke")).StatusCode);
        var invited = f.NewPerson();
        var accepted = await invited.Redeem(RoomsFactory.TokenOf(invitationLink.GetProperty("link").GetString()!));
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post("/auth/sign-out")).StatusCode);

        var audit = f.WithDb(db => db.AuditEvents.ToList());
        AuditEvent One(string action) => Assert.Single(audit, a => a.Action == action);
        Assert.Equal(burakId, audit.First(a => a.Action == "sign_in").ActorUserId);
        Assert.Equal(3, audit.Count(a => a.Action == "sign_in")); // Burak, the owner, the invited person
        var failed = One("sign_in_failed");
        Assert.Null(failed.ActorUserId);
        Assert.Null(failed.Details);
        var copied = One("sign_in_link_copied");
        Assert.Equal(burakId, copied.ActorUserId);
        Assert.Contains(ownerId.ToString(), copied.Details);
        var invitationCopied = One("invitation_link_copied");
        Assert.Equal(burakId, invitationCopied.ActorUserId);
        Assert.Equal(projectId, invitationCopied.ProjectId);
        var revoked = One("session_revoked");
        Assert.Equal(burakId, revoked.ActorUserId);
        Assert.Contains(sessionId.ToString(), revoked.Details);
        var joined = One("invitation_accepted");
        Assert.Equal(projectId, joined.ProjectId);
        var signedOut = One("sign_out");
        Assert.Equal(burakId, signedOut.ActorUserId);
        Assert.All(audit, a => Assert.NotEqual(default, a.CreatedAt));
        _ = owner;
    }

    // ---- GET changes nothing ----
    [Fact]
    public async Task A_GET_to_every_endpoint_changes_nothing()
    {
        using var f = new RoomsFactory();
        var ownerId = f.SeedOwner();
        var burak = await f.ConsultantSignedIn();
        var owner = await f.SignedIn(ownerId);
        var nobody = f.NewPerson();

        var routes = f.Services.GetServices<EndpointDataSource>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("GET") == true)
            .Select(e => e.RoutePattern.RawText!)
            .ToList();
        // Prove the test sees the endpoints that read the most.
        Assert.Contains("/auth/me", routes);
        Assert.Contains("/auth/csrf", routes);
        Assert.Contains("/health", routes);
        Assert.Contains(routes, r => r.StartsWith("/consultant/users/") && r.EndsWith("/sessions"));

        var before = Snapshot(f);
        foreach (var route in routes)
        {
            var url = System.Text.RegularExpressions.Regex.Replace(route, @"\{[^}]+\}", ownerId.ToString());
            foreach (var person in new[] { burak, owner, nobody })
                await person.Http.GetAsync(url);
        }

        Assert.Equal(before, Snapshot(f));
    }

    private static string Snapshot(RoomsFactory f) => f.WithDb(db => string.Join("\n",
        JsonSerializer.Serialize(db.Users.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Projects.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.ProjectMembers.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Invitations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.SignInTokens.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.UserSessions.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Conversations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Messages.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.AuditEvents.OrderBy(x => x.Id).ToList())));
}
