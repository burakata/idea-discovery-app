using System.Threading.RateLimiting;
using IdeaDiscovery.Api;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Conversations;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using IdeaDiscovery.Api.Projects;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Every setting is read first; the app then refuses to start once, naming each
// problem. Outside Development that includes a strong token key, an https public
// address, an email provider (Resend), the one proxy and the key folder.
var problems = new StartupProblems();
var authRead = AuthSettings.Read(builder.Configuration, builder.Environment, problems);
var emailRead = EmailSettings.Read(builder.Configuration, builder.Environment, problems);
var hostingRead = HostingSettings.Read(builder.Configuration, builder.Environment, problems);
var connection = DatabaseSetup.ReadConnection(builder.Configuration, problems);
DatabaseSetup.CheckConsultant(builder.Configuration, builder.Environment, problems);
problems.ThrowIfAny();
// Nothing is null past this point: a missing value added a problem above.
var authSettings = authRead!;
var emailSettings = emailRead!;
var hostingSettings = hostingRead!;

// Proves the image library's native part loads here, before the first upload needs it.
ProjectImageEndpoints.SelfCheck();

builder.Services.AddSingleton(authSettings);
builder.Services.AddSingleton<TokenHasher>();
builder.Services.AddScoped<SignInLinks>();

builder.Services.AddSingleton(emailSettings);
builder.Services.AddSingleton<EmailQueue>();
// Refuses to start if a supported language has no email template, or its placeholders differ.
builder.Services.AddSingleton(EmailTemplates.LoadFromBuildOutput());
switch (emailSettings.Provider)
{
    case EmailProvider.Folder:
        builder.Services.AddSingleton<IEmailSender, FolderEmailSender>();
        break;
    case EmailProvider.Resend:
        // A client per send, so connections and DNS are refreshed by the factory.
        builder.Services.AddHttpClient(ResendEmailSender.ClientName, client => client.Timeout = TimeSpan.FromSeconds(15));
        builder.Services.AddSingleton<IEmailSender>(sp => new ResendEmailSender(
            sp.GetRequiredService<IHttpClientFactory>(), emailSettings,
            sp.GetRequiredService<ILogger<ResendEmailSender>>(), sp.GetRequiredService<TimeProvider>()));
        break;
    default: // only in Development, where the provider may be left unset
        builder.Services.AddSingleton<IEmailSender, NoEmailSender>();
        break;
}
builder.Services.AddHostedService<EmailDispatcher>();
// One clock for the whole app, so tests can move it.
builder.Services.TryAddSingleton(TimeProvider.System);

// Cookie authentication. Refusals answer with a status code and never
// redirect to a login page. The cookie holds only a session id; every request
// is checked against the database.
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        // Behind a TLS-terminating proxy the app sees plain http, so only
        // local development may send the cookie without the Secure flag.
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        // A session lasts 30 days from sign-in and is never extended.
        options.SlidingExpiration = false;
        options.Events.OnValidatePrincipal = SessionValidation.ValidateAsync;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<TimeProvider>((options, clock) => options.TimeProvider = clock);

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = CsrfProtection.HeaderName;
    options.Cookie.Name = "idr_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    // Antiforgery refuses to run on a request that is not https when this is
    // Always. Behind the proxy the forwarded protocol (Proxy:KnownProxy) makes
    // requests https, so outside Development the cookie is always Secure.
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

// Where the proxy sits: only the one configured address may say who the client
// is and which scheme it used, and only one hop is believed. Without the
// setting (Development) no forwarded header is trusted.
if (hostingSettings.KnownProxy is { } knownProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        // The defaults trust loopback; only the configured proxy is trusted.
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        options.KnownProxies.Add(knownProxy);
        options.ForwardLimit = 1;
    });
}

// Keys that survive restarts, so sessions and antiforgery tokens stay valid.
// They are not encrypted at rest; the folder's permissions protect them.
if (hostingSettings.KeysPath is { } keysPath)
{
    builder.Services.AddDataProtection()
        .SetApplicationName(HostingSettings.ApplicationName)
        .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

// Using links is limited per client IP: 10 attempts in 15 minutes.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Asking for links: 10 an hour per client IP. Past it the answer is 429,
    // which says nothing about any email.
    options.AddPolicy(AuthEndpoints.RequestLinkRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIp.PartitionKey(context.Connection.RemoteIpAddress),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));
    // Asking to join: 5 an hour per client IP.
    options.AddPolicy(JoinEndpoints.AskRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIp.PartitionKey(context.Connection.RemoteIpAddress),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));
    // Inviting: 30 an hour per client IP.
    options.AddPolicy(InvitationEndpoints.InviteRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIp.PartitionKey(context.Connection.RemoteIpAddress),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));
    // Posting a message: 30 a minute per signed-in person.
    options.AddPolicy(ConversationEndpoints.PostRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            SessionValidation.UserId(context.User)?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    options.AddPolicy(AuthEndpoints.RedeemRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIp.PartitionKey(context.Connection.RemoteIpAddress),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
            }));
});

// Deny by default: an endpoint without an explicit access rule needs a
// signed-in user.
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    // Read from the database on each request, never from the cookie.
    options.AddPolicy(SessionValidation.ConsultantPolicy, policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim(SessionValidation.ConsultantClaim, "true"));
});

builder.Services.AddDatabase(connection!);

var app = builder.Build();

DatabaseSetup.Initialise(app.Services);

if (emailSettings.Provider == EmailProvider.None)
    app.Logger.LogWarning("Email:Provider is not set. Sign-in emails are dropped, not sent.");

// First, so everything after it (path base, authentication, the rate limiter,
// audit entries) sees the client's address and scheme, not the proxy's.
if (hostingSettings.KnownProxy is not null) app.UseForwardedHeaders();

// The browser reaches the API at /api/... on its own origin, so the client's
// pages never clash with API routes. The root paths keep working too. Routing
// is explicit so that it sees the path after the base is removed.
app.UsePathBase("/api");
app.UseRouting();

app.UseAuthentication();
// After authentication, so the message limit can be counted per person.
app.UseRateLimiter();
app.UseMiddleware<CsrfProtection>();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();

app.MapAuth();
app.MapJoin();
app.MapConsultant();
app.MapProjects();
app.MapProjectImages();
app.MapConversations();

app.Run();

public partial class Program;
