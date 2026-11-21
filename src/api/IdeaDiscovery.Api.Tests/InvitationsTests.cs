using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IdeaDiscovery.Api.Tests;

// Invitations beyond the A15 acceptance tests: name and language rules, what the
// audit log may hold, the limits, the worker's own checks, revoking, logs.
public class InvitationsTests
{
    // Like InviteHarness, plus the email queue and every log line, so a test can
    // hand the worker a job directly and read what the app logged.
    private sealed class Rig : IDisposable
    {
        public sealed class Sender : IEmailSender
        {
            public ConcurrentQueue<SentMail> Messages { get; } = new();
            public int FailNext;

            public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
            {
                if (Interlocked.Decrement(ref FailNext) >= 0) throw new InvalidOperationException($"boom {to} {body}");
                Messages.Enqueue(new SentMail(to, subject, body));
                return Task.CompletedTask;
            }
        }

        public sealed class LogCapture : ILoggerProvider, ILogger
        {
            public ConcurrentQueue<string> Lines { get; } = new();
            public ILogger CreateLogger(string categoryName) => this;
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                Lines.Enqueue(formatter(state, exception) + exception);
            public void Dispose() { }
        }

        public RoomsFactory F { get; } = new();
        public Sender Mail { get; } = new();
        public LogCapture Log { get; } = new();
        private readonly WebApplicationFactory<Program> _app;

        public Rig()
        {
            _app = F.WithWebHostBuilder(b => b.ConfigureServices(s =>
            {
                s.AddSingleton<IEmailSender>(Mail);
                s.AddLogging(l => l.AddProvider(Log));
            }));
        }

        public EmailQueue Queue => _app.Services.GetRequiredService<EmailQueue>();

