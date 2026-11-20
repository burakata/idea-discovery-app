using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace IdeaDiscovery.Api.Tests;

public class AccessTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AccessTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Health_is_open_to_anonymous_requests()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // The app has no other endpoint yet, so the test host adds one with no
    // access rule, on the app's real authentication and authorisation setup.
    [Fact]
    public async Task Endpoint_without_an_access_rule_refuses_anonymous_requests()
    {
        var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.AddSingleton<IStartupFilter, UnruledEndpointFilter>()));
        var client = factory.CreateClient();

        // The fallback policy also answers unmatched paths with 401, so prove
        // the route exists before trusting the 401.
        var registered = factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Any(endpoint => endpoint.RoutePattern.RawText == "/test/unruled");
        Assert.True(registered, "The test route /test/unruled is not registered.");

        var response = await client.GetAsync("/test/unruled");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Opening an endpoint to anonymous requests must be a deliberate act:
    // add its route here on purpose.
    // /auth/csrf, /auth/request-link and /auth/redeem: a signed-out person needs all three to sign in.
    // /join/{code}, /join/request and /join/claim: a person asking to join has no session; each is limited by the project code or the browser's own secret.
    private static readonly string[] AllowedAnonymousRoutes =
        ["/health", "/auth/csrf", "/auth/request-link", "/auth/redeem", "/join/{code}", "/join/request", "/join/claim"];

    [Fact]
    public void Only_listed_endpoints_are_open_to_anonymous_requests()
    {
        var found = _factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(source => source.Endpoints)
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(endpoint => (endpoint as RouteEndpoint)?.RoutePattern.RawText
                ?? endpoint.DisplayName
                ?? "(unnamed endpoint)")
            .ToList();

        // Prove the test can see the app's endpoints, so an empty read cannot pass.
        Assert.Contains("/health", found);

        var open = found
            .Where(route => !AllowedAnonymousRoutes.Contains(route))
            .ToList();

        Assert.True(open.Count == 0,
            "These endpoints allow anonymous requests but are not on the allow-list in AccessTests: "
            + string.Join(", ", open));
    }

    private sealed class UnruledEndpointFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) =>
            app =>
            {
                next(app);
                // Joins the app's own routing, so the app's real authentication
                // and authorisation middleware sit in front of it.
                app.UseEndpoints(endpoints =>
                    endpoints.MapGet("/test/unruled", () => "reached"));
            };
    }
}
