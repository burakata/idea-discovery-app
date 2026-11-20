using System.Net;
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

        var response = await client.GetAsync("/test/unruled");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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
