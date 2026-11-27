using System.Text;

namespace IdeaDiscovery.Api.Mail;

public enum EmailProvider { None, Folder, Resend }

// Email settings, read and checked once at startup (docs/engineering.md §12).
public sealed record EmailSettings(EmailProvider Provider, string From, string FolderPath, string? ResendApiKey = null)
{
    public const string DefaultFrom = "Idea Discovery Rooms <no-reply@example.test>";

    // The API key is a secret, so it stays out of any text the record prints.
    private bool PrintMembers(StringBuilder builder)
    {
        builder.Append("Provider = ").Append(Provider);
        return true;
    }

    // Null when a problem was added to `problems`.
    public static EmailSettings? Read(IConfiguration config, IHostEnvironment environment, StartupProblems problems)
    {
        var development = environment.IsDevelopment();
        var valid = true;

        var raw = config["Email:Provider"];
        var provider = EmailProvider.None;
        if (!string.IsNullOrWhiteSpace(raw))
        {
            if (raw.Trim().Equals("Folder", StringComparison.OrdinalIgnoreCase)) provider = EmailProvider.Folder;
            else if (raw.Trim().Equals("Resend", StringComparison.OrdinalIgnoreCase)) provider = EmailProvider.Resend;
            else
            {
                // The value is not repeated: a setting in the wrong place can be a secret.
                problems.Add($"Email:Provider is not a known provider. Use Resend{(development ? " or Folder" : "")}.");
                valid = false;
            }
        }
        else if (!development)
        {
            problems.Add("Email:Provider is not set. Use Resend.");
            valid = false;
        }

        // The folder sender keeps every sign-in link on disk in plain text.
        if (provider == EmailProvider.Folder && !development)
        {
            problems.Add("Email:Provider Folder is for Development only.");
            valid = false;
        }

        var from = config["Email:From"];
        var apiKey = config["Email:Resend:ApiKey"];
        if (provider == EmailProvider.Resend)
        {
            // The example sender is never a fallback for real email.
            if (string.IsNullOrWhiteSpace(from))
            {
                problems.Add("Email:From is not set. It is required with Email:Provider Resend.");
                valid = false;
            }
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                problems.Add("Email:Resend:ApiKey is not set. It is required with Email:Provider Resend.");
                valid = false;
            }
        }

        if (!valid) return null;
        var folder = config["Email:FolderPath"];
        return new EmailSettings(
            provider,
            string.IsNullOrWhiteSpace(from) ? DefaultFrom : from.Trim(),
            Path.GetFullPath(string.IsNullOrWhiteSpace(folder) ? "emails" : folder, environment.ContentRootPath),
            string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim());
    }
}
