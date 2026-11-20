namespace IdeaDiscovery.Api.Mail;

// Used when no provider is set: the message is dropped and the log says so,
// without the message text (it holds a sign-in link).
public sealed class NoEmailSender(ILogger<NoEmailSender> log) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        log.LogWarning("No email provider is set (Email:Provider), so an email was dropped.");
        return Task.CompletedTask;
    }
}
