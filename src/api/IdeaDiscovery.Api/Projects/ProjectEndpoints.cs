using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Projects;

// Projects and members. Reads go to any signed-in person, scoped by
// ProjectAccess; writes are Burak's and sit behind the Consultant policy.
public static class ProjectEndpoints
{
    public const int MaxTitleLength = 120;
    public const int MaxIntroLength = 2000;

    private sealed record ProjectRequest(string? TitleEn, string? TitleTr, string? IntroEn, string? IntroTr);
    private sealed record LanguageRequest(string? Language);
    private sealed record AskToJoinView(bool Enabled, string? Link);
    private sealed record ProjectView(
        Guid Id, string TitleEn, string TitleTr, string IntroEn, string IntroTr, string Status, DateTime CreatedAt,
        object Members,
        [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
        AskToJoinView? AskToJoin);

    public static void MapProjects(this IEndpointRouteBuilder app)
    {
        // Deny by default: the fallback policy needs a signed-in user.
        app.MapGet("/projects", async (HttpContext http, AppDbContext db) =>
        {
            var query = ProjectAccess.Visible(db, http.User).AsNoTracking();
            var projects = await query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id).ToListAsync();
            return Results.Ok(projects.Select(p => new
            {
                id = p.Id, titleEn = p.TitleEn, titleTr = p.TitleTr, status = p.Status, createdAt = p.CreatedAt,
            }));
        });

        app.MapGet("/projects/{projectId:guid}", async (Guid projectId, HttpContext http, AppDbContext db, AuthSettings settings) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            var withEmail = ProjectAccess.IsConsultant(http.User);
            // Whether asking to join is on is Burak's to see; owners get no such field.
            return Results.Ok(await Describe(db, project, withEmail, withEmail ? settings : null));
        });

