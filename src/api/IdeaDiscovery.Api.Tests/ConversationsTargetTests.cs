using System.Net;
using static IdeaDiscovery.Api.Tests.ConversationsTestSupport;

namespace IdeaDiscovery.Api.Tests;

// A message goes to the conversation named in the address, and only while that
// conversation is still Active, even when another one has been started since.
public class ConversationsTargetTests
{
    private sealed record Room(Person Burak, Guid ProjectId, Person Owner);

    private static async Task<Room> NewRoom(RoomsFactory f)
    {
        var burak = await f.ConsultantSignedIn();
        var projectId = await burak.CreateProject();
        var owner = f.SeedOwner("one@example.com", "Ayse Owner");
        f.AddOwnerMember(projectId, owner);
        return new Room(burak, projectId, await f.SignedIn(owner));
    }

    [Fact]
    public async Task A_message_written_in_a_conversation_that_was_finished_and_replaced_is_refused_and_stored_nowhere()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Owner.PostMessage(r.ProjectId, "Before.");

        // Burak finishes 1 and starts 2 while the owner is still typing in 1.
        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(FinishUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await r.Burak.Post(StartUrl(r.ProjectId))).StatusCode);

        var late = await r.Owner.Post(ActiveMessagesUrl(r.ProjectId, 1), new { text = "Meant for one." });
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("no_active_conversation", await r.Owner.ErrorCode(late));
        Assert.Equal(new[] { "Before." }, (await r.Owner.Read(r.ProjectId, 1)).Messages.Select(m => m.Text));
        Assert.Empty((await r.Owner.Read(r.ProjectId, 2)).Messages);

        var fresh = await r.Owner.Post(ActiveMessagesUrl(r.ProjectId, 2), new { text = "For two." });
        Assert.Equal(HttpStatusCode.Created, fresh.StatusCode);
        Assert.EndsWith("/conversations/2/messages/" + (await r.Owner.Read(r.ProjectId, 2)).Messages.Single().Id,
            fresh.Headers.Location!.ToString());
        Assert.Equal(new[] { "Before." }, (await r.Owner.Read(r.ProjectId, 1)).Messages.Select(m => m.Text));
    }

    [Fact]
    public async Task A_finished_conversation_with_nothing_started_after_it_is_409()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Burak.Post(FinishUrl(r.ProjectId));

        var response = await r.Owner.Post(ActiveMessagesUrl(r.ProjectId, 1), new { text = "Late." });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("no_active_conversation", await r.Owner.ErrorCode(response));
    }

    [Theory]
    [InlineData("two")]
    [InlineData("1.5")]
    [InlineData("99")]
    [InlineData("0")]
    public async Task A_number_that_is_not_an_integer_or_names_no_conversation_is_404(string number)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var response = await r.Owner.Post($"/projects/{r.ProjectId}/conversations/{number}/messages", new { text = "Hi." });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty((await r.Owner.Read(r.ProjectId, 1)).Messages);
    }

    [Fact]
    public async Task A_non_member_and_another_project_are_404_even_with_a_real_number()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var otherProject = await r.Burak.CreateProject("Other");
        var stranger = await f.SignedIn(f.SeedOwner("stranger@example.com", "Stranger"));

        // Not a member of the project.
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.Post(ActiveMessagesUrl(r.ProjectId, 1), new { text = "Let me in." })).StatusCode);
        // A member of one project writing to another project's conversation 1.
        Assert.Equal(HttpStatusCode.NotFound,
            (await r.Owner.Post(ActiveMessagesUrl(otherProject, 1), new { text = "Wrong room." })).StatusCode);
        Assert.Empty((await r.Owner.Read(r.ProjectId, 1)).Messages);
        Assert.Empty((await r.Burak.Read(otherProject, 1)).Messages);
    }

    [Fact]
    public async Task The_old_active_route_is_gone()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var response = await r.Owner.Post($"/projects/{r.ProjectId}/conversations/active/messages", new { text = "Hi." });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty((await r.Owner.Read(r.ProjectId, 1)).Messages);
    }
}
