using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace IdeaDiscovery.Api.Tests;

// Ask to join (M1 PR 4b): a person opens the project link, asks, and only
// their own browser can finish signing in after Burak approves.
public class AskToJoinTests
{
    // ---- Helpers ----

    // A browser with a cookie jar kept by hand, so a test can copy, change or
    // drop a cookie and read the Set-Cookie flags exactly as sent.
    private sealed class Browser
    {
        private readonly Dictionary<string, string> _cookies = new();
        public HttpClient Http { get; }

        public Browser(HttpClient http, string userAgent = "Phone/1.0")
        {
            Http = http;
            http.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
        }

        public string? Cookie(string name) => _cookies.GetValueOrDefault(name);
        public void SetCookie(string name, string value) => _cookies[name] = value;
        public void DropCookie(string name) => _cookies.Remove(name);

        public async Task<string> CsrfToken()
        {
            var response = await Get("/auth/csrf");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return json.RootElement.GetProperty("token").GetString()!;
        }

        public Task<HttpResponseMessage> Get(string url) => SendRaw(new HttpRequestMessage(HttpMethod.Get, url));

        public async Task<HttpResponseMessage> Post(
            string url, object? body = null, bool csrf = true, string? origin = RoomsFactory.BaseUrl, HttpContent? raw = null)
        {
            var token = csrf ? await CsrfToken() : null;
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (raw is not null) request.Content = raw;
            else if (body is not null) request.Content = JsonContent.Create(body);
            if (origin is not null) request.Headers.TryAddWithoutValidation("Origin", origin);
            if (token is not null) request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", token);
            return await SendRaw(request);
        }

        private async Task<HttpResponseMessage> SendRaw(HttpRequestMessage request)
        {
            if (_cookies.Count > 0)
                request.Headers.TryAddWithoutValidation("Cookie", string.Join("; ", _cookies.Select(c => $"{c.Key}={c.Value}")));
            var response = await Http.SendAsync(request);
            if (response.Headers.TryGetValues("Set-Cookie", out var headers))
                foreach (var header in headers)
                {
                    var pair = header.Split(';')[0];
                    var at = pair.IndexOf('=');
                    var (name, value) = (pair[..at], pair[(at + 1)..]);
                    // A deleted cookie carries an expiry in 1970. The value alone (random text) may hold "1970".
                    var deleted = Regex.IsMatch(header, @"expires=[^;]*1970", RegexOptions.IgnoreCase);
                    if (value.Length == 0 || deleted) _cookies.Remove(name);
                    else _cookies[name] = value;
                }
            return response;
        }
    }

    private sealed class Rig : IDisposable
    {
        public RoomsFactory F { get; } = new();
        public Guid ProjectA { get; }
        private Person? _burak;

        public Rig() => ProjectA = F.SeedProject("Project A");

        public async Task<Person> Burak() => _burak ??= await F.ConsultantSignedIn();

