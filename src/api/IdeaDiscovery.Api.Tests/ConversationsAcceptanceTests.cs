using System.Net;
using static IdeaDiscovery.Api.Tests.ConversationsTestSupport;

namespace IdeaDiscovery.Api.Tests;

// PRD §8 A01 (two devices), A03 (return later) and A04 (conversation finish),
// written against the contract before the endpoints exist.
public class ConversationsAcceptanceTests
{
    private sealed record Room(
        RoomsFactory F, Person Burak, Guid ProjectId,
        Guid Owner1Id, Person Owner1, Guid Owner2Id, Person Owner2);

    private static async Task<Room> NewRoom(RoomsFactory f)
    {
        var burak = await f.ConsultantSignedIn();
        var projectId = await burak.CreateProject();
        var o1 = f.SeedOwner("one@example.com", "Ayse Owner");
        var o2 = f.SeedOwner("two@example.com", "Mehmet Owner");
        f.AddOwnerMember(projectId, o1);
        f.AddOwnerMember(projectId, o2);
        var d1 = await f.SignedIn(o1, "Phone/1.0");
        var d2 = await f.SignedIn(o2, "Laptop/1.0");
        return new Room(f, burak, projectId, o1, d1, o2, d2);
    }

    // Messages get distinct creation times, so ordering and cursors do not
    // depend on how an implementation breaks ties.
    private static void Tick(RoomsFactory f) => f.Clock.Advance(TimeSpan.FromSeconds(1));

    // ---- A01 ----

    [Fact]
    public async Task A01_two_devices_see_the_same_conversation_and_each_others_new_replies()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var list1 = await r.Owner1.Conversations(r.ProjectId);
        var list2 = await r.Owner2.Conversations(r.ProjectId);
        Assert.Equal(list1, list2);
        var only = Assert.Single(list1);
        Assert.Equal(1, only.Number);
        Assert.Equal("active", only.State);

        var start1 = await r.Owner1.Read(r.ProjectId, 1);
        var start2 = await r.Owner2.Read(r.ProjectId, 1);
        Assert.Empty(start1.Messages);
        Assert.Empty(start2.Messages);

        Tick(f);
        var first = await r.Owner1.PostMessage(r.ProjectId, "We want to move stock faster.");

        var poll2 = await r.Owner2.Read(r.ProjectId, 1, start2.Cursor);
        var seen = Assert.Single(poll2.Messages);
        Assert.Equal(first.Id, seen.Id);
        Assert.Equal("We want to move stock faster.", seen.Text);
        Assert.Equal("Ayse Owner", seen.AuthorName);
        Assert.Equal("owner", seen.AuthorRole);
        Assert.False(seen.AuthorLeft);
        Assert.Equal(r.Owner1Id, seen.AuthorId);

        Tick(f);
        var reply = await r.Owner2.PostMessage(r.ProjectId, "Agreed, mainly for small shops.");

        // Owner 1's own cursor is the one from before the first message, so
        // use a cursor from a read taken after it: only the reply is new.
        var caughtUp = await r.Owner1.Read(r.ProjectId, 1, poll2.Cursor);
        var onlyReply = Assert.Single(caughtUp.Messages);
        Assert.Equal(reply.Id, onlyReply.Id);
        Assert.Equal("Mehmet Owner", onlyReply.AuthorName);
        Assert.Equal("owner", onlyReply.AuthorRole);

        // A cursor from before both returns both, oldest first.
        var all = await r.Owner1.Read(r.ProjectId, 1, start1.Cursor);
        Assert.Equal(new[] { first.Id, reply.Id }, all.Messages.Select(m => m.Id));

