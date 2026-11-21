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

            if (await db.Users.AnyAsync(u => u.Email != null && u.Email == invitation.Email && u.IsConsultant))
                return Results.Conflict(new { error = "invitation_not_open" });

            var link = await links.ForInvitationAsync(invitationId);
            AuditLog.Add(db, clock, "invitation_link_copied", SessionValidation.UserId(http.User), Ip(http),
                invitation.ProjectId, $"invitation:{invitationId}");
            await db.SaveChangesAsync();
            return Results.Ok(new { link });
        });

        MapJoin(group);
    }

    private sealed record ApproveRequest(string? DisplayName);

    // Ask to join, Burak's side. Every query names the project or the request.
    private static void MapJoin(RouteGroupBuilder group)
    {
        group.MapPost("/projects/{projectId:guid}/join-link", async (
            Guid projectId, HttpContext http, AppDbContext db, AuthSettings settings, TimeProvider clock) =>
        {
            var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == projectId);
            if (project is null) return Results.NotFound();
            project.AskToJoinEnabled = true;
            project.JoinCode ??= JoinEndpoints.NewCode();
            AuditLog.Add(db, clock, "join_link_on", SessionValidation.UserId(http.User), Ip(http), projectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { link = JoinLink(settings, project.JoinCode) });
        });

        group.MapPost("/projects/{projectId:guid}/join-link/off", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == projectId);
            if (project is null) return Results.NotFound();
            project.AskToJoinEnabled = false;
            AuditLog.Add(db, clock, "join_link_off", SessionValidation.UserId(http.User), Ip(http), projectId);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // A new code; the old one stops working. Whether asking is on stays as it was.
        group.MapPost("/projects/{projectId:guid}/join-link/renew", async (
            Guid projectId, HttpContext http, AppDbContext db, AuthSettings settings, TimeProvider clock) =>
        {
            var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == projectId);
            if (project is null) return Results.NotFound();
            project.JoinCode = JoinEndpoints.NewCode();
            AuditLog.Add(db, clock, "join_link_renewed", SessionValidation.UserId(http.User), Ip(http), projectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { link = JoinLink(settings, project.JoinCode) });
        });

        group.MapGet("/projects/{projectId:guid}/join-requests", async (
            Guid projectId, AppDbContext db, TimeProvider clock) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == projectId)) return Results.NotFound();
            var now = clock.GetUtcNow().UtcDateTime;

            var memberNames = await (from m in db.ProjectMembers
                                     join u in db.Users on m.UserId equals u.Id
                                     where m.ProjectId == projectId
                                     select u.DisplayName).ToListAsync();
            var taken = memberNames.Select(JoinEndpoints.NameKey).ToHashSet();

            var waiting = await db.JoinRequests.AsNoTracking()
                .Where(r => r.ProjectId == projectId && r.State == JoinRequestState.Pending && r.ExpiresAt > now)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync();
            return Results.Ok(waiting.Select(r => new
            {
                id = r.Id,
                name = r.Name,
                uncheckedEmail = r.UncheckedEmail,
                device = r.Device,
                createdAt = r.CreatedAt,
                expiresAt = r.ExpiresAt,
                nameMatchesMember = taken.Contains(JoinEndpoints.NameKey(r.Name)),
            }));
        });

        group.MapPost("/join-requests/{requestId:guid}/approve", async (
            Guid requestId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            string? typed = null;
            try
            {
                if (http.Request.HasJsonContentType())
                    typed = (await http.Request.ReadFromJsonAsync<ApproveRequest>())?.DisplayName;
            }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(new { error = "invalid_request" }); }
            catch (BadHttpRequestException) { return Results.BadRequest(new { error = "invalid_request" }); }
            var corrected = JoinEndpoints.CleanName(typed);
            if (typed is not null && corrected is null)
                return Results.BadRequest(new { error = "invalid_request" });

            var request = await db.JoinRequests.AsNoTracking().SingleOrDefaultAsync(r => r.Id == requestId);
            if (request is null) return Results.NotFound();

            var actor = SessionValidation.UserId(http.User);
            var now = clock.GetUtcNow().UtcDateTime;
            try
            {
                // One transaction: the person, the membership and the decision, or none of it.
                await using var tx = await db.Database.BeginTransactionAsync();
                var user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = null,
                    DisplayName = corrected ?? request.Name,
                    UiLanguage = "en",
                    CreatedAt = now,
                };
                db.Users.Add(user);
                db.ProjectMembers.Add(new ProjectMember
                {
                    Id = Guid.NewGuid(),
                    ProjectId = request.ProjectId,
                    UserId = user.Id,
                    Role = MemberRole.Owner,
                    JoinedAt = now,
                });
                await db.SaveChangesAsync();

                var decided = await db.JoinRequests
                    .Where(r => r.Id == requestId && r.State == JoinRequestState.Pending && r.ExpiresAt > now)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(r => r.State, JoinRequestState.Approved)
                        .SetProperty(r => r.DecidedAt, (DateTime?)now)
                        .SetProperty(r => r.DecidedById, actor)
                        .SetProperty(r => r.UserId, (Guid?)user.Id)
                        .SetProperty(r => r.ApprovedUntil, (DateTime?)(now + JoinEndpoints.ApprovalWindow)));
                // Leaving here rolls the new person back.
                if (decided != 1) return Results.Conflict(new { error = "request_not_waiting" });

                AuditLog.Add(db, clock, "join_approved", actor, Ip(http), request.ProjectId,
                    $"request:{requestId} user:{user.Id}");
                await db.SaveChangesAsync();
                await tx.CommitAsync();
                return Results.Ok(new { userId = user.Id, displayName = user.DisplayName });
            }
            catch (Exception ex) when (ex is DbUpdateException or Microsoft.Data.Sqlite.SqliteException)
            {
                // The loser of two parallel decisions.
                return Results.Conflict(new { error = "request_not_waiting" });
            }
        });

        group.MapPost("/join-requests/{requestId:guid}/reject", async (
            Guid requestId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var request = await db.JoinRequests.AsNoTracking().SingleOrDefaultAsync(r => r.Id == requestId);
            if (request is null) return Results.NotFound();

            var actor = SessionValidation.UserId(http.User);
            var now = clock.GetUtcNow().UtcDateTime;
            var decided = await db.JoinRequests
                .Where(r => r.Id == requestId && r.State == JoinRequestState.Pending && r.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.State, JoinRequestState.Rejected)
                    .SetProperty(r => r.DecidedAt, (DateTime?)now)
                    .SetProperty(r => r.DecidedById, actor));
            if (decided != 1) return Results.Conflict(new { error = "request_not_waiting" });

            AuditLog.Add(db, clock, "join_rejected", actor, Ip(http), request.ProjectId, $"request:{requestId}");
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static string JoinLink(AuthSettings settings, string? code) => $"{settings.LinkBase}/join/{code}";

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
