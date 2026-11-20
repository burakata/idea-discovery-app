namespace IdeaDiscovery.Api.Mail;

// Sends one plain-text email. A provider is chosen by Email:Provider.
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken);
}
