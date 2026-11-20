namespace IdeaDiscovery.Api.Auth;

// Sign-in settings, read and checked once at startup (docs/engineering.md §12).
public sealed record AuthSettings(string TokenKey, Uri PublicBaseUrl, IReadOnlyList<string> AllowedOrigins)
{
    // Not a secret: the value appsettings.Development.json carries. Outside
    // Development the app refuses to start with it.
    public const string DevelopmentTokenKey = "development-only-token-key-not-a-secret-0001";

    // The Vite dev server, allowed as an Origin in Development only.
    private const string ViteDevOrigin = "http://localhost:5173";

    public const int MinimumTokenKeyLength = 32;

    // Where a person's browser reaches the app; links are built from it and
    // never from the request.
    public string LinkBase => PublicBaseUrl.GetLeftPart(UriPartial.Path).TrimEnd('/');

    public static AuthSettings Read(IConfiguration config, IHostEnvironment environment)
    {
        var development = environment.IsDevelopment();

        var key = config["Auth:TokenKey"];
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("Auth:TokenKey is not set. Set it in user secrets or an environment variable.");
        if (!development && (key.Length < MinimumTokenKeyLength || key == DevelopmentTokenKey))
            throw new InvalidOperationException(
                $"Auth:TokenKey must be at least {MinimumTokenKeyLength} characters and not the development value.");

        var raw = config["App:PublicBaseUrl"];
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var baseUrl)
            || (baseUrl.Scheme != Uri.UriSchemeHttps && !(development && baseUrl.Scheme == Uri.UriSchemeHttp)))
            throw new InvalidOperationException(
                development
                    ? "App:PublicBaseUrl must be an absolute http or https URL."
                    : "App:PublicBaseUrl must be an absolute https URL.");

        var origins = new List<string> { baseUrl.GetLeftPart(UriPartial.Authority) };
        if (development) origins.Add(ViteDevOrigin);
        return new AuthSettings(key, baseUrl, origins);
    }
}
