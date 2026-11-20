using System.Text.Json;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Auth;

public static class AuthEndpoints
{
    public const string RedeemRateLimit = "redeem";
    public const string RequestLinkRateLimit = "request-link";
    private const int MaxDeviceLength = 200;
    private const int MaxEmailLength = 254;

    private sealed record RedeemRequest(string? Token);
    private sealed record RequestLinkRequest(string? Email);

    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth");

        // Anonymous on purpose: a person without a session needs the token to
        // send the one POST that signs them in.
        auth.MapGet("/csrf", (HttpContext http, IAntiforgery antiforgery) =>
            Results.Ok(new { token = antiforgery.GetAndStoreTokens(http).RequestToken }))
            .AllowAnonymous();

        auth.MapPost("/redeem", RedeemAsync)
            .AllowAnonymous()
            .RequireRateLimiting(RedeemRateLimit);

        // Anonymous on purpose: the person asking has no session yet.
        auth.MapPost("/request-link", RequestLinkAsync)
            .AllowAnonymous()
            .RequireRateLimiting(RequestLinkRateLimit);

        auth.MapPost("/sign-out", SignOutAsync);
        auth.MapGet("/me", MeAsync);
    }

    // Every failure looks the same, so a response never says whether a link
    // was used, expired, revoked or never existed.
    private static IResult LinkNotValid() => Results.Text("{\"error\":\"link_not_valid\"}", "application/json", statusCode: 400);

    // The same empty 202 for every email and every body, so the answer never says
    // whether an email is known. The request touches no database: it only checks
    // the shape and queues the work, which the email dispatcher does afterwards.
    private static async Task<IResult> RequestLinkAsync(
        HttpContext http, EmailQueue queue, ILogger<SignInLinks> log)
    {
        var accepted = Results.Accepted();

        string? email = null;
        try { if (http.Request.HasJsonContentType()) email = (await http.Request.ReadFromJsonAsync<RequestLinkRequest>())?.Email; }
        catch (JsonException) { }
        catch (BadHttpRequestException) { }
        if (string.IsNullOrWhiteSpace(email) || email.Length > MaxEmailLength) return accepted;
        email = Emails.Normalise(email);
        if (!LooksLikeEmail(email)) return accepted;

        if (!queue.Enqueue(new SignInLinkRequest(email, http.Connection.RemoteIpAddress?.ToString())))
            log.LogWarning("The sign-in link queue is full, so a request was dropped.");
        return accepted;
    }

    // Cheap shape check: one "@" with something on both sides, and no spaces.
    private static bool LooksLikeEmail(string email)
    {
        var at = email.IndexOf('@');
        return at > 0 && at == email.LastIndexOf('@') && at < email.Length - 1
            && !email.Any(c => char.IsWhiteSpace(c) || char.IsControl(c));
    }

    private static async Task<IResult> RedeemAsync(
        HttpContext http, AppDbContext db, TokenHasher hasher, TimeProvider clock, ILogger<SignInLinks> log)
    {
        var ip = http.Connection.RemoteIpAddress?.ToString();

        string? token = null;
        // A body that is not JSON fails like every other bad link, not with a 500.
        try { if (http.Request.HasJsonContentType()) token = (await http.Request.ReadFromJsonAsync<RedeemRequest>())?.Token; }
        catch (JsonException) { }
        catch (BadHttpRequestException) { }

        UserSession? session = null;
        if (TokenHasher.LooksLikeToken(token))
        {
            try { session = await TryRedeemAsync(db, hasher, clock, token!, http, ip); }
            catch (Exception ex) when (ex is DbUpdateException or SqliteException)
            {
                // Typically the loser of two parallel uses of one link.
                log.LogWarning(ex, "A link could not be redeemed.");
            }
        }

        if (session is null)
        {
            db.ChangeTracker.Clear();
            AuditLog.Add(db, clock, "sign_in_failed", null, ip);
            await db.SaveChangesAsync();
            return LinkNotValid();
        }

        await SignInWithSessionAsync(http, session);
        return Results.Ok(await ReadMeAsync(db, session.UserId));
    }

    // Shared with the join claim: one place makes a session row and its cookie.
    // The row is added to the context; the caller saves it.
    internal static UserSession NewSession(AppDbContext db, DateTime now, Guid userId, HttpContext http, string? ip)
    {
        var userAgent = http.Request.Headers.UserAgent.ToString();
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = now,
            ExpiresAt = now + SessionValidation.SessionLifetime,
            LastSeenAt = now,
            Device = userAgent.Length > MaxDeviceLength ? userAgent[..MaxDeviceLength] : userAgent,
            IpAddress = ip,
        };
        db.UserSessions.Add(session);
        return session;
    }

    internal static Task SignInWithSessionAsync(HttpContext http, UserSession session) =>
        http.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            SessionValidation.NewPrincipal(session.UserId, session.Id),
            new AuthenticationProperties
            {
                IsPersistent = true,
                AllowRefresh = false,
                ExpiresUtc = new DateTimeOffset(session.ExpiresAt, TimeSpan.Zero),
            });

    // One transaction: the token is spent, the person and membership exist, the
    // invitation is accepted and the session is created, or none of it happens.
    private static async Task<UserSession?> TryRedeemAsync(
        AppDbContext db, TokenHasher hasher, TimeProvider clock, string token, HttpContext http, string? ip)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var hash = hasher.Hash(token);
        await using var tx = await db.Database.BeginTransactionAsync();

        // The single conditional update is the only gate: of two parallel uses,
        // the database lets exactly one change the row.
        var spent = await db.SignInTokens
            .Where(t => t.TokenHash == hash && t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, (DateTime?)now));
        if (spent != 1) return null;

        var row = await db.SignInTokens.AsNoTracking().SingleAsync(t => t.TokenHash == hash);

        User? user;
        Guid? projectId = null;
        string? details = null;
        if (row.Purpose == TokenPurpose.SignIn)
        {
            user = await db.Users.SingleOrDefaultAsync(u => u.Id == row.UserId);
            if (user is null) return null;
        }
        else
        {
            var invitation = await db.Invitations.AsNoTracking().SingleOrDefaultAsync(i => i.Id == row.InvitationId);
            if (invitation is null || invitation.RevokedAt is not null || invitation.AcceptedAt is not null
                || invitation.ExpiresAt <= now)
                return null;

            user = await db.Users.SingleOrDefaultAsync(u => u.Email != null && u.Email == invitation.Email);
            // An invitation must never sign anyone in as the consultant. Nothing
            // has been committed, so leaving here rolls the spent token back.
            if (user is { IsConsultant: true }) return null;
            if (user is null)
            {
                user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = invitation.Email,
                    DisplayName = invitation.DisplayName,
                    CreatedAt = now,
                };
                db.Users.Add(user);
            }
            if (!await db.ProjectMembers.AnyAsync(m => m.ProjectId == invitation.ProjectId && m.UserId == user.Id))
                db.ProjectMembers.Add(new ProjectMember
                {
                    Id = Guid.NewGuid(),
                    ProjectId = invitation.ProjectId,
                    UserId = user.Id,
                    Role = MemberRole.Owner,
                    JoinedAt = now,
                });
            await db.SaveChangesAsync();

            var accepted = await db.Invitations
                .Where(i => i.Id == invitation.Id && i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(i => i.AcceptedAt, (DateTime?)now)
                    .SetProperty(i => i.AcceptedUserId, (Guid?)user.Id));
            if (accepted != 1) return null;

            projectId = invitation.ProjectId;
            details = $"invitation:{invitation.Id}";
            AuditLog.Add(db, clock, "invitation_accepted", user.Id, ip, projectId, details);
        }

        var session = NewSession(db, now, user.Id, http, ip);
        AuditLog.Add(db, clock, "sign_in", user.Id, ip, projectId, $"session:{session.Id}");
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return session;
    }

    private static async Task<IResult> SignOutAsync(HttpContext http, AppDbContext db, TimeProvider clock)
    {
        var userId = SessionValidation.UserId(http.User);
        var sessionId = SessionValidation.SessionId(http.User);
        var now = clock.GetUtcNow().UtcDateTime;
        await db.UserSessions
            .Where(s => s.Id == sessionId && s.UserId == userId && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));
        AuditLog.Add(db, clock, "sign_out", userId, http.Connection.RemoteIpAddress?.ToString(), null, $"session:{sessionId}");
        await db.SaveChangesAsync();
        await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static async Task<IResult> MeAsync(HttpContext http, AppDbContext db)
    {
        var me = await ReadMeAsync(db, SessionValidation.UserId(http.User)!.Value);
        return me is null ? Results.Unauthorized() : Results.Ok(me);
    }

    internal static Task<object?> ReadMeAsync(AppDbContext db, Guid userId) =>
        db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (object?)new { id = u.Id, displayName = u.DisplayName, email = u.Email, uiLanguage = u.UiLanguage, isConsultant = u.IsConsultant })
            .SingleOrDefaultAsync();
}
