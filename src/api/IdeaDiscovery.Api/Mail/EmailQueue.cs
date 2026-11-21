using System.Threading.Channels;

namespace IdeaDiscovery.Api.Mail;

// What a request leaves behind for the dispatcher. Jobs hold ids and the
// normalised email only; the dispatcher looks everything else up, so a request
// takes the same time whatever it finds.
public abstract record EmailJob;

// A sign-in link request: the normalised email and the caller's IP. Whether the
// email is known, the limit, the link and the email itself are all handled by
// the dispatcher, so the request takes the same time for everyone.
public sealed record SignInLinkRequest(string Email, string? Ip) : EmailJob;

// Email a new person an invitation link, if the invitation is still open.
public sealed record InvitationEmail(Guid InvitationId) : EmailJob;

// Tell an existing account it was added to a project, with a sign-in link, if
// it is still a member.
public sealed record AddedEmail(Guid UserId, Guid ProjectId, Guid AddedById) : EmailJob;

// In-process queue. A job lost in a restart is simply asked for again.
public sealed class EmailQueue
{
    private readonly Channel<EmailJob> _channel = Channel.CreateBounded<EmailJob>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropWrite });

    private int _unfinished;

    // Jobs queued or being handled. Tests wait for it to reach zero.
    public int Unfinished => Volatile.Read(ref _unfinished);

    public bool Enqueue(EmailJob job)
    {
        Interlocked.Increment(ref _unfinished);
        if (_channel.Writer.TryWrite(job)) return true;
        Interlocked.Decrement(ref _unfinished);
        return false;
    }

    public void Finished() => Interlocked.Decrement(ref _unfinished);

    public IAsyncEnumerable<EmailJob> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
