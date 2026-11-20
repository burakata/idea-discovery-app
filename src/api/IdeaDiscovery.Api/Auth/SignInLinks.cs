using IdeaDiscovery.Api.Data;

namespace IdeaDiscovery.Api.Auth;

// Issues one-time links. The raw token exists only in the returned link.
public sealed class SignInLinks(AppDbContext db, TokenHasher hasher, AuthSettings settings, TimeProvider clock)
{
    public static readonly TimeSpan SignInLifetime = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan InvitationLifetime = TimeSpan.FromDays(7);

    // The caller has checked that the user exists.
    public Task<string> ForUserAsync(Guid userId) =>
        IssueAsync(new SignInToken { Purpose = TokenPurpose.SignIn, UserId = userId }, SignInLifetime);

    // Whether the invitation is still open is checked when the link is used,
    // and by the consultant endpoint that hands the link out.
    public Task<string> ForInvitationAsync(Guid invitationId) =>
        IssueAsync(new SignInToken { Purpose = TokenPurpose.Invitation, InvitationId = invitationId }, InvitationLifetime);

    private async Task<string> IssueAsync(SignInToken row, TimeSpan lifetime)
    {
        var token = TokenHasher.NewToken();
        var now = clock.GetUtcNow().UtcDateTime;
        row.Id = Guid.NewGuid();
        row.TokenHash = hasher.Hash(token);
        row.CreatedAt = now;
        row.ExpiresAt = now + lifetime;
        db.SignInTokens.Add(row);
        await db.SaveChangesAsync();
        return $"{settings.LinkBase}/sign-in#t={token}";
    }
}
