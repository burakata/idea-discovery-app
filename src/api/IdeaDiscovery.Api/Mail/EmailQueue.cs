using System.Threading.Channels;

namespace IdeaDiscovery.Api.Mail;

// What the request leaves behind: who, in which language, and the link. The
// dispatcher renders and sends it after the response.
public sealed record SignInEmailJob(string To, string Language, string Link);

// In-process queue. A job lost in a restart is simply asked for again.
public sealed class EmailQueue
{
    private readonly Channel<SignInEmailJob> _channel = Channel.CreateBounded<SignInEmailJob>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropWrite });

    public bool Enqueue(SignInEmailJob job) => _channel.Writer.TryWrite(job);

    public IAsyncEnumerable<SignInEmailJob> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
