using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using IdeaDiscovery.Api.Mail;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace IdeaDiscovery.Api.Tests;

public sealed record SentMail(string To, string Subject, string Body)
{
    public IReadOnlyList<string> Links =>
        Regex.Matches(Body, Regex.Escape(RoomsFactory.BaseUrl) + @"/sign-in#t=\S+").Select(m => m.Value).ToList();

    // The one link in the email.
    public string Token => RoomsFactory.TokenOf(Assert.Single(Links));
}

// The app with a capturing email sender; people and Burak browse this app.
public sealed class InviteHarness : IDisposable
{
    private sealed class CapturingSender : IEmailSender
    {
        public ConcurrentQueue<SentMail> Messages { get; } = new();

        public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
        {
            Messages.Enqueue(new SentMail(to, subject, body));
            return Task.CompletedTask;
        }
    }

    public RoomsFactory F { get; } = new();
    private readonly CapturingSender _sender = new();
    private readonly WebApplicationFactory<Program> _app;

    public InviteHarness()
    {
        _app = F.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<IEmailSender>(_sender)));
    }

    public Person NewPerson() => new(_app.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri(RoomsFactory.BaseUrl),
        AllowAutoRedirect = false,
        HandleCookies = true,
    }));

    public async Task<Person> Burak() => await SignIn(F.ConsultantId());

    public async Task<Person> SignIn(Guid userId)
    {
        var person = NewPerson();
        var response = await person.Redeem(await F.UserToken(userId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return person;
    }

    // Waits until every queued email is handled, then returns all emails so far.
    public async Task<List<SentMail>> Settled()
    {
        var queue = _app.Services.GetRequiredService<EmailQueue>();
        for (var i = 0; i < 1000 && queue.Unfinished > 0; i++)
            await Task.Delay(10);
        Assert.Equal(0, queue.Unfinished);
        return _sender.Messages.ToList();
    }

    public void Dispose() { _app.Dispose(); F.Dispose(); }
}

public static class InvitationsTestSupport
{
    public static Task<HttpResponseMessage> Invite(
        this Person burak, Guid projectId, string email, string name = "Ayse Yilmaz", string language = "en") =>
        burak.Post($"/consultant/projects/{projectId}/invitations", new { email, displayName = name, language });

    public static Task<HttpResponseMessage> Revoke(this Person person, Guid invitationId) =>
        person.Post($"/consultant/invitations/{invitationId}/revoke");

    public static async Task<Guid> InviteNew(
        this Person burak, Guid projectId, string email, string name = "Ayse Yilmaz", string language = "en")
    {
        var response = await burak.Invite(projectId, email, name, language);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await burak.Json(response);
        Assert.Equal("invited", json.GetProperty("kind").GetString());
        return json.GetProperty("invitationId").GetGuid();
    }

    public static async Task<List<JsonElement>> Invitations(this Person person, Guid projectId)
    {
        var response = await person.Http.GetAsync($"/consultant/projects/{projectId}/invitations");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await person.Json(response)).EnumerateArray().ToList();
    }

    public static async Task<string> StateOf(this Person person, Guid projectId, Guid invitationId) =>
        (await person.Invitations(projectId)).Single(i => i.GetProperty("id").GetGuid() == invitationId)
            .GetProperty("state").GetString()!;

    // A refused link: 400 with the same body as every other refusal.
    public static async Task AssertRefused(this HttpResponseMessage response, Person person)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("link_not_valid", (await person.Json(response)).GetProperty("error").GetString());
    }
}
