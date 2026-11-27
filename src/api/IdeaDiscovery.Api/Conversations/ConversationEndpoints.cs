using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Projects;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Conversations;

// A project's conversations and their messages. Every route first asks
// ProjectAccess for the project, then scopes every query by that project's id
// and the conversation's own ProjectId. Every Message row is visible to every
// member: drafts and private notes never live in this table.
public static partial class ConversationEndpoints
{
    public const string PostRateLimit = "post-message";
    public const int MaxTextLength = 4000;
    // Far above 4000 characters in any script, far below anything worth buffering.
    public const long MaxBodyBytes = 64 * 1024;

    private sealed record MessageRequest(string? Text);

    public static void MapConversations(this IEndpointRouteBuilder app)
    {
        app.MapGet("/projects/{projectId:guid}/conversations", async (
            Guid projectId, HttpContext http, AppDbContext db) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            var rows = await db.Conversations.AsNoTracking()
                .Where(c => c.ProjectId == project.Id).OrderBy(c => c.Number).ToListAsync();
            return Results.Ok(rows.Select(Describe));
        });

        // The number is parsed after the access check, so an unknown project is
        // 404 whatever the number says.
        app.MapGet("/projects/{projectId:guid}/conversations/{number}/messages", async (
            Guid projectId, string number, string? after, HttpContext http, AppDbContext db) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            if (!int.TryParse(number, out var n)) return Results.NotFound();
            var conversation = await db.Conversations.AsNoTracking()
                .Where(c => c.ProjectId == project.Id && c.Number == n).SingleOrDefaultAsync();
            if (conversation is null) return Results.NotFound();

            var afterSequence = 0;
            if (after is not null && !TryParseCursor(after, conversation.Number, out afterSequence))
                return Results.BadRequest(new { error = "invalid_cursor" });

            var messages = await ReadMessages(db, project.Id, conversation.Id, afterSequence, null);
            var last = messages.Count == 0 ? afterSequence : messages[^1].Sequence;
            return Results.Ok(new
            {
                messages = messages.Select(m => m.Body),
                cursor = Cursor(conversation.Number, last),
            });
        });

        // The message goes to the conversation the writer was looking at, never to
        // "whatever is active now": Burak may have finished it and started the next
        // one while the writer was typing.
        app.MapPost("/projects/{projectId:guid}/conversations/{number}/messages", async (
            Guid projectId, string number, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            // Refused before the body is read. The request-size metadata below
            // enforces it for bodies with no declared length.
            if (http.Request.ContentLength > MaxBodyBytes) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            if (!int.TryParse(number, out var n)) return Results.NotFound();
            if (!await db.Conversations.AnyAsync(c => c.ProjectId == project.Id && c.Number == n))
                return Results.NotFound();
            var text = Clean((await ReadBody(http))?.Text);
            if (text is null) return Invalid();

            var author = SessionValidation.UserId(http.User)!.Value;
            var language = Languages.Resolve(
                await db.Users.Where(u => u.Id == author).Select(u => u.UiLanguage).SingleAsync());
            var isConsultant = ProjectAccess.IsConsultant(http.User);
            var id = Guid.NewGuid();
            var now = clock.GetUtcNow().UtcDateTime;

            // One statement finds the named conversation if it is still Active, numbers the message
            // and inserts it, so a finish at the same moment either comes first
            // (no row, 409) or after (the message was already stored).
            var inserted = await Retrying(() => db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "Messages" ("Id", "ConversationId", "AuthorId", "Text", "Language", "CreatedAt", "Sequence")
                SELECT {id}, c."Id", {author}, {text}, {language}, {now},
                       COALESCE((SELECT MAX(m."Sequence") FROM "Messages" m WHERE m."ConversationId" = c."Id"), 0) + 1
                FROM "Conversations" c
                WHERE c."ProjectId" = {project.Id} AND c."Number" = {n} AND c."State" = 'Active'
                  AND ({isConsultant} OR EXISTS (
                      SELECT 1 FROM "ProjectMembers" pm WHERE pm."ProjectId" = {project.Id} AND pm."UserId" = {author}))
                """));
            if (inserted == 0)
            {
                // Removed after the access check: refuse like any non-member.
                var stillMember = isConsultant || await db.ProjectMembers
                    .AnyAsync(m => m.ProjectId == project.Id && m.UserId == author);
                return stillMember ? Results.Conflict(new { error = "no_active_conversation" }) : Results.NotFound();
            }

            var message = (await ReadMessages(db, project.Id, null, 0, id)).Single();
            return Results.Created($"/projects/{project.Id}/conversations/{n}/messages/{id}", message.Body);
        }).RequireRateLimiting(PostRateLimit)
          .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));

        var consultant = app.MapGroup("/consultant").RequireAuthorization(SessionValidation.ConsultantPolicy);

        consultant.MapPost("/projects/{projectId:guid}/conversations/active/finish", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            var active = await db.Conversations.AsNoTracking()
                .Where(c => c.ProjectId == project.Id && c.State == ConversationState.Active)
                .Select(c => c.Id).SingleOrDefaultAsync();
            if (active == Guid.Empty) return Conflict("no_active_conversation");

            var actor = SessionValidation.UserId(http.User)!.Value;
            var now = clock.GetUtcNow().UtcDateTime;
            return await Retrying(async () =>
            {
                db.ChangeTracker.Clear(); // a retry must not add the audit row twice
                await using var tx = await db.Database.BeginTransactionAsync();
                // Only the row that is still Active changes, so two finishes cannot both win.
                var changed = await db.Conversations
                    .Where(c => c.Id == active && c.ProjectId == project.Id && c.State == ConversationState.Active)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.State, ConversationState.Finished)
                        .SetProperty(c => c.FinishedAt, (DateTime?)now)
                        .SetProperty(c => c.FinishedById, (Guid?)actor));
                if (changed == 0) return Conflict("no_active_conversation");
                AuditLog.Add(db, clock, "conversation_finished", actor, Ip(http), project.Id, $"conversation:{active}");
                await db.SaveChangesAsync();
                await tx.CommitAsync();
                return Results.NoContent();
            });
        });

        consultant.MapPost("/projects/{projectId:guid}/conversations", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            if (await db.Conversations.AnyAsync(c => c.ProjectId == project.Id && c.State == ConversationState.Active))
                return Conflict("conversation_active");

            var actor = SessionValidation.UserId(http.User)!.Value;
            var highest = await db.Conversations.Where(c => c.ProjectId == project.Id)
                .Select(c => (int?)c.Number).MaxAsync() ?? 0;
            var conversation = new Conversation
            {
                Id = Guid.NewGuid(), ProjectId = project.Id, Number = highest + 1,
                State = ConversationState.Active, StartedAt = clock.GetUtcNow().UtcDateTime, StartedById = actor,
            };
            db.Conversations.Add(conversation);
            AuditLog.Add(db, clock, "conversation_started", actor, Ip(http), project.Id, $"conversation:{conversation.Id}");
            try
            {
                await Retrying(async () => { await db.SaveChangesAsync(); return 0; });
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                // A parallel start won: the unique indexes allow one Active conversation and one number.
                return Conflict("conversation_active");
            }
            return Results.Created($"/projects/{project.Id}/conversations", Describe(conversation));
        });
    }

    private static object Describe(Conversation c) => new
    {
        number = c.Number,
        state = c.State.ToString().ToLowerInvariant(),
        startedAt = c.StartedAt,
        finishedAt = c.FinishedAt,
    };

    private sealed record Row(int Sequence, object Body);

    // Messages oldest first, by sequence. Either a whole conversation after a
    // sequence, or one message by id; both are scoped to the project. The
    // author's role is read from their membership in this project now.
    private static async Task<List<Row>> ReadMessages(
        AppDbContext db, Guid projectId, Guid? conversationId, int after, Guid? messageId)
    {
        var rows = await (
            from m in db.Messages.AsNoTracking()
            join c in db.Conversations on m.ConversationId equals c.Id
            join u in db.Users on m.AuthorId equals u.Id
            join pm in db.ProjectMembers.Where(x => x.ProjectId == projectId) on m.AuthorId equals pm.UserId into members
            from member in members.DefaultIfEmpty()
            where c.ProjectId == projectId
                && (conversationId == null || m.ConversationId == conversationId)
                && (messageId == null || m.Id == messageId)
                && m.Sequence > after
            orderby m.Sequence
            select new
            {
                m.Id, m.AuthorId, u.DisplayName, Role = member == null ? (MemberRole?)null : member.Role,
                m.Text, m.Language, m.CreatedAt, m.Sequence,
            }).ToListAsync();

        return rows.Select(r => new Row(r.Sequence, new
        {
            id = r.Id,
            authorId = r.AuthorId,
            authorName = r.DisplayName,
            authorRole = r.Role?.ToString().ToLowerInvariant(),
            authorLeft = r.Role is null,
            text = r.Text,
            language = r.Language,
            // Empty until translations arrive (M2).
            translation = (object?)null,
            createdAt = r.CreatedAt,
        })).ToList();
    }

    // The cursor is opaque to clients: the conversation's number and the last
    // sequence seen. Sequences are dense and unique per conversation, so the
    // order is exact even for messages stored in the same instant. A cursor
    // from another conversation is refused rather than skipping messages here.
    private static string Cursor(int number, int sequence) => $"{number}-{sequence}";

    private static bool TryParseCursor(string cursor, int number, out int sequence)
    {
        sequence = 0;
        var match = CursorPattern().Match(cursor);
        return match.Success
            && int.Parse(match.Groups[1].Value) == number
            && int.TryParse(match.Groups[2].Value, out sequence);
    }

    [GeneratedRegex(@"^([0-9]{1,9})-([0-9]{1,9})$")]
    private static partial Regex CursorPattern();

    // The trimmed text when it is 1 to 4000 characters with no control
    // characters other than line breaks and tabs, otherwise null.
    private static string? Clean(string? raw)
    {
        var text = raw?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > MaxTextLength) return null;
        return text.Any(c => char.IsControl(c) && c is not ('\n' or '\r' or '\t')) ? null : text;
    }

    private static async Task<MessageRequest?> ReadBody(HttpContext http)
    {
        try { return http.Request.HasJsonContentType() ? await http.Request.ReadFromJsonAsync<MessageRequest>() : null; }
        catch (System.Text.Json.JsonException) { return null; }
        catch (BadHttpRequestException ex) when (ex.StatusCode != StatusCodes.Status413PayloadTooLarge) { return null; }
    }

    // SQLite reports a busy or locked database at once under shared access; a
    // short retry lets the other writer finish.
    private static async Task<T> Retrying<T>(Func<Task<T>> work)
    {
        for (var attempt = 0; ; attempt++)
        {
            try { return await work(); }
            catch (Exception ex) when (attempt < 8 && Sqlite(ex) is { SqliteErrorCode: 5 or 6 })
            {
                await Task.Delay(25 * (attempt + 1));
            }
        }
    }

    private static bool IsUniqueViolation(Exception ex) => Sqlite(ex) is { SqliteErrorCode: 19 };

    private static SqliteException? Sqlite(Exception ex) => ex as SqliteException ?? ex.InnerException as SqliteException;

    private static IResult Conflict(string error) => Results.Conflict(new { error });

    private static IResult Invalid() => Results.BadRequest(new { error = "invalid_request" });

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
