using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IdeaDiscovery.Api.Tests;

// Asking for a sign-in link by email: the answer never depends on the email,
// and the email goes out after the response.
public class RequestLinkTests
{
    private sealed record Sent(string To, string Subject, string Body)
    {
        public string Link => Body.Split('\n').Single(l => l.StartsWith(RoomsFactory.BaseUrl)).Trim();
        public string Token => RoomsFactory.TokenOf(Link);
    }

    private sealed class CapturingSender : IEmailSender
    {
        public ConcurrentQueue<Sent> Messages { get; } = new();
        public int FailNext;
        public string? LastFailedBody;

        public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
        {
            if (Interlocked.Exchange(ref FailNext, 0) == 1)
            {
                LastFailedBody = body;
                // Deliberately holds the body, and so the link: logging the message would leak it.
                throw new IOException("disk full: " + body);
            }
            Messages.Enqueue(new Sent(to, subject, body));
            return Task.CompletedTask;
        }
    }

    // The app with a capturing sender, and people who browse it.
    private sealed class Harness : IDisposable
    {
        public RoomsFactory F { get; } = new();
        public CapturingSender Sender { get; } = new();
        public WarningLog Log { get; } = new();
        private readonly WebApplicationFactory<Program> _app;

        public Harness()
        {
            _app = F.WithWebHostBuilder(b =>
            {
                b.ConfigureServices(s => s.AddSingleton<IEmailSender>(Sender));
                b.ConfigureLogging(l => l.AddProvider(Log));
            });
        }

