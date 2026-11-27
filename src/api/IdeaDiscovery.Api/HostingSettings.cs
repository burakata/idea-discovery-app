using System.Net;

namespace IdeaDiscovery.Api;

// Where the app runs: the one proxy in front of it and where it keeps its keys.
// Read and checked once at startup (docs/engineering.md §12).
public sealed record HostingSettings(IPAddress? KnownProxy, string? KeysPath)
{
    // The fixed name keeps the keys usable across restarts and a changed content root.
    public const string ApplicationName = "IdeaDiscoveryRooms";

    // Null when a problem was added to `problems`. Both settings are required
    // outside Development; in Development they are optional.
    public static HostingSettings? Read(IConfiguration config, IHostEnvironment environment, StartupProblems problems)
    {
        var development = environment.IsDevelopment();
        var valid = true;

        IPAddress? proxy = null;
        var rawProxy = config["Proxy:KnownProxy"];
        if (string.IsNullOrWhiteSpace(rawProxy))
        {
            if (!development)
            {
                problems.Add("Proxy:KnownProxy is not set. Set it to the proxy's fixed IP address.");
                valid = false;
            }
        }
        else if (!TryParseAddress(rawProxy.Trim(), out proxy))
        {
            problems.Add("Proxy:KnownProxy must be one IP address, for example 172.20.0.2.");
            valid = false;
        }

        var keys = config["DataProtection:KeysPath"];
        if (string.IsNullOrWhiteSpace(keys) && !development)
        {
            problems.Add("DataProtection:KeysPath is not set. Set it to a folder that survives restarts.");
            valid = false;
        }

        if (!valid) return null;
        return new HostingSettings(
            proxy,
            string.IsNullOrWhiteSpace(keys) ? null : Path.GetFullPath(keys.Trim(), environment.ContentRootPath));
    }

    // IPAddress.TryParse accepts "1" (as 0.0.0.1) and the like, so the text
    // must come back the same. A catch-all address would trust nothing useful.
    private static bool TryParseAddress(string text, out IPAddress? address)
    {
        address = null;
        if (!IPAddress.TryParse(text, out var parsed)) return false;
        if (!string.Equals(parsed.ToString(), text, StringComparison.OrdinalIgnoreCase)) return false;
        if (parsed.Equals(IPAddress.Any) || parsed.Equals(IPAddress.IPv6Any)) return false;
        address = parsed;
        return true;
    }
}
