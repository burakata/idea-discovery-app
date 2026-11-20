using System.Threading.Channels;

namespace IdeaDiscovery.Api.Mail;

// What the request leaves behind: the normalised email and the caller's IP.
// Whether the email is known, the limit, the link and the email itself are all
// handled by the dispatcher, so the request takes the same time for everyone.
public sealed record SignInLinkRequest(string Email, string? Ip);

// In-process queue. A job lost in a restart is simply asked for again.
public sealed class EmailQueue
{
    private readonly Channel<SignInLinkRequest> _channel = Channel.CreateBounded<SignInLinkRequest>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropWrite });

    private int _unfinished;

    // Jobs queued or being handled. Tests wait for it to reach zero.
    public int Unfinished => Volatile.Read(ref _unfinished);

    public bool Enqueue(SignInLinkRequest job)
    {
        Interlocked.Increment(ref _unfinished);
        if (_channel.Writer.TryWrite(job)) return true;
        Interlocked.Decrement(ref _unfinished);
        return false;
    }

    public void Finished() => Interlocked.Decrement(ref _unfinished);

    public IAsyncEnumerable<SignInLinkRequest> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