        public Person NewPerson() => new(_app.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri(RoomsFactory.BaseUrl),
            AllowAutoRedirect = false,
            HandleCookies = true,
        }));

        public async Task<Person> SignIn(Guid userId)
        {
            var person = NewPerson();
            Assert.Equal(HttpStatusCode.OK, (await person.Redeem(await F.UserToken(userId))).StatusCode);
            return person;
        }

        public Task<Person> Burak() => SignIn(F.ConsultantId());

        public async Task<List<SentMail>> Settled()
        {
            for (var i = 0; i < 1000 && Queue.Unfinished > 0; i++) await Task.Delay(10);
            Assert.Equal(0, Queue.Unfinished);
            return Mail.Messages.ToList();
        }

        public void Dispose() { _app.Dispose(); F.Dispose(); }
    }

    private static List<AuditEvent> Audit(RoomsFactory f, string action) =>
        f.WithDb(db => db.AuditEvents.Where(a => a.Action == action).ToList());

    private static async Task<string> ErrorOf(Person person, HttpResponseMessage response) =>
        (await person.Json(response)).GetProperty("error").GetString()!;

    // ---- Name, email and language rules ----

    public static IEnumerable<object?[]> BadNames()
    {
        yield return ["digits", "Ayse 2"];
        yield return ["markup", "<b>Ayse</b>"];
        yield return ["tab inside", "Ayse\tYilmaz"];
        yield return ["line break inside", "Ayse\nYilmaz"];
        yield return ["Hangul filler", "Ayseㅤ"];
        yield return ["only a filler", "ㅤ"];
        yield return ["too long", new string('a', 101)];
        yield return ["email as name", "ayse@example.com"];
    }

    [Theory]
    [MemberData(nameof(BadNames))]
    public async Task A_name_the_name_rules_refuse_is_a_400_and_nothing_is_created_or_sent(string why, string name)
    {
        _ = why;
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();

        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Invite(project, "new.owner@example.com", name)).StatusCode);

        Assert.Empty(await r.Settled());
        Assert.Equal(0, r.F.WithDb(db => db.Invitations.Count()));
        Assert.Empty(Audit(r.F, "invitation_created"));
    }

    [Fact]
    public async Task A_name_is_tidied_like_an_ask_to_join_name_and_turkish_letters_are_kept()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();

        var id = await burak.InviteNew(project, "new.owner@example.com", "  Işıl   Şükrü Özdemir  ", "tr");

        Assert.Equal("Işıl Şükrü Özdemir", r.F.WithDb(db => db.Invitations.Single(i => i.Id == id).DisplayName));
    }

    [Theory]
    [InlineData("TR")]
    [InlineData("en-GB")]
    [InlineData(" en")]
    public async Task The_language_must_be_exactly_en_or_tr(string language)
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();

        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Invite(project, "new.owner@example.com", "Ayse", language)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await burak.Post($"/consultant/projects/{project}/invitations", new { email = "new.owner@example.com", displayName = "Ayse" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Post($"/consultant/projects/{project}/invitations")).StatusCode);

        Assert.Equal(0, r.F.WithDb(db => db.Invitations.Count()));
    }

    [Fact]
    public async Task An_address_longer_than_254_characters_is_a_400()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var tooLong = new string('a', 250) + "@example.com";

        Assert.Equal(HttpStatusCode.BadRequest, (await burak.Invite(project, tooLong)).StatusCode);
        Assert.Equal(0, r.F.WithDb(db => db.Invitations.Count()));
    }

    [Fact]
    public async Task The_email_is_stored_normalised()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();

        await burak.InviteNew(project, "  New.Owner@Example.COM ");

        Assert.Equal("new.owner@example.com", r.F.WithDb(db => db.Invitations.Single().Email));
        Assert.Equal("new.owner@example.com", Assert.Single(await r.Settled()).To);
    }

    [Fact]
    public async Task Each_refusal_says_why()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        r.F.AddOwnerMember(project, r.F.SeedOwner("member@example.com"));
        await burak.InviteNew(project, "open@example.com");

        var consultant = await burak.Invite(project, RoomsFactory.ConsultantEmail);
        var member = await burak.Invite(project, "member@example.com");
        var open = await burak.Invite(project, "open@example.com");

        Assert.Equal("cannot_invite_consultant", await ErrorOf(burak, consultant));
        Assert.Equal("already_member", await ErrorOf(burak, member));
        Assert.Equal("already_invited", await ErrorOf(burak, open));
    }

    [Fact]
    public async Task The_same_email_can_be_invited_again_once_the_old_invitation_has_expired_and_the_old_link_stays_refused()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        await burak.InviteNew(project, "new.owner@example.com");
        await r.Settled(); // the worker sends it before the clock moves
        r.F.Clock.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));

        await burak.InviteNew(project, "new.owner@example.com");

        var mails = await r.Settled();
        Assert.Equal(2, mails.Count);
        var old = r.NewPerson();
        await (await old.Redeem(mails[0].Token)).AssertRefused(old);
        Assert.Equal(HttpStatusCode.OK, (await r.NewPerson().Redeem(mails[1].Token)).StatusCode);
    }

    [Fact]
    public async Task An_existing_account_in_another_project_is_added_to_this_one_and_keeps_its_own_name_and_language()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var a = await burak.CreateProject("A");
        var b = await burak.CreateProject("B");
        var userId = r.F.SeedOwner("existing@example.com", "Existing Name");
        r.F.AddOwnerMember(a, userId);
        r.F.WithDb(db => { db.Users.Single(u => u.Id == userId).UiLanguage = "tr"; db.SaveChanges(); return 0; });

        var response = await burak.Invite(b, "existing@example.com", "Another Name", "en");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(0, r.F.WithDb(db => db.Invitations.Count()));
        var user = r.F.WithDb(db => db.Users.Single(u => u.Id == userId));
        Assert.Equal(("Existing Name", "tr"), (user.DisplayName, user.UiLanguage));
        // The email follows the account's own language, not the one typed.
        var mail = Assert.Single(await r.Settled());
        Assert.Contains("\"B (TR)\"", mail.Body);
        Assert.Contains("ekledi", mail.Body);
        Assert.Contains("30", mail.Body);
        Assert.Single(Audit(r.F, "member_added"));
    }

    // ---- The new account's language ----

    [Theory]
    [InlineData("en")]
    [InlineData("tr")]
    public async Task Using_the_link_creates_the_account_with_the_invitations_language(string language)
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        await burak.InviteNew(project, "new.owner@example.com", "Ayse Yilmaz", language);
        var mail = Assert.Single(await r.Settled());

        var person = r.NewPerson();
        var me = await person.Json(await person.Redeem(mail.Token));

        Assert.Equal(language, me.GetProperty("uiLanguage").GetString());
        Assert.Equal(language, r.F.WithDb(db => db.Users.Single(u => u.Email == "new.owner@example.com").UiLanguage));
    }

    // ---- Audit holds ids only ----

    [Fact]
    public async Task The_audit_rows_hold_no_email_or_name_and_the_daily_count_still_works_and_resets_after_a_day()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        r.F.SeedOwner("existing@example.com", "Existing Name");

        // Two invitations and one add to the same address are not possible, so mix kinds:
        // one address is invited three times (revoked between), another is added.
        var ids = new List<Guid>();
        for (var i = 0; i < 3; i++)
        {
            ids.Add(await burak.InviteNew(project, "new.owner@example.com", "Ayse Yilmaz"));
            Assert.Equal(HttpStatusCode.NoContent, (await burak.Revoke(ids[^1])).StatusCode);
        }
        Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, "existing@example.com", "Existing Name")).StatusCode);
        await r.Settled();

        var rows = r.F.WithDb(db => db.AuditEvents.Where(a => a.Action.StartsWith("invitation_") || a.Action == "member_added").ToList());
        Assert.Equal(7, rows.Count);
        foreach (var row in rows)
        {
            var text = (row.Details ?? "") + "|" + (row.IpAddress ?? "") + "|" + row.Action;
            Assert.DoesNotContain("example.com", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("owner", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Ayse", text);
            Assert.DoesNotContain("Existing", text);
            Assert.DoesNotContain("#t=", text);
        }
        // Same address, same tag; another address, another tag.
        var tags = rows.Where(a => a.Action == "invitation_created").Select(a => a.Details![(a.Details!.IndexOf(" to:", StringComparison.Ordinal))..]).ToList();
        Assert.Single(tags.Distinct());
        var added = Assert.Single(rows, a => a.Action == "member_added");
        Assert.DoesNotContain(tags[0], added.Details);

        // The count works: a fourth email to the same address is refused, another address is not.
        Assert.Equal((HttpStatusCode)429, (await burak.Invite(project, "new.owner@example.com")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, "someone.else@example.com")).StatusCode);
        Assert.Single(Audit(r.F, "invitation_limited"));

        // A day later it is allowed again.
        r.F.Clock.Advance(TimeSpan.FromHours(24) + TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, "new.owner@example.com")).StatusCode);
    }

    [Fact]
    public async Task Inviting_revoking_and_listing_are_audited_with_the_project_and_the_actor()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        await burak.Revoke(id);

        var created = Assert.Single(Audit(r.F, "invitation_created"));
        var revoked = Assert.Single(Audit(r.F, "invitation_revoked"));
        Assert.Equal(project, created.ProjectId);
        Assert.Equal(project, revoked.ProjectId);
        Assert.Equal(r.F.ConsultantId(), created.ActorUserId);
        Assert.Equal($"invitation:{id}", revoked.Details);
    }

    // ---- The per-IP limit ----

    [Fact]
    public async Task The_thirty_first_invitation_from_one_address_in_an_hour_is_a_429_whoever_is_invited()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        for (var i = 0; i < 30; i++)
            Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, $"person{i}@example.com")).StatusCode);

        var refused = await burak.Invite(project, "person31@example.com");

        Assert.Equal((HttpStatusCode)429, refused.StatusCode);
        Assert.Equal(30, r.F.WithDb(db => db.Invitations.Count()));
        Assert.Equal(30, (await r.Settled()).Count);
    }

    // ---- The worker checks again before sending ----

    private static Guid Seed(Rig r, Guid project, string email = "late@example.com", string language = "en")
    {
        var id = r.F.SeedInvitation(project, email, "Late Person");
        r.F.Change(id, i => i.Language = language);
        return id;
    }

    [Fact]
    public async Task An_open_invitation_handed_to_the_worker_is_sent_in_its_language_as_the_control_for_the_skips()
    {
        using var r = new Rig();
        var project = r.F.SeedProject("Open project");
        var id = Seed(r, project, language: "tr");

        Assert.True(r.Queue.Enqueue(new InvitationEmail(id)));

        var mail = Assert.Single(await r.Settled());
        Assert.Equal("late@example.com", mail.To);
        Assert.Contains("davet", mail.Body);
        Assert.Single(mail.Links);
    }

    [Fact]
    public async Task The_invitation_email_is_skipped_when_the_invitation_was_revoked_accepted_or_expired_before_the_worker_ran()
    {
        using var r = new Rig();
        var project = r.F.SeedProject();
        var revoked = Seed(r, project, "revoked@example.com");
        r.F.Change(revoked, i => i.RevokedAt = r.F.Now);
        var accepted = Seed(r, project, "accepted@example.com");
        r.F.Change(accepted, i => i.AcceptedAt = r.F.Now);
        var expired = Seed(r, project, "expired@example.com");
        r.F.Change(expired, i => i.ExpiresAt = r.F.Now.AddMinutes(-1));

        foreach (var id in new[] { revoked, accepted, expired }) r.Queue.Enqueue(new InvitationEmail(id));
        r.Queue.Enqueue(new InvitationEmail(Guid.NewGuid()));

        Assert.Empty(await r.Settled());
        Assert.Equal(0, r.F.WithDb(db => db.SignInTokens.Count()));
    }

    [Fact]
    public async Task The_added_email_is_skipped_when_the_member_was_removed_before_the_worker_ran()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var userId = r.F.SeedOwner("existing@example.com");

        // Control: still a member, so it goes out.
        r.F.AddOwnerMember(project, userId);
        r.Queue.Enqueue(new AddedEmail(userId, project, r.F.ConsultantId()));
        Assert.Single(await r.Settled());

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Post($"/consultant/projects/{project}/members/{userId}/remove")).StatusCode);
        var tokens = r.F.WithDb(db => db.SignInTokens.Count());
        r.Queue.Enqueue(new AddedEmail(userId, project, r.F.ConsultantId()));

        Assert.Single(await r.Settled()); // no second email
        Assert.Equal(tokens, r.F.WithDb(db => db.SignInTokens.Count()));
    }

    [Fact]
    public async Task The_invitation_email_names_the_person_burak_and_the_project_and_says_how_long_the_link_lasts()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject("Warehouse idea");
        await burak.InviteNew(project, "english@example.com", "John Smith", "en");
        await burak.InviteNew(project, "turkish@example.com", "Ayse Yilmaz", "tr");

        var mails = await r.Settled();
        var en = mails.Single(m => m.To == "english@example.com").Body;
        var tr = mails.Single(m => m.To == "turkish@example.com").Body;

        var burakName = r.F.WithDb(db => db.Users.Single(u => u.IsConsultant).DisplayName);
        Assert.Contains("John Smith", en);
        Assert.Contains(burakName, en);
        Assert.Contains("7 days", en);
        Assert.Contains("Ayse Yilmaz", tr);
        Assert.Contains(burakName, tr);
        Assert.Contains("7 gün", tr);
    }

    // ---- Revoking ----

    [Fact]
    public async Task Revoking_ends_the_emailed_link_and_a_link_burak_copied_and_leaves_other_invitations_alone()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var id = await burak.InviteNew(project, "new.owner@example.com");
        var other = await burak.InviteNew(project, "other@example.com");
        var mails = await r.Settled();
        var copied = await burak.Post($"/consultant/invitations/{id}/link");
        Assert.Equal(HttpStatusCode.OK, copied.StatusCode);
        var copiedToken = RoomsFactory.TokenOf((await burak.Json(copied)).GetProperty("link").GetString()!);

        Assert.Equal(HttpStatusCode.NoContent, (await burak.Revoke(id)).StatusCode);

        var tokens = r.F.WithDb(db => db.SignInTokens.Where(t => t.InvitationId == id).ToList());
        Assert.Equal(2, tokens.Count);
        Assert.All(tokens, t => Assert.NotNull(t.RevokedAt));
        Assert.All(r.F.WithDb(db => db.SignInTokens.Where(t => t.InvitationId == other).ToList()), t => Assert.Null(t.RevokedAt));
        var p1 = r.NewPerson();
        await (await p1.Redeem(copiedToken)).AssertRefused(p1);
        var p2 = r.NewPerson();
        await (await p2.Redeem(mails.Single(m => m.To == "new.owner@example.com").Token)).AssertRefused(p2);
        Assert.Equal(HttpStatusCode.OK, (await r.NewPerson().Redeem(mails.Single(m => m.To == "other@example.com").Token)).StatusCode);
        // A revoked invitation no longer hands out a link.
        Assert.Equal(HttpStatusCode.Conflict, (await burak.Post($"/consultant/invitations/{id}/link")).StatusCode);
    }

    [Fact]
    public async Task An_accepted_or_expired_invitation_cannot_be_revoked()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var accepted = await burak.InviteNew(project, "a@example.com");
        var expired = await burak.InviteNew(project, "b@example.com");
        var mails = await r.Settled();
        Assert.Equal(HttpStatusCode.OK, (await r.NewPerson().Redeem(mails.Single(m => m.To == "a@example.com").Token)).StatusCode);
        r.F.Change(expired, i => i.ExpiresAt = r.F.Now.AddMinutes(-1));

        Assert.Equal(HttpStatusCode.Conflict, (await burak.Revoke(accepted)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await burak.Revoke(expired)).StatusCode);

        Assert.Equal("accepted", await burak.StateOf(project, accepted));
        Assert.Equal("expired", await burak.StateOf(project, expired));
        Assert.Empty(Audit(r.F, "invitation_revoked"));
    }

    [Fact]
    public async Task The_list_is_only_for_that_project_and_shows_all_four_states()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        var other = await burak.CreateProject("Other");
        var open = await burak.InviteNew(project, "open@example.com");
        var revoked = await burak.InviteNew(project, "revoked@example.com");
        var accepted = await burak.InviteNew(project, "accepted@example.com");
        var expired = await burak.InviteNew(project, "expired@example.com");
        await burak.InviteNew(other, "elsewhere@example.com");
        var mails = await r.Settled();
        await burak.Revoke(revoked);
        await r.NewPerson().Redeem(mails.Single(m => m.To == "accepted@example.com").Token);
        r.F.Change(expired, i => i.ExpiresAt = r.F.Now.AddMinutes(-1));

        var list = await burak.Invitations(project);

        Assert.Equal(4, list.Count);
        Assert.Equal("open", await burak.StateOf(project, open));
        Assert.Equal("revoked", await burak.StateOf(project, revoked));
        Assert.Equal("accepted", await burak.StateOf(project, accepted));
        Assert.Equal("expired", await burak.StateOf(project, expired));
        Assert.DoesNotContain(list, i => i.GetProperty("email").GetString() == "elsewhere@example.com");
    }

    // ---- Logs ----

    [Fact]
    public async Task Nothing_the_app_logs_holds_a_link_a_token_or_an_address_even_when_sending_or_the_database_fails()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        r.F.SeedOwner("existing@example.com");

        await burak.InviteNew(project, "ok.person@example.com");
        r.Mail.FailNext = 1;
        await burak.InviteNew(project, "fails.to.send@example.com");
        Assert.Equal(HttpStatusCode.Created, (await burak.Invite(project, "existing@example.com")).StatusCode);
        await r.Settled(); // earlier jobs finish before the table goes
        // A job whose database step fails.
        r.F.WithDb(db => db.Database.ExecuteSqlRaw("ALTER TABLE SignInTokens RENAME TO SignInTokensGone"));
        await burak.InviteNew(project, "db.fails@example.com");
        var mails = await r.Settled();
        r.F.WithDb(db => db.Database.ExecuteSqlRaw("ALTER TABLE SignInTokensGone RENAME TO SignInTokens"));

        Assert.Equal(2, mails.Count);
        var lines = r.Log.Lines.ToList();
        Assert.Contains(lines, l => l.Contains("could not be sent"));
        Assert.Contains(lines, l => l.Contains("could not be handled"));
        var tokens = mails.Select(m => m.Token).ToList();
        foreach (var line in lines)
        {
            Assert.DoesNotContain("#t=", line);
            Assert.DoesNotContain("/sign-in", line);
            Assert.DoesNotContain("@example.com", line);
            Assert.DoesNotContain("Ayse", line);
            foreach (var token in tokens) Assert.DoesNotContain(token, line);
        }
    }

    // ---- Reads change nothing; no anonymous routes ----

    private static string Snapshot(RoomsFactory f) => f.WithDb(db => string.Join("\n",
        JsonSerializer.Serialize(db.Users.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.ProjectMembers.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.Invitations.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.SignInTokens.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.UserSessions.OrderBy(x => x.Id).ToList()),
        JsonSerializer.Serialize(db.AuditEvents.OrderBy(x => x.Id).ToList())));

    [Fact]
    public async Task Listing_invitations_changes_nothing_for_burak_an_owner_or_a_stranger_and_gives_the_last_two_nothing()
    {
        using var r = new Rig();
        var burak = await r.Burak();
        var project = await burak.CreateProject();
        await burak.InviteNew(project, "open@example.com");
        var old = await burak.InviteNew(project, "old@example.com");
        await burak.Revoke(old);
        await r.Settled();
        var ownerId = r.F.SeedOwner("owner@example.com");
        r.F.AddOwnerMember(project, ownerId);
        var owner = await r.SignIn(ownerId);
        var before = Snapshot(r.F);

        var url = $"/consultant/projects/{project}/invitations";
        Assert.Equal(HttpStatusCode.OK, (await burak.Http.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.Http.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await r.NewPerson().Http.GetAsync(url)).StatusCode);

        Assert.Equal(before, Snapshot(r.F));
    }

    [Fact]
    public void The_invitation_routes_are_Burak_only_and_not_open_to_anonymous_requests()
    {
        using var r = new Rig();
        var endpoints = r.F.Services.GetServices<EndpointDataSource>()
            .SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText!.Contains("invitations"))
            .ToList();

        var patterns = endpoints.Select(e => e.RoutePattern.RawText!).ToList();
        Assert.Contains("/consultant/projects/{projectId:guid}/invitations", patterns);
        Assert.Contains("/consultant/invitations/{invitationId:guid}/revoke", patterns);
        Assert.All(endpoints, e =>
        {
            Assert.Null(e.Metadata.GetMetadata<IAllowAnonymous>());
            Assert.Contains(e.Metadata.GetOrderedMetadata<IAuthorizeData>(), a => a.Policy == SessionValidation.ConsultantPolicy);
        });
    }
}
