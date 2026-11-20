using System.Net.Http.Json;
using System.Text.Json;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace IdeaDiscovery.Api.Tests;

// One app per test: a private in-memory database, a clock the test controls,
// and the configuration the sign-in contract names.
public sealed class RoomsFactory : WebApplicationFactory<Program>
{
    public const string BaseUrl = "https://rooms.test";
    public const string ConsultantEmail = "consultant@rooms.test";

    private readonly SqliteConnection _keepAlive;

    // Starts at the real time: the HTTP client's cookie jar uses the real clock.
    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    public string ConnectionString { get; }

    public RoomsFactory()
    {
        ConnectionString = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
        _keepAlive = new SqliteConnection(ConnectionString);
        _keepAlive.Open();
    }

    public DateTime Now => Clock.GetUtcNow().UtcDateTime;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("App:PublicBaseUrl", BaseUrl);
        builder.UseSetting("Consultant:Email", ConsultantEmail);
        builder.UseSetting("Auth:TokenKey", "test-token-key-0123456789-abcdefghijklmnop");
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _keepAlive.Dispose();
    }

    // A new person's browser: its own cookie jar, no redirects followed.
    public Person NewPerson(string userAgent = "TestBrowser/1.0")
    {
        var http = CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(BaseUrl),
            AllowAutoRedirect = false,
            HandleCookies = true,
        });
        http.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
        return new Person(http);
    }

    // ---- Seeding straight through the database ----

    public T WithDb<T>(Func<AppDbContext, T> work)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return work(db);
    }

    public Guid ConsultantId() =>
        WithDb(db => db.Users.Single(u => u.Email == ConsultantEmail).Id);

    public Guid SeedOwner(string email = "owner@example.com", string name = "Owner One") =>
        WithDb(db =>
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = Emails.Normalise(email),
                DisplayName = name,
                CreatedAt = Now,
            };
            db.Users.Add(user);
            db.SaveChanges();
            return user.Id;
        });

    public Guid SeedProject(string title = "Test project") =>
        WithDb(db =>
        {
            var project = new Project
            {
                Id = Guid.NewGuid(),
                TitleEn = title,
                TitleTr = title,
                IntroEn = "",
                IntroTr = "",
                Status = "active",
                CreatedAt = Now,
                CreatedById = db.Users.Single(u => u.Email == ConsultantEmail).Id,
            };
            db.Projects.Add(project);
            db.SaveChanges();
            return project.Id;
        });

    public Guid SeedInvitation(Guid projectId, string email = "invited@example.com", string name = "Invited Person") =>
        WithDb(db =>
        {
            var invitation = new Invitation
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Email = Emails.Normalise(email),
                DisplayName = name,
                CreatedById = db.Users.Single(u => u.Email == ConsultantEmail).Id,
                CreatedAt = Now,
                ExpiresAt = Now.AddDays(7),
            };
            db.Invitations.Add(invitation);
            db.SaveChanges();
            return invitation.Id;
        });

    public void Change(Guid invitationId, Action<Invitation> change) =>
        WithDb(db =>
        {
            var invitation = db.Invitations.Single(i => i.Id == invitationId);
            change(invitation);
            db.SaveChanges();
            return 0;
        });

    // ---- Links, taken from the contract's issuing service ----

    public async Task<string> UserToken(Guid userId) => TokenOf(await Links(s => s.ForUserAsync(userId)));

    public async Task<string> InvitationToken(Guid invitationId) =>
        TokenOf(await Links(s => s.ForInvitationAsync(invitationId)));

    private async Task<string> Links(Func<SignInLinks, Task<string>> issue)
    {
        using var scope = Services.CreateScope();
        return await issue(scope.ServiceProvider.GetRequiredService<SignInLinks>());
    }

    public static string TokenOf(string link)
    {
        const string marker = "#t=";
        Assert.StartsWith(BaseUrl + "/sign-in" + marker, link);
        return link[(link.IndexOf(marker, StringComparison.Ordinal) + marker.Length)..];
    }

    // Signs a person in through the public endpoint and returns them.
    public async Task<Person> SignedIn(Guid userId, string userAgent = "TestBrowser/1.0")
    {
        var person = NewPerson(userAgent);
        var response = await person.Redeem(await UserToken(userId));
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return person;
    }

    public Task<Person> ConsultantSignedIn() => SignedIn(ConsultantId());
}

// A browser: a client with its own cookies that knows the CSRF rules.
public sealed class Person
{
    public HttpClient Http { get; }

    public Person(HttpClient http) => Http = http;

    public async Task<string> CsrfToken()
    {
        var response = await Http.GetAsync("/auth/csrf");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("token").GetString()!;
    }

    // A POST that carries the Origin and CSRF token, unless a test removes them.
    public async Task<HttpResponseMessage> Post(
        string url,
        object? body = null,
        string? origin = RoomsFactory.BaseUrl,
        bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        if (body is not null) request.Content = JsonContent.Create(body);
        if (origin is not null) request.Headers.TryAddWithoutValidation("Origin", origin);
        if (csrf) request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", await CsrfToken());
        return await Http.SendAsync(request);
    }

    public Task<HttpResponseMessage> Redeem(string token, string? origin = RoomsFactory.BaseUrl, bool csrf = true) =>
        Post("/auth/redeem", new { token }, origin, csrf);

    public Task<HttpResponseMessage> Me() => Http.GetAsync("/auth/me");

    public async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }
}
