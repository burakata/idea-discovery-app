using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Mail;

// Handles email jobs one at a time, after the response: looks the person up,
// applies the per-email limit, issues the link and sends the email. Each job
// gets a fresh scope.
// One reader means parallel requests cannot slip past the limit. A failure is
// logged without the email address, link or token and never stops the service.
public sealed class EmailDispatcher(
    EmailQueue queue, IServiceScopeFactory scopes, IEmailSender sender, EmailTemplates templates, ILogger<EmailDispatcher> log) : BackgroundService
{
    private const int MaxLinkRequestsPerEmailPerHour = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await HandleAsync(job, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { throw; }
                catch (Exception ex)
                {
                    // The type only: messages can hold the email body, and so the link.
                    log.LogWarning("An email job ({Job}) could not be handled ({Error}).", job.GetType().Name, ex.GetType().Name);
                }
                finally
                {
                    queue.Finished();
                }
            }
        }
        catch (OperationCanceledException) { }
    }

    private Task HandleAsync(EmailJob job, CancellationToken cancellationToken) => job switch
    {
        SignInLinkRequest request => HandleAsync(request, cancellationToken),
        InvitationEmail invitation => HandleInvitationAsync(invitation, cancellationToken),
        AddedEmail added => HandleAddedAsync(added, cancellationToken),
        _ => Task.CompletedTask,
    };

    // A new person's invitation, if it is still open when the worker gets to it.
    private async Task HandleInvitationAsync(InvitationEmail job, CancellationToken cancellationToken)
    {
        string to, subject, body;
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
            var links = scope.ServiceProvider.GetRequiredService<SignInLinks>();
            var now = clock.GetUtcNow().UtcDateTime;

            var invitation = await db.Invitations.AsNoTracking()
                .Where(i => i.Id == job.InvitationId && i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
                .SingleOrDefaultAsync(cancellationToken);
            if (invitation is null) return;
            // The account appeared since: its sign-in goes through the added email.
            if (await db.Users.AnyAsync(u => u.Email != null && u.Email == invitation.Email, cancellationToken)) return;
            var project = await db.Projects.AsNoTracking()
                .SingleOrDefaultAsync(p => p.Id == invitation.ProjectId, cancellationToken);
            var inviter = await db.Users.AsNoTracking()
                .SingleOrDefaultAsync(u => u.Id == invitation.CreatedById, cancellationToken);
            if (project is null || inviter is null) return;

            var link = await links.ForInvitationAsync(invitation.Id);
            (subject, body) = templates.RenderInvitation(
                invitation.Language, invitation.DisplayName, inviter.DisplayName, project.Title(invitation.Language), link);
            to = invitation.Email;
        }
        await SendAsync(to, subject, body, cancellationToken);
    }

    // An existing account added to a project, if it is still a member.
    private async Task HandleAddedAsync(AddedEmail job, CancellationToken cancellationToken)
    {
        string to, subject, body;
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var links = scope.ServiceProvider.GetRequiredService<SignInLinks>();

            var row = await (from m in db.ProjectMembers
                             join u in db.Users on m.UserId equals u.Id
                             join p in db.Projects on m.ProjectId equals p.Id
                             where m.ProjectId == job.ProjectId && m.UserId == job.UserId && u.Email != null
                             select new { u.Email, u.DisplayName, u.UiLanguage, Project = p })
                .AsNoTracking().SingleOrDefaultAsync(cancellationToken);
            if (row is null) return;
            var inviter = await db.Users.AsNoTracking()
                .SingleOrDefaultAsync(u => u.Id == job.AddedById, cancellationToken);
            if (inviter is null) return;

            var link = await links.ForUserAsync(job.UserId);
            (subject, body) = templates.RenderAdded(
                row.UiLanguage, row.DisplayName, inviter.DisplayName, row.Project.Title(row.UiLanguage), link);
            to = row.Email!; // the query matched on a non-null email
        }
        await SendAsync(to, subject, body, cancellationToken);
    }

    private async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        try
        {
            await sender.SendAsync(to, subject, body, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            log.LogWarning("An email could not be sent ({Error}).", ex.GetType().Name);
        }
    }

    private async Task HandleAsync(SignInLinkRequest job, CancellationToken cancellationToken)
    {
        string to, language, link;
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
            var links = scope.ServiceProvider.GetRequiredService<SignInLinks>();

            var user = await db.Users.AsNoTracking()
                .Where(u => u.Email != null && u.Email == job.Email
                    && (u.IsConsultant || db.ProjectMembers.Any(m => m.UserId == u.Id)))
                .SingleOrDefaultAsync(cancellationToken);
            if (user is null) return;

            var now = clock.GetUtcNow().UtcDateTime;
            var since = now - TimeSpan.FromHours(1);
            // The count and the writes are one transaction.
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            var recent = await db.AuditEvents.CountAsync(a =>
                a.Action == "sign_in_link_requested" && a.ActorUserId == user.Id && a.CreatedAt > since, cancellationToken);
            if (recent >= MaxLinkRequestsPerEmailPerHour)
            {
                AuditLog.Add(db, clock, "sign_in_link_limited", user.Id, job.Ip);
                await db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                return;
            }

            // Only the newest emailed link works. Invitation links stay.
            await db.SignInTokens
                .Where(t => t.UserId == user.Id && t.Purpose == TokenPurpose.SignIn
                    && t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, (DateTime?)now), cancellationToken);
            link = await links.ForUserAsync(user.Id);
            AuditLog.Add(db, clock, "sign_in_link_requested", user.Id, job.Ip);
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            (to, language) = (user.Email!, user.UiLanguage); // the query above matched on a non-null email
        }

        try
        {
            var (subject, body) = templates.RenderSignIn(language, link);
            await sender.SendAsync(to, subject, body, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            log.LogWarning("A sign-in email could not be sent ({Error}).", ex.GetType().Name);
        }
    }
}
