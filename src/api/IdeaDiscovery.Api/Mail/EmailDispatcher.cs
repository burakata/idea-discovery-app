using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Mail;

// Handles sign-in link requests one at a time, after the response: looks the
// person up, applies the per-email limit, issues the link and sends the email.
// One reader means parallel requests cannot slip past the limit. A failure is
// logged without the email address, link or token and never stops the service.
public sealed class EmailDispatcher(
    EmailQueue queue, IServiceScopeFactory scopes, IEmailSender sender, ILogger<EmailDispatcher> log) : BackgroundService
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
                    log.LogWarning("A sign-in link request could not be handled ({Error}).", ex.GetType().Name);
                }
                finally
                {
                    queue.Finished();
                }
            }
        }
        catch (OperationCanceledException) { }
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
                .Where(u => u.Email == job.Email
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
            (to, language) = (user.Email, user.UiLanguage);
        }

        try
        {
            var (subject, body) = EmailTexts.SignIn(language, link);
            await sender.SendAsync(to, subject, body, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            log.LogWarning("A sign-in email could not be sent ({Error}).", ex.GetType().Name);
        }
    }
}
