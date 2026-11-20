using IdeaDiscovery.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Auth;

// Burak only. The whole group needs the per-request consultant claim, read
// from the database; owners get 403 and signed-out callers get 401.
public static class ConsultantEndpoints
{
    public static void MapConsultant(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/consultant").RequireAuthorization(SessionValidation.ConsultantPolicy);

        group.MapGet("/users/{userId:guid}/sessions", async (Guid userId, AppDbContext db) =>
            await db.Users.AnyAsync(u => u.Id == userId)
                ? Results.Ok(await db.UserSessions.AsNoTracking()
                    .Where(s => s.UserId == userId)
                    .OrderByDescending(s => s.CreatedAt)
                    .Select(s => new
                    {
                        id = s.Id,
                        createdAt = s.CreatedAt,
                        lastSeenAt = s.LastSeenAt,
                        expiresAt = s.ExpiresAt,
                        endedAt = s.RevokedAt,
                        device = s.Device,
                        ipAddress = s.IpAddress,
                    })
                    .ToListAsync())
                : Results.NotFound());

        group.MapPost("/sessions/{sessionId:guid}/revoke", async (
            Guid sessionId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var session = await db.UserSessions.AsNoTracking()
                .Where(s => s.Id == sessionId).Select(s => new { s.UserId }).SingleOrDefaultAsync();
            if (session is null) return Results.NotFound();

            await db.UserSessions.Where(s => s.Id == sessionId && s.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));
            AuditLog.Add(db, clock, "session_revoked", SessionValidation.UserId(http.User), Ip(http),
                null, $"session:{sessionId} user:{session.UserId}");
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapPost("/users/{userId:guid}/sign-in-link", async (
            Guid userId, HttpContext http, AppDbContext db, SignInLinks links, TimeProvider clock) =>
        {
            if (!await db.Users.AnyAsync(u => u.Id == userId)) return Results.NotFound();
            var link = await links.ForUserAsync(userId);
            AuditLog.Add(db, clock, "sign_in_link_copied", SessionValidation.UserId(http.User), Ip(http),
                null, $"user:{userId}");
            await db.SaveChangesAsync();
            return Results.Ok(new { link });
        });

        group.MapPost("/invitations/{invitationId:guid}/link", async (
            Guid invitationId, HttpContext http, AppDbContext db, SignInLinks links, TimeProvider clock) =>
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var invitation = await db.Invitations.AsNoTracking()
                .SingleOrDefaultAsync(i => i.Id == invitationId);
            if (invitation is null) return Results.NotFound();
            if (invitation.RevokedAt is not null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= now)
                return Results.Conflict(new { error = "invitation_not_open" });

            var link = await links.ForInvitationAsync(invitationId);
            AuditLog.Add(db, clock, "invitation_link_copied", SessionValidation.UserId(http.User), Ip(http),
                invitation.ProjectId, $"invitation:{invitationId}");
            await db.SaveChangesAsync();
            return Results.Ok(new { link });
        });
    }

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
