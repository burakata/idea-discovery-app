using IdeaDiscovery.Api.Data;

namespace IdeaDiscovery.Api.Auth;

public static class AuditLog
{
    // Adds the event to the context; the caller saves it, so it commits or
    // fails together with the change it describes. Never put a token in details.
    public static void Add(
        AppDbContext db, TimeProvider clock, string action, Guid? actor, string? ip,
        Guid? projectId = null, string? details = null) =>
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            Action = action,
            ActorUserId = actor,
            ProjectId = projectId,
            Details = details,
            IpAddress = ip,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        });
}
