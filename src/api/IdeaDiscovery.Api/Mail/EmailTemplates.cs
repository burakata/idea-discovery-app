using System.Text.RegularExpressions;
using IdeaDiscovery.Api.Auth;

namespace IdeaDiscovery.Api.Mail;

// The email texts, loaded from Mail/Templates at startup. One file per email and
// language, named <email>.<language>.txt. Owner-facing, so follow .claude/skills/ui-copy.
// The sign-in email holds no names; the invitation emails name the person, Burak
// and the project. The names and the project title are Burak's own entries and
// none of them can hold a line break.
//
// File format: the first line is "Subject: ...", then a blank line, then the body.
// The body is sent exactly as written, so end the file with one line break.
// Placeholders are {name}, {inviter}, {project}, {link}, {minutes} and {days}; a
// language must use exactly the placeholders its English file uses.
// Adding a language means adding its files and its entry in Languages.All.
public sealed partial class EmailTemplates
{
    public const string SignIn = "sign-in";
    public const string Invitation = "invitation";
    public const string Added = "added";
    public static readonly IReadOnlyList<string> Names = [SignIn, Invitation, Added];

    private const string SubjectPrefix = "Subject: ";

    private readonly Dictionary<(string Name, string Language), Template> _templates = [];

    private sealed record Template(string Subject, string Body);

    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex PlaceholderPattern();

    // Throws InvalidOperationException, saying what is wrong, when a supported
    // language has no template or its placeholders differ from the English one.
    public EmailTemplates(string directory)
    {
        foreach (var name in Names)
            foreach (var language in Languages.All)
            {
                var path = Path.Combine(directory, $"{name}.{language}.txt");
                if (!File.Exists(path))
                    throw new InvalidOperationException(
                        $"The email template \"{name}\" is missing for language \"{language}\". Add {path}.");
                _templates[(name, language)] = Parse(path);
            }

        foreach (var name in Names)
        {
            var expected = Placeholders(_templates[(name, Languages.Default)]);
            foreach (var language in Languages.All.Where(l => l != Languages.Default))
            {
                var actual = Placeholders(_templates[(name, language)]);
                if (!expected.SetEquals(actual))
                    throw new InvalidOperationException(
                        $"The email template \"{name}\" for language \"{language}\" must use the same placeholders as "
                        + $"the {Languages.Default} one. Expected {{{string.Join("}, {", expected.Order())}}}, "
                        + $"found {{{string.Join("}, {", actual.Order())}}}.");
            }
        }
    }

    // The templates are copied next to the build output, like the prompts.
    public static EmailTemplates LoadFromBuildOutput() =>
        new(Path.Combine(AppContext.BaseDirectory, "Mail", "Templates"));

    // An unsupported language gets the English email.
    public (string Subject, string Body) Render(string name, string? language, IReadOnlyDictionary<string, string> values)
    {
        var template = _templates[(name, Languages.Resolve(language))];
        return (Fill(template.Subject, values), Fill(template.Body, values));
    }

    public (string Subject, string Body) RenderSignIn(string? language, string link) =>
        Render(SignIn, language, new Dictionary<string, string>
        {
            ["link"] = link,
            ["minutes"] = Minutes,
        });

    // An invitation for a person with no account yet.
    public (string Subject, string Body) RenderInvitation(
        string? language, string name, string inviter, string project, string link) =>
        Render(Invitation, language, new Dictionary<string, string>
        {
            ["name"] = name, ["inviter"] = inviter, ["project"] = project, ["link"] = link,
            ["days"] = ((int)SignInLinks.InvitationLifetime.TotalDays).ToString(),
        });

    // For someone who already had an account: they are in the project now, and
    // the link only signs them in.
    public (string Subject, string Body) RenderAdded(
        string? language, string name, string inviter, string project, string link) =>
        Render(Added, language, new Dictionary<string, string>
        {
            ["name"] = name, ["inviter"] = inviter, ["project"] = project, ["link"] = link,
            ["minutes"] = Minutes,
        });

    private static string Minutes => ((int)SignInLinks.SignInLifetime.TotalMinutes).ToString();

    // One pass, so a value that contains braces is never expanded again.
    private static string Fill(string text, IReadOnlyDictionary<string, string> values) =>
        PlaceholderPattern().Replace(text, m => values.TryGetValue(m.Groups[1].Value, out var value)
            ? value
            : throw new InvalidOperationException($"No value for the placeholder {{{m.Groups[1].Value}}}."));

    private static HashSet<string> Placeholders(Template t) =>
        PlaceholderPattern().Matches(t.Subject + "\n" + t.Body).Select(m => m.Groups[1].Value).ToHashSet();

    private static Template Parse(string path)
    {
        // Line endings may differ by checkout; the sent text always uses \n.
        var text = File.ReadAllText(path).TrimStart('﻿').Replace("\r\n", "\n");
        var split = text.IndexOf("\n\n", StringComparison.Ordinal);
        if (!text.StartsWith(SubjectPrefix, StringComparison.Ordinal) || split < 0)
            throw new InvalidOperationException(
                $"The email template {path} must start with \"Subject: ...\", then a blank line, then the body.");
        return new Template(text[SubjectPrefix.Length..split], text[(split + 2)..]);
    }
}
