using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using static IdeaDiscovery.Api.Tests.ConversationsTestSupport;

namespace IdeaDiscovery.Api.Tests;

// What the acceptance tests do not cover: text rules, cursor order and
// mix-ups, the per-person limit, races, audit rows and cross-project access.
public class ConversationsTests
{
    private sealed record Room(RoomsFactory F, Person Burak, Guid ProjectId, Person Owner1, Person Owner2);

    private static async Task<Room> NewRoom(RoomsFactory f)
    {
        var burak = await f.ConsultantSignedIn();
        var projectId = await burak.CreateProject();
        var o1 = f.SeedOwner("one@example.com", "Ayse Owner");
        var o2 = f.SeedOwner("two@example.com", "Mehmet Owner");
        f.AddOwnerMember(projectId, o1);
        f.AddOwnerMember(projectId, o2);
        return new Room(f, burak, projectId, await f.SignedIn(o1), await f.SignedIn(o2));
    }

    private static Task<HttpResponseMessage> Post(Person p, Guid projectId, object body) =>
        p.Post(ActiveMessagesUrl(projectId), body);

    // ---- Text rules ----

    [Theory]
    [InlineData("a\u0000b")]
    [InlineData("a\u0007b")]
    [InlineData("a\u001bb")]
    [InlineData("a\u007fb")]
    [InlineData("a\u0085b")]
    public async Task Control_characters_other_than_line_breaks_and_tabs_are_refused(string text)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Assert.Equal(HttpStatusCode.BadRequest, (await Post(r.Owner1, r.ProjectId, new { text })).StatusCode);
        Assert.Empty((await r.Owner1.Read(r.ProjectId, 1)).Messages);
    }

    [Fact]
    public async Task Line_breaks_and_tabs_are_kept_and_the_text_is_trimmed()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var padded = await r.Owner1.PostMessage(r.ProjectId, "  \n first\r\n\tsecond  \n");
        Assert.Equal("first\r\n\tsecond", padded.Text);
        Assert.Equal("first\r\n\tsecond", Assert.Single((await r.Owner2.Read(r.ProjectId, 1)).Messages).Text);
    }

    [Fact]
    public async Task The_length_limit_counts_the_trimmed_text()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Assert.Equal(HttpStatusCode.Created,
            (await Post(r.Owner1, r.ProjectId, new { text = "  " + new string('a', 4000) + "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Post(r.Owner1, r.ProjectId, new { text = new string('a', 4000) + "b" })).StatusCode);
        Assert.Single((await r.Owner1.Read(r.ProjectId, 1)).Messages);
    }

    [Fact]
    public async Task A_missing_or_wrongly_typed_text_is_400()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Assert.Equal(HttpStatusCode.BadRequest, (await Post(r.Owner1, r.ProjectId, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(r.Owner1, r.ProjectId, new { text = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await r.Owner1.Post(ActiveMessagesUrl(r.ProjectId))).StatusCode);
        Assert.Empty((await r.Owner1.Read(r.ProjectId, 1)).Messages);
    }

    // ---- The cursor ----

    [Fact]
    public async Task Messages_stored_in_the_same_instant_keep_their_order_and_the_cursor_splits_them_exactly()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        // The clock never moves, so every message has the same CreatedAt.
        await r.Owner1.PostMessage(r.ProjectId, "m1");
        await r.Owner2.PostMessage(r.ProjectId, "m2");
        var upToTwo = await r.Owner1.Read(r.ProjectId, 1);
        var posted = new List<Guid>();
        foreach (var text in new[] { "m3", "m4", "m5", "m6" })
            posted.Add((await r.Owner1.PostMessage(r.ProjectId, text)).Id);

        var all = await r.Burak.Read(r.ProjectId, 1);
        Assert.Equal(new[] { "m1", "m2", "m3", "m4", "m5", "m6" }, all.Messages.Select(m => m.Text));
        Assert.Equal(6, all.Messages.Select(m => m.Id).Distinct().Count());

        // The cursor after m2 returns m3 to m6 in order: no gap, no repeat.
        var after = await r.Owner2.Read(r.ProjectId, 1, upToTwo.Cursor);
        Assert.Equal(posted, after.Messages.Select(m => m.Id));
        Assert.Equal(all.Cursor, after.Cursor);
        Assert.Empty((await r.Owner2.Read(r.ProjectId, 1, after.Cursor)).Messages);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("1")]
    [InlineData("1-")]
    [InlineData("-1")]
    [InlineData("1-x")]
    [InlineData("1--1")]
    [InlineData("1-1-1")]
    [InlineData("1-99999999999")]
    [InlineData(" 1-1")]
    [InlineData("1-1' OR '1'='1")]
    public async Task A_malformed_cursor_is_400(string cursor)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Owner1.PostMessage(r.ProjectId, "Hello.");

        var response = await r.Owner1.Http.GetAsync(MessagesUrl(r.ProjectId, 1, cursor));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("Hello.", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_cursor_from_conversation_1_is_refused_on_conversation_2_and_leaks_nothing()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Owner1.PostMessage(r.ProjectId, "Secret of one.");
        await r.Owner1.PostMessage(r.ProjectId, "More of one.");
        var cursorOne = (await r.Owner1.Read(r.ProjectId, 1)).Cursor;
        await r.Burak.Post(FinishUrl(r.ProjectId));
        await r.Burak.Post(StartUrl(r.ProjectId));
        await r.Owner2.PostMessage(r.ProjectId, "First of two.");
        await r.Owner2.PostMessage(r.ProjectId, "Second of two.");

        var response = await r.Owner1.Http.GetAsync(MessagesUrl(r.ProjectId, 2, cursorOne));

        // Refused, rather than silently skipping conversation 2's first messages.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("of one", body);
        Assert.DoesNotContain("of two", body);
        // Conversation 1 and 2 still read in full on their own.
        Assert.Equal(2, (await r.Owner1.Read(r.ProjectId, 2)).Messages.Count);
        Assert.Equal(2, (await r.Owner1.Read(r.ProjectId, 1)).Messages.Count);
    }

    // ---- The per-person limit ----

    [Fact]
    public async Task The_31st_message_in_a_minute_is_429_and_does_not_affect_anyone_else()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        for (var i = 1; i <= 30; i++)
            Assert.Equal(HttpStatusCode.Created, (await Post(r.Owner1, r.ProjectId, new { text = $"m{i}" })).StatusCode);
        var limited = await Post(r.Owner1, r.ProjectId, new { text = "m31" });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);

        // Another person, and Burak, are not limited by it; a new device of the same person still is.
        Assert.Equal(HttpStatusCode.Created, (await Post(r.Owner2, r.ProjectId, new { text = "other" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Post(r.Burak, r.ProjectId, new { text = "burak" })).StatusCode);
        var secondDevice = await f.SignedIn(await UserIdOf(f, "one@example.com"), "Tablet/1.0");
        Assert.Equal(HttpStatusCode.TooManyRequests, (await Post(secondDevice, r.ProjectId, new { text = "again" })).StatusCode);

        var texts = (await r.Burak.Read(r.ProjectId, 1)).Messages.Select(m => m.Text).ToList();
        Assert.Equal(32, texts.Count);
        Assert.DoesNotContain("m31", texts);
    }

    private static Task<Guid> UserIdOf(RoomsFactory f, string email) =>
        Task.FromResult(f.WithDb(db => db.Users.Single(u => u.Email == email).Id));

    // ---- Request size and membership at the insert ----

    [Fact]
    public async Task A_post_body_over_64_KB_is_413_and_nothing_is_stored()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        // Sent with a declared length, as browsers do. (The test server does not
        // enforce the request-size metadata for bodies without one; Kestrel does.)
        var request = new HttpRequestMessage(HttpMethod.Post, ActiveMessagesUrl(r.ProjectId))
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new { text = new string('a', 70 * 1024) }), System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.TryAddWithoutValidation("Origin", RoomsFactory.BaseUrl);
        request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", await r.Owner1.CsrfToken());
        var response = await r.Owner1.Http.SendAsync(request);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Empty((await r.Owner1.Read(r.ProjectId, 1)).Messages);
        Assert.Equal(HttpStatusCode.Created, (await Post(r.Owner1, r.ProjectId, new { text = "ok" })).StatusCode);
    }

    // Deletes a membership just before the message INSERT runs, which is after
    // the route's access check: the insert itself must refuse.
    private sealed class RemoveBeforeInsert(string connectionString, Guid userId)
        : Microsoft.EntityFrameworkCore.Diagnostics.DbCommandInterceptor
    {
        public override async ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int>> NonQueryExecutingAsync(
            System.Data.Common.DbCommand command,
            Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("INSERT INTO \"Messages\""))
            {
                await using var other = new Microsoft.Data.Sqlite.SqliteConnection(connectionString);
                await other.OpenAsync(cancellationToken);
                await using var delete = other.CreateCommand();
                delete.CommandText = "DELETE FROM \"ProjectMembers\" WHERE \"UserId\" = $u";
                delete.Parameters.AddWithValue("$u", userId.ToString().ToUpperInvariant());
                await delete.ExecuteNonQueryAsync(cancellationToken);
            }
            return result;
        }
    }

    [Fact]
    public async Task A_person_removed_between_the_access_check_and_the_insert_stores_nothing()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var ownerId = f.WithDb(db => db.Users.Single(u => u.Email == "one@example.com").Id);
        using var hooked = f.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.ConfigureDbContext<AppDbContext>(o =>
                o.AddInterceptors(new RemoveBeforeInsert(f.ConnectionString, ownerId)))));
        var http = hooked.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl), AllowAutoRedirect = false, HandleCookies = true,
        });
        var person = new Person(http);
        Assert.Equal(HttpStatusCode.OK, (await person.Redeem(await f.UserToken(ownerId))).StatusCode);

        var response = await Post(person, r.ProjectId, new { text = "Sneaking in." });

        // The membership was really gone by the insert, and nothing was stored.
        Assert.Equal(0, f.WithDb(db => db.ProjectMembers.Count(m => m.UserId == ownerId)));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(f.WithDb(db => db.Messages.ToList()));
    }

    // ---- Races ----

    [Fact]
    public async Task Racing_a_finish_every_201_is_stored_once_in_order_and_a_post_after_the_finish_is_409()
    {
        // The atomicity itself comes from the single INSERT ... SELECT statement
        // that checks the Active conversation; this test checks its visible results.
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var third = await f.SignedIn(f.SeedOwnerMember(r.ProjectId, "three@example.com", "Third Owner"));

        var posters = new[] { r.Owner1, r.Owner2, third };
        var posts = new List<Task<HttpResponseMessage>>();
        for (var i = 0; i < 8; i++)
            foreach (var p in posters) posts.Add(Task.Run(() => Post(p, r.ProjectId, new { text = "racing" })));
        var finish = Task.Run(() => r.Burak.Post(FinishUrl(r.ProjectId)));

        var results = await Task.WhenAll(posts);
        Assert.Equal(HttpStatusCode.NoContent, (await finish).StatusCode);

        // Each answer is "stored" or "no active conversation", never an error.
        Assert.All(results, x => Assert.True(
            x.StatusCode is HttpStatusCode.Created or HttpStatusCode.Conflict, $"Unexpected {(int)x.StatusCode}."));
        var stored = f.WithDb(db => db.Messages.OrderBy(m => m.Sequence).Select(m => m.Sequence).ToList());
        Assert.Equal(results.Count(x => x.StatusCode == HttpStatusCode.Created), stored.Count);
        Assert.Equal(Enumerable.Range(1, stored.Count), stored);

        // Once the finish has returned, nothing more is ever stored.
        Assert.Equal(HttpStatusCode.Conflict, (await Post(r.Owner1, r.ProjectId, new { text = "late" })).StatusCode);
        Assert.Equal(stored.Count, f.WithDb(db => db.Messages.Count()));
        Assert.Equal("finished", Assert.Single(await r.Burak.Conversations(r.ProjectId)).State);
    }

    [Fact]
    public async Task Two_parallel_start_next_calls_make_exactly_one_new_conversation()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        var secondBurak = await f.ConsultantSignedIn();

        var starts = await Task.WhenAll(Enumerable.Range(0, 6)
            .Select(i => Task.Run(() => (i % 2 == 0 ? r.Burak : secondBurak).Post(StartUrl(r.ProjectId)))));

        Assert.Equal(1, starts.Count(s => s.StatusCode == HttpStatusCode.Created));
        Assert.Equal(5, starts.Count(s => s.StatusCode == HttpStatusCode.Conflict));
        var list = await r.Burak.Conversations(r.ProjectId);
        Assert.Equal(new[] { (1, "finished"), (2, "active") }, list.Select(c => (c.Number, c.State)));
        Assert.Equal(1, f.WithDb(db => db.AuditEvents.Count(a => a.Action == "conversation_started")));
    }

    // ---- Audit ----

    [Fact]
    public async Task Finish_and_start_are_audited_with_ids_only()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Owner1.PostMessage(r.ProjectId, "Words that must not reach the audit log.");
        var burakId = f.ConsultantId();
        var firstId = f.WithDb(db => db.Conversations.Single().Id);

        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        // A refused finish is not an event.
        Assert.Equal(HttpStatusCode.Conflict, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await r.Burak.Post(StartUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.Burak.Post(StartUrl(r.ProjectId))).StatusCode);

        var events = f.WithDb(db => db.AuditEvents
            .Where(a => a.Action == "conversation_finished" || a.Action == "conversation_started").ToList());
        var finished = Assert.Single(events, e => e.Action == "conversation_finished");
        var started = Assert.Single(events, e => e.Action == "conversation_started");
        var secondId = f.WithDb(db => db.Conversations.Single(c => c.Number == 2).Id);

        Assert.Equal($"conversation:{firstId}", finished.Details);
        Assert.Equal($"conversation:{secondId}", started.Details);
        Assert.All(new[] { finished, started }, e =>
        {
            Assert.Equal(burakId, e.ActorUserId);
            Assert.Equal(r.ProjectId, e.ProjectId);
            Assert.Matches(new Regex(@"^conversation:[0-9a-fA-F-]{36}$"), e.Details!);
        });
        var finishedRow = f.WithDb(db => db.Conversations.Single(c => c.Number == 1));
        Assert.Equal(ConversationState.Finished, finishedRow.State);
        Assert.Equal(burakId, finishedRow.FinishedById);
        Assert.NotNull(finishedRow.FinishedAt);
    }

    // ---- Another project ----

    [Fact]
    public async Task An_owner_of_A_cannot_read_post_finish_or_start_in_B_and_reads_only_A_through_As_own_url()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");
        var ownerA = f.SeedOwner("a@example.com", "Owner A");
        var ownerB = f.SeedOwner("b@example.com", "Owner B");
        f.AddOwnerMember(a, ownerA);
        f.AddOwnerMember(b, ownerB);
        var pa = await f.SignedIn(ownerA);
        var pb = await f.SignedIn(ownerB);
        await pa.PostMessage(a, "Words of A.");
        await pb.PostMessage(b, "Words of B.");

        Assert.Equal(HttpStatusCode.NotFound, (await pa.Http.GetAsync(ConversationsUrl(b))).StatusCode);
        var read = await pa.Http.GetAsync(MessagesUrl(b, 1));
        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);
        Assert.DoesNotContain("Words of B.", await read.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await Post(pa, b, new { text = "Hi B." })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await pa.Post(FinishUrl(b))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await pa.Post(StartUrl(b))).StatusCode);

        // Conversation 1 of A is A's, never B's, even though both are number 1.
        Assert.Equal(new[] { "Words of A." }, (await pa.Read(a, 1)).Messages.Select(m => m.Text));
        Assert.Equal(new[] { "Words of B." }, (await pb.Read(b, 1)).Messages.Select(m => m.Text));
        Assert.Equal(0, f.WithDb(db => db.Messages.Count(m => m.Text == "Hi B.")));
        Assert.Equal(new[] { (1, "active") }, (await burak.Conversations(b)).Select(c => (c.Number, c.State)));
    }

    // The route scans in ProjectsTests find routes by the {projectId} in the
    // pattern; this makes sure the conversation routes are among them.
    [Fact]
    public void The_conversation_routes_are_found_by_the_project_route_scans_and_are_not_anonymous()
    {
        using var f = new RoomsFactory();
        var routes = f.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>().ToList();
        string[] expected =
        [
            "/projects/{projectId:guid}/conversations",
            "/projects/{projectId:guid}/conversations/{number}/messages",
            "/projects/{projectId:guid}/conversations/active/messages",
            "/consultant/projects/{projectId:guid}/conversations/active/finish",
            "/consultant/projects/{projectId:guid}/conversations",
        ];
        foreach (var pattern in expected)
        {
            var endpoint = Assert.Single(routes, e => e.RoutePattern.RawText == pattern);
            Assert.Null(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
        }
    }

    [Fact]
    public async Task No_conversation_GET_changes_any_table_even_with_real_ids()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Owner1.PostMessage(r.ProjectId, "One.");
        await r.Burak.Post(FinishUrl(r.ProjectId));
        await r.Burak.Post(StartUrl(r.ProjectId));
        await r.Owner2.PostMessage(r.ProjectId, "Two.");
        var cursor = (await r.Owner1.Read(r.ProjectId, 2)).Cursor;
        var nobody = f.NewPerson();
        var before = Snapshot(f);

        foreach (var person in new[] { r.Burak, r.Owner1, nobody })
        {
            await person.Http.GetAsync(ConversationsUrl(r.ProjectId));
            await person.Http.GetAsync(MessagesUrl(r.ProjectId, 1));
            await person.Http.GetAsync(MessagesUrl(r.ProjectId, 2, cursor));
            await person.Http.GetAsync(MessagesUrl(r.ProjectId, 2, "garbage"));
        }

        Assert.Equal(before, Snapshot(f));
    }

    private static string Snapshot(RoomsFactory f) => f.WithDb(db => string.Join("\n",
        JsonSerializer.Serialize(db.Users.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.ProjectMembers.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Conversations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Messages.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.MessageTranslations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.AuditEvents.OrderBy(x => x.Id).ToList())));
}

internal static class ConversationsTestsExtensions
{
    // An owner added to a project straight through the database.
    public static Guid SeedOwnerMember(this RoomsFactory f, Guid projectId, string email, string name)
    {
        var id = f.SeedOwner(email, name);
        f.AddOwnerMember(projectId, id);
        return id;
    }
}
