using System.Security.Cryptography;
using System.Text;

namespace IdeaDiscovery.Api.Auth;

// Tokens are stored and looked up only as HMAC-SHA256 under a server key, so a
// copy of the database cannot be used to sign in.
public sealed class TokenHasher(AuthSettings settings)
{
    private readonly byte[] _key = Encoding.UTF8.GetBytes(settings.TokenKey);

    // A real token is 43 characters; anything far longer is garbage and is not hashed.
    public const int MaxTokenLength = 128;

    public static bool LooksLikeToken(string? token) =>
        !string.IsNullOrEmpty(token) && token.Length <= MaxTokenLength;

    public string Hash(string token) =>
        Convert.ToHexString(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(token)));

    public static string NewToken() =>
        System.Buffers.Text.Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
}
