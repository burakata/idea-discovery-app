using System.Text;

namespace IdeaDiscovery.Api.Mail;

// Development only: writes each message as an .eml file you can open.
public sealed class FolderEmailSender(EmailSettings settings) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(settings.FolderPath);
        var text = string.Join("\r\n",
            $"From: {OneLine(settings.From)}",
            $"To: {OneLine(to)}",
            $"Subject: =?utf-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(OneLine(subject)))}?=",
            $"Date: {DateTimeOffset.UtcNow:R}",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: 8bit",
            "",
            body.ReplaceLineEndings("\r\n"));
        var path = Path.Combine(settings.FolderPath, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.eml");
        await File.WriteAllTextAsync(path, text, new UTF8Encoding(false), cancellationToken);
    }

    // Header values never hold a line break.
    private static string OneLine(string value) => value.ReplaceLineEndings(" ");
}
