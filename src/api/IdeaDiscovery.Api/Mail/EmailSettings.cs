namespace IdeaDiscovery.Api.Mail;

public enum EmailProvider { None, Folder }

// Email settings, read and checked once at startup (docs/engineering.md §12).
public sealed record EmailSettings(EmailProvider Provider, string From, string FolderPath)
{
    public const string DefaultFrom = "Idea Discovery Rooms <no-reply@example.test>";

    public static EmailSettings Read(IConfiguration config, IHostEnvironment environment)
    {
        var raw = config["Email:Provider"];
        var provider = string.IsNullOrWhiteSpace(raw) ? EmailProvider.None
            : raw.Trim().Equals("Folder", StringComparison.OrdinalIgnoreCase) ? EmailProvider.Folder
            : throw new InvalidOperationException($"Email:Provider '{raw}' is not known. Use Folder, or leave it unset.");

        // The folder sender keeps every sign-in link on disk in plain text.
        if (provider == EmailProvider.Folder && !environment.IsDevelopment())
            throw new InvalidOperationException("Email:Provider Folder is for Development only.");

        var from = config["Email:From"];
        var folder = config["Email:FolderPath"];
        return new EmailSettings(
            provider,
            string.IsNullOrWhiteSpace(from) ? DefaultFrom : from.Trim(),
            Path.GetFullPath(string.IsNullOrWhiteSpace(folder) ? "emails" : folder, environment.ContentRootPath));
    }
}
