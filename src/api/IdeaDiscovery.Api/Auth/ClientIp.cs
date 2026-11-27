using System.Net;
using System.Net.Sockets;

namespace IdeaDiscovery.Api.Auth;

// The key a per-IP limit counts under. One person on IPv6 has a whole /64 of
// addresses, so counting each address would give them an unlimited supply.
public static class ClientIp
{
    public const string Unknown = "unknown";

    public static string PartitionKey(IPAddress? address)
    {
        if (address is null) return Unknown;
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != AddressFamily.InterNetworkV6) return address.ToString();

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes) + "/64";
    }
}
