using System.Threading.RateLimiting;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Conversations;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using IdeaDiscovery.Api.Projects;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Refuses to start outside Development without a strong token key and an
// https public address.
var authSettings = AuthSettings.Read(builder.Configuration, builder.Environment);
builder.Services.AddSingleton(authSettings);
builder.Services.AddSingleton<TokenHasher>();
builder.Services.AddScoped<SignInLinks>();

// Refuses to start with the Folder sender outside Development. With no
// provider the app starts and drops emails with a warning.
var emailSettings = EmailSettings.Read(builder.Configuration, builder.Environment);
builder.Services.AddSingleton(emailSettings);
builder.Services.AddSingleton<EmailQueue>();
// Refuses to start if a supported language has no email template, or its placeholders differ.
builder.Services.AddSingleton(EmailTemplates.LoadFromBuildOutput());
if (emailSettings.Provider == EmailProvider.Folder) builder.Services.AddSingleton<IEmailSender, FolderEmailSender>();
else builder.Services.AddSingleton<IEmailSender, NoEmailSender>();
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
    // Antiforgery refuses to run behind a TLS-terminating proxy when this is
    // Always, because the app sees plain http. The token's cookie carries no
    // access; PR 9 (forwarded headers) makes it Secure on the public address.
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// Using links is limited per client IP: 10 attempts in 15 minutes.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Asking for links: 10 an hour per client IP. Past it the answer is 429,
    // which says nothing about any email.
    options.AddPolicy(AuthEndpoints.RequestLinkRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));
    // Asking to join: 5 an hour per client IP.
    options.AddPolicy(JoinEndpoints.AskRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));
    // Inviting: 30 an hour per client IP.
    options.AddPolicy(InvitationEndpoints.InviteRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
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
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
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

builder.Services.AddDatabase(builder.Configuration);

var app = builder.Build();

DatabaseSetup.Initialise(app.Services);

if (emailSettings.Provider == EmailProvider.None)
    app.Logger.LogWarning("Email:Provider is not set. Sign-in emails are dropped, not sent.");

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