        public Browser NewBrowser(string userAgent = "Phone/1.0") => new(F.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl),
            AllowAutoRedirect = false,
            HandleCookies = false,
        }), userAgent);

        // Switches asking on and returns the code taken from the copied link.
        public async Task<string> Enable(Guid? projectId = null)
        {
            var response = await (await Burak()).Post($"/consultant/projects/{projectId ?? ProjectA}/join-link");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var link = (await Read(response)).GetProperty("link").GetString()!;
            Assert.StartsWith(RoomsFactory.BaseUrl + "/join/", link);
            return link[(RoomsFactory.BaseUrl + "/join/").Length..];
        }

        public Task<HttpResponseMessage> Ask(Browser b, string code, string name = "Ayse Yilmaz", string? email = null) =>
            b.Post($"/join/{code}", new { name, email });

        public async Task<Guid> Asked(Browser b, string code, string name = "Ayse Yilmaz")
        {
            Assert.Equal(HttpStatusCode.Accepted, (await Ask(b, code, name)).StatusCode);
            return RequestId(b);
        }

        public static Guid RequestId(Browser b) =>
            Guid.ParseExact(b.Cookie(JoinEndpoints.CookieName)!.Split('.')[0], "N");

        public async Task<HttpResponseMessage> TryApprove(Guid requestId, object? body = null) =>
            await (await Burak()).Post($"/consultant/join-requests/{requestId}/approve", body);

        public async Task Approve(Guid requestId, string? displayName = null)
        {
            var response = await TryApprove(requestId, displayName is null ? null : new { displayName });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        public async Task<HttpResponseMessage> Reject(Guid requestId) =>
            await (await Burak()).Post($"/consultant/join-requests/{requestId}/reject");

        public Task<HttpResponseMessage> Claim(Browser b) => b.Post("/join/claim");

        // Asks and gets approved; the browser holds the cookie.
        public async Task<(Browser Browser, Guid RequestId)> ApprovedBrowser(
            string code, string name = "Ayse Yilmaz", string userAgent = "Phone/1.0")
        {
            var browser = NewBrowser(userAgent);
            var id = await Asked(browser, code, name);
            await Approve(id);
            return (browser, id);
        }

        public async Task<string> State(Browser b) => (await Read(await b.Get("/join/request"))).GetProperty("state").GetString()!;

        public async Task<JsonElement> Waiting(Guid? projectId = null) =>
            await Read(await (await Burak()).Http.GetAsync($"/consultant/projects/{projectId ?? ProjectA}/join-requests"));

        public JoinRequest Row(Guid id) => F.WithDb(db => db.JoinRequests.Single(r => r.Id == id));
        public List<AuditEvent> Audit() => F.WithDb(db => db.AuditEvents.ToList());

        public void Dispose() => F.Dispose();
    }

    private static async Task<JsonElement> Read(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static async Task AssertCannotClaim(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("{\"error\":\"cannot_claim\"}", await response.Content.ReadAsStringAsync());
    }

    private static void AddMember(RoomsFactory f, Guid projectId, Guid userId) =>
        f.WithDb(db =>
        {
            db.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(), ProjectId = projectId, UserId = userId, Role = MemberRole.Owner, JoinedAt = f.Now,
            });
            db.SaveChanges();
            return 0;
        });

    private static void SeedRequests(
        RoomsFactory f, Guid projectId, int count, JoinRequestState state, DateTime expiresAt) =>
        f.WithDb(db =>
        {
            for (var i = 0; i < count; i++)
                db.JoinRequests.Add(new JoinRequest
                {
                    Id = Guid.NewGuid(), ProjectId = projectId, Name = $"Seeded {i}", SecretHash = new string('0', 64),
                    CreatedAt = f.Now, ExpiresAt = expiresAt, State = state,
                });
            db.SaveChanges();
            return 0;
        });

    // ---- Happy path ----

    [Fact]
    public async Task A_person_asks_Burak_approves_and_only_that_browser_signs_in_once_as_a_member_of_that_project()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var burak = await r.Burak();

        var code = await r.Enable();
        Assert.Equal(22, code.Length); // 128 bits in base64url
        Assert.Matches("^[A-Za-z0-9_-]+$", code);

        var person = r.NewBrowser("Phone/1.0");
        var canAsk = await person.Get($"/join/{code}");
        Assert.Equal(HttpStatusCode.OK, canAsk.StatusCode);
        Assert.Equal("{\"canAsk\":true}", await canAsk.Content.ReadAsStringAsync());

        var asked = await r.Ask(person, code, "  Ayse Yilmaz  ", "ayse@example.com");
        Assert.Equal(HttpStatusCode.Accepted, asked.StatusCode);
        Assert.Equal("{\"state\":\"pending\"}", await asked.Content.ReadAsStringAsync());
        var requestId = Rig.RequestId(person);

        var waiting = await r.Waiting();
        var entry = Assert.Single(waiting.EnumerateArray());
        Assert.Equal(requestId, entry.GetProperty("id").GetGuid());
        Assert.Equal("Ayse Yilmaz", entry.GetProperty("name").GetString());
        Assert.Equal("ayse@example.com", entry.GetProperty("uncheckedEmail").GetString());
        Assert.Equal("Phone/1.0", entry.GetProperty("device").GetString());
        Assert.False(entry.GetProperty("nameMatchesMember").GetBoolean());
        Assert.True(entry.GetProperty("expiresAt").GetDateTime() > entry.GetProperty("createdAt").GetDateTime());

        await r.Approve(requestId);
        Assert.Equal("approved", await r.State(person));

        var copiedCookie = person.Cookie(JoinEndpoints.CookieName)!;
        var claimed = await r.Claim(person);
        Assert.Equal(HttpStatusCode.OK, claimed.StatusCode);
        var me = await Read(claimed);
        Assert.Equal("Ayse Yilmaz", me.GetProperty("displayName").GetString());
        Assert.Equal(JsonValueKind.Null, me.GetProperty("email").ValueKind);
        Assert.False(me.GetProperty("isConsultant").GetBoolean());
        var userId = me.GetProperty("id").GetGuid();

        // Signed in: /auth/me answers the same person.
        Assert.Equal(userId, (await Read(await person.Get("/auth/me"))).GetProperty("id").GetGuid());
        // A member of exactly that project, as an owner.
        var memberships = r.F.WithDb(db => db.ProjectMembers.Where(m => m.UserId == userId).ToList());
        var membership = Assert.Single(memberships);
        Assert.Equal(r.ProjectA, membership.ProjectId);
        Assert.Equal(MemberRole.Owner, membership.Role);
        Assert.DoesNotContain(memberships, m => m.ProjectId == projectB);
        var user = r.F.WithDb(db => db.Users.Single(u => u.Id == userId));
        Assert.Null(user.Email);
        Assert.Equal("en", user.UiLanguage);
        Assert.False(user.IsConsultant);
        // The session carries the browser's device, like a redeemed link.
        Assert.Equal("Phone/1.0", r.F.WithDb(db => db.UserSessions.Single(s => s.UserId == userId).Device));
        // The join cookie is gone and the request cannot be used again.
        Assert.Null(person.Cookie(JoinEndpoints.CookieName));
        Assert.Contains("1970", string.Join(";", claimed.Headers.GetValues("Set-Cookie").Where(c => c.StartsWith("join_request="))));
        Assert.NotNull(r.Row(requestId).ClaimedAt);

        // A second claim fails, even for a copy of the cookie in another browser.
        var thief = r.NewBrowser();
        thief.SetCookie(JoinEndpoints.CookieName, copiedCookie);
        await AssertCannotClaim(await r.Claim(thief));
        Assert.Equal(HttpStatusCode.Unauthorized, (await thief.Get("/auth/me")).StatusCode);
        Assert.Equal("expired", await r.State(thief));
        Assert.Equal(1, r.F.WithDb(db => db.UserSessions.Count(s => s.UserId == userId)));

        // The new owner is no consultant.
        Assert.Equal(HttpStatusCode.Forbidden, (await person.Get($"/consultant/projects/{r.ProjectA}/join-requests")).StatusCode);
        _ = burak;
    }

    [Fact]
    public async Task Approving_makes_an_owner_without_an_email_with_a_corrected_name_in_one_step()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code, "ayse");
        var burakId = r.F.ConsultantId();

        var response = await r.TryApprove(id, new { displayName = "  Ayse Yilmaz " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var row = r.Row(id);
        Assert.Equal(JoinRequestState.Approved, row.State);
        Assert.Equal(burakId, row.DecidedById);
        Assert.NotNull(row.DecidedAt);
        Assert.Equal(r.F.Now + TimeSpan.FromHours(48), row.ApprovedUntil);
        Assert.Null(row.ClaimedAt);
        var user = r.F.WithDb(db => db.Users.Single(u => u.Id == row.UserId));
        Assert.Equal("Ayse Yilmaz", user.DisplayName);
        Assert.Null(user.Email);
        Assert.Equal("en", user.UiLanguage);
        var member = r.F.WithDb(db => db.ProjectMembers.Single(m => m.UserId == user.Id));
        Assert.Equal(r.ProjectA, member.ProjectId);
        Assert.Equal(MemberRole.Owner, member.Role);
        Assert.Empty((await r.Waiting()).EnumerateArray());
    }

    [Fact]
    public async Task Two_people_without_emails_can_exist_side_by_side()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (first, _) = await r.ApprovedBrowser(code, "First Person");
        var (second, _) = await r.ApprovedBrowser(code, "Second Person");

        Assert.Equal(HttpStatusCode.OK, (await r.Claim(first)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(second)).StatusCode);

        Assert.Equal(2, r.F.WithDb(db => db.Users.Count(u => u.Email == null)));
    }

    // ---- What a waiting browser can see ----

    [Fact]
    public async Task A_pending_browser_reads_nothing_and_the_link_page_says_only_whether_asking_is_possible()
    {
        using var r = new Rig();
        var projectId = r.ProjectA;
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);

        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get("/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get($"/consultant/projects/{projectId}/join-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Post($"/consultant/join-requests/{id}/approve")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Post($"/consultant/projects/{projectId}/join-link/renew")).StatusCode);
        Assert.Equal("pending", await r.State(person));
        Assert.Equal("{\"state\":\"pending\"}", await (await person.Get("/join/request")).Content.ReadAsStringAsync());

        var page = await person.Get($"/join/{code}");
        var props = (await Read(page)).EnumerateObject().Select(p => p.Name).ToList();
        Assert.Equal(["canAsk"], props);
        Assert.DoesNotContain("Project A", await (await person.Get($"/join/{code}")).Content.ReadAsStringAsync());
        // Claiming before approval fails.
        await AssertCannotClaim(await r.Claim(person));
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get("/auth/me")).StatusCode);
    }

    [Fact]
    public async Task An_unknown_code_and_a_switched_off_project_give_identical_answers()
    {
        using var r = new Rig();
        var code = await r.Enable();
        Assert.Equal(HttpStatusCode.NoContent, (await (await r.Burak()).Post($"/consultant/projects/{r.ProjectA}/join-link/off")).StatusCode);
        const string unknown = "some-code-nobody-has";
        var person = r.NewBrowser();

        var getOff = await person.Get($"/join/{code}");
        var getUnknown = await person.Get($"/join/{unknown}");
        var postOff = await r.Ask(person, code);
        var postUnknown = await r.Ask(person, unknown);

        foreach (var (a, b) in new[] { (getOff, getUnknown), (postOff, postUnknown) })
        {
            Assert.Equal(a.StatusCode, b.StatusCode);
            Assert.Equal(await a.Content.ReadAsStringAsync(), await b.Content.ReadAsStringAsync());
            Assert.Equal(a.Content.Headers.ContentType, b.Content.Headers.ContentType);
            Assert.Equal(a.Headers.Select(h => h.Key).Order(), b.Headers.Select(h => h.Key).Order());
        }
        Assert.Equal("{\"canAsk\":false}", await getOff.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, postOff.StatusCode);
        Assert.Equal("{\"error\":\"cannot_ask\"}", await postOff.Content.ReadAsStringAsync());
        Assert.Equal(0, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Null(person.Cookie(JoinEndpoints.CookieName));
    }

    [Fact]
    public async Task A_project_that_never_had_asking_switched_on_cannot_be_asked()
    {
        using var r = new Rig();
        var person = r.NewBrowser();

        Assert.Equal("{\"canAsk\":false}", await (await person.Get("/join/anything")).Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await r.Ask(person, "anything")).StatusCode);
    }

    // ---- The link: on, off, renew ----

    [Fact]
    public async Task Switching_on_twice_or_off_and_on_keeps_the_same_code()
    {
        using var r = new Rig();
        var burak = await r.Burak();

        var first = await r.Enable();
        var second = await r.Enable();
        await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/off");
        var offPage = await r.NewBrowser().Get($"/join/{first}");
        var third = await r.Enable();

        Assert.Equal(first, second);
        Assert.Equal(first, third);
        Assert.Equal("{\"canAsk\":false}", await offPage.Content.ReadAsStringAsync());
        Assert.Equal("{\"canAsk\":true}", await (await r.NewBrowser().Get($"/join/{first}")).Content.ReadAsStringAsync());
        Assert.Equal(new[] { "join_link_on", "join_link_off", "join_link_on", "join_link_on" }.Order(),
            r.Audit().Where(a => a.Action.StartsWith("join_link")).Select(a => a.Action).Order());
    }

    [Fact]
    public async Task Renewing_stops_the_old_code_but_a_waiting_request_made_with_it_can_still_be_approved_and_claimed()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var oldCode = await r.Enable();
        var waiting = r.NewBrowser();
        var id = await r.Asked(waiting, oldCode);

        var renewed = await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/renew");
        Assert.Equal(HttpStatusCode.OK, renewed.StatusCode);
        var link = (await Read(renewed)).GetProperty("link").GetString()!;
        var newCode = link[(RoomsFactory.BaseUrl + "/join/").Length..];

        Assert.NotEqual(oldCode, newCode);
        var late = r.NewBrowser();
        Assert.Equal("{\"canAsk\":false}", await (await late.Get($"/join/{oldCode}")).Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await r.Ask(late, oldCode)).StatusCode);
        Assert.Equal("{\"canAsk\":true}", await (await late.Get($"/join/{newCode}")).Content.ReadAsStringAsync());
        Assert.Equal(id, Assert.Single((await r.Waiting()).EnumerateArray()).GetProperty("id").GetGuid());

        await r.Approve(id);
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(waiting)).StatusCode);
        Assert.Contains(r.Audit(), a => a.Action == "join_link_renewed" && a.ProjectId == r.ProjectA && a.ActorUserId == r.F.ConsultantId());
    }

    [Fact]
    public async Task Renewing_does_not_switch_asking_on()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var response = await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/renew");
        var code = (await Read(response)).GetProperty("link").GetString()![(RoomsFactory.BaseUrl + "/join/").Length..];

        Assert.Equal("{\"canAsk\":false}", await (await r.NewBrowser().Get($"/join/{code}")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Switching_off_leaves_waiting_requests_to_decide_and_approving_still_works()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);

        await (await r.Burak()).Post($"/consultant/projects/{r.ProjectA}/join-link/off");

        Assert.Single((await r.Waiting()).EnumerateArray());
        Assert.Equal("pending", await r.State(person));
        await r.Approve(id);
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(person)).StatusCode);
        // Asking again through the old code is refused.
        Assert.Equal(HttpStatusCode.NotFound, (await r.Ask(r.NewBrowser(), code)).StatusCode);
    }

    [Fact]
    public async Task The_link_endpoints_answer_404_for_an_unknown_project_and_request()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var nothing = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{nothing}/join-link")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{nothing}/join-link/off")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/projects/{nothing}/join-link/renew")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Http.GetAsync($"/consultant/projects/{nothing}/join-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/join-requests/{nothing}/approve")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post($"/consultant/join-requests/{nothing}/reject")).StatusCode);
        Assert.DoesNotContain(r.Audit(), a => a.Action.StartsWith("join_"));
    }

    // ---- Name match ----

    [Fact]
    public async Task The_list_flags_a_name_that_matches_a_member_of_that_project_only()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("a@example.com", "Ayse Yilmaz"));
        AddMember(r.F, projectB, r.F.SeedOwner("b@example.com", "Mehmet Kaya"));
        var code = await r.Enable();
        await r.Asked(r.NewBrowser(), code, "  AYSE yilmaz ");
        await r.Asked(r.NewBrowser(), code, "Mehmet Kaya");
        await r.Asked(r.NewBrowser(), code, "Somebody Else");

        var byName = (await r.Waiting()).EnumerateArray()
            .ToDictionary(e => e.GetProperty("name").GetString()!, e => e.GetProperty("nameMatchesMember").GetBoolean());

        Assert.True(byName["AYSE yilmaz"]);
        Assert.False(byName["Mehmet Kaya"]); // a member of another project only
        Assert.False(byName["Somebody Else"]);
    }

    // ---- Names that imitate a member ----

    private const string TurkishName = "Işıl Güneş Çağlar Öztürk";

    [Theory]
    [InlineData("Ayse​Yilmaz")] // zero-width space
    [InlineData("Ayse‌Yilmaz")] // zero-width non-joiner
    [InlineData("Ayse⁠Yilmaz")] // word joiner
    [InlineData("﻿Ayse Yilmaz")] // byte order mark
    [InlineData("‮Ayse Yilmaz")] // right-to-left override
    [InlineData("Ayse ⁦Yilmaz⁩")] // bidi isolate
    [InlineData("Ayse\U000E0041Yilmaz")] // tag character, outside the BMP
    [InlineData("Ayse͏Yilmaz")] // combining grapheme joiner
    [InlineData("Ayse️Yilmaz")] // variation selector
    [InlineData("AyseㅤYilmaz")] // Hangul filler
    [InlineData("Ayse⠀Yilmaz")] // braille blank
    public async Task A_name_with_an_invisible_character_is_refused_when_asking_and_when_approving(string name)
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();

        var response = await r.Ask(person, code, name);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("{\"error\":\"invalid_request\"}", await response.Content.ReadAsStringAsync());
        Assert.Equal(0, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Null(person.Cookie(JoinEndpoints.CookieName));

        var id = await r.Asked(r.NewBrowser(), code);
        Assert.Equal(HttpStatusCode.BadRequest, (await r.TryApprove(id, new { displayName = name })).StatusCode);
        Assert.Equal(JoinRequestState.Pending, r.Row(id).State);
    }

    [Theory]
    [InlineData("AyseㅤYilmaz")] // Hangul filler (a letter)
    [InlineData("AyseﾠYilmaz")] // halfwidth Hangul filler (a letter)
    [InlineData("AyseᅟYilmaz")] // Hangul choseong filler (a letter)
    [InlineData("AyseᅠYilmaz")] // Hangul jungseong filler (a letter)
    [InlineData("Ayse឴Yilmaz")] // Khmer inherent vowel (a mark)
    [InlineData("Ayse᠋Yilmaz")] // Mongolian free variation selector (a mark)
    [InlineData("Ayse\U000E0100Yilmaz")] // variation selector supplement (a mark)
    [InlineData("Ayse 2")] // digit
    [InlineData("Ayse\U0001F600")] // emoji
    [InlineData("Ayse@Yilmaz")]
    [InlineData("Ayse\tYilmaz")]
    public void Names_with_anything_but_letters_marks_spaces_apostrophes_hyphens_and_full_stops_are_refused(string name)
    {
        Assert.Null(JoinEndpoints.CleanName(name));
    }

    [Theory]
    [InlineData("O'Brien", "O'Brien")]
    [InlineData("O’Brien", "O’Brien")]
    [InlineData("Anne-Marie", "Anne-Marie")]
    [InlineData("J. Smith", "J. Smith")]
    [InlineData(TurkishName, TurkishName)]
    // "s" followed by a combining cedilla becomes the single letter "ş" under NFKC.
    [InlineData("Ay" + "ş" + "e", "Ayşe")]
    [InlineData("  Ayse   Yilmaz ", "Ayse Yilmaz")]
    public void Ordinary_names_pass_and_are_normalised(string typed, string stored)
    {
        Assert.Equal(stored, JoinEndpoints.CleanName(typed));
    }

    [Fact]
    public async Task The_warning_fires_without_accents_and_without_dots_but_not_for_another_name()
    {
        using var r = new Rig();
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("sukru@example.com", "Şükrü"));
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("hasan@example.com", "Hasan"));
        var code = await r.Enable();
        var sukru = await r.Asked(r.NewBrowser(), code, "Sukru");
        var elif = await r.Asked(r.NewBrowser(), code, "Elif");

        var flags = (await r.Waiting()).EnumerateArray()
            .ToDictionary(e => e.GetProperty("id").GetGuid(), e => e.GetProperty("nameMatchesMember").GetBoolean());
        Assert.True(flags[sukru]);
        Assert.False(flags[elif]);
        Assert.Equal("Sukru", r.Row(sukru).Name); // stored as typed
    }

    [Fact]
    public async Task Extra_spaces_are_collapsed_before_storing_and_before_comparing_with_members()
    {
        using var r = new Rig();
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("elif@example.com", "Elif Yıldız"));
        var code = await r.Enable();
        var id = await r.Asked(r.NewBrowser(), code, "  Elif  Yıldız ");

        Assert.Equal("Elif Yıldız", r.Row(id).Name);
        var entry = Assert.Single((await r.Waiting()).EnumerateArray());
        Assert.Equal("Elif Yıldız", entry.GetProperty("name").GetString());
        Assert.True(entry.GetProperty("nameMatchesMember").GetBoolean());

        // The corrected name is cleaned the same way.
        await r.Approve(id, "  Elif   Yıldız Two ");
        Assert.Equal("Elif Yıldız Two", r.F.WithDb(db => db.Users.Single(u => u.Id == r.Row(id).UserId)).DisplayName);
    }

    [Fact]
    public async Task A_compatibility_form_of_a_members_name_is_stored_in_its_plain_form_and_flagged()
    {
        using var r = new Rig();
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("ayse@example.com", "Ayse Yilmaz"));
        var code = await r.Enable();
        // Fullwidth letters with an ideographic space.
        var id = await r.Asked(r.NewBrowser(), code, "Ａｙｓｅ　Ｙｉｌｍａｚ");

        Assert.Equal("Ayse Yilmaz", r.Row(id).Name);
        Assert.True(Assert.Single((await r.Waiting()).EnumerateArray()).GetProperty("nameMatchesMember").GetBoolean());
    }

    [Fact]
    public async Task Turkish_letters_are_stored_as_typed_and_the_warning_fires_for_look_alike_spellings()
    {
        using var r = new Rig();
        AddMember(r.F, r.ProjectA, r.F.SeedOwner("isil@example.com", TurkishName));
        var code = await r.Enable();
        var same = await r.Asked(r.NewBrowser(), code, "  " + TurkishName + " ");
        // Decided: the warning fires generously, so these all flag.
        var dotted = await r.Asked(r.NewBrowser(), code, "İşıl Güneş Çağlar Öztürk");
        var lower = await r.Asked(r.NewBrowser(), code, "ışıl güneş çağlar öztürk");
        var plain = await r.Asked(r.NewBrowser(), code, "Isil Gunes Caglar Ozturk");

        Assert.Equal(TurkishName, r.Row(same).Name);
        var flags = (await r.Waiting()).EnumerateArray()
            .ToDictionary(e => e.GetProperty("id").GetGuid(), e => e.GetProperty("nameMatchesMember").GetBoolean());
        Assert.True(flags[same]);
        Assert.True(flags[dotted]);
        Assert.True(flags[lower]);
        Assert.True(flags[plain]);

        await r.Approve(same);
        Assert.Equal(TurkishName, r.F.WithDb(db => db.Users.Single(u => u.Id == r.Row(same).UserId)).DisplayName);
    }

    // ---- Claim refusals ----

    [Fact]
    public async Task A_claim_with_no_cookie_is_refused_the_same_way_and_audited_with_the_address_only()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (owner, id) = await r.ApprovedBrowser(code);
        var stranger = r.NewBrowser();

        await AssertCannotClaim(await r.Claim(stranger));

        Assert.Equal(HttpStatusCode.Unauthorized, (await stranger.Get("/auth/me")).StatusCode);
        Assert.Null(r.Row(id).ClaimedAt);
        var failed = Assert.Single(r.Audit(), a => a.Action == "join_claim_failed");
        Assert.Null(failed.ActorUserId);
        Assert.Null(failed.ProjectId);
        Assert.Null(failed.Details);
        Assert.Equal(0, r.F.WithDb(db => db.UserSessions.Count(s => s.Device == "Phone/1.0")));
        // The real owner of the cookie can still claim: only the missing cookie was refused.
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(owner)).StatusCode);
    }

    [Fact]
    public async Task A_cookie_copied_with_a_wrong_secret_or_with_another_requests_id_is_refused()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (first, firstId) = await r.ApprovedBrowser(code, "First Person");
        var (second, secondId) = await r.ApprovedBrowser(code, "Second Person");
        var firstCookie = first.Cookie(JoinEndpoints.CookieName)!;
        var secondCookie = second.Cookie(JoinEndpoints.CookieName)!;
        var firstSecret = firstCookie.Split('.')[1];

        // The right request id with a made-up secret.
        var guesser = r.NewBrowser();
        guesser.SetCookie(JoinEndpoints.CookieName, $"{firstId:N}.{new string('A', 43)}");
        await AssertCannotClaim(await r.Claim(guesser));
        // Another request's id with this request's secret.
        var mixed = r.NewBrowser();
        mixed.SetCookie(JoinEndpoints.CookieName, $"{secondId:N}.{firstSecret}");
        await AssertCannotClaim(await r.Claim(mixed));
        // Garbage in the cookie.
        foreach (var junk in new[] { "garbage", ".", $"{firstId:N}.", $"{firstId}.{firstSecret}", new string('x', 500) })
        {
            var other = r.NewBrowser();
            other.SetCookie(JoinEndpoints.CookieName, junk);
            await AssertCannotClaim(await r.Claim(other));
            Assert.Equal("expired", await r.State(other));
        }

        Assert.Equal("expired", await r.State(guesser));
        Assert.Equal(HttpStatusCode.Unauthorized, (await guesser.Get("/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await mixed.Get("/auth/me")).StatusCode);
        Assert.Null(r.Row(firstId).ClaimedAt);
        Assert.Null(r.Row(secondId).ClaimedAt);
        Assert.Equal(0, r.F.WithDb(db => db.UserSessions.Count(s => s.Device == "Phone/1.0")));
        // Each real browser still claims its own request.
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(first)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(second)).StatusCode);
        var firstUser = r.Row(firstId).UserId;
        Assert.Equal(firstUser, (await Read(await first.Get("/auth/me"))).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task A_rejected_request_cannot_be_claimed()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);

        Assert.Equal(HttpStatusCode.NoContent, (await r.Reject(id)).StatusCode);

        Assert.Equal("rejected", await r.State(person));
        await AssertCannotClaim(await r.Claim(person));
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get("/auth/me")).StatusCode);
        Assert.Equal(0, r.F.WithDb(db => db.ProjectMembers.Count()));
        Assert.Equal(1, r.F.WithDb(db => db.Users.Count())); // only Burak
        var row = r.Row(id);
        Assert.Equal(JoinRequestState.Rejected, row.State);
        Assert.Null(row.UserId);
        Assert.Contains(r.Audit(), a => a.Action == "join_rejected" && a.ProjectId == r.ProjectA && a.ActorUserId == r.F.ConsultantId());
    }

    [Fact]
    public async Task A_waiting_request_expires_after_48_hours_and_can_then_be_neither_approved_nor_claimed()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);

        r.F.Clock.Advance(TimeSpan.FromHours(47));
        Assert.Equal("pending", await r.State(person));
        Assert.Single((await r.Waiting()).EnumerateArray());
        r.F.Clock.Advance(TimeSpan.FromHours(2)); // 49 hours

        Assert.Equal("expired", await r.State(person));
        Assert.Empty((await r.Waiting()).EnumerateArray());
        Assert.Equal(HttpStatusCode.Conflict, (await r.TryApprove(id)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.Reject(id)).StatusCode);
        await AssertCannotClaim(await r.Claim(person));
        Assert.Equal(JoinRequestState.Pending, r.Row(id).State);
        Assert.Equal(0, r.F.WithDb(db => db.ProjectMembers.Count()));
    }

    [Fact]
    public async Task An_approval_past_48_hours_cannot_be_claimed_but_one_just_inside_it_can()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (late, lateId) = await r.ApprovedBrowser(code, "Late Person");
        var (inTime, _) = await r.ApprovedBrowser(code, "In Time Person");

        r.F.Clock.Advance(TimeSpan.FromHours(47));
        Assert.Equal("approved", await r.State(inTime));
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(inTime)).StatusCode);

        r.F.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        Assert.Equal("expired", await r.State(late));
        await AssertCannotClaim(await r.Claim(late));
        Assert.Equal(HttpStatusCode.Unauthorized, (await late.Get("/auth/me")).StatusCode);
        Assert.Null(r.Row(lateId).ClaimedAt);
    }

    [Fact]
    public async Task A_member_removed_before_the_claim_cannot_claim()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (person, id) = await r.ApprovedBrowser(code);
        var userId = r.Row(id).UserId!.Value;
        r.F.WithDb(db =>
        {
            db.ProjectMembers.Remove(db.ProjectMembers.Single(m => m.UserId == userId));
            db.SaveChanges();
            return 0;
        });

        await AssertCannotClaim(await r.Claim(person));

        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get("/auth/me")).StatusCode);
        Assert.Null(r.Row(id).ClaimedAt);
        Assert.Equal(0, r.F.WithDb(db => db.UserSessions.Count(s => s.UserId == userId)));
    }

    [Fact]
    public async Task Parallel_claims_of_one_approval_sign_in_exactly_once()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (person, id) = await r.ApprovedBrowser(code);
        var cookie = person.Cookie(JoinEndpoints.CookieName)!;
        var copies = Enumerable.Range(0, 6).Select(_ => { var b = r.NewBrowser(); b.SetCookie(JoinEndpoints.CookieName, cookie); return b; }).ToList();

        var responses = await Task.WhenAll(copies.Select(b => Task.Run(() => r.Claim(b))));

        Assert.Equal(1, responses.Count(x => x.StatusCode == HttpStatusCode.OK));
        Assert.Equal(5, responses.Count(x => x.StatusCode == HttpStatusCode.BadRequest));
        Assert.Equal(1, r.F.WithDb(db => db.UserSessions.Count(s => s.UserId == r.Row(id).UserId)));
    }

    // ---- Decisions ----

    [Fact]
    public async Task A_request_in_the_wrong_state_gets_409_and_nothing_changes()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var approved = await r.Asked(r.NewBrowser(), code, "Approved Person");
        var rejected = await r.Asked(r.NewBrowser(), code, "Rejected Person");
        await r.Approve(approved);
        await r.Reject(rejected);
        var usersBefore = r.F.WithDb(db => db.Users.Count());

        Assert.Equal(HttpStatusCode.Conflict, (await r.TryApprove(approved)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.Reject(approved)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.TryApprove(rejected)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await r.Reject(rejected)).StatusCode);

        Assert.Equal(usersBefore, r.F.WithDb(db => db.Users.Count()));
        Assert.Equal(1, r.F.WithDb(db => db.ProjectMembers.Count()));
        Assert.Equal(JoinRequestState.Approved, r.Row(approved).State);
        Assert.Equal(JoinRequestState.Rejected, r.Row(rejected).State);
    }

    [Fact]
    public async Task A_bad_corrected_name_is_refused_and_the_request_stays_waiting()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var id = await r.Asked(r.NewBrowser(), code);

        Assert.Equal(HttpStatusCode.BadRequest, (await r.TryApprove(id, new { displayName = "   " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await r.TryApprove(id, new { displayName = new string('n', 81) })).StatusCode);

        Assert.Equal(JoinRequestState.Pending, r.Row(id).State);
        Assert.Equal(1, r.F.WithDb(db => db.Users.Count()));
    }

    [Fact]
    public async Task Of_several_parallel_approvals_exactly_one_succeeds_and_makes_one_person()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var id = await r.Asked(r.NewBrowser(), code);
        var burak = await r.Burak();

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            Task.Run(() => burak.Post($"/consultant/join-requests/{id}/approve"))));

        Assert.Equal(1, responses.Count(x => x.StatusCode == HttpStatusCode.OK));
        Assert.All(responses.Where(x => x.StatusCode != HttpStatusCode.OK), x => Assert.Equal(HttpStatusCode.Conflict, x.StatusCode));
        Assert.Equal(2, r.F.WithDb(db => db.Users.Count())); // Burak and one new person
        Assert.Equal(1, r.F.WithDb(db => db.ProjectMembers.Count()));
    }

    // ---- Across projects ----

    [Fact]
    public async Task Approval_for_one_project_gives_no_membership_in_another_and_a_code_only_reaches_its_own_project()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var codeA = await r.Enable(r.ProjectA);
        var codeB = await r.Enable(projectB);
        Assert.NotEqual(codeA, codeB);

        var person = r.NewBrowser();
        var idA = await r.Asked(person, codeA, "Ayse Yilmaz");
        await r.Approve(idA);
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(person)).StatusCode);

        var userId = r.Row(idA).UserId!.Value;
        Assert.Equal([r.ProjectA], r.F.WithDb(db => db.ProjectMembers.Where(m => m.UserId == userId).Select(m => m.ProjectId).ToList()));
        Assert.Empty((await r.Waiting(projectB)).EnumerateArray());
        Assert.Equal(r.ProjectA, r.Row(idA).ProjectId);

        // A request made through A's code never lists under B, and B's list never holds A's.
        var other = r.NewBrowser();
        var viaA = await r.Asked(other, codeA, "Mehmet Kaya");
        var viaB = await r.Asked(r.NewBrowser(), codeB, "Zeynep Kaya");
        Assert.Equal(viaA, Assert.Single((await r.Waiting(r.ProjectA)).EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(viaB, Assert.Single((await r.Waiting(projectB)).EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(projectB, r.Row(viaB).ProjectId);

        // A browser waiting on A that asks B's code gets its own, new request for B.
        var viaBAgain = await r.Asked(other, codeB, "Mehmet Kaya");
        Assert.NotEqual(viaA, viaBAgain);
        Assert.Equal(projectB, r.Row(viaBAgain).ProjectId);
        Assert.Equal(r.ProjectA, r.Row(viaA).ProjectId);
    }

    [Fact]
    public async Task Approving_a_request_from_B_adds_the_member_to_B_and_never_to_A()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var codeB = await r.Enable(projectB);
        var person = r.NewBrowser();
        var id = await r.Asked(person, codeB);
        await r.Approve(id);
        await r.Claim(person);

        var userId = r.Row(id).UserId!.Value;
        Assert.Equal([projectB], r.F.WithDb(db => db.ProjectMembers.Where(m => m.UserId == userId).Select(m => m.ProjectId).ToList()));
        Assert.Equal(0, r.F.WithDb(db => db.ProjectMembers.Count(m => m.ProjectId == r.ProjectA)));
    }

    // ---- Consultant only ----

    private static Task<HttpResponseMessage> CallConsultant(Person who, string endpoint, Guid projectId, Guid requestId) => endpoint switch
    {
        "join-link" => who.Post($"/consultant/projects/{projectId}/join-link"),
        "off" => who.Post($"/consultant/projects/{projectId}/join-link/off"),
        "renew" => who.Post($"/consultant/projects/{projectId}/join-link/renew"),
        "list" => who.Http.GetAsync($"/consultant/projects/{projectId}/join-requests"),
        "approve" => who.Post($"/consultant/join-requests/{requestId}/approve"),
        _ => who.Post($"/consultant/join-requests/{requestId}/reject"),
    };

    [Theory]
    [InlineData("join-link")]
    [InlineData("off")]
    [InlineData("renew")]
    [InlineData("list")]
    [InlineData("approve")]
    [InlineData("reject")]
    public async Task An_owner_gets_403_and_a_signed_out_caller_401_on_every_consultant_join_endpoint(string endpoint)
    {
        using var r = new Rig();
        var code = await r.Enable();
        var id = await r.Asked(r.NewBrowser(), code);
        // Switch asking off first for the endpoints that would change it, so a change is visible.
        await (await r.Burak()).Post($"/consultant/projects/{r.ProjectA}/join-link/off");
        var ownerId = r.F.SeedOwner("owner@example.com");
        AddMember(r.F, r.ProjectA, ownerId); // a member of this very project
        var owner = await r.F.SignedIn(ownerId);
        var nobody = r.F.NewPerson();
        var before = r.F.WithDb(db => (db.Projects.Single(p => p.Id == r.ProjectA).JoinCode, db.Users.Count(), db.AuditEvents.Count()));

        var asOwner = await CallConsultant(owner, endpoint, r.ProjectA, id);
        var signedOut = await CallConsultant(nobody, endpoint, r.ProjectA, id);

        Assert.Equal(HttpStatusCode.Forbidden, asOwner.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);
        var after = r.F.WithDb(db => (db.Projects.Single(p => p.Id == r.ProjectA).JoinCode, db.Users.Count(), db.AuditEvents.Count()));
        Assert.Equal(before, after);
        Assert.False(r.F.WithDb(db => db.Projects.Single(p => p.Id == r.ProjectA).AskToJoinEnabled));
        Assert.Equal(JoinRequestState.Pending, r.Row(id).State);
    }

    // ---- Limits ----

    [Fact]
    public async Task A_project_holds_at_most_20_waiting_requests_and_only_waiting_unexpired_ones_count()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var codeA = await r.Enable();
        var codeB = await r.Enable(projectB);
        SeedRequests(r.F, r.ProjectA, 19, JoinRequestState.Pending, r.F.Now.AddHours(10));
        SeedRequests(r.F, r.ProjectA, 10, JoinRequestState.Pending, r.F.Now.AddHours(-1)); // expired
        SeedRequests(r.F, r.ProjectA, 10, JoinRequestState.Rejected, r.F.Now.AddHours(10));
        SeedRequests(r.F, r.ProjectA, 10, JoinRequestState.Approved, r.F.Now.AddHours(10));

        var twentieth = r.NewBrowser();
        Assert.Equal(HttpStatusCode.Accepted, (await r.Ask(twentieth, codeA)).StatusCode);
        var twentyFirst = r.NewBrowser();
        var refused = await r.Ask(twentyFirst, codeA);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal("{\"error\":\"try_later\"}", await refused.Content.ReadAsStringAsync());
        Assert.Null(twentyFirst.Cookie(JoinEndpoints.CookieName));
        // The refusal is audited with the project and address, and nothing typed.
        var capped = Assert.Single(r.Audit(), a => a.Action == "join_ask_capped");
        Assert.Equal(r.ProjectA, capped.ProjectId);
        Assert.Null(capped.ActorUserId);
        Assert.Null(capped.Details);
        Assert.Equal(20, r.F.WithDb(db => db.JoinRequests.Count(x => x.ProjectId == r.ProjectA && x.State == JoinRequestState.Pending && x.ExpiresAt > r.F.Now)));
        // The cap is per project.
        Assert.Equal(HttpStatusCode.Accepted, (await r.Ask(r.NewBrowser(), codeB)).StatusCode);
    }

    [Fact]
    public async Task The_sixth_ask_from_one_address_in_an_hour_gets_429_and_creates_nothing()
    {
        using var r = new Rig();
        var code = await r.Enable();
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Accepted, (await r.Ask(r.NewBrowser(), code, $"Person {(char)('A' + i)}")).StatusCode);

        var sixth = r.NewBrowser();
        var limited = await r.Ask(sixth, code, "Person F");

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Null(sixth.Cookie(JoinEndpoints.CookieName));
        Assert.Equal(5, r.F.WithDb(db => db.JoinRequests.Count()));
    }

    [Fact]
    public async Task Claims_from_one_address_are_limited_to_10_in_15_minutes_even_with_a_real_approval()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (person, id) = await r.ApprovedBrowser(code);
        var stranger = r.NewBrowser();
        // The limit is 10 in 15 minutes, shared with signing in (Burak's own sign-in used one).
        var refused = 0;
        while (refused < 10)
        {
            var response = await r.Claim(stranger);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) break;
            await AssertCannotClaim(response);
            refused++;
        }
        Assert.InRange(refused, 1, 9);

        var limited = await r.Claim(person);

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Null(r.Row(id).ClaimedAt);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Get("/auth/me")).StatusCode);
    }

    // ---- Input ----

    [Theory]
    [InlineData("missing-name")]
    [InlineData("empty-name")]
    [InlineData("blank-name")]
    [InlineData("name-81")]
    [InlineData("control-in-name")]
    [InlineData("email-255")]
    [InlineData("control-in-email")]
    [InlineData("name-not-text")]
    [InlineData("text-body")]
    [InlineData("no-body")]
    public async Task Invalid_input_gets_400_and_creates_nothing(string kind)
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var url = $"/join/{code}";

        var response = kind switch
        {
            "missing-name" => await person.Post(url, new { email = "a@example.com" }),
            "empty-name" => await person.Post(url, new { name = "" }),
            "blank-name" => await person.Post(url, new { name = "   " }),
            "name-81" => await person.Post(url, new { name = new string('n', 81) }),
            "control-in-name" => await person.Post(url, new { name = "Ayse\u0007" }),
            "email-255" => await person.Post(url, new { name = "Ayse", email = new string('e', 255) }),
            "control-in-email" => await person.Post(url, new { name = "Ayse", email = "a\nb@example.com" }),
            "name-not-text" => await person.Post(url, new { name = 12 }),
            "text-body" => await person.Post(url, raw: new StringContent("not json", System.Text.Encoding.UTF8, "text/plain")),
            _ => await person.Post(url),
        };

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("{\"error\":\"invalid_request\"}", await response.Content.ReadAsStringAsync());
        Assert.Equal(0, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Null(person.Cookie(JoinEndpoints.CookieName));
    }

    [Fact]
    public async Task The_longest_allowed_name_and_email_are_accepted_trimmed_and_a_blank_email_is_kept_as_none()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var longest = r.NewBrowser();
        var blank = r.NewBrowser();

        var name80 = new string('n', 80);
        var email254 = new string('e', 242) + "@example.com"; // 254 characters
        Assert.Equal(254, email254.Length);
        Assert.Equal(HttpStatusCode.Accepted, (await r.Ask(longest, code, " " + name80 + " ", " " + email254 + " ")).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await r.Ask(blank, code, "  x  ", "   ")).StatusCode);

        var a = r.Row(Rig.RequestId(longest));
        Assert.Equal(name80, a.Name);
        Assert.Equal(email254, a.UncheckedEmail);
        var b = r.Row(Rig.RequestId(blank));
        Assert.Equal("x", b.Name);
        Assert.Null(b.UncheckedEmail);
    }

    [Fact]
    public async Task What_was_typed_is_never_the_account_email_and_never_used_to_send_anything()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);
        await r.Ask(person, code, "Ayse", "typed@example.com"); // the same browser: nothing new
        var other = r.NewBrowser();
        var second = (await r.Ask(other, code, "Ayse Two", "typed@example.com")).StatusCode;
        Assert.Equal(HttpStatusCode.Accepted, second);
        await r.Approve(Rig.RequestId(other));

        var user = r.F.WithDb(db => db.Users.Single(u => u.DisplayName == "Ayse Two"));

        Assert.Null(user.Email);
        Assert.Equal(0, r.F.WithDb(db => db.Users.Count(u => u.Email == "typed@example.com")));
        var burakId = r.F.ConsultantId();
        Assert.Equal(0, r.F.WithDb(db => db.SignInTokens.Count(t => t.UserId != burakId)));
        _ = id;
    }

    // ---- The same browser asking again ----

    [Fact]
    public async Task A_browser_that_is_already_waiting_on_the_project_gets_its_own_request_back()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code, "First Name");
        var cookie = person.Cookie(JoinEndpoints.CookieName);

        var again = await r.Ask(person, code, "Another Name");

        Assert.Equal(HttpStatusCode.Accepted, again.StatusCode);
        Assert.Equal("{\"state\":\"pending\"}", await again.Content.ReadAsStringAsync());
        Assert.False(again.Headers.TryGetValues("Set-Cookie", out var set) && set.Any(c => c.StartsWith("join_request=")));
        Assert.Equal(cookie, person.Cookie(JoinEndpoints.CookieName));
        Assert.Equal(1, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Equal("First Name", r.Row(id).Name);

        // Once that request has expired the browser may ask afresh.
        r.F.Clock.Advance(TimeSpan.FromHours(49));
        var fresh = await r.Asked(person, code, "Another Name");
        Assert.NotEqual(id, fresh);
        Assert.Equal(2, r.F.WithDb(db => db.JoinRequests.Count()));
    }

    [Fact]
    public async Task A_browser_asking_again_after_approval_is_told_so_keeps_its_cookie_and_can_still_claim()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (person, id) = await r.ApprovedBrowser(code);
        var cookie = person.Cookie(JoinEndpoints.CookieName);

        var again = await r.Ask(person, code, "Another Name");

        Assert.Equal(HttpStatusCode.Accepted, again.StatusCode);
        Assert.Equal("{\"state\":\"approved\"}", await again.Content.ReadAsStringAsync());
        Assert.False(again.Headers.TryGetValues("Set-Cookie", out var set) && set.Any(c => c.StartsWith("join_request=")));
        Assert.Equal(cookie, person.Cookie(JoinEndpoints.CookieName));
        Assert.Equal(1, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(person)).StatusCode);
        Assert.NotNull(r.Row(id).ClaimedAt);
    }

    [Fact]
    public async Task Another_browser_asking_under_the_same_name_learns_nothing_of_an_approval()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (first, firstId) = await r.ApprovedBrowser(code, "Ayse Yilmaz");
        var fresh = await r.Asked(r.NewBrowser(), code, "Pending Person");
        var freshBody = await (await r.Ask(r.NewBrowser(), code, "Other Person")).Content.ReadAsStringAsync();

        var second = r.NewBrowser();
        var response = await r.Ask(second, code, "Ayse Yilmaz");

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(freshBody, await response.Content.ReadAsStringAsync());
        Assert.Equal("{\"state\":\"pending\"}", freshBody);
        var secondId = Rig.RequestId(second);
        Assert.NotEqual(firstId, secondId);
        Assert.NotEqual(fresh, secondId);
        Assert.Equal(JoinRequestState.Pending, r.Row(secondId).State);
        Assert.Equal("pending", await r.State(second));
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(first)).StatusCode);
    }

    [Fact]
    public async Task A_cookie_with_the_wrong_secret_for_an_approved_request_gets_the_normal_answer()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (_, id) = await r.ApprovedBrowser(code);
        var guesser = r.NewBrowser();
        guesser.SetCookie(JoinEndpoints.CookieName, $"{id:N}.{new string('A', 43)}");

        var response = await r.Ask(guesser, code, "Guesser");

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal("{\"state\":\"pending\"}", await response.Content.ReadAsStringAsync());
        var newId = Rig.RequestId(guesser);
        Assert.NotEqual(id, newId);
        Assert.Equal(JoinRequestState.Pending, r.Row(newId).State);
    }

    [Fact]
    public async Task An_approval_that_ran_out_or_was_claimed_does_not_block_asking_afresh()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (late, lateId) = await r.ApprovedBrowser(code, "Late Person");
        r.F.Clock.Advance(TimeSpan.FromHours(49));

        var fresh = await r.Asked(late, code, "Late Person");

        Assert.NotEqual(lateId, fresh);
        Assert.Equal(JoinRequestState.Pending, r.Row(fresh).State);
    }

    // ---- Secrets and cookie ----

    [Fact]
    public async Task Only_a_hash_of_the_secret_is_stored_and_it_is_never_written_to_the_audit_log()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code);
        await r.Approve(id);
        await r.Claim(person);

        var cookie = person.Cookie(JoinEndpoints.CookieName);
        Assert.Null(cookie); // cleared by the claim, so read the secret from the first response instead
        var other = r.NewBrowser();
        var secretId = await r.Asked(other, code, "Second Person");
        var secret = other.Cookie(JoinEndpoints.CookieName)!.Split('.')[1];
        var row = r.Row(secretId);

        Assert.Equal(43, secret.Length); // 256 bits in base64url
        Assert.Matches("^[A-Za-z0-9_-]+$", secret);
        Assert.NotEqual(secret, row.SecretHash);
        Assert.Equal(64, row.SecretHash.Length);
        var everything = JsonSerializer.Serialize(r.Audit()) + JsonSerializer.Serialize(r.F.WithDb(db => db.JoinRequests.ToList()));
        Assert.DoesNotContain(secret, everything);
    }

    [Fact]
    public async Task The_join_cookie_is_HttpOnly_SameSite_Lax_and_lasts_96_hours_in_Development()
    {
        using var r = new Rig();
        var code = await r.Enable();

        var response = await r.Ask(r.NewBrowser(), code);

        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("join_request="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("max-age=345600", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase); // the test address is https
    }

    private sealed class ProductionFactory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _keepAlive;
        private readonly string _connection = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
        private readonly Dictionary<string, string?> _settings;

        public ProductionFactory()
        {
            _settings = ProductionSettings.Good(_connection);
            _keepAlive = new SqliteConnection(_connection);
            _keepAlive.Open();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            foreach (var (key, value) in _settings)
                if (value is not null) builder.UseSetting(key, value);
            builder.ConfigureServices(TestRemoteAddress.AddTo);
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (!disposing) return;
            _keepAlive.Dispose();
            ProductionSettings.DeleteKeys(_settings);
        }
    }

    [Fact]
    public async Task Outside_Development_the_join_cookie_is_Secure_even_when_the_app_sees_plain_http()
    {
        using var f = new ProductionFactory();
        const string code = "production-code";
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Projects.Add(new Project
            {
                Id = Guid.NewGuid(), TitleEn = "P", TitleTr = "P", Status = "active", CreatedAt = DateTime.UtcNow,
                CreatedById = db.Users.Single(u => u.IsConsultant).Id, AskToJoinEnabled = true, JoinCode = code,
            });
            db.SaveChanges();
        }
        // Behind a TLS-terminating proxy the app itself sees plain http.
        var person = new Browser(f.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://rooms.test"), AllowAutoRedirect = false, HandleCookies = false,
        }));
        // The proxy's address and its forwarded protocol make the request https.
        person.Http.DefaultRequestHeaders.Add(TestRemoteAddress.Header, ProductionSettings.ProxyAddress);
        person.Http.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");

        var response = await person.Post($"/join/{code}", new { name = "Ayse" });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("join_request="));
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
    }

    // ---- Audit ----

    [Fact]
    public async Task Every_step_is_audited_with_the_right_actor_and_project_and_no_typed_name_or_email()
    {
        using var r = new Rig();
        var burakId = r.F.ConsultantId();
        var burak = await r.Burak();
        var code = await r.Enable();
        var person = r.NewBrowser();
        var id = await r.Asked(person, code, "Zeynep Quokka");
        await r.Ask(person, code, "Zeynep Quokka", "zeynep-quokka@example.com");
        var rejectedPerson = r.NewBrowser();
        var rejectedId = await r.Asked(rejectedPerson, code, "Rejected Quokka");
        await r.Reject(rejectedId);
        await r.Approve(id, "Zeynep Corrected-Quokka");
        var claimed = await Read(await r.Claim(person));
        var userId = claimed.GetProperty("id").GetGuid();
        await r.Claim(person); // fails: no cookie any more
        await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/renew");
        await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/off");

        var audit = r.Audit();
        AuditEvent One(string action) => Assert.Single(audit, a => a.Action == action);
        Assert.Equal(burakId, One("join_link_renewed").ActorUserId);
        Assert.Equal(r.ProjectA, One("join_link_renewed").ProjectId);
        Assert.Equal(burakId, One("join_link_off").ActorUserId);
        Assert.Equal(r.ProjectA, One("join_link_off").ProjectId);
        Assert.Equal(burakId, One("join_link_on").ActorUserId);
        Assert.Equal(2, audit.Count(a => a.Action == "join_requested"));
        Assert.All(audit.Where(a => a.Action == "join_requested"), a =>
        {
            Assert.Null(a.ActorUserId);
            Assert.Equal(r.ProjectA, a.ProjectId);
        });
        var approved = One("join_approved");
        Assert.Equal(burakId, approved.ActorUserId);
        Assert.Equal(r.ProjectA, approved.ProjectId);
        var rejected = One("join_rejected");
        Assert.Equal(burakId, rejected.ActorUserId);
        Assert.Equal(r.ProjectA, rejected.ProjectId);
        var joined = One("join_claimed");
        Assert.Equal(userId, joined.ActorUserId);
        Assert.Equal(r.ProjectA, joined.ProjectId);
        var failed = One("join_claim_failed");
        Assert.Null(failed.ActorUserId);
        Assert.Null(failed.ProjectId);
        Assert.Null(failed.Details);

        var everything = JsonSerializer.Serialize(audit);
        Assert.DoesNotContain("Quokka", everything);
        Assert.DoesNotContain("zeynep", everything, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(code, everything);
    }

    // ---- A user with no email is never matched by an email lookup ----

    private sealed class CapturingSender : IEmailSender
    {
        public ConcurrentQueue<string> To { get; } = new();

        public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
        {
            To.Enqueue(to);
            return Task.CompletedTask;
        }
    }

    [Theory]
    [InlineData("their-name-as-an-email")]
    [InlineData("an-empty-email")]
    [InlineData("a-blank-email")]
    public async Task A_person_with_no_email_is_never_matched_by_a_sign_in_link_request(string kind)
    {
        using var f = new RoomsFactory();
        var sender = new CapturingSender();
        using var app = f.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<IEmailSender>(sender)));
        var projectId = f.SeedProject();
        // A member who really has this address, so a working lookup is proven to send.
        AddMember(f, projectId, f.SeedOwner("real@example.com", "Real Person"));
        // The person who joined by asking: no email, and a display name that looks like one.
        var ghost = Guid.NewGuid();
        f.WithDb(db =>
        {
            db.Users.Add(new User { Id = ghost, Email = null, DisplayName = "ghost@example.com", CreatedAt = f.Now });
            db.SaveChanges();
            return 0;
        });
        AddMember(f, projectId, ghost);
        var person = new Person(app.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl), AllowAutoRedirect = false, HandleCookies = true,
        }));
        var queue = app.Services.GetRequiredService<EmailQueue>();

        var email = kind switch { "their-name-as-an-email" => "ghost@example.com", "an-empty-email" => "", _ => "   " };
        Assert.Equal(HttpStatusCode.Accepted, (await person.Post("/auth/request-link", new { email })).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await person.Post("/auth/request-link", new { email = "real@example.com" })).StatusCode);
        for (var i = 0; i < 1000 && queue.Unfinished > 0; i++) await Task.Delay(10);

        Assert.Equal(0, queue.Unfinished);
        Assert.Equal(["real@example.com"], sender.To.ToList());
        Assert.Equal(0, f.WithDb(db => db.SignInTokens.Count(t => t.UserId == ghost)));
    }

    // ---- CSRF and Origin ----

    [Theory]
    [InlineData("ask", true)]
    [InlineData("ask", false)]
    [InlineData("claim", true)]
    [InlineData("claim", false)]
    [InlineData("join-link", true)]
    [InlineData("join-link", false)]
    [InlineData("approve", true)]
    [InlineData("approve", false)]
    public async Task Every_join_POST_is_refused_from_another_origin_or_without_the_CSRF_proof(string endpoint, bool wrongOrigin)
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (waitingBrowser, id) = await r.ApprovedBrowser(code);
        var burak = await r.Burak();
        var url = endpoint switch
        {
            "ask" => $"/join/{code}",
            "claim" => "/join/claim",
            "join-link" => $"/consultant/projects/{r.ProjectA}/join-link/renew",
            _ => $"/consultant/join-requests/{id}/approve",
        };
        var actor = endpoint is "join-link" or "approve" ? burak.Http : waitingBrowser.Http;
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Content = JsonContent.Create(new { name = "Someone" });
        if (endpoint is "ask" or "claim") request.Headers.TryAddWithoutValidation("Cookie", $"{JoinEndpoints.CookieName}={waitingBrowser.Cookie(JoinEndpoints.CookieName)}");
        request.Headers.TryAddWithoutValidation("Origin", wrongOrigin ? "https://evil.test" : RoomsFactory.BaseUrl);
        if (wrongOrigin)
        {
            var csrf = await actor.GetAsync("/auth/csrf");
            using var json = JsonDocument.Parse(await csrf.Content.ReadAsStringAsync());
            request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", json.RootElement.GetProperty("token").GetString());
        }

        var response = await actor.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(1, r.F.WithDb(db => db.JoinRequests.Count()));
        Assert.Null(r.Row(id).ClaimedAt);
        Assert.Equal(code, r.F.WithDb(db => db.Projects.Single(p => p.Id == r.ProjectA).JoinCode));
        Assert.Equal(0, r.F.WithDb(db => db.UserSessions.Count(s => s.Device == "Phone/1.0")));
    }

    // ---- GET changes nothing ----

    private static string Snapshot(RoomsFactory f) => f.WithDb(db => string.Join("\n",
        JsonSerializer.Serialize(db.Users.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Projects.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.ProjectMembers.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.JoinRequests.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.SignInTokens.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.UserSessions.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.AuditEvents.OrderBy(x => x.Id).ToList())));

    [Fact]
    public async Task A_GET_to_every_join_endpoint_changes_nothing_even_after_the_requests_have_expired()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var pending = r.NewBrowser();
        await r.Asked(pending, code, "Pending Person");
        var (approved, _) = await r.ApprovedBrowser(code, "Approved Person");
        var burak = await r.Burak();
        var nobody = r.NewBrowser();

        var routes = r.F.Services.GetServices<EndpointDataSource>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("GET") == true)
            .Select(e => e.RoutePattern.RawText!)
            .ToList();
        // Prove the test sees the new endpoints.
        Assert.Contains("/join/{code}", routes);
        Assert.Contains("/join/request", routes);
        Assert.Contains(routes, x => x.StartsWith("/consultant/projects/") && x.EndsWith("/join-requests"));

        async Task GetAll()
        {
            foreach (var route in routes)
            {
                var url = route.StartsWith("/join/{code}")
                    ? $"/join/{code}"
                    : Regex.Replace(route, @"\{[^}]+\}", r.ProjectA.ToString());
                await burak.Http.GetAsync(url);
                foreach (var browser in new[] { pending, approved, nobody })
                    await browser.Get(url);
            }
        }

        var before = Snapshot(r.F);
        await GetAll();
        Assert.Equal(before, Snapshot(r.F));

        r.F.Clock.Advance(TimeSpan.FromHours(100));
        // Burak's own request refreshes his session's last-seen time by design; let that happen first.
        await burak.Http.GetAsync("/auth/me");
        before = Snapshot(r.F);
        await GetAll();
        Assert.Equal(before, Snapshot(r.F));
    }

    // ---- Whether asking is on, and whose request this is (PR 7c) ----

    [Fact]
    public async Task Burak_reads_whether_asking_is_on_with_its_link_and_an_owner_never_does()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var url = $"/projects/{r.ProjectA}";

        var before = await Read(await burak.Http.GetAsync(url));
        Assert.False(before.GetProperty("askToJoin").GetProperty("enabled").GetBoolean());
        Assert.Equal(JsonValueKind.Null, before.GetProperty("askToJoin").GetProperty("link").ValueKind);

        var code = await r.Enable();
        var on = (await Read(await burak.Http.GetAsync(url))).GetProperty("askToJoin");
        Assert.True(on.GetProperty("enabled").GetBoolean());
        Assert.Equal($"{RoomsFactory.BaseUrl}/join/{code}", on.GetProperty("link").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/projects/{r.ProjectA}/join-link/off")).StatusCode);
        var off = (await Read(await burak.Http.GetAsync(url))).GetProperty("askToJoin");
        Assert.False(off.GetProperty("enabled").GetBoolean());
        Assert.Equal(JsonValueKind.Null, off.GetProperty("link").ValueKind);

        // An owner of the project gets the project, and no word about asking or the code.
        await r.Enable();
        var ownerId = r.F.SeedOwner();
        AddMember(r.F, r.ProjectA, ownerId);
        var owner = await r.F.SignedIn(ownerId);
        var ownerResponse = await owner.Http.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, ownerResponse.StatusCode);
        var text = await ownerResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("askToJoin", text);
        Assert.DoesNotContain("/join/", text);
        Assert.DoesNotContain(code, text);
    }

    [Fact]
    public async Task A_request_is_reported_as_for_this_link_only_to_the_link_it_was_made_on()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var codeA = await r.Enable();
        var codeB = await r.Enable(projectB);
        var person = r.NewBrowser();
        await r.Asked(person, codeA, "Ayse Yilmaz");

        var own = await Read(await person.Get($"/join/request?code={codeA}"));
        Assert.Equal("pending", own.GetProperty("state").GetString());
        Assert.True(own.GetProperty("forThisLink").GetBoolean());

        // Read with another project's code, the answer is what a browser with no request gets.
        var other = await person.Get($"/join/request?code={codeB}");
        var otherText = await other.Content.ReadAsStringAsync();
        Assert.Equal("{\"state\":\"expired\",\"forThisLink\":false}", otherText);
        var stranger = await r.NewBrowser().Get($"/join/request?code={codeB}");
        Assert.Equal(otherText, await stranger.Content.ReadAsStringAsync());
        Assert.DoesNotContain("Project A", otherText);
        Assert.DoesNotContain(codeA, otherText);

        // An unknown code says false too, and without a code the answer is unchanged.
        Assert.Equal(otherText, await (await person.Get("/join/request?code=nope")).Content.ReadAsStringAsync());
        Assert.Equal("{\"state\":\"pending\"}", await (await person.Get("/join/request")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_approved_request_is_still_for_its_link_after_asking_is_switched_off()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var (person, _) = await r.ApprovedBrowser(code);
        Assert.Equal(HttpStatusCode.NoContent,
            (await (await r.Burak()).Post($"/consultant/projects/{r.ProjectA}/join-link/off")).StatusCode);

        var answer = await Read(await person.Get($"/join/request?code={code}"));
        Assert.Equal("approved", answer.GetProperty("state").GetString());
        Assert.True(answer.GetProperty("forThisLink").GetBoolean());
    }

    [Fact]
    public async Task A_request_that_ran_out_is_stale_for_its_own_link_and_nothing_else()
    {
        using var r = new Rig();
        var projectB = r.F.SeedProject("Project B");
        var codeA = await r.Enable();
        var codeB = await r.Enable(projectB);

        var waiting = r.NewBrowser();
        await r.Asked(waiting, codeA);
        var (lapsed, _) = await r.ApprovedBrowser(codeA, "Can Demir");
        var nobody = r.NewBrowser();

        r.F.Clock.Advance(TimeSpan.FromHours(49));

        Assert.Equal("{\"state\":\"stale\",\"forThisLink\":true}",
            await (await waiting.Get($"/join/request?code={codeA}")).Content.ReadAsStringAsync());
        Assert.Equal("{\"state\":\"stale\",\"forThisLink\":true}",
            await (await lapsed.Get($"/join/request?code={codeA}")).Content.ReadAsStringAsync());

        // Read with another project's link, or by a browser with no request, it is the no-request answer.
        var none = "{\"state\":\"expired\",\"forThisLink\":false}";
        Assert.Equal(none, await (await waiting.Get($"/join/request?code={codeB}")).Content.ReadAsStringAsync());
        Assert.Equal(none, await (await nobody.Get($"/join/request?code={codeA}")).Content.ReadAsStringAsync());
        // Without a code nothing changes.
        Assert.Equal("{\"state\":\"expired\"}", await (await waiting.Get("/join/request")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_rejected_or_claimed_request_is_never_stale()
    {
        using var r = new Rig();
        var code = await r.Enable();
        var rejected = r.NewBrowser();
        await r.Reject(await r.Asked(rejected, code));
        var (claimed, _) = await r.ApprovedBrowser(code, "Can Demir");
        Assert.Equal(HttpStatusCode.OK, (await r.Claim(claimed)).StatusCode);
        r.F.Clock.Advance(TimeSpan.FromHours(100));

        Assert.Equal("{\"state\":\"rejected\",\"forThisLink\":true}",
            await (await rejected.Get($"/join/request?code={code}")).Content.ReadAsStringAsync());
        // The claim cleared the cookie; a copy of the old one reads as used, not as stale.
        Assert.Equal("{\"state\":\"expired\",\"forThisLink\":false}",
            await (await claimed.Get($"/join/request?code={code}")).Content.ReadAsStringAsync());
    }
}
