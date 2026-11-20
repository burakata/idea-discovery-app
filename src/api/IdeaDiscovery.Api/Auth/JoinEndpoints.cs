using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IdeaDiscovery.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Auth;

// Ask to join, the person's side. All of it is anonymous: the person has no
// session yet. What they may do is limited by the project's code, and later by
// a cookie that holds a secret only their browser knows.
public static class JoinEndpoints
{
    public const string AskRateLimit = "join-ask";
    public const string CookieName = "join_request";
    public const int MaxNameLength = 80;
    public const int MaxEmailLength = 254;
    public const int MaxWaitingPerProject = 20;
    private const int MaxCodeLength = 64;

    public static readonly TimeSpan RequestLifetime = TimeSpan.FromHours(48);
    public static readonly TimeSpan ApprovalWindow = TimeSpan.FromHours(48);
    // Long enough to reach the end of the approval window.
    public static readonly TimeSpan CookieLifetime = TimeSpan.FromHours(96);

    private sealed record AskRequest(string? Name, string? Email);

    public static void MapJoin(this IEndpointRouteBuilder app)
    {
        var join = app.MapGroup("/join");

        // Anonymous on purpose: the person opening the project link has no session.
        // The literal routes win over {code}, and no code can be that short.
        join.MapGet("/request", StatusAsync).AllowAnonymous();
        join.MapPost("/claim", ClaimAsync).AllowAnonymous();
        join.MapGet("/{code}", CanAskAsync).AllowAnonymous();
        join.MapPost("/{code}", AskAsync).AllowAnonymous().RequireRateLimiting(AskRateLimit);
    }

