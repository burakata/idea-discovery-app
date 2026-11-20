namespace IdeaDiscovery.Api.Data;

// Enums are stored as strings, so the database stays readable and reordering
// the members later cannot change what a stored value means.
public enum MemberRole { Consultant, Owner }

public enum ConversationState { Active, Finished }

public enum TokenPurpose { Invitation, SignIn }

// Times are UTC DateTime, because SQLite cannot order DateTimeOffset.
// Languages are "en" or "tr".
public class User
{
    public Guid Id { get; set; }
    // Lower-case and trimmed; use Emails.Normalise before storing or comparing.
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string UiLanguage { get; set; } = "en";
    public bool IsConsultant { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Project
{
    public Guid Id { get; set; }
    public string TitleEn { get; set; } = "";
    public string TitleTr { get; set; } = "";
    public string IntroEn { get; set; } = "";
    public string IntroTr { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
}

public class ProjectMember
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public MemberRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
}

public class Invitation
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Email { get; set; } = "";
    // Entered by Burak; owners cannot change it.
    public string DisplayName { get; set; } = "";
    public MemberRole Role { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public Guid? AcceptedUserId { get; set; }
}

public class SignInToken
{
    public Guid Id { get; set; }
    // Hash of the token. The raw token is never stored.
    public string TokenHash { get; set; } = "";
    public TokenPurpose Purpose { get; set; }
    public Guid? InvitationId { get; set; }
    public Guid? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class UserSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime LastSeenAt { get; set; }
}

public class Conversation
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int Number { get; set; }
    public ConversationState State { get; set; }
    public DateTime StartedAt { get; set; }
    public Guid StartedById { get; set; }
    public DateTime? FinishedAt { get; set; }
    public Guid? FinishedById { get; set; }
}

public class Message
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid AuthorId { get; set; }
    // Stored as written and never changed.
    public string Text { get; set; } = "";
    public string Language { get; set; } = "en";
    public DateTime CreatedAt { get; set; }
}

public class MessageTranslation
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public string Language { get; set; } = "en";
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class AuditEvent
{
    public Guid Id { get; set; }
    public string Action { get; set; } = "";
    // Plain values, not foreign keys: the log must outlive what it describes.
    public Guid? ActorUserId { get; set; }
    public Guid? ProjectId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}

public static class Emails
{
    public static string Normalise(string email) => email.Trim().ToLowerInvariant();
}
