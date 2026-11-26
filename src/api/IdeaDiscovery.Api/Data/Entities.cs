namespace IdeaDiscovery.Api.Data;

// Enums are stored as strings, so the database stays readable and reordering
// the members later cannot change what a stored value means.
public enum MemberRole { Consultant, Owner }

public enum ConversationState { Active, Finished }

public enum TokenPurpose { Invitation, SignIn }

// Times are UTC DateTime, because SQLite cannot order DateTimeOffset.
// Languages are the codes in Languages.All.
public class User
{
    public Guid Id { get; set; }
    // Lower-case and trimmed; use Emails.Normalise before storing or comparing.
    // Null for a person who joined by asking: nothing they typed becomes an
    // address. A null email never matches any email lookup.
    public string? Email { get; set; }
    public string DisplayName { get; set; } = "";
    public string UiLanguage { get; set; } = Languages.Default;
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
    // The only way to read a bilingual field by language: callers never pick a
    // column. Phase 1 stores the English and Turkish pair in these columns; a third
    // language needs a translations table behind this lookup. An unsupported
    // language gets the English text.
    public string Title(string? language) => Languages.Resolve(language) == Languages.Default ? TitleEn : TitleTr;
    public string Intro(string? language) => Languages.Resolve(language) == Languages.Default ? IntroEn : IntroTr;
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    // Ask to join: switched on by Burak per project.
    public bool AskToJoinEnabled { get; set; }
    // Random 128-bit base64url code in the project link. Not a credential, so it
    // is stored as is and Burak can see the link again. Null until first switched on.
    public string? JoinCode { get; set; }
}

// A project's one image, always re-encoded WebP. Kept apart from Project so
// project reads never load the bytes. Version changes on every replacement.
public class ProjectImage
{
    public Guid ProjectId { get; set; }
    public string ContentType { get; set; } = "image/webp";
    public byte[] Bytes { get; set; } = [];
    public int Width { get; set; }
    public int Height { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Version { get; set; } = "";
}

public enum JoinRequestState { Pending, Approved, Rejected }

// A person's request to join a project. Nothing typed here is a verified fact.
public class JoinRequest
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "";
    // Never used to send anything and never copied to the account.
    public string? UncheckedEmail { get; set; }
    // HMAC of the secret in the asking browser's cookie.
    public string SecretHash { get; set; } = "";
    public string? Device { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public JoinRequestState State { get; set; }
    public DateTime? DecidedAt { get; set; }
    public Guid? DecidedById { get; set; }
    public Guid? UserId { get; set; }
    public DateTime? ApprovedUntil { get; set; }
    public DateTime? ClaimedAt { get; set; }
}

public class ProjectMember
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    // Descriptive only. It never grants consultant powers: access checks use
    // User.IsConsultant, which comes from configuration.
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
    // A code from Languages.All: the language of the email and of the account it creates.
    public string Language { get; set; } = Languages.Default;
    // No role: an invitation can only make an owner.
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
    // The browser's User-Agent (cut short) and the connection's address, so
    // Burak can tell one sign-in from another. Both are personal data.
    public string? Device { get; set; }
    public string? IpAddress { get; set; }
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
    // 1, 2, 3 ... within the conversation: the exact order and the polling cursor.
    public int Sequence { get; set; }
    // Stored as written and never changed.
    public string Text { get; set; } = "";
    public string Language { get; set; } = Languages.Default;
    public DateTime CreatedAt { get; set; }
}

public class MessageTranslation
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public string Language { get; set; } = Languages.Default;
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