        // Polling again from the newest cursor returns nothing.
        var quiet = await r.Owner1.Read(r.ProjectId, 1, caughtUp.Cursor);
        Assert.Empty(quiet.Messages);
    }

    [Fact]
    public async Task A01_a_reader_polling_from_their_own_cursor_gets_only_the_reply()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "First.");
        var caughtUp = await r.Owner1.Read(r.ProjectId, 1);
        Assert.Single(caughtUp.Messages);

        Tick(f);
        var reply = await r.Owner2.PostMessage(r.ProjectId, "Reply.");

        var next = await r.Owner1.Read(r.ProjectId, 1, caughtUp.Cursor);
        var only = Assert.Single(next.Messages);
        Assert.Equal(reply.Id, only.Id);
    }

    [Fact]
    public async Task A01_burak_sees_all_messages_with_roles_and_no_emails()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "From owner one.");
        Tick(f);
        await r.Owner2.PostMessage(r.ProjectId, "From owner two.");
        Tick(f);
        var fromBurak = await r.Burak.PostMessage(r.ProjectId, "From Burak.");
        Assert.Equal("consultant", fromBurak.AuthorRole);

        var page = await r.Burak.Read(r.ProjectId, 1);
        Assert.Equal(new[] { "From owner one.", "From owner two.", "From Burak." }, page.Messages.Select(m => m.Text));
        Assert.Equal(new[] { "owner", "owner", "consultant" }, page.Messages.Select(m => m.AuthorRole));
        Assert.All(page.Messages, m => Assert.Equal("null", m.TranslationJson));

        var raw = await (await r.Owner1.Http.GetAsync(MessagesUrl(r.ProjectId, 1))).Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", raw);
    }

    [Fact]
    public async Task A01_messages_carry_the_writers_language_setting()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var response = await r.Owner2.Put("/me/language", new { language = "tr" });
        Assert.True(response.IsSuccessStatusCode);

        Tick(f);
        var en = await r.Owner1.PostMessage(r.ProjectId, "Hello.");
        Tick(f);
        var tr = await r.Owner2.PostMessage(r.ProjectId, "Merhaba.");

        Assert.Equal("en", en.Language);
        Assert.Equal("tr", tr.Language);
    }

    [Fact]
    public async Task A01_a_person_who_is_not_a_member_sees_nothing_and_cannot_post()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "Private to the room.");

        var outsider = await f.SignedIn(f.SeedOwner("outsider@example.com", "Outsider"), "Other/1.0");

        var list = await outsider.Http.GetAsync(ConversationsUrl(r.ProjectId));
        var messages = await outsider.Http.GetAsync(MessagesUrl(r.ProjectId, 1));
        var post = await outsider.Post(ActiveMessagesUrl(r.ProjectId), new { text = "Let me in." });
        Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, messages.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, post.StatusCode);
        Assert.DoesNotContain("Private to the room.", await messages.Content.ReadAsStringAsync());

        // Same answer as for a project that does not exist.
        var unknown = await outsider.Http.GetAsync(ConversationsUrl(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);

        // Nothing was written.
        Assert.Single((await r.Burak.Read(r.ProjectId, 1)).Messages);
    }

    [Fact]
    public async Task A01_signed_out_gets_401_on_every_conversation_route()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var anon = f.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Http.GetAsync(ConversationsUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Http.GetAsync(MessagesUrl(r.ProjectId, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Post(ActiveMessagesUrl(r.ProjectId), new { text = "Hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Post(StartUrl(r.ProjectId))).StatusCode);
    }

    [Fact]
    public async Task A01_an_unknown_conversation_number_is_404()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var response = await r.Owner1.Http.GetAsync(MessagesUrl(r.ProjectId, 7));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   \n\t ")]
    public async Task A01_empty_or_blank_text_is_refused_with_400(string text)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var response = await r.Owner1.Post(ActiveMessagesUrl(r.ProjectId), new { text });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await r.Owner1.Read(r.ProjectId, 1)).Messages);
    }

    [Fact]
    public async Task A01_text_over_4000_characters_is_refused_and_4000_is_accepted()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var tooLong = await r.Owner1.Post(ActiveMessagesUrl(r.ProjectId), new { text = new string('a', 4001) });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        var exact = await r.Owner1.Post(ActiveMessagesUrl(r.ProjectId), new { text = new string('a', 4000) });
        Assert.Equal(HttpStatusCode.Created, exact.StatusCode);
        Assert.Single((await r.Owner1.Read(r.ProjectId, 1)).Messages);
    }

    // ---- A03 ----

    [Fact]
    public async Task A03_an_owner_returning_after_a_day_finds_the_same_conversation_and_history()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Tick(f);
        var m1 = await r.Owner1.PostMessage(r.ProjectId, "Our idea in one line.");
        Tick(f);
        var m2 = await r.Owner2.PostMessage(r.ProjectId, "And what I would add.");
        var startedBefore = (await r.Owner1.Conversations(r.ProjectId)).Single().StartedAt;

        f.Clock.Advance(TimeSpan.FromHours(25));
        var returned = await f.SignedIn(r.Owner1Id, "NextDayBrowser/1.0");

        var only = Assert.Single(await returned.Conversations(r.ProjectId));
        Assert.Equal(1, only.Number);
        Assert.Equal("active", only.State);
        Assert.Null(only.FinishedAt);
        Assert.Equal(startedBefore, only.StartedAt);

        var history = await returned.Read(r.ProjectId, 1);
        Assert.Equal(new[] { m1.Id, m2.Id }, history.Messages.Select(m => m.Id));
        Assert.Equal(new[] { "Our idea in one line.", "And what I would add." }, history.Messages.Select(m => m.Text));

        var again = await returned.PostMessage(r.ProjectId, "Back again.");
        Assert.Equal(r.Owner1Id, again.AuthorId);

        Assert.Equal(1, Assert.Single(await returned.Conversations(r.ProjectId)).Number);
        var full = await returned.Read(r.ProjectId, 1);
        Assert.Equal(new[] { "Our idea in one line.", "And what I would add.", "Back again." }, full.Messages.Select(m => m.Text));
    }

    [Fact]
    public async Task A03_signing_in_again_never_creates_a_second_conversation()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        for (var i = 0; i < 3; i++)
        {
            f.Clock.Advance(TimeSpan.FromHours(25));
            var device = await f.SignedIn(r.Owner2Id, $"Device{i}/1.0");
            Assert.Equal(1, Assert.Single(await device.Conversations(r.ProjectId)).Number);
        }

        Assert.Equal(1, Assert.Single(await r.Burak.Conversations(r.ProjectId)).Number);
    }

    // ---- A04 ----

    [Fact]
    public async Task A04_finishing_keeps_the_messages_and_a_new_conversation_begins_separately()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "One.");
        Tick(f);
        await r.Owner2.PostMessage(r.ProjectId, "Two.");
        var before = await r.Burak.Read(r.ProjectId, 1);

        Tick(f);
        var finish = await r.Burak.Post(FinishUrl(r.ProjectId));
        Assert.Equal(HttpStatusCode.NoContent, finish.StatusCode);

        var listed = Assert.Single(await r.Owner1.Conversations(r.ProjectId));
        Assert.Equal(1, listed.Number);
        Assert.Equal("finished", listed.State);
        Assert.NotNull(listed.FinishedAt);

        Assert.Equal(before.Messages, (await r.Owner1.Read(r.ProjectId, 1)).Messages);

        // Nothing can be posted until Burak starts the next one.
        var refused = await r.Owner1.Post(ActiveMessagesUrl(r.ProjectId), new { text = "Too late." });
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("no_active_conversation", await r.Owner1.ErrorCode(refused));
        var refusedBurak = await r.Burak.Post(ActiveMessagesUrl(r.ProjectId), new { text = "Too late." });
        Assert.Equal(HttpStatusCode.Conflict, refusedBurak.StatusCode);
        Assert.Equal(before.Messages, (await r.Owner1.Read(r.ProjectId, 1)).Messages);

        Tick(f);
        var start = await r.Burak.Post(StartUrl(r.ProjectId));
        Assert.Equal(HttpStatusCode.Created, start.StatusCode);
        var started = await r.Burak.Json(start);
        Assert.Equal(2, started.GetProperty("number").GetInt32());
        Assert.Equal("active", started.GetProperty("state").GetString());

        Tick(f);
        var fresh = await r.Owner2.PostMessage(r.ProjectId, "A new start.");

        Assert.Equal(before.Messages, (await r.Owner1.Read(r.ProjectId, 1)).Messages);
        var only = Assert.Single((await r.Owner1.Read(r.ProjectId, 2)).Messages);
        Assert.Equal(fresh.Id, only.Id);

        var states = (await r.Owner1.Conversations(r.ProjectId)).Select(c => (c.Number, c.State)).ToList();
        Assert.Equal(new[] { (1, "finished"), (2, "active") }, states);
    }

    [Fact]
    public async Task A04_starting_while_one_is_active_is_409_and_finishing_with_none_active_is_409()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var duplicate = await r.Burak.Post(StartUrl(r.ProjectId));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("conversation_active", await r.Burak.ErrorCode(duplicate));
        Assert.Equal(1, Assert.Single(await r.Burak.Conversations(r.ProjectId)).Number);

        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await r.Burak.Post(StartUrl(r.ProjectId))).StatusCode);
        var again = await r.Burak.Post(StartUrl(r.ProjectId));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("conversation_active", await r.Burak.ErrorCode(again));
        Assert.Equal(2, (await r.Burak.Conversations(r.ProjectId)).Count);
    }

    [Fact]
    public async Task A04_an_owner_cannot_finish_or_start_and_nothing_changes()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "Still going.");

        Assert.Equal(HttpStatusCode.Forbidden, (await r.Owner1.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await r.Owner1.Post(StartUrl(r.ProjectId))).StatusCode);

        var list = Assert.Single(await r.Burak.Conversations(r.ProjectId));
        Assert.Equal("active", list.State);
        Assert.Null(list.FinishedAt);

        // Once finished, an owner still cannot start the next one.
        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await r.Owner2.Post(StartUrl(r.ProjectId))).StatusCode);
        Assert.Equal(1, Assert.Single(await r.Burak.Conversations(r.ProjectId)).Number);
    }

    [Fact]
    public async Task A04_a_non_consultant_outsider_is_refused_on_the_consultant_routes()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var outsider = await f.SignedIn(f.SeedOwner("outsider@example.com", "Outsider"), "Other/1.0");

        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.Post(StartUrl(r.ProjectId))).StatusCode);
        Assert.Equal("active", Assert.Single(await r.Burak.Conversations(r.ProjectId)).State);
    }

    // ---- A04 / R05: a removed member's words stay ----

    [Fact]
    public async Task A04_R05_a_removed_members_messages_stay_with_their_name_marked_as_left()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Tick(f);
        var written = await r.Owner2.PostMessage(r.ProjectId, "I will be leaving the project.");
        Tick(f);
        await r.Owner1.PostMessage(r.ProjectId, "Noted.");

        var removal = await r.Burak.Post($"/consultant/projects/{r.ProjectId}/members/{r.Owner2Id}/remove");
        Assert.True(removal.IsSuccessStatusCode);

        foreach (var reader in new[] { r.Owner1, r.Burak })
        {
            var page = await reader.Read(r.ProjectId, 1);
            Assert.Equal(2, page.Messages.Count);
            var gone = page.Messages[0];
            Assert.Equal(written.Id, gone.Id);
            Assert.Equal("Mehmet Owner", gone.AuthorName);
            Assert.True(gone.AuthorLeft);
            Assert.Null(gone.AuthorRole);
            Assert.Equal("I will be leaving the project.", gone.Text);

            var stays = page.Messages[1];
            Assert.False(stays.AuthorLeft);
            Assert.Equal("owner", stays.AuthorRole);
        }

        // The removed person can no longer read or post.
        var back = await f.SignedIn(r.Owner2Id, "AfterRemoval/1.0");
        Assert.Equal(HttpStatusCode.NotFound, (await back.Http.GetAsync(MessagesUrl(r.ProjectId, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await back.Post(ActiveMessagesUrl(r.ProjectId), new { text = "Hello?" })).StatusCode);
    }
}
