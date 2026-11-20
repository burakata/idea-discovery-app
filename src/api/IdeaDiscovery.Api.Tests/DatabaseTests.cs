using IdeaDiscovery.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace IdeaDiscovery.Api.Tests;

// Each test gets its own in-memory SQLite database, built by the real migrations.
public sealed class DatabaseTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AppDbContext _db;

    public DatabaseTests()
    {
        _connection.Open();
        _db = NewContext();
        _db.Database.Migrate();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private AppDbContext NewContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

    private User AddUser(string email)
    {
        var user = new User { Id = Guid.NewGuid(), Email = email, DisplayName = "Test", CreatedAt = DateTime.UtcNow };
        _db.Users.Add(user);
        _db.SaveChanges();
        return user;
    }

    private Project AddProject(User creator)
    {
        var project = new Project { Id = Guid.NewGuid(), Status = "Active", CreatedAt = DateTime.UtcNow, CreatedById = creator.Id };
        _db.Projects.Add(project);
        _db.SaveChanges();
        return project;
    }

    private static Conversation NewConversation(Project p, User u, int number, ConversationState state) => new()
    {
        Id = Guid.NewGuid(), ProjectId = p.Id, Number = number, State = state,
        StartedAt = DateTime.UtcNow, StartedById = u.Id,
    };

    private Message AddMessage(User author)
    {
        var project = AddProject(author);
        var conversation = NewConversation(project, author, 1, ConversationState.Active);
        _db.Conversations.Add(conversation);
        var message = new Message
        {
            Id = Guid.NewGuid(), ConversationId = conversation.Id, AuthorId = author.Id,
            Text = "Hello", Language = "en", CreatedAt = DateTime.UtcNow,
        };
        _db.Messages.Add(message);
        _db.SaveChanges();
        return message;
    }

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value))
            .Build();

    [Fact]
    public void Migration_applies_to_an_empty_database_and_matches_the_model()
    {
        // Migrate() itself throws when the model has changes with no migration.
        Assert.Empty(_db.Database.GetPendingMigrations());
        Assert.NotEmpty(_db.Database.GetAppliedMigrations());

        // Every table in the model exists and can be read.
        Assert.Empty(_db.Users.ToList());
        Assert.Empty(_db.Projects.ToList());
        Assert.Empty(_db.ProjectMembers.ToList());
        Assert.Empty(_db.Invitations.ToList());
        Assert.Empty(_db.SignInTokens.ToList());
        Assert.Empty(_db.UserSessions.ToList());
        Assert.Empty(_db.Conversations.ToList());
        Assert.Empty(_db.Messages.ToList());
        Assert.Empty(_db.MessageTranslations.ToList());
        Assert.Empty(_db.AuditEvents.ToList());
    }

    [Fact]
    public void A_project_can_have_only_one_active_conversation()
    {
        var user = AddUser("a@example.test");
        var project = AddProject(user);
        _db.Conversations.Add(NewConversation(project, user, 1, ConversationState.Active));
        _db.SaveChanges();

        // A finished conversation is allowed beside the active one.
        _db.Conversations.Add(NewConversation(project, user, 2, ConversationState.Finished));
        _db.SaveChanges();

        // A second active one is refused.
        _db.Conversations.Add(NewConversation(project, user, 3, ConversationState.Active));
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void Another_project_can_have_its_own_active_conversation()
    {
        var user = AddUser("a@example.test");
        _db.Conversations.Add(NewConversation(AddProject(user), user, 1, ConversationState.Active));
        _db.Conversations.Add(NewConversation(AddProject(user), user, 1, ConversationState.Active));
        _db.SaveChanges();
    }

    [Fact]
    public void Email_is_unique()
    {
        AddUser("a@example.test");
        _db.Users.Add(new User { Id = Guid.NewGuid(), Email = "a@example.test", DisplayName = "Other", CreatedAt = DateTime.UtcNow });
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void A_user_joins_a_project_only_once()
    {
        var user = AddUser("a@example.test");
        var project = AddProject(user);
        _db.ProjectMembers.Add(new ProjectMember { Id = Guid.NewGuid(), ProjectId = project.Id, UserId = user.Id, Role = MemberRole.Owner, JoinedAt = DateTime.UtcNow });
        _db.SaveChanges();

        _db.ProjectMembers.Add(new ProjectMember { Id = Guid.NewGuid(), ProjectId = project.Id, UserId = user.Id, Role = MemberRole.Owner, JoinedAt = DateTime.UtcNow });
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void A_message_has_one_translation_per_language()
    {
        var message = AddMessage(AddUser("a@example.test"));
        _db.MessageTranslations.Add(new MessageTranslation { Id = Guid.NewGuid(), MessageId = message.Id, Language = "tr", Text = "Merhaba", CreatedAt = DateTime.UtcNow });
        _db.SaveChanges();

        _db.MessageTranslations.Add(new MessageTranslation { Id = Guid.NewGuid(), MessageId = message.Id, Language = "tr", Text = "Selam", CreatedAt = DateTime.UtcNow });
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void Token_hash_is_unique()
    {
        var user = AddUser("a@example.test");
        var token = () => new SignInToken
        {
            Id = Guid.NewGuid(), TokenHash = "same-hash", Purpose = TokenPurpose.SignIn, UserId = user.Id,
            CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(1),
        };
        _db.SignInTokens.Add(token());
        _db.SaveChanges();

        _db.SignInTokens.Add(token());
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void Enums_are_stored_as_text()
    {
        var user = AddUser("a@example.test");
        _db.Conversations.Add(NewConversation(AddProject(user), user, 1, ConversationState.Active));
        _db.SaveChanges();

        using var command = _connection.CreateCommand();
        command.CommandText = "SELECT State FROM Conversations";
        Assert.Equal("Active", command.ExecuteScalar());
    }

    [Fact]
    public void Consultant_setting_creates_and_marks_the_user()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "  Boss@Example.Test ")), NullLogger.Instance);

        var user = Assert.Single(_db.Users.ToList());
        Assert.Equal("boss@example.test", user.Email);
        Assert.Equal("Burak", user.DisplayName);
        Assert.True(user.IsConsultant);
    }

    [Fact]
    public void Consultant_setting_moves_the_flag_when_the_email_changes()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "first@example.test")), NullLogger.Instance);
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "second@example.test"), ("Consultant:DisplayName", "Second")), NullLogger.Instance);

        var users = _db.Users.ToDictionary(u => u.Email);
        Assert.False(users["first@example.test"].IsConsultant);
        Assert.True(users["second@example.test"].IsConsultant);
        Assert.Equal("Second", users["second@example.test"].DisplayName);
    }

    [Fact]
    public void Consultant_setting_marks_an_existing_user_without_duplicating_it()
    {
        AddUser("owner@example.test");
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "owner@example.test")), NullLogger.Instance);

        var user = Assert.Single(_db.Users.ToList());
        Assert.True(user.IsConsultant);
    }

    [Fact]
    public void Without_a_consultant_setting_nobody_is_consultant()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "first@example.test")), NullLogger.Instance);
        DatabaseSetup.SyncConsultant(_db, Config(), NullLogger.Instance);

        Assert.DoesNotContain(_db.Users.ToList(), u => u.IsConsultant);
    }

    private Invitation AddInvitation(User creator)
    {
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(), ProjectId = AddProject(creator).Id, Email = "o@example.test", DisplayName = "Owner",
            CreatedById = creator.Id, CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(7),
        };
        _db.Invitations.Add(invitation);
        _db.SaveChanges();
        return invitation;
    }

    private UserSession AddSession(User user)
    {
        var session = new UserSession
        {
            Id = Guid.NewGuid(), UserId = user.Id, CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(1), LastSeenAt = DateTime.UtcNow,
        };
        _db.UserSessions.Add(session);
        _db.SaveChanges();
        return session;
    }

    private static SignInToken NewToken(string hash, TokenPurpose purpose, Guid? invitationId, Guid? userId) => new()
    {
        Id = Guid.NewGuid(), TokenHash = hash, Purpose = purpose, InvitationId = invitationId, UserId = userId,
        CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(1),
    };

    [Fact]
    public void An_invitation_has_no_role_and_cannot_make_a_consultant()
    {
        Assert.Null(typeof(Invitation).GetProperty("Role"));
        Assert.DoesNotContain(typeof(Invitation).GetProperties(), p => p.PropertyType == typeof(MemberRole));

        var columns = _db.Model.FindEntityType(typeof(Invitation))!.GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain(columns, c => c.Contains("Role") || c.Contains("Consultant"));
    }

    [Fact]
    public void Becoming_consultant_revokes_that_users_open_sessions_only()
    {
        var owner = AddUser("owner@example.test");
        var other = AddUser("other@example.test");
        var open = AddSession(owner);
        var alreadyRevoked = AddSession(owner);
        var revokedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        alreadyRevoked.RevokedAt = revokedAt;
        var othersSession = AddSession(other);
        _db.SaveChanges();

        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "owner@example.test")), NullLogger.Instance);

        var sessions = NewContext().UserSessions.ToDictionary(s => s.Id);
        Assert.NotNull(sessions[open.Id].RevokedAt);
        Assert.Equal(revokedAt, sessions[alreadyRevoked.Id].RevokedAt);
        Assert.Null(sessions[othersSession.Id].RevokedAt);
    }

    [Fact]
    public void Losing_the_consultant_flag_revokes_sessions_and_leaves_the_new_consultant_alone()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "first@example.test")), NullLogger.Instance);
        var first = _db.Users.Single(u => u.Email == "first@example.test");
        var second = AddUser("second@example.test");
        var firstSession = AddSession(first);
        var secondSession = AddSession(second);

        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "second@example.test")), NullLogger.Instance);

        var sessions = NewContext().UserSessions.ToDictionary(s => s.Id);
        Assert.NotNull(sessions[firstSession.Id].RevokedAt);
        Assert.NotNull(sessions[secondSession.Id].RevokedAt);
    }

    [Fact]
    public void Clearing_the_setting_revokes_the_old_consultants_sessions()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "first@example.test")), NullLogger.Instance);
        var session = AddSession(_db.Users.Single());

        DatabaseSetup.SyncConsultant(_db, Config(), NullLogger.Instance);

        Assert.NotNull(NewContext().UserSessions.Single(s => s.Id == session.Id).RevokedAt);
    }

    [Fact]
    public void An_unchanged_consultant_keeps_their_sessions()
    {
        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "boss@example.test")), NullLogger.Instance);
        var session = AddSession(_db.Users.Single());

        DatabaseSetup.SyncConsultant(_db, Config(("Consultant:Email", "boss@example.test")), NullLogger.Instance);

        Assert.Null(NewContext().UserSessions.Single(s => s.Id == session.Id).RevokedAt);
    }

    [Fact]
    public void Every_token_belongs_to_an_invitation_or_a_user()
    {
        var user = AddUser("a@example.test");
        var invitation = AddInvitation(user);

        // Valid shapes are accepted.
        _db.SignInTokens.Add(NewToken("h1", TokenPurpose.Invitation, invitation.Id, null));
        _db.SignInTokens.Add(NewToken("h2", TokenPurpose.SignIn, null, user.Id));
        _db.SaveChanges();

        // Invalid shapes are refused, each on its own.
        foreach (var bad in new[]
        {
            NewToken("b1", TokenPurpose.Invitation, null, null),
            NewToken("b2", TokenPurpose.Invitation, null, user.Id),
            NewToken("b3", TokenPurpose.SignIn, null, null),
            NewToken("b4", TokenPurpose.SignIn, invitation.Id, null),
        })
        {
            using var db = NewContext();
            db.SignInTokens.Add(bad);
            Assert.Throws<DbUpdateException>(() => db.SaveChanges());
        }
    }

    [Fact]
    public void Conversation_numbers_are_unique_within_a_project()
    {
        var user = AddUser("a@example.test");
        var project = AddProject(user);
        _db.Conversations.Add(NewConversation(project, user, 1, ConversationState.Finished));
        _db.SaveChanges();

        _db.Conversations.Add(NewConversation(project, user, 1, ConversationState.Active));
        Assert.Throws<DbUpdateException>(() => _db.SaveChanges());
    }

    [Fact]
    public void Times_read_back_as_utc()
    {
        var user = AddUser("a@example.test");
        var project = AddProject(user);
        var conversation = NewConversation(project, user, 1, ConversationState.Finished);
        conversation.FinishedAt = DateTime.UtcNow;
        _db.Conversations.Add(conversation);
        _db.SaveChanges();

        using var fresh = NewContext();
        Assert.Equal(DateTimeKind.Utc, fresh.Users.Single().CreatedAt.Kind);
        var read = fresh.Conversations.Single();
        Assert.Equal(DateTimeKind.Utc, read.StartedAt.Kind);
        Assert.Equal(DateTimeKind.Utc, read.FinishedAt!.Value.Kind);

        // A nullable time that is empty stays empty.
        _db.SignInTokens.Add(NewToken("h", TokenPurpose.SignIn, null, user.Id));
        _db.SaveChanges();
        Assert.Null(NewContext().SignInTokens.Single().UsedAt);
    }
}
