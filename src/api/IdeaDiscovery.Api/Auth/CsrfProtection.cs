using Microsoft.AspNetCore.Antiforgery;

namespace IdeaDiscovery.Api.Auth;

// Every request that can change something, signed-out ones included, must come
// from the app's own origin and carry the antiforgery token.
public sealed class CsrfProtection(RequestDelegate next, AuthSettings settings, IAntiforgery antiforgery)
{
    public const string HeaderName = "X-CSRF-TOKEN";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsSafe(context.Request.Method))
        {
            var origin = context.Request.Headers.Origin.ToString();
            var originAllowed = settings.AllowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
            if (!originAllowed || !await antiforgery.IsRequestValidAsync(context))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "request_refused" });
                return;
            }
        }
        await next(context);
    }

    private static bool IsSafe(string method) =>
        HttpMethods.IsGet(method) || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method);
}
