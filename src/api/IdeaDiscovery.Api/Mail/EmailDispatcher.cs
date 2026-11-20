namespace IdeaDiscovery.Api.Mail;

// Renders and sends queued emails, one at a time. A failure is logged without
// the link or token and never stops the service.
public sealed class EmailDispatcher(EmailQueue queue, IEmailSender sender, ILogger<EmailDispatcher> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    var (subject, body) = EmailTexts.SignIn(job.Language, job.Link);
                    await sender.SendAsync(job.To, subject, body, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { throw; }
                catch (Exception ex)
                {
                    log.LogWarning("A sign-in email could not be sent ({Error}).", ex.GetType().Name);
                }
            }
        }
        catch (OperationCanceledException) { }
    }
}