    public static string NewCode() =>
        System.Buffers.Text.Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(16));

    // ---- The project link ----

    // The same answer for an unknown code and a switched-off project, and
    // nothing about the project.
    private static async Task<IResult> CanAskAsync(string code, AppDbContext db) =>
        Results.Json(new { canAsk = await FindProjectIdAsync(db, code) is not null });

    private static async Task<Guid?> FindProjectIdAsync(AppDbContext db, string code)
    {
        if (string.IsNullOrEmpty(code) || code.Length > MaxCodeLength) return null;
        return await db.Projects.AsNoTracking()
            .Where(p => p.AskToJoinEnabled && p.JoinCode == code)
            .Select(p => (Guid?)p.Id)
            .SingleOrDefaultAsync();
    }

    private static IResult CannotAsk() => Results.Text("{\"error\":\"cannot_ask\"}", "application/json", statusCode: 404);
    private static IResult Invalid() => Results.Text("{\"error\":\"invalid_request\"}", "application/json", statusCode: 400);
    private static IResult CannotClaim() => Results.Text("{\"error\":\"cannot_claim\"}", "application/json", statusCode: 400);

    // ---- Asking ----

    private static async Task<IResult> AskAsync(
        string code, HttpContext http, AppDbContext db, TokenHasher hasher, TimeProvider clock, IWebHostEnvironment env)
    {
        var projectId = await FindProjectIdAsync(db, code);
        if (projectId is null) return CannotAsk();

        var now = clock.GetUtcNow().UtcDateTime;
        // A browser that already waits on this project gets its own request back.
        var existing = await FindOwnRequestAsync(http, db, hasher);
        if (existing is { State: JoinRequestState.Pending } && existing.ProjectId == projectId && existing.ExpiresAt > now)
            return Results.Json(new { state = "pending" }, statusCode: StatusCodes.Status202Accepted);

        AskRequest? body = null;
        try { if (http.Request.HasJsonContentType()) body = await http.Request.ReadFromJsonAsync<AskRequest>(); }
        catch (JsonException) { }
        catch (BadHttpRequestException) { }
        var name = body?.Name?.Trim();
        var email = body?.Email?.Trim();
        if (string.IsNullOrEmpty(email)) email = null;
        if (string.IsNullOrEmpty(name) || name.Length > MaxNameLength || HasControlCharacters(name)
            || (email is not null && (email.Length > MaxEmailLength || HasControlCharacters(email))))
            return Invalid();

        var ip = http.Connection.RemoteIpAddress?.ToString();
        var secret = TokenHasher.NewToken();
        var request = new JoinRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId.Value,
            Name = name,
            UncheckedEmail = email,
            SecretHash = hasher.Hash(secret),
            Device = Truncate(http.Request.Headers.UserAgent.ToString(), 200),
            IpAddress = ip,
            CreatedAt = now,
            ExpiresAt = now + RequestLifetime,
            State = JoinRequestState.Pending,
        };

        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            var waiting = await db.JoinRequests.CountAsync(r =>
                r.ProjectId == projectId && r.State == JoinRequestState.Pending && r.ExpiresAt > now);
            if (waiting >= MaxWaitingPerProject)
                return Results.Text("{\"error\":\"try_later\"}", "application/json", statusCode: 429);

            db.JoinRequests.Add(request);
            // No name or email in the audit row.
            AuditLog.Add(db, clock, "join_requested", null, ip, projectId, $"request:{request.Id}");
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        var options = CookieSettings(http, env);
        options.MaxAge = CookieLifetime;
        http.Response.Cookies.Append(CookieName, $"{request.Id:N}.{secret}", options);
        return Results.Json(new { state = "pending" }, statusCode: StatusCodes.Status202Accepted);
    }

    // ---- Waiting ----

    // Reads the cookie only and changes nothing. "expired" covers every case in
    // which this browser has nothing to wait for, so the answer reveals no more.
    private static async Task<IResult> StatusAsync(
        HttpContext http, AppDbContext db, TokenHasher hasher, TimeProvider clock)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var request = await FindOwnRequestAsync(http, db, hasher);
        var state = request switch
        {
            null => "expired",
            { State: JoinRequestState.Rejected } => "rejected",
            { State: JoinRequestState.Pending } => request.ExpiresAt > now ? "pending" : "expired",
            _ => request.ClaimedAt is null && request.ApprovedUntil >= now ? "approved" : "expired",
        };
        return Results.Json(new { state });
    }

    // ---- Claiming ----

    private static async Task<IResult> ClaimAsync(
        HttpContext http, AppDbContext db, TokenHasher hasher, TimeProvider clock, IWebHostEnvironment env,
        ILogger<JoinRequest> log)
    {
        var ip = http.Connection.RemoteIpAddress?.ToString();
        UserSession? session = null;
        try
        {
            var request = await FindOwnRequestAsync(http, db, hasher);
            if (request is not null) session = await TryClaimAsync(db, clock, request, http, ip);
        }
        catch (Exception ex) when (ex is DbUpdateException or SqliteException)
        {
            // Typically the loser of two parallel claims.
            log.LogWarning("A join claim could not be completed ({Error}).", ex.GetType().Name);
        }

        if (session is null)
        {
            db.ChangeTracker.Clear();
            AuditLog.Add(db, clock, "join_claim_failed", null, ip);
            await db.SaveChangesAsync();
            return CannotClaim();
        }

        await AuthEndpoints.SignInWithSessionAsync(http, session);
        http.Response.Cookies.Delete(CookieName, CookieSettings(http, env));
        return Results.Ok(await AuthEndpoints.ReadMeAsync(db, session.UserId));
    }

    // One transaction. The conditional update is the only gate: it needs an
    // approved, unclaimed, unexpired request whose person is still a member of
    // the project and is not the consultant. Of two parallel claims the
    // database lets exactly one change the row.
    private static async Task<UserSession?> TryClaimAsync(
        AppDbContext db, TimeProvider clock, JoinRequest request, HttpContext http, string? ip)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        await using var tx = await db.Database.BeginTransactionAsync();

        var claimed = await db.JoinRequests
            .Where(r => r.Id == request.Id
                && r.State == JoinRequestState.Approved
                && r.ClaimedAt == null
                && r.UserId != null
                && r.ApprovedUntil >= now
                && db.ProjectMembers.Any(m => m.ProjectId == r.ProjectId && m.UserId == r.UserId)
                && db.Users.Any(u => u.Id == r.UserId && !u.IsConsultant))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ClaimedAt, (DateTime?)now));
        if (claimed != 1) return null;

        var session = AuthEndpoints.NewSession(db, now, request.UserId!.Value, http, ip);
        AuditLog.Add(db, clock, "join_claimed", request.UserId, ip, request.ProjectId,
            $"request:{request.Id} session:{session.Id}");
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return session;
    }

    // ---- The cookie ----

    // The request the browser's cookie points to, only when the secret is right.
    private static async Task<JoinRequest?> FindOwnRequestAsync(HttpContext http, AppDbContext db, TokenHasher hasher)
    {
        if (!http.Request.Cookies.TryGetValue(CookieName, out var value) || string.IsNullOrEmpty(value)) return null;
        var parts = value.Split('.');
        if (parts.Length != 2 || !Guid.TryParseExact(parts[0], "N", out var id)
            || !TokenHasher.LooksLikeToken(parts[1]))
            return null;

        var request = await db.JoinRequests.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id);
        if (request is null) return null;
        var given = Encoding.UTF8.GetBytes(hasher.Hash(parts[1]));
        var stored = Encoding.UTF8.GetBytes(request.SecretHash);
        return CryptographicOperations.FixedTimeEquals(given, stored) ? request : null;
    }

    private static CookieOptions CookieSettings(HttpContext http, IWebHostEnvironment env) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        // Like the session cookie: only local development may omit Secure.
        Secure = !env.IsDevelopment() || http.Request.IsHttps,
        Path = "/",
        IsEssential = true,
    };

    private static bool HasControlCharacters(string text) => text.Any(char.IsControl);

    private static string Truncate(string text, int max) => text.Length > max ? text[..max] : text;
}
