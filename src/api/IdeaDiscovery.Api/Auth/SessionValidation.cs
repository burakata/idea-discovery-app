using System.Security.Claims;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Auth;

// The cookie holds only a session id and a user id. Every request checks them
// against the database, so ending a session, or moving the consultant flag,
// takes effect on the next request.
public static class SessionValidation
{
    public const string SessionClaim = "idr:session";
    // Added to the principal for one request, from the database. Never in the cookie.
    public const string ConsultantClaim = "idr:consultant";
    public const string ConsultantPolicy = "Consultant";

    public static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan LastSeenInterval = TimeSpan.FromMinutes(5);

    public static ClaimsPrincipal NewPrincipal(Guid userId, Guid sessionId) =>
        new(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(SessionClaim, sessionId.ToString())],
            CookieAuthenticationDefaults.AuthenticationScheme));

    public static Guid? UserId(ClaimsPrincipal? user) =>
        Guid.TryParse(user?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static Guid? SessionId(ClaimsPrincipal? user) =>
        Guid.TryParse(user?.FindFirstValue(SessionClaim), out var id) ? id : null;

    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        var userId = UserId(context.Principal);
        var sessionId = SessionId(context.Principal);
        var http = context.HttpContext;
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        var now = http.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow().UtcDateTime;

        var found = userId is null || sessionId is null
            ? null
            : await (from s in db.UserSessions
                     join u in db.Users on s.UserId equals u.Id
                     where s.Id == sessionId && s.UserId == userId
                     select new { s.RevokedAt, s.ExpiresAt, s.LastSeenAt, u.IsConsultant })
                .AsNoTracking().SingleOrDefaultAsync();

        if (found is null || found.RevokedAt is not null || found.ExpiresAt <= now)
        {
            context.RejectPrincipal();
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        if (now - found.LastSeenAt > LastSeenInterval)
            await db.UserSessions.Where(s => s.Id == sessionId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.LastSeenAt, now));

        if (found.IsConsultant)
            context.Principal!.AddIdentity(new ClaimsIdentity([new Claim(ConsultantClaim, "true")]));
        // Never rewrite the cookie: the per-request claim must not be stored.
        context.ShouldRenew = false;
    }
}
