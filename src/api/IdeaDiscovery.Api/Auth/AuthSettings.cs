namespace IdeaDiscovery.Api.Auth;

// Sign-in settings, read and checked once at startup (docs/engineering.md §12).
public sealed record AuthSettings(string TokenKey, Uri PublicBaseUrl, IReadOnlyList<string> AllowedOrigins)
{
    // Not a secret: the value appsettings.Development.json carries. Outside
    // Development the app refuses to start with it.
    public const string DevelopmentTokenKey = "development-only-token-key-not-a-secret-0001";

    public const int MinimumTokenKeyLength = 32;

    // Where a person's browser reaches the app; links are built from it and
    // never from the request.
    public string LinkBase => PublicBaseUrl.GetLeftPart(UriPartial.Path).TrimEnd('/');

    // The key is a secret, so it stays out of any text the record prints.
    private bool PrintMembers(System.Text.StringBuilder builder)
    {
        builder.Append("PublicBaseUrl = ").Append(PublicBaseUrl);
        return true;
    }

    // Null when a problem was added to `problems`.
    public static AuthSettings? Read(IConfiguration config, IHostEnvironment environment, StartupProblems problems)
    {
        var development = environment.IsDevelopment();
        var valid = true;

        var key = config["Auth:TokenKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            problems.Add("Auth:TokenKey is not set. Set it in user secrets or an environment variable.");
            valid = false;
        }
        else if (!development && (key.Length < MinimumTokenKeyLength || key == DevelopmentTokenKey))
        {
            problems.Add($"Auth:TokenKey must be at least {MinimumTokenKeyLength} characters and not the development value.");
            valid = false;
        }

        var raw = config["App:PublicBaseUrl"];
        Uri? baseUrl = null;
        if (!Uri.TryCreate(raw, UriKind.Absolute, out baseUrl)
            || (baseUrl.Scheme != Uri.UriSchemeHttps && !(development && baseUrl.Scheme == Uri.UriSchemeHttp)))
        {
            problems.Add(development
                ? "App:PublicBaseUrl must be an absolute http or https URL."
                : "App:PublicBaseUrl must be an absolute https URL.");
            valid = false;
        }

        if (!valid) return null;
        var origins = new List<string> { baseUrl!.GetLeftPart(UriPartial.Authority) };
        return new AuthSettings(key!, baseUrl, origins);
    }
}