        public Person NewPerson() => new(_app.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl),
            AllowAutoRedirect = false,
            HandleCookies = true,
        }));

        public Guid Member(string email = "owner@example.com", string language = "en")
        {
            var id = F.SeedOwner(email);
            AddMembership(F, id);
            F.WithDb(db =>
            {
                db.Users.Single(u => u.Id == id).UiLanguage = language;
                db.SaveChanges();
                return 0;
            });
            return id;
        }

        public Task<HttpResponseMessage> Ask(Person person, string email) => person.Post("/auth/request-link", new { email });

        // Waits until the dispatcher has handled everything asked so far (each
        // request is queued before it is answered). Returns what was sent.
        public async Task<List<Sent>> Settled()
        {
            var queue = _app.Services.GetRequiredService<EmailQueue>();
            for (var i = 0; i < 1000 && queue.Unfinished > 0; i++)
                await Task.Delay(10);
            Assert.Equal(0, queue.Unfinished);
            return Sender.Messages.ToList();
        }

        public void Dispose() { _app.Dispose(); F.Dispose(); }
    }

    private static void AddMembership(RoomsFactory f, Guid userId)
    {
        var projectId = f.SeedProject();
        f.WithDb(db =>
        {
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(), ProjectId = projectId, UserId = userId, Role = MemberRole.Owner, JoinedAt = f.Now,
            });
            db.SaveChanges();
            return 0;
        });
    }

    private static async Task AssertEmptyAccepted(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync());
    }

    // ---- A member gets one email ----
    [Fact]
    public async Task A_member_gets_exactly_one_email_whose_link_signs_in_once()
    {
        using var h = new Harness();
        var id = h.Member("owner@example.com");
        var person = h.NewPerson();

        // Spaces and capitals do not matter.
        await AssertEmptyAccepted(await h.Ask(person, "  Owner@Example.COM "));

        var sent = Assert.Single(await h.Settled());
        Assert.Equal("owner@example.com", sent.To);
        Assert.Contains("sign-in link", sent.Subject);
        Assert.Contains("works once", sent.Body);
        Assert.Contains("30 minutes", sent.Body);
        Assert.Contains("you can ignore this email", sent.Body);
        var first = await person.Redeem(sent.Token);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(id, (await person.Json(first)).GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.BadRequest, (await h.NewPerson().Redeem(sent.Token)).StatusCode);
    }

    [Fact]
    public async Task The_consultant_gets_an_email_without_any_membership()
    {
        using var h = new Harness();

        await AssertEmptyAccepted(await h.Ask(h.NewPerson(), RoomsFactory.ConsultantEmail));

        Assert.Equal(RoomsFactory.ConsultantEmail, Assert.Single(await h.Settled()).To);
    }

    [Fact]
    public async Task A_Turkish_user_gets_the_Turkish_text_and_an_English_one_gets_English()
    {
        using var h = new Harness();
        h.Member("ayse@example.com", "tr");
        h.Member("john@example.com", "en");

        await h.Ask(h.NewPerson(), "ayse@example.com");
        await h.Ask(h.NewPerson(), "john@example.com");

        var sent = await h.Settled();
        var tr = sent.Single(m => m.To == "ayse@example.com");
        Assert.Equal("Idea Discovery Rooms giriş bağlantınız", tr.Subject);
        Assert.Contains("yalnızca bir kez çalışır ve 30 dakika sonra", tr.Body);
        Assert.Contains("siz istemediyseniz", tr.Body);
        Assert.DoesNotContain("works once", tr.Body);
        var en = sent.Single(m => m.To == "john@example.com");
        Assert.Equal("Your sign-in link for Idea Discovery Rooms", en.Subject);
        Assert.DoesNotContain("bağlantı", en.Body);
    }

    // ---- The answer never says whether an email is known ----
    [Theory]
    [InlineData("unknown")]
    [InlineData("no-membership")]
    [InlineData("malformed")]
    [InlineData("empty-email")]
    [InlineData("json-without-email")]
    [InlineData("no-body")]
    [InlineData("text-body")]
    [InlineData("very-long")]
    public async Task Whatever_the_email_the_answer_is_the_same_empty_202_and_nothing_is_sent(string kind)
    {
        using var h = new Harness();
        h.F.SeedOwner("lonely@example.com"); // a user, but in no project
        var person = h.NewPerson();

        var response = kind switch
        {
            "unknown" => await h.Ask(person, "nobody@example.com"),
            "no-membership" => await h.Ask(person, "lonely@example.com"),
            "malformed" => await h.Ask(person, "not an email"),
            "empty-email" => await h.Ask(person, ""),
            "json-without-email" => await person.Post("/auth/request-link", new { other = 1 }),
            "no-body" => await person.Post("/auth/request-link"),
            "text-body" => await SendText(person),
            _ => await h.Ask(person, new string('a', 400) + "@example.com"),
        };

        await AssertEmptyAccepted(response);
        Assert.Empty(await h.Settled());
        Assert.Equal(0, h.F.WithDb(db => db.SignInTokens.Count()));
        Assert.Equal(0, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action.StartsWith("sign_in_link"))));
    }

    [Fact]
    public async Task A_member_and_an_unknown_email_get_the_same_answer_down_to_the_headers()
    {
        using var h = new Harness();
        h.Member("owner@example.com");

        var known = await h.Ask(h.NewPerson(), "owner@example.com");
        var unknown = await h.Ask(h.NewPerson(), "nobody@example.com");

        await AssertEmptyAccepted(known);
        await AssertEmptyAccepted(unknown);
        Assert.Equal(known.Headers.Select(x => x.Key).Order(), unknown.Headers.Select(x => x.Key).Order());
        Assert.Equal(known.Content.Headers.Select(x => x.Key).Order(), unknown.Content.Headers.Select(x => x.Key).Order());
    }

    private static async Task<HttpResponseMessage> SendText(Person person)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/request-link")
        {
            Content = new StringContent("not json at all", System.Text.Encoding.UTF8, "text/plain"),
        };
        request.Headers.TryAddWithoutValidation("Origin", RoomsFactory.BaseUrl);
        request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", await person.CsrfToken());
        return await person.Http.SendAsync(request);
    }

    // ---- Only the newest link works ----
    [Fact]
    public async Task A_second_request_ends_the_first_link_and_leaves_invitation_links_alone()
    {
        using var h = new Harness();
        h.Member();
        var invitation = h.F.SeedInvitation(h.F.SeedProject(), "someone-else@example.com");
        await h.F.InvitationToken(invitation);
        var person = h.NewPerson();

        await h.Ask(person, "owner@example.com");
        await h.Settled();
        await h.Ask(person, "owner@example.com");
        var sent = await h.Settled();

        Assert.Equal(2, sent.Count);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.NewPerson().Redeem(sent[0].Token)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.NewPerson().Redeem(sent[1].Token)).StatusCode);
        Assert.Null(h.F.WithDb(db => db.SignInTokens.Single(t => t.InvitationId == invitation).RevokedAt));
    }

    // ---- Limits ----
    [Fact]
    public async Task The_fourth_request_in_an_hour_sends_nothing_and_still_answers_202_and_an_hour_later_sending_works_again()
    {
        using var h = new Harness();
        var id = h.Member();
        var person = h.NewPerson();

        for (var i = 0; i < 3; i++) await AssertEmptyAccepted(await h.Ask(person, "owner@example.com"));
        await AssertEmptyAccepted(await h.Ask(person, "owner@example.com"));

        Assert.Equal(3, (await h.Settled()).Count);
        Assert.Equal(3, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action == "sign_in_link_requested" && a.ActorUserId == id)));
        Assert.Equal(1, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action == "sign_in_link_limited" && a.ActorUserId == id)));
        Assert.Equal(3, h.F.WithDb(db => db.SignInTokens.Count(t => t.UserId == id)));

        h.F.Clock.Advance(TimeSpan.FromMinutes(61));
        await AssertEmptyAccepted(await h.Ask(person, "owner@example.com"));
        Assert.Equal(4, (await h.Settled()).Count);
    }

    [Fact]
    public async Task Links_the_consultant_copied_do_not_count_toward_the_limit()
    {
        using var h = new Harness();
        var id = h.Member();
        var burak = h.NewPerson();
        Assert.Equal(HttpStatusCode.OK, (await burak.Redeem(await h.F.UserToken(h.F.ConsultantId()))).StatusCode);
        for (var i = 0; i < 4; i++)
            Assert.Equal(HttpStatusCode.OK, (await burak.Post($"/consultant/users/{id}/sign-in-link")).StatusCode);
        Assert.Equal(4, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action == "sign_in_link_copied")));

        await h.Ask(h.NewPerson(), "owner@example.com");

        Assert.Single(await h.Settled());
    }

    [Fact]
    public async Task One_address_may_ask_ten_times_an_hour_and_then_gets_429_with_nothing_sent()
    {
        using var h = new Harness();
        h.Member();
        var person = h.NewPerson();

        for (var i = 0; i < 10; i++) await AssertEmptyAccepted(await h.Ask(person, $"nobody{i}@example.com"));
        var limited = await h.Ask(person, "owner@example.com");

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Empty(await h.Settled());
    }

    // ---- What is written down ----
    [Fact]
    public async Task The_audit_rows_name_the_person_and_hold_no_token_or_link()
    {
        using var h = new Harness();
        var id = h.Member();
        var person = h.NewPerson();
        for (var i = 0; i < 4; i++) await h.Ask(person, "owner@example.com");
        await h.Ask(person, "nobody@example.com");
        var sent = await h.Settled();

        var audit = h.F.WithDb(db => db.AuditEvents.ToList());
        Assert.Equal(3, audit.Count(a => a.Action == "sign_in_link_requested" && a.ActorUserId == id));
        Assert.Single(audit, a => a.Action == "sign_in_link_limited" && a.ActorUserId == id);
        Assert.DoesNotContain(audit, a => a.Action.StartsWith("sign_in_link") && a.Details is not null);
        var everything = JsonSerializer.Serialize(audit);
        Assert.Equal(3, sent.Count);
        foreach (var message in sent)
            Assert.DoesNotContain(message.Token, everything);
        Assert.DoesNotContain("/sign-in", everything);
    }

    // ---- The usual request checks apply ----
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_request_without_the_CSRF_proof_or_from_another_origin_is_refused_and_sends_nothing(bool wrongOrigin)
    {
        using var h = new Harness();
        h.Member();

        var response = await h.NewPerson().Post("/auth/request-link", new { email = "owner@example.com" },
            origin: wrongOrigin ? "https://evil.test" : RoomsFactory.BaseUrl, csrf: wrongOrigin);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await h.Settled());
        Assert.Equal(0, h.F.WithDb(db => db.SignInTokens.Count()));
    }

    [Fact]
    public async Task Parallel_requests_for_one_email_still_send_exactly_three()
    {
        using var h = new Harness();
        h.Member();
        var people = Enumerable.Range(0, 8).Select(_ => h.NewPerson()).ToList();

        var answers = await Task.WhenAll(people.Select(p => h.Ask(p, "owner@example.com")));

        foreach (var answer in answers) await AssertEmptyAccepted(answer);
        Assert.Equal(3, (await h.Settled()).Count);
        Assert.Equal(3, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action == "sign_in_link_requested")));
        Assert.Equal(5, h.F.WithDb(db => db.AuditEvents.Count(a => a.Action == "sign_in_link_limited")));
    }

    // ---- Sending ----
    [Fact]
    public async Task A_send_failure_is_survived_and_the_next_email_still_goes_out()
    {
        using var h = new Harness();
        h.Member("a@example.com");
        h.Member("b@example.com");
        h.Sender.FailNext = 1;

        await h.Ask(h.NewPerson(), "a@example.com");
        await h.Ask(h.NewPerson(), "b@example.com");

        Assert.Equal("b@example.com", Assert.Single(await h.Settled()).To);
    }

    [Fact]
    public async Task A_failed_send_logs_a_warning_that_holds_no_link_token_or_address()
    {
        using var h = new Harness();
        h.Member("a@example.com");
        h.Sender.FailNext = 1;

        await h.Ask(h.NewPerson(), "a@example.com");
        await h.Settled();

        Assert.Contains(h.Log.Lines, l => l.Contains("could not be sent"));
        var failed = Assert.IsType<string>(h.Sender.LastFailedBody);
        var token = new Sent("a@example.com", "", failed).Token;
        AssertNothingSecretLogged(h, token, "a@example.com");
    }

    [Fact]
    public async Task A_failed_database_step_logs_a_warning_without_secrets_and_the_dispatcher_carries_on()
    {
        using var h = new Harness();
        h.Member("a@example.com");
        h.F.WithDb(db => db.Database.ExecuteSqlRaw("ALTER TABLE SignInTokens RENAME TO SignInTokensGone"));

        await h.Ask(h.NewPerson(), "a@example.com");
        await h.Settled();

        Assert.Contains(h.Log.Lines, l => l.Contains("could not be handled"));
        Assert.Empty(h.Sender.Messages);
        AssertNothingSecretLogged(h, null, "a@example.com");

        h.F.WithDb(db => db.Database.ExecuteSqlRaw("ALTER TABLE SignInTokensGone RENAME TO SignInTokens"));
        h.Member("b@example.com");
        await h.Ask(h.NewPerson(), "b@example.com");
        Assert.Equal("b@example.com", Assert.Single(await h.Settled()).To);
    }

    private static void AssertNothingSecretLogged(Harness h, string? token, string email)
    {
        Assert.DoesNotContain(h.Log.Lines, l => l.Contains("#t=") || l.Contains("/sign-in") || l.Contains(email));
        if (token is not null) Assert.DoesNotContain(h.Log.Lines, l => l.Contains(token));
    }

    [Fact]
    public async Task In_Development_the_Folder_sender_writes_the_email_to_a_file()
    {
        var folder = Path.Combine(Path.GetTempPath(), "idr-emails-" + Guid.NewGuid().ToString("N"));
        try
        {
            using var f = new RoomsFactory();
            AddMembership(f, f.SeedOwner("owner@example.com"));
            using var app = f.WithWebHostBuilder(b => b.UseSetting("Email:FolderPath", folder));
            var person = new Person(app.CreateClient(new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri(RoomsFactory.BaseUrl),
                HandleCookies = true,
            }));

            await AssertEmptyAccepted(await person.Post("/auth/request-link", new { email = "owner@example.com" }));
            // The file may be half-written until the queue has finished with the email.
            var queue = app.Services.GetRequiredService<EmailQueue>();
            for (var i = 0; i < 1000 && queue.Unfinished > 0; i++) await Task.Delay(10);
            Assert.Equal(0, queue.Unfinished);

            var file = Assert.Single(Directory.GetFiles(folder, "*.eml"));
            var text = await File.ReadAllTextAsync(file);
            Assert.Contains("To: owner@example.com", text);
            Assert.Contains("From: Idea Discovery Rooms <no-reply@example.test>", text);
            Assert.Contains(RoomsFactory.BaseUrl + "/sign-in#t=", text);
        }
        finally
        {
            if (Directory.Exists(folder)) Directory.Delete(folder, true);
        }
    }

    // ---- Startup ----
    private sealed class WarningLog : ILoggerProvider, ILogger
    {
        public ConcurrentQueue<string> Lines { get; } = new();
        public ILogger CreateLogger(string categoryName) => this;
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            // The exception is part of the line, so a logged exception cannot hide a leak.
            if (logLevel >= LogLevel.Warning) Lines.Enqueue(formatter(state, exception) + exception);
        }
        public void Dispose() { }
    }

    private sealed class ProductionFactory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _keepAlive;
        private readonly Dictionary<string, string> _settings;
        public WarningLog Log { get; } = new();

        public ProductionFactory(Dictionary<string, string>? extra = null)
        {
            var connection = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
            _keepAlive = new SqliteConnection(connection);
            _keepAlive.Open();
            _settings = new Dictionary<string, string>
            {
                ["Auth:TokenKey"] = "production-test-key-0123456789-abcdefghij",
                ["App:PublicBaseUrl"] = RoomsFactory.BaseUrl,
                ["Consultant:Email"] = RoomsFactory.ConsultantEmail,
                ["ConnectionStrings:Default"] = connection,
            };
            foreach (var (k, v) in extra ?? []) _settings[k] = v;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            foreach (var (k, v) in _settings) builder.UseSetting(k, v);
            builder.ConfigureLogging(l => l.AddProvider(Log));
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _keepAlive.Dispose();
        }
    }

    [Theory]
    [InlineData("Folder")]
    [InlineData("folder")]
    [InlineData("Carrier-pigeon")]
    public void Outside_Development_the_Folder_sender_and_unknown_providers_stop_the_app_from_starting(string provider)
    {
        using var f = new ProductionFactory(new() { ["Email:Provider"] = provider });

        var error = Assert.ThrowsAny<Exception>(() => f.CreateClient());

        var messages = new List<string>();
        for (var e = error; e is not null; e = e.InnerException) messages.Add(e.Message);
        Assert.Contains(messages, m => m.Contains("Email:Provider"));
    }

    [Fact]
    public async Task Outside_Development_with_no_provider_the_app_starts_with_a_warning_and_drops_the_email_without_the_link()
    {
        using var f = new ProductionFactory();
        var person = new Person(f.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl),
            HandleCookies = true,
        }));

        Assert.Contains(f.Log.Lines, l => l.Contains("Email:Provider is not set"));
        await AssertEmptyAccepted(await person.Post("/auth/request-link", new { email = RoomsFactory.ConsultantEmail }));
        for (var i = 0; i < 500 && !f.Log.Lines.Any(l => l.Contains("an email was dropped")); i++)
            await Task.Delay(10);

        Assert.Contains(f.Log.Lines, l => l.Contains("an email was dropped"));
        Assert.DoesNotContain(f.Log.Lines, l => l.Contains("/sign-in") || l.Contains("#t="));
    }
}
