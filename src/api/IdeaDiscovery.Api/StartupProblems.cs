namespace IdeaDiscovery.Api;

// Collects what is wrong with the settings so the app can refuse to start once,
// naming every problem, instead of one at a time (docs/engineering.md §12).
// Messages name the setting, never its value: a value can be a secret.
public sealed class StartupProblems
{
    private readonly List<string> _problems = [];

    public IReadOnlyList<string> All => _problems;

    public void Add(string problem) => _problems.Add(problem);

    public void ThrowIfAny()
    {
        if (_problems.Count == 0) return;
        throw new InvalidOperationException(
            "The app cannot start. Fix these settings:" + Environment.NewLine
            + string.Join(Environment.NewLine, _problems.Select(p => "- " + p)));
    }
}
