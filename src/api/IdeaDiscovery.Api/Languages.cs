using System.Diagnostics.CodeAnalysis;

namespace IdeaDiscovery.Api;

// The one place that knows which languages exist, the default and the fallback
// (docs/engineering.md section 15). Adding a language means adding it to All and
// adding its files: the email templates in Mail/Templates and the web strings.
// No other code compares language codes.
public static class Languages
{
    public static readonly IReadOnlyList<string> All = ["en", "tr"];

    // The source language, and the fallback for anything unsupported.
    public const string Default = "en";

    public static bool IsSupported([NotNullWhen(true)] string? code) => code is not null && All.Contains(code);

    public static string Resolve(string? code) => IsSupported(code) ? code : Default;
}
