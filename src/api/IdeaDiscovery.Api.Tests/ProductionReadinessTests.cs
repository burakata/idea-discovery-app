using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Mail;
using IdeaDiscovery.Api.Projects;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging;

namespace IdeaDiscovery.Api.Tests;

// Running in production behind one HTTPS proxy: the Resend sender, required
// settings, the email queue, forwarded headers, IPv6 limits, the secure
// antiforgery cookie, persisted keys and the startup checks.
public class ProductionReadinessTests
{
    // ---- Resend sender ----

    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Queue<Func<HttpResponseMessage>> _script = new();
        public List<(HttpRequestMessage Request, string Body)> Calls { get; } = [];

        public FakeHandler Then(HttpStatusCode status, Action<HttpResponseMessage>? adjust = null)
        {
            _script.Enqueue(() =>
            {
                var response = new HttpResponseMessage(status) { Content = new StringContent("{\"id\":\"x\"}") };
                adjust?.Invoke(response);
                return response;
            });
            return this;
        }

        public FakeHandler ThenTimeout()
        {
            _script.Enqueue(() => throw new TaskCanceledException("timed out", new TimeoutException()));
            return this;
        }

        public FakeHandler ThenConnectionError()
        {
            _script.Enqueue(() => throw new HttpRequestException("no route"));
            return this;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls.Add((request, await request.Content!.ReadAsStringAsync(cancellationToken)));
            return _script.Dequeue()();
        }
    }

    private sealed class FakeClients(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private const string To = "owner.person@example.com";
    private const string Subject = "Your sign-in link";
    private const string Body = "Open https://rooms.test/sign-in#t=secret-token-value";
    private const string ApiKey = "re_test_key_not_real";

    private sealed class Resend
    {
        public FakeHandler Handler { get; } = new();
        public CapturedLog Log { get; } = new();
        public List<TimeSpan> Delays { get; } = [];
        public ResendEmailSender Sender { get; }

        public Resend()
        {
            var settings = new EmailSettings(EmailProvider.Resend, "Rooms <hello@rooms.test>", "unused", ApiKey);
            var logger = new LoggerFactory([Log]).CreateLogger<ResendEmailSender>();
            Sender = new ResendEmailSender(new FakeClients(Handler), settings, logger, (span, _) =>
            {
                Delays.Add(span);
                return Task.CompletedTask;
            });
        }

        public Task Send() => Sender.SendAsync(To, Subject, Body, CancellationToken.None);

        public string KeyOf(int call) => Handler.Calls[call].Request.Headers.GetValues("Idempotency-Key").Single();

        public void AssertNothingSensitiveLogged() =>
            Assert.DoesNotContain(Log.Lines, l =>
                l.Contains(To) || l.Contains(Subject) || l.Contains("secret-token-value") || l.Contains("/sign-in") || l.Contains(ApiKey));
    }

    [Fact]
    public async Task Resend_gets_the_bearer_key_sender_recipient_subject_and_text()
    {
        var r = new Resend();
        r.Handler.Then(HttpStatusCode.OK);

        await r.Send();

        var (request, body) = Assert.Single(r.Handler.Calls);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://api.resend.com/emails", request.RequestUri!.ToString());
        Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
        Assert.Equal(ApiKey, request.Headers.Authorization.Parameter);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("Rooms <hello@rooms.test>", json.RootElement.GetProperty("from").GetString());
        Assert.Equal(To, json.RootElement.GetProperty("to").EnumerateArray().Single().GetString());
        Assert.Equal(Subject, json.RootElement.GetProperty("subject").GetString());
        Assert.Equal(Body, json.RootElement.GetProperty("text").GetString());
        Assert.Empty(r.Delays);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadGateway)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    public async Task A_temporary_failure_is_retried_with_the_same_idempotency_key(HttpStatusCode failure)
    {
        var r = new Resend();
        r.Handler.Then(failure).Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal(2, r.Handler.Calls.Count);
        Assert.Equal(r.KeyOf(0), r.KeyOf(1));
        Assert.Equal(32, r.KeyOf(0).Length);
        Assert.Equal([ResendEmailSender.FirstBackoff], r.Delays);
        r.AssertNothingSensitiveLogged();
    }

    [Fact]
    public async Task Too_many_requests_is_retried_after_the_time_Resend_asks_for()
    {
        var r = new Resend();
        r.Handler
            .Then(HttpStatusCode.TooManyRequests, x => x.Headers.RetryAfter = new(TimeSpan.FromSeconds(4)))
            .Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal(2, r.Handler.Calls.Count);
        Assert.Equal(r.KeyOf(0), r.KeyOf(1));
        Assert.Equal([TimeSpan.FromSeconds(4)], r.Delays);
    }

    [Fact]
    public async Task A_long_Retry_After_is_capped()
    {
        var r = new Resend();
        r.Handler
            .Then(HttpStatusCode.TooManyRequests, x => x.Headers.RetryAfter = new(TimeSpan.FromHours(2)))
            .Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal([ResendEmailSender.MaxRetryAfter], r.Delays);
    }

    [Fact]
    public async Task Too_many_requests_without_Retry_After_backs_off()
    {
        var r = new Resend();
        r.Handler.Then(HttpStatusCode.TooManyRequests).Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal([ResendEmailSender.FirstBackoff], r.Delays);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.UnprocessableEntity)]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task A_refusal_is_one_attempt_and_logged_as_an_error(HttpStatusCode refusal)
    {
        var r = new Resend();
        r.Handler.Then(refusal);

        var error = await Assert.ThrowsAsync<EmailDeliveryException>(r.Send);

        Assert.Single(r.Handler.Calls);
        Assert.Empty(r.Delays);
        Assert.Contains(r.Log.Entries, e => e.Level == LogLevel.Error && e.Text.Contains(((int)refusal).ToString()));
        Assert.DoesNotContain(To, error.Message);
        r.AssertNothingSensitiveLogged();
    }

    [Fact]
    public async Task A_timeout_is_retried_with_the_same_idempotency_key()
    {
        var r = new Resend();
        r.Handler.ThenTimeout().Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal(2, r.Handler.Calls.Count);
        Assert.Equal(r.KeyOf(0), r.KeyOf(1));
    }

    [Fact]
    public async Task A_connection_error_is_retried()
    {
        var r = new Resend();
        r.Handler.ThenConnectionError().Then(HttpStatusCode.OK);

        await r.Send();

        Assert.Equal(2, r.Handler.Calls.Count);
    }

    [Fact]
    public async Task After_three_attempts_it_gives_up_with_an_error_and_nothing_sensitive_logged()
    {
        var r = new Resend();
        r.Handler.Then(HttpStatusCode.InternalServerError).ThenTimeout().Then(HttpStatusCode.BadGateway);

        await Assert.ThrowsAsync<EmailDeliveryException>(r.Send);

        Assert.Equal(ResendEmailSender.MaxAttempts, r.Handler.Calls.Count);
        Assert.Single(r.Handler.Calls.Select((_, i) => r.KeyOf(i)).Distinct());
        Assert.Equal([TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2)], r.Delays);
        Assert.Contains(r.Log.Entries, e => e.Level == LogLevel.Error);
        r.AssertNothingSensitiveLogged();
    }

    [Fact]
    public async Task Each_email_has_its_own_idempotency_key()
    {
        var r = new Resend();
        r.Handler.Then(HttpStatusCode.OK).Then(HttpStatusCode.OK);

        await r.Send();
        await r.Send();

        Assert.NotEqual(r.KeyOf(0), r.KeyOf(1));
    }

    [Fact]
    public async Task Cancelling_is_not_retried()
    {
        var r = new Resend();
        using var cancel = new CancellationTokenSource();
        await cancel.CancelAsync();
        r.Handler.ThenTimeout();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            r.Sender.SendAsync(To, Subject, Body, cancel.Token));

        Assert.Single(r.Handler.Calls);
    }

    // ---- Settings ----

    private static IHostEnvironment Env(string name) => new HostingEnvironment { EnvironmentName = name, ContentRootPath = Path.GetTempPath() };

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => v.Value)).Build();

    [Fact]
    public void Resend_needs_a_key_and_a_sender_and_never_falls_back_to_the_example_sender()
    {
        var problems = new StartupProblems();

        var settings = EmailSettings.Read(Config(("Email:Provider", "Resend")), Env("Production"), problems);

        Assert.Null(settings);
        Assert.Contains(problems.All, p => p.Contains("Email:From"));
        Assert.Contains(problems.All, p => p.Contains("Email:Resend:ApiKey"));
    }

    [Fact]
    public void Resend_with_a_key_and_a_sender_is_read_and_the_key_is_not_printed()
    {
        var problems = new StartupProblems();

        var settings = EmailSettings.Read(
            Config(("Email:Provider", "resend"), ("Email:From", "Rooms <a@b.test>"), ("Email:Resend:ApiKey", ApiKey)),
            Env("Production"), problems);

        Assert.Empty(problems.All);
        Assert.Equal(EmailProvider.Resend, settings!.Provider);
        Assert.Equal(ApiKey, settings.ResendApiKey);
        Assert.DoesNotContain(ApiKey, settings.ToString());
    }

    [Fact]
    public void In_Development_an_unset_provider_is_allowed_and_Folder_too()
    {
        var unset = new StartupProblems();
        var folder = new StartupProblems();

        Assert.Equal(EmailProvider.None, EmailSettings.Read(Config(), Env("Development"), unset)!.Provider);
        Assert.Equal(EmailProvider.Folder, EmailSettings.Read(Config(("Email:Provider", "Folder")), Env("Development"), folder)!.Provider);
        Assert.Empty(unset.All);
        Assert.Empty(folder.All);
    }

    [Theory]
    [InlineData("10.20.30.40", true)]
    [InlineData("172.20.0.2", true)]
    [InlineData("::1", true)]
    [InlineData("fd00::2", true)]
    [InlineData("not-an-ip", false)]
    [InlineData("1", false)]
    [InlineData("10.0.0.1, 10.0.0.2", false)]
    [InlineData("10.0.0.0/24", false)]
    [InlineData("0.0.0.0", false)]
    [InlineData("::", false)]
    public void The_known_proxy_is_one_valid_address(string value, bool valid)
    {
        var problems = new StartupProblems();

        var settings = HostingSettings.Read(
            Config(("Proxy:KnownProxy", value), ("DataProtection:KeysPath", "keys")), Env("Production"), problems);

        Assert.Equal(valid, settings is not null);
        Assert.Equal(valid, problems.All.Count == 0);
        if (!valid) Assert.Contains(problems.All, p => p.Contains("Proxy:KnownProxy"));
    }

    [Fact]
    public void Outside_Development_the_proxy_and_the_key_folder_are_required_and_in_Development_optional()
    {
        var production = new StartupProblems();
        var development = new StartupProblems();

        Assert.Null(HostingSettings.Read(Config(), Env("Production"), production));
        var settings = HostingSettings.Read(Config(), Env("Development"), development);

        Assert.Contains(production.All, p => p.Contains("Proxy:KnownProxy"));
        Assert.Contains(production.All, p => p.Contains("DataProtection:KeysPath"));
        Assert.Empty(development.All);
        Assert.Null(settings!.KnownProxy);
        Assert.Null(settings.KeysPath);
    }

    [Fact]
    public void In_Development_an_invalid_proxy_address_is_still_refused()
    {
        var problems = new StartupProblems();

        Assert.Null(HostingSettings.Read(Config(("Proxy:KnownProxy", "nonsense")), Env("Development"), problems));

        Assert.Contains(problems.All, p => p.Contains("Proxy:KnownProxy"));
    }

    // ---- Startup ----

    private static string Messages(Exception error)
    {
        var messages = new List<string>();
        for (var e = error; e is not null; e = e.InnerException) messages.Add(e.Message);
        return string.Join("\n", messages);
    }

    [Fact]
    public void A_Production_start_with_several_settings_missing_names_every_one_in_one_message()
    {
        using var host = new ProductionHost(s =>
        {
            s["ConnectionStrings:Default"] = null;
            s["Auth:TokenKey"] = "short";
            s["App:PublicBaseUrl"] = "http://rooms.test";
            s["Email:Provider"] = null;
            s["Proxy:KnownProxy"] = null;
            s["DataProtection:KeysPath"] = null;
        });

        var message = Messages(Assert.ThrowsAny<Exception>(() => host.CreateClient()));

        foreach (var name in new[]
                 {
                     "ConnectionStrings:Default", "Auth:TokenKey", "App:PublicBaseUrl",
                     "Email:Provider", "Proxy:KnownProxy", "DataProtection:KeysPath",
                 })
            Assert.Contains(name, message);
    }

    [Fact]
    public void A_Production_start_with_Resend_but_no_sender_or_key_names_both()
    {
        using var host = new ProductionHost(s =>
        {
            s["Email:From"] = null;
            s["Email:Resend:ApiKey"] = null;
        });

        var message = Messages(Assert.ThrowsAny<Exception>(() => host.CreateClient()));

        Assert.Contains("Email:From", message);
        Assert.Contains("Email:Resend:ApiKey", message);
    }

    [Fact]
    public void A_Production_start_with_an_invalid_proxy_address_is_refused()
    {
        using var host = new ProductionHost(s => s["Proxy:KnownProxy"] = "10.0.0.1,10.0.0.2");

        Assert.Contains("Proxy:KnownProxy", Messages(Assert.ThrowsAny<Exception>(() => host.CreateClient())));
    }

    [Fact]
    public void A_complete_Production_start_works()
    {
        using var host = new ProductionHost();

        using var client = host.CreateClient();

        Assert.NotNull(client);
    }

    [Fact]
    public void The_image_library_self_check_passes()
    {
        ProjectImageEndpoints.SelfCheck();
    }

    // ---- Email queue ----

    private sealed record Job : EmailJob;

    [Fact]
    public void A_full_queue_says_so_and_does_not_count_the_dropped_job()
    {
        var queue = new EmailQueue(2);

        Assert.True(queue.Enqueue(new Job()));
        Assert.True(queue.Enqueue(new Job()));
        Assert.False(queue.Enqueue(new Job()));

        Assert.Equal(2, queue.Unfinished);
    }

    [Fact]
    public async Task A_queue_has_room_again_once_a_job_is_read()
    {
        var queue = new EmailQueue(1);
        Assert.True(queue.Enqueue(new Job()));
        Assert.False(queue.Enqueue(new Job()));

        await foreach (var _ in queue.ReadAllAsync(CancellationToken.None)) break;
        queue.Finished();

        Assert.Equal(0, queue.Unfinished);
        Assert.True(queue.Enqueue(new Job()));
    }

    // ---- Forwarded headers ----

    private static async Task<string?> FailedRedeemAddress(ProductionHost host, HttpClient client)
    {
        var response = await RedeemWrongToken(client);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = host.Services.CreateScope();
        return scope.ServiceProvider
            .GetRequiredService<Data.AppDbContext>()
            .AuditEvents.Where(a => a.Action == "sign_in_failed").OrderByDescending(a => a.CreatedAt).First().IpAddress;
    }

    // Cookies are carried by hand, so this does not depend on a cookie jar.
    private static async Task<HttpResponseMessage> RedeemWrongToken(HttpClient client)
    {
        var csrf = await client.GetAsync("/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, csrf.StatusCode);
        var cookie = csrf.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("idr_csrf")).Split(';')[0];
        using var json = JsonDocument.Parse(await csrf.Content.ReadAsStringAsync());
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/redeem") { Content = JsonContent.Create(new { token = "wrong" }) };
        request.Headers.TryAddWithoutValidation("Origin", RoomsFactory.BaseUrl);
        request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", json.RootElement.GetProperty("token").GetString());
        request.Headers.TryAddWithoutValidation("Cookie", cookie);
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task A_forwarded_address_from_an_untrusted_peer_is_ignored()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom("203.0.113.5", forwardedFor: "198.51.100.7", forwardedProto: "http", baseAddress: RoomsFactory.BaseUrl);

        Assert.Equal("203.0.113.5", await FailedRedeemAddress(host, client));
    }

    [Fact]
    public async Task A_forwarded_address_from_the_configured_proxy_is_the_client_address()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom(ProductionSettings.ProxyAddress, forwardedFor: "198.51.100.7", forwardedProto: "https");

        Assert.Equal("198.51.100.7", await FailedRedeemAddress(host, client));
    }

    [Fact]
    public async Task Only_one_hop_is_believed_the_nearest_address_a_client_may_have_made_up_the_rest()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom(ProductionSettings.ProxyAddress, forwardedFor: "192.0.2.99, 198.51.100.7", forwardedProto: "https");

        Assert.Equal("198.51.100.7", await FailedRedeemAddress(host, client));
    }

    [Fact]
    public async Task A_different_address_than_the_proxy_is_not_trusted_even_in_the_same_network()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom("10.20.30.41", forwardedFor: "198.51.100.7", forwardedProto: "https", baseAddress: RoomsFactory.BaseUrl);

        Assert.Equal("10.20.30.41", await FailedRedeemAddress(host, client));
    }

    [Fact]
    public async Task The_forwarded_protocol_from_the_proxy_makes_the_request_https_and_from_others_it_does_not()
    {
        using var host = new ProductionHost();
        using var trusted = host.ClientFrom(ProductionSettings.ProxyAddress, forwardedFor: "198.51.100.7", forwardedProto: "https");
        using var untrusted = host.ClientFrom("203.0.113.5", forwardedFor: "198.51.100.7", forwardedProto: "https");

        // The secure antiforgery cookie only works on an https request.
        Assert.Equal(HttpStatusCode.OK, (await trusted.GetAsync("/auth/csrf")).StatusCode);
        var error = await Record.ExceptionAsync(async () =>
            Assert.Equal(HttpStatusCode.OK, (await untrusted.GetAsync("/auth/csrf")).StatusCode));
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Without_a_configured_proxy_in_Development_no_forwarded_header_is_trusted()
    {
        using var f = new RoomsFactory();
        using var app = f.WithWebHostBuilder(b => b.ConfigureServices(TestRemoteAddress.AddTo));
        using var client = app.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl), AllowAutoRedirect = false, HandleCookies = false,
        });
        client.DefaultRequestHeaders.Add(TestRemoteAddress.Header, ProductionSettings.ProxyAddress);
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "198.51.100.7");

        var response = await RedeemWrongToken(client);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ProductionSettings.ProxyAddress,
            f.WithDb(db => db.AuditEvents.Single(a => a.Action == "sign_in_failed").IpAddress));
    }

    // ---- IPv6 limits ----

    [Theory]
    [InlineData("203.0.113.5", "203.0.113.5")]
    [InlineData("::ffff:203.0.113.5", "203.0.113.5")]
    [InlineData("2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2::1", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:3::1", "2001:db8:1:3::/64")]
    [InlineData("::1", "::/64")]
    public void The_partition_key_groups_IPv6_by_its_64_bit_prefix(string address, string expected)
    {
        Assert.Equal(expected, ClientIp.PartitionKey(IPAddress.Parse(address)));
    }

    [Fact]
    public void An_IPv6_scope_does_not_split_a_prefix()
    {
        var scoped = IPAddress.Parse("fe80::1%3");

        Assert.Equal(ClientIp.PartitionKey(IPAddress.Parse("fe80::2")), ClientIp.PartitionKey(scoped));
    }

    [Fact]
    public void No_address_is_one_unknown_partition()
    {
        Assert.Equal("unknown", ClientIp.PartitionKey(null));
    }

    [Fact]
    public async Task Two_addresses_in_one_IPv6_prefix_share_a_limit_and_another_prefix_does_not()
    {
        using var host = new ProductionHost();
        // No forwarding: the peers are direct, over https.
        using var first = host.ClientFrom("2001:db8:1:2::1", baseAddress: RoomsFactory.BaseUrl);
        using var sibling = host.ClientFrom("2001:db8:1:2:aaaa::7", baseAddress: RoomsFactory.BaseUrl);
        using var other = host.ClientFrom("2001:db8:1:3::1", baseAddress: RoomsFactory.BaseUrl);

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await RedeemWrongToken(first)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await RedeemWrongToken(sibling)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await RedeemWrongToken(other)).StatusCode);
    }

    // ---- Cookies and keys ----

    [Fact]
    public async Task Outside_Development_the_antiforgery_cookie_is_Secure()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom(ProductionSettings.ProxyAddress, forwardedFor: "198.51.100.7", forwardedProto: "https");

        var response = await client.GetAsync("/auth/csrf");

        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("idr_csrf"));
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Data_protection_keys_are_written_to_the_configured_folder()
    {
        using var host = new ProductionHost();
        using var client = host.ClientFrom(ProductionSettings.ProxyAddress, forwardedFor: "198.51.100.7", forwardedProto: "https");

        // The antiforgery token needs a key, so the first one is made now.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/auth/csrf")).StatusCode);

        var folder = host.Settings["DataProtection:KeysPath"]!;
        Assert.NotEmpty(Directory.GetFiles(folder, "key-*.xml"));
    }
}
