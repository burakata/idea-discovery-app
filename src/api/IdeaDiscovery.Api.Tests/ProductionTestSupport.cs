using System.Collections.Concurrent;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IdeaDiscovery.Api.Tests;

// What a Production start needs, and a way to act as the proxy in tests.
public static class ProductionSettings
{
    public const string ProxyAddress = "10.20.30.40";
    public const string TokenKey = "production-test-key-0123456789-abcdefghij";

    // Every setting a Production start requires. Tests change or remove one to
    // see the refusal. Pass a connection string; the keys folder is new each time.
    public static Dictionary<string, string?> Good(string connection) => new()
    {
        ["Auth:TokenKey"] = TokenKey,
        ["App:PublicBaseUrl"] = RoomsFactory.BaseUrl,
        ["Consultant:Email"] = RoomsFactory.ConsultantEmail,
        ["ConnectionStrings:Default"] = connection,
        ["Email:Provider"] = "Resend",
        ["Email:From"] = "Rooms <hello@rooms.test>",
        ["Email:Resend:ApiKey"] = "re_test_key_not_real",
        ["Proxy:KnownProxy"] = ProxyAddress,
        ["DataProtection:KeysPath"] = Path.Combine(Path.GetTempPath(), "idr-keys-" + Guid.NewGuid().ToString("N")),
    };

    public static void DeleteKeys(IReadOnlyDictionary<string, string?> settings)
    {
        if (settings.TryGetValue("DataProtection:KeysPath", out var path) && path is not null && Directory.Exists(path))
            Directory.Delete(path, true);
    }
}

// Test servers have no network peer, so a request says who it is from with this
// header. Everything after this middleware sees it as the connection's address,
// as it would behind a real proxy.
public sealed class TestRemoteAddress : IStartupFilter
{
    public const string Header = "X-Test-Remote-Ip";

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, nextMiddleware) =>
        {
            if (context.Request.Headers.TryGetValue(Header, out var value) && IPAddress.TryParse(value, out var address))
                context.Connection.RemoteIpAddress = address;
            return nextMiddleware(context);
        });
        next(app);
    };

    public static void AddTo(IServiceCollection services) => services.AddSingleton<IStartupFilter, TestRemoteAddress>();
}

// Warning-and-above log lines, with exceptions, so a leak in either shows.
public sealed class CapturedLog : ILoggerProvider, ILogger
{
    public ConcurrentQueue<(LogLevel Level, string Text)> Entries { get; } = new();
    public IEnumerable<string> Lines => Entries.Select(e => e.Text);
    public ILogger CreateLogger(string categoryName) => this;
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (logLevel >= LogLevel.Warning) Entries.Enqueue((logLevel, formatter(state, exception) + exception));
    }
    public void Dispose() { }
}

// A Production app with a private database, settings to change and a log.
public sealed class ProductionHost : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _keepAlive;

    public Dictionary<string, string?> Settings { get; }
    public CapturedLog Log { get; } = new();

    public ProductionHost(Action<Dictionary<string, string?>>? change = null)
    {
        var connection = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
        _keepAlive = new SqliteConnection(connection);
        _keepAlive.Open();
        Settings = ProductionSettings.Good(connection);
        change?.Invoke(Settings);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        foreach (var (key, value) in Settings)
            if (value is not null) builder.UseSetting(key, value);
        builder.ConfigureLogging(l => l.AddProvider(Log));
        builder.ConfigureServices(TestRemoteAddress.AddTo);
    }

    // As a client that the proxy forwarded (or not): the address the request
    // comes from, and any forwarded headers it carries.
    public HttpClient ClientFrom(
        string? remoteIp, string? forwardedFor = null, string? forwardedProto = null, string baseAddress = "http://rooms.test")
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(baseAddress),
            AllowAutoRedirect = false,
            HandleCookies = false,
        });
        if (remoteIp is not null) client.DefaultRequestHeaders.Add(TestRemoteAddress.Header, remoteIp);
        if (forwardedFor is not null) client.DefaultRequestHeaders.Add("X-Forwarded-For", forwardedFor);
        if (forwardedProto is not null) client.DefaultRequestHeaders.Add("X-Forwarded-Proto", forwardedProto);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        _keepAlive.Dispose();
        ProductionSettings.DeleteKeys(Settings);
    }
}
