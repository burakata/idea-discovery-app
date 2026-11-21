using System.Net;
using System.Text.Json;

namespace IdeaDiscovery.Api.Tests;

// Helpers for the conversation tests. They use only the public contract.
public static class ConversationsTestSupport
{
    public sealed record Message(
        Guid Id, Guid AuthorId, string AuthorName, string? AuthorRole, bool AuthorLeft,
        string Text, string Language, string TranslationJson);

    public sealed record Page(List<Message> Messages, string Cursor);

    public sealed record Conversation(int Number, string State, DateTime? StartedAt, DateTime? FinishedAt);

    public static string ConversationsUrl(Guid projectId) => $"/projects/{projectId}/conversations";

    public static string MessagesUrl(Guid projectId, int number, string? after = null) =>
        $"/projects/{projectId}/conversations/{number}/messages" +
        (after is null ? "" : "?after=" + Uri.EscapeDataString(after));

    public static string ActiveMessagesUrl(Guid projectId) =>
        $"/projects/{projectId}/conversations/active/messages";

    public static string FinishUrl(Guid projectId) =>
        $"/consultant/projects/{projectId}/conversations/active/finish";

    public static string StartUrl(Guid projectId) => $"/consultant/projects/{projectId}/conversations";

    public static async Task<List<Conversation>> Conversations(this Person person, Guid projectId)
    {
        var response = await person.Http.GetAsync(ConversationsUrl(projectId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await person.Json(response);
        return json.EnumerateArray().Select(c => new Conversation(
            c.GetProperty("number").GetInt32(),
            c.GetProperty("state").GetString()!,
            Date(c.GetProperty("startedAt")),
            Date(c.GetProperty("finishedAt")))).ToList();
    }

    private static DateTime? Date(JsonElement e) =>
        e.ValueKind == JsonValueKind.Null ? null : e.GetDateTimeOffset().UtcDateTime;

    // Reads a conversation's messages, optionally after a cursor.
    public static async Task<Page> Read(this Person person, Guid projectId, int number, string? after = null)
    {
        var response = await person.Http.GetAsync(MessagesUrl(projectId, number, after));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await person.Json(response);
        var messages = json.GetProperty("messages").EnumerateArray().Select(ParseMessage).ToList();
        return new Page(messages, json.GetProperty("cursor").GetString()!);
    }

    public static Message ParseMessage(JsonElement m) => new(
        m.GetProperty("id").GetGuid(),
        m.GetProperty("authorId").GetGuid(),
        m.GetProperty("authorName").GetString()!,
        m.GetProperty("authorRole").ValueKind == JsonValueKind.Null ? null : m.GetProperty("authorRole").GetString(),
        m.GetProperty("authorLeft").GetBoolean(),
        m.GetProperty("text").GetString()!,
        m.GetProperty("language").GetString()!,
        m.GetProperty("translation").GetRawText());

    // Posts to the active conversation and expects 201; returns the message.
    public static async Task<Message> PostMessage(this Person person, Guid projectId, string text)
    {
        var response = await person.Post(ActiveMessagesUrl(projectId), new { text });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return ParseMessage(await person.Json(response));
    }

    public static async Task<string> ErrorCode(this Person person, HttpResponseMessage response) =>
        (await person.Json(response)).GetProperty("error").GetString()!;
}
