using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace IdeaDiscovery.Api.Mail;

// The email could not be delivered. The message holds a status code at most,
// never the address, subject, body or key.
public sealed class EmailDeliveryException(string message) : Exception(message);

// Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// One call to SendAsync is one email: the same Idempotency-Key goes with every
// attempt, so a retry after Resend already accepted the email is not delivered
// twice. Timeouts, 429 and 5xx are retried a few times; any other 4xx (a wrong
// key, an invalid sender) is a configuration error and is not.
// Logs carry the status code and attempt number only.
public sealed class ResendEmailSender : IEmailSender
{
    public const string ClientName = "resend";
    public const string Endpoint = "https://api.resend.com/emails";
    public const int MaxAttempts = 3;
    public static readonly TimeSpan FirstBackoff = TimeSpan.FromSeconds(1);
    public static readonly TimeSpan MaxRetryAfter = TimeSpan.FromSeconds(10);

    private readonly IHttpClientFactory _clients;
    private readonly EmailSettings _settings;
    private readonly ILogger<ResendEmailSender> _log;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;

    public ResendEmailSender(IHttpClientFactory clients, EmailSettings settings, ILogger<ResendEmailSender> log, TimeProvider clock)
        : this(clients, settings, log, (span, token) => Task.Delay(span, clock, token)) { }

    // The delay can be replaced, so tests do not wait.
    public ResendEmailSender(
        IHttpClientFactory clients, EmailSettings settings, ILogger<ResendEmailSender> log,
        Func<TimeSpan, CancellationToken, Task> delay)
    {
        _clients = clients;
        _settings = settings;
        _log = log;
        _delay = delay;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        var idempotencyKey = Guid.NewGuid().ToString("N");
        var payload = new { from = _settings.From, to = new[] { to }, subject, text = body };
        var client = _clients.CreateClient(ClientName);

        for (var attempt = 1; ; attempt++)
        {
            TimeSpan? retryAfter = null;
            string failure;
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint) { Content = JsonContent.Create(payload) };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ResendApiKey);
                request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
                using var response = await client.SendAsync(request, cancellationToken);

                var status = (int)response.StatusCode;
                if (response.IsSuccessStatusCode) return;
                if (status != StatusCodes.Status429TooManyRequests && status < 500)
                {
                    _log.LogError("Resend refused an email (status {Status}), so it was not retried. Check Email:Resend:ApiKey and Email:From.", status);
                    throw new EmailDeliveryException($"Resend refused the email (status {status}).");
                }
                retryAfter = RetryAfter(response.Headers.RetryAfter);
                failure = $"status {status}";
            }
            catch (HttpRequestException)
            {
                failure = "connection error";
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                failure = "timeout";
            }

            if (attempt >= MaxAttempts)
            {
                _log.LogError("An email could not be sent through Resend after {Attempts} attempts ({Failure}).", attempt, failure);
                throw new EmailDeliveryException($"Resend did not accept the email after {attempt} attempts ({failure}).");
            }
            _log.LogWarning("An email attempt to Resend failed ({Failure}, attempt {Attempt} of {Max}); trying again.", failure, attempt, MaxAttempts);
            await _delay(retryAfter ?? FirstBackoff * Math.Pow(2, attempt - 1), cancellationToken);
        }
    }

    // What Resend asks for, capped, so a large value cannot hold the queue.
    private static TimeSpan? RetryAfter(RetryConditionHeaderValue? header)
    {
        var wait = header?.Delta ?? (header?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
        if (wait is null) return null;
        return wait.Value < TimeSpan.Zero ? TimeSpan.Zero : wait.Value > MaxRetryAfter ? MaxRetryAfter : wait.Value;
    }
}
