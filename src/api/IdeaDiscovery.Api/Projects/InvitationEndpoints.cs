using System.Text.Json;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Projects;

// Inviting people to a project, Burak only (the group carries the Consultant
// policy). Every query names the project the access check approved.
public static class InvitationEndpoints
{
    public const string InviteRateLimit = "invite";
    public const int MaxEmailsPerAddressPerDay = 3;

    private sealed record InviteRequest(string? Email, string? DisplayName, string? Language);

    public static void MapInvitations(this IEndpointRouteBuilder group)
    {
        group.MapPost("/projects/{projectId:guid}/invitations", InviteAsync)
            .RequireRateLimiting(InviteRateLimit);

        group.MapGet("/projects/{projectId:guid}/invitations", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            var now = clock.GetUtcNow().UtcDateTime;
            var rows = await db.Invitations.AsNoTracking()
                .Where(i => i.ProjectId == project.Id)
                .OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Id)
                .ToListAsync();
            return Results.Ok(rows.Select(i => new
            {
                id = i.Id,
                email = i.Email,
                displayName = i.DisplayName,
                language = i.Language,
                state = State(i, now),
                createdAt = i.CreatedAt,
                expiresAt = i.ExpiresAt,
                acceptedAt = i.AcceptedAt,
                revokedAt = i.RevokedAt,
            }));
        });

        group.MapPost("/invitations/{invitationId:guid}/revoke", async (
            Guid invitationId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var invitation = await db.Invitations.AsNoTracking().SingleOrDefaultAsync(i => i.Id == invitationId);
            if (invitation is null) return Results.NotFound();
            var project = await ProjectAccess.FindAsync(db, http.User, invitation.ProjectId);
            if (project is null) return Results.NotFound();

            var now = clock.GetUtcNow().UtcDateTime;
            await using var tx = await db.Database.BeginTransactionAsync();
            // The one conditional update is the gate: only an open invitation changes.
            var revoked = await db.Invitations
                .Where(i => i.Id == invitationId && i.ProjectId == project.Id
                    && i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, (DateTime?)now));
            if (revoked != 1) return Results.Conflict(new { error = "invitation_not_open" });

            // Every unused link for it ends, including one Burak copied.
            await db.SignInTokens
                .Where(t => t.InvitationId == invitationId && t.UsedAt == null && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, (DateTime?)now));
            AuditLog.Add(db, clock, "invitation_revoked", SessionValidation.UserId(http.User), Ip(http),
                project.Id, $"invitation:{invitationId}");
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
    }

    private static async Task<IResult> InviteAsync(
        Guid projectId, HttpContext http, AppDbContext db, TokenHasher hasher, EmailQueue queue,
        TimeProvider clock, ILogger<EmailQueue> log)
    {
        InviteRequest? body = null;
        try { if (http.Request.HasJsonContentType()) body = await http.Request.ReadFromJsonAsync<InviteRequest>(); }
        catch (JsonException) { }
        catch (BadHttpRequestException) { }

        var project = await ProjectAccess.FindAsync(db, http.User, projectId);
        if (project is null) return Results.NotFound();

        var email = body?.Email is null ? null : Emails.Normalise(body.Email);
        var name = JoinEndpoints.CleanName(body?.DisplayName);
        if (string.IsNullOrEmpty(email) || email.Length > AuthEndpoints.MaxEmailLength
            || !AuthEndpoints.LooksLikeEmail(email)
            || name is null || !Languages.IsSupported(body?.Language))
            return Results.BadRequest(new { error = "invalid_request" });
        var language = body.Language;

        var actor = SessionValidation.UserId(http.User)!.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var pid = project.Id;
        // A keyed hash of the address, so the daily count works without the
        // address itself being stored in the audit log.
        var addressKey = hasher.Hash("invitee-email:" + email);
        var addressTag = $" to:{addressKey}";

        await using var tx = await db.Database.BeginTransactionAsync();

        var existing = await db.Users.AsNoTracking()
            .Where(u => u.Email != null && u.Email == email)
            .Select(u => new { u.Id, u.IsConsultant, u.DisplayName })
            .SingleOrDefaultAsync();
        if (existing is { IsConsultant: true })
            return Results.Conflict(new { error = "cannot_invite_consultant" });
        if (existing is not null && await db.ProjectMembers.AnyAsync(m => m.ProjectId == pid && m.UserId == existing.Id))
            return Results.Conflict(new { error = "already_member" });
        if (await db.Invitations.AnyAsync(i => i.ProjectId == pid && i.Email == email
                && i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now))
            return Results.Conflict(new { error = "already_invited" });

        var since = now - TimeSpan.FromDays(1);
        var sentToday = await db.AuditEvents.CountAsync(a =>
            (a.Action == "invitation_created" || a.Action == "member_added")
            && a.CreatedAt > since && a.Details != null && a.Details.EndsWith(addressTag));
        if (sentToday >= MaxEmailsPerAddressPerDay)
        {
            AuditLog.Add(db, clock, "invitation_limited", actor, Ip(http), pid);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Text("{\"error\":\"try_later\"}", "application/json", statusCode: 429);
        }

        EmailJob job;
        object result;
        if (existing is not null)
        {
            // An existing account keeps its own name and is added at once.
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(), ProjectId = pid, UserId = existing.Id, Role = MemberRole.Owner, JoinedAt = now,
            });
            AuditLog.Add(db, clock, "member_added", actor, Ip(http), pid, $"user:{existing.Id}{addressTag}");
            job = new AddedEmail(existing.Id, pid, actor);
            result = new { kind = "added", userId = existing.Id, displayName = existing.DisplayName };
        }
        else
        {
            var invitation = new Invitation
            {
                Id = Guid.NewGuid(),
                ProjectId = pid,
                Email = email,
                DisplayName = name,
                Language = language,
                CreatedById = actor,
                CreatedAt = now,
                ExpiresAt = now + SignInLinks.InvitationLifetime,
            };
            db.Invitations.Add(invitation);
            AuditLog.Add(db, clock, "invitation_created", actor, Ip(http), pid, $"invitation:{invitation.Id}{addressTag}");
            job = new InvitationEmail(invitation.Id);
            result = new { kind = "invited", invitationId = invitation.Id };
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        // The email is written and sent by the worker, after the answer. If the
        // queue is full Burak can still copy the link from the invitation.
        if (!queue.Enqueue(job)) log.LogWarning("The email queue is full, so an invitation email was dropped.");
        return Results.Created((string?)null, result);
    }

    private static string State(Invitation i, DateTime now) =>
        i.AcceptedAt is not null ? "accepted"
        : i.RevokedAt is not null ? "revoked"
        : i.ExpiresAt <= now ? "expired"
        : "open";

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