        app.MapPut("/me/language", async (HttpContext http, AppDbContext db) =>
        {
            var body = await ReadBody<LanguageRequest>(http);
            if (!Languages.IsSupported(body?.Language)) return Invalid();
            var userId = SessionValidation.UserId(http.User)!.Value;
            var language = body.Language;
            await db.Users.Where(u => u.Id == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.UiLanguage, language));
            return Results.NoContent();
        });

        var consultant = app.MapGroup("/consultant").RequireAuthorization(SessionValidation.ConsultantPolicy);

        consultant.MapPost("/projects", async (HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var fields = Validate(await ReadBody<ProjectRequest>(http));
            if (fields is null) return Invalid();
            var actor = SessionValidation.UserId(http.User)!.Value;
            var now = clock.GetUtcNow().UtcDateTime;

            // One transaction: the project, Burak's membership and Conversation 1, or none of it.
            await using var tx = await db.Database.BeginTransactionAsync();
            var project = new Project
            {
                Id = Guid.NewGuid(),
                TitleEn = fields.TitleEn!, TitleTr = fields.TitleTr!,
                IntroEn = fields.IntroEn!, IntroTr = fields.IntroTr!,
                Status = "active",
                CreatedAt = now,
                CreatedById = actor,
            };
            db.Projects.Add(project);
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(), ProjectId = project.Id, UserId = actor, Role = MemberRole.Consultant, JoinedAt = now,
            });
            db.Conversations.Add(new Conversation
            {
                Id = Guid.NewGuid(), ProjectId = project.Id, Number = 1, State = ConversationState.Active,
                StartedAt = now, StartedById = actor,
            });
            AuditLog.Add(db, clock, "project_created", actor, Ip(http), project.Id);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Created($"/projects/{project.Id}", await Describe(db, project, true));
        });

        consultant.MapPut("/projects/{projectId:guid}", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var fields = Validate(await ReadBody<ProjectRequest>(http));
            if (fields is null) return Invalid();
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();

            project.TitleEn = fields.TitleEn!; project.TitleTr = fields.TitleTr!;
            project.IntroEn = fields.IntroEn!; project.IntroTr = fields.IntroTr!;
            AuditLog.Add(db, clock, "project_edited", SessionValidation.UserId(http.User), Ip(http), project.Id);
            await db.SaveChangesAsync();
            return Results.Ok(await Describe(db, project, true));
        });

        consultant.MapPost("/projects/{projectId:guid}/members/{userId:guid}/remove", async (
            Guid projectId, Guid userId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();

            var target = await (from m in db.ProjectMembers
                                join u in db.Users on m.UserId equals u.Id
                                where m.ProjectId == project.Id && m.UserId == userId
                                select new { u.Email, u.IsConsultant }).SingleOrDefaultAsync();
            if (target is null) return Results.NotFound();
            // Burak is never removed, by role or by flag.
            if (target.IsConsultant) return Results.Conflict(new { error = "cannot_remove_consultant" });

            var now = clock.GetUtcNow().UtcDateTime;
            var email = target.Email is null ? null : Emails.Normalise(target.Email);
            var pid = project.Id;

            await using var tx = await db.Database.BeginTransactionAsync();
            await db.ProjectMembers.Where(m => m.ProjectId == pid && m.UserId == userId).ExecuteDeleteAsync();
            await db.UserSessions.Where(s => s.UserId == userId && s.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));

            // Their open invitations to this project, by the address.
            var invitationIds = await db.Invitations
                .Where(i => i.ProjectId == pid && i.RevokedAt == null && i.AcceptedAt == null
                    && email != null && i.Email == email)
                .Select(i => i.Id).ToListAsync();
            await db.Invitations.Where(i => invitationIds.Contains(i.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));
            await db.SignInTokens
                .Where(t => t.InvitationId != null && invitationIds.Contains(t.InvitationId.Value)
                    && t.UsedAt == null && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));

            // Sign-in links already sent to them stop working too.
            await db.SignInTokens
                .Where(t => t.Purpose == TokenPurpose.SignIn && t.UserId == userId
                    && t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTime?)now));

            AuditLog.Add(db, clock, "member_removed", SessionValidation.UserId(http.User), Ip(http), pid, $"user:{userId}");
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
    }

    private static async Task<object> Describe(AppDbContext db, Project project, bool withEmail, AuthSettings? askToJoinFor = null)
    {
        var rows = await (from m in db.ProjectMembers
                          join u in db.Users on m.UserId equals u.Id
                          where m.ProjectId == project.Id
                          select new { u.Id, u.DisplayName, u.Email, m.Role, m.JoinedAt }).ToListAsync();
        var members = rows
            .OrderBy(r => r.Role == MemberRole.Consultant ? 0 : 1).ThenBy(r => r.JoinedAt).ThenBy(r => r.Id)
            .Select(r => withEmail
                ? (object)new { userId = r.Id, displayName = r.DisplayName, role = Role(r.Role), email = r.Email }
                : new { userId = r.Id, displayName = r.DisplayName, role = Role(r.Role) })
            .ToList();
        // One shape for everyone; Burak's reads add `askToJoin`, and nobody else's carries the field.
        var askToJoin = askToJoinFor is null
            ? null
            : new AskToJoinView(
                project.AskToJoinEnabled,
                // A switched-off link takes no requests, so none is offered.
                project.AskToJoinEnabled && project.JoinCode is not null
                    ? ConsultantEndpoints.JoinLink(askToJoinFor, project.JoinCode)
                    : null);
        return new ProjectView(
            project.Id, project.TitleEn, project.TitleTr, project.IntroEn, project.IntroTr,
            project.Status, project.CreatedAt, members, askToJoin);
    }

    private static string Role(MemberRole role) => role.ToString().ToLowerInvariant();

    // Trimmed copies when every field passes, otherwise null.
    private static ProjectRequest? Validate(ProjectRequest? body)
    {
        if (body is null) return null;
        var titleEn = Clean(body.TitleEn, MaxTitleLength, false);
        var titleTr = Clean(body.TitleTr, MaxTitleLength, false);
        var introEn = Clean(body.IntroEn, MaxIntroLength, true);
        var introTr = Clean(body.IntroTr, MaxIntroLength, true);
        return titleEn is null || titleTr is null || introEn is null || introTr is null
            ? null
            : new ProjectRequest(titleEn, titleTr, introEn, introTr);
    }

    // Control characters are refused, except line breaks where allowed.
    private static string? Clean(string? raw, int max, bool allowLineBreaks)
    {
        var text = raw?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > max) return null;
        return text.Any(c => char.IsControl(c) && !(allowLineBreaks && (c == '\n' || c == '\r'))) ? null : text;
    }

    private static async Task<T?> ReadBody<T>(HttpContext http) where T : class
    {
        try { return http.Request.HasJsonContentType() ? await http.Request.ReadFromJsonAsync<T>() : null; }
        catch (System.Text.Json.JsonException) { return null; }
        catch (BadHttpRequestException) { return null; }
    }

    private static IResult Invalid() => Results.BadRequest(new { error = "invalid_request" });

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
