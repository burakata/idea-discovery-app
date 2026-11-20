using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<SignInToken> SignInTokens => Set<SignInToken>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageTranslation> MessageTranslations => Set<MessageTranslation>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.UiLanguage).HasDefaultValue("en");
        });

        b.Entity<Project>(e =>
        {
            e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProjectMember>(e =>
        {
            e.Property(x => x.Role).HasConversion<string>();
            e.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Invitation>(e =>
        {
            e.Property(x => x.Role).HasConversion<string>();
            e.HasIndex(x => x.ProjectId);
            e.HasIndex(x => x.Email);
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.AcceptedUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<SignInToken>(e =>
        {
            e.Property(x => x.Purpose).HasConversion<string>();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasOne<Invitation>().WithMany().HasForeignKey(x => x.InvitationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<UserSession>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Conversation>(e =>
        {
            e.Property(x => x.State).HasConversion<string>();
            e.HasIndex(x => new { x.ProjectId, x.Number }).IsUnique();
            // At most one Active conversation per project, enforced here and
            // not left to application code.
            e.HasIndex(x => x.ProjectId, "IX_Conversations_ProjectId_Active")
                .IsUnique()
                .HasFilter("\"State\" = 'Active'");
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.StartedById).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.FinishedById).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Message>(e =>
        {
            e.HasIndex(x => new { x.ConversationId, x.CreatedAt });
            e.HasOne<Conversation>().WithMany().HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<MessageTranslation>(e =>
        {
            e.HasIndex(x => new { x.MessageId, x.Language }).IsUnique();
            e.HasOne<Message>().WithMany().HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<AuditEvent>(e =>
        {
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => x.ProjectId);
        });
    }
}
