using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using SkiaSharp;

namespace IdeaDiscovery.Api.Projects;

// A project's one decorative image. Burak uploads it; every upload is decoded
// and re-encoded as WebP, so nothing hidden in the file (location, comments,
// embedded scripts) is ever stored or served. Members and Burak can view it
// through ProjectAccess; anyone else gets 404, the same as for no image.
public static class ProjectImageEndpoints
{
    public const string FieldName = "file";
    public const long MaxFileBytes = 5 * 1024 * 1024;
    // The file plus the multipart envelope.
    public const long MaxRequestBytes = MaxFileBytes + 64 * 1024;
    public const int MaxSide = 10_000;
    public const long MaxPixels = 40_000_000;
    public const int MaxOutputSide = 1600;
    private const int OutputQuality = 80;
    private const string OutputType = "image/webp";

    public static void MapProjectImages(this IEndpointRouteBuilder app)
    {
        app.MapGet("/projects/{projectId:guid}/image", async (Guid projectId, HttpContext http, AppDbContext db) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();
            var version = await db.ProjectImages.AsNoTracking()
                .Where(i => i.ProjectId == project.Id).Select(i => i.Version).SingleOrDefaultAsync();
            if (version is null) return Results.NotFound();

            // A removed member's browser must ask again, so the answer is never cached unchecked.
            var response = http.Response;
            var etag = new EntityTagHeaderValue($"\"{version}\"");
            response.Headers.ETag = etag.ToString();
            response.Headers.CacheControl = "private, no-cache";
            response.Headers["X-Content-Type-Options"] = "nosniff";
            response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
            response.Headers.ContentDisposition = "inline";

            var known = http.Request.GetTypedHeaders().IfNoneMatch;
            if (known.Any(t => t.Equals(EntityTagHeaderValue.Any) || t.Compare(etag, useStrongComparison: false)))
                return Results.StatusCode(StatusCodes.Status304NotModified);

            var bytes = await db.ProjectImages.AsNoTracking()
                .Where(i => i.ProjectId == project.Id && i.Version == version).Select(i => i.Bytes).SingleOrDefaultAsync();
            return bytes is null ? Results.NotFound() : Results.Bytes(bytes, OutputType);
        });

        var consultant = app.MapGroup("/consultant").RequireAuthorization(SessionValidation.ConsultantPolicy);

        consultant.MapPost("/projects/{projectId:guid}/image", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            // Refused before the body is read. The request-size metadata below
            // enforces it for bodies with no declared length.
            if (http.Request.ContentLength > MaxRequestBytes) return TooLarge();
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();

            var upload = await ReadUpload(http);
            if (upload.Refusal is not null) return upload.Refusal;

            var output = ReEncode(upload.Bytes!);
            if (output is null) return NotValid();

            var now = clock.GetUtcNow().UtcDateTime;
            var version = Guid.NewGuid().ToString("N");
            var image = await db.ProjectImages.SingleOrDefaultAsync(i => i.ProjectId == project.Id);
            if (image is null)
            {
                image = new ProjectImage { ProjectId = project.Id };
                db.ProjectImages.Add(image);
            }
            image.ContentType = OutputType;
            image.Bytes = output.Bytes;
            image.Width = output.Width;
            image.Height = output.Height;
            image.UpdatedAt = now;
            image.Version = version;
            AuditLog.Add(db, clock, "project_image_set", SessionValidation.UserId(http.User), Ip(http), project.Id);
            await db.SaveChangesAsync();
            return Results.Ok(new { imageVersion = version });
        }).WithMetadata(new RequestSizeLimitAttribute(MaxRequestBytes));

        // Removing when there is no image is not an error: the result is the same, 204.
        consultant.MapPost("/projects/{projectId:guid}/image/remove", async (
            Guid projectId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var project = await ProjectAccess.FindAsync(db, http.User, projectId);
            if (project is null) return Results.NotFound();

            await using var tx = await db.Database.BeginTransactionAsync();
            var removed = await db.ProjectImages.Where(i => i.ProjectId == project.Id).ExecuteDeleteAsync();
            if (removed > 0)
            {
                AuditLog.Add(db, clock, "project_image_removed", SessionValidation.UserId(http.User), Ip(http), project.Id);
                await db.SaveChangesAsync();
            }
            await tx.CommitAsync();
            return Results.NoContent();
        });
    }

    private sealed record Upload(byte[]? Bytes, IResult? Refusal);

    private sealed record Output(byte[] Bytes, int Width, int Height);

    // The one file field's bytes, or the answer to refuse it with.
    private static async Task<Upload> ReadUpload(HttpContext http)
    {
        if (!http.Request.HasFormContentType) return new Upload(null, NotValid());
        IFormFile? file;
        try
        {
            file = (await http.Request.ReadFormAsync()).Files.GetFile(FieldName);
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return new Upload(null, TooLarge());
        }
        catch (Exception ex) when (ex is InvalidDataException or BadHttpRequestException or IOException)
        {
            return new Upload(null, NotValid());
        }
        if (file is null || file.Length == 0) return new Upload(null, NotValid());
        if (file.Length > MaxFileBytes) return new Upload(null, TooLarge());

        using var memory = new MemoryStream((int)file.Length);
        await using (var stream = file.OpenReadStream()) await stream.CopyToAsync(memory);
        return new Upload(memory.ToArray(), null);
    }

    // The real type, from the first bytes only: PNG, JPEG or WebP. The file
    // name and the declared content type are never consulted.
    internal static bool HasAllowedSignature(ReadOnlySpan<byte> b) =>
        b.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })
        || b.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF })
        || (b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8) && b.Slice(8, 4).SequenceEqual("WEBP"u8));

    // Null when the file is not a usable image. Dimensions come from the
    // header and are checked before any pixel is decoded.
    private static Output? ReEncode(byte[] bytes)
    {
        if (!HasAllowedSignature(bytes)) return null;
        try
        {
            using var codec = SKCodec.Create(new MemoryStream(bytes));
            if (codec is null) return null;
            var (width, height) = (codec.Info.Width, codec.Info.Height);
            if (width < 1 || height < 1 || width > MaxSide || height > MaxSide || (long)width * height > MaxPixels)
                return null;

            // The first frame only, then at most 1600 px on the long edge, then upright.
            using var decoded = SKBitmap.Decode(codec);
            if (decoded is null) return null;
            using var sized = Downsize(decoded);
            using var upright = Orient(sized, codec.EncodedOrigin);
            using var image = SKImage.FromBitmap(upright);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, OutputQuality);
            return encoded is null ? null : new Output(encoded.ToArray(), upright.Width, upright.Height);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            return null;
        }
    }

    private static SKBitmap Downsize(SKBitmap source)
    {
        var longest = Math.Max(source.Width, source.Height);
        if (longest <= MaxOutputSide) return source.Copy();
        var scale = (double)MaxOutputSide / longest;
        var info = new SKImageInfo(
            Math.Max(1, (int)Math.Round(source.Width * scale)),
            Math.Max(1, (int)Math.Round(source.Height * scale)));
        return source.Resize(info, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear))
            ?? throw new InvalidOperationException("Resize failed.");
    }

    // Draws the bitmap upright. The eight EXIF orientations, as the matrix that
    // takes a source pixel (x, y) to its place in the upright image.
    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        float w = source.Width, h = source.Height;
        var (matrix, swap) = origin switch
        {
            SKEncodedOrigin.TopRight => (Matrix(-1, 0, w, 0, 1, 0), false),
            SKEncodedOrigin.BottomRight => (Matrix(-1, 0, w, 0, -1, h), false),
            SKEncodedOrigin.BottomLeft => (Matrix(1, 0, 0, 0, -1, h), false),
            SKEncodedOrigin.LeftTop => (Matrix(0, 1, 0, 1, 0, 0), true),
            SKEncodedOrigin.RightTop => (Matrix(0, -1, h, 1, 0, 0), true),
            SKEncodedOrigin.RightBottom => (Matrix(0, -1, h, -1, 0, w), true),
            SKEncodedOrigin.LeftBottom => (Matrix(0, 1, 0, -1, 0, w), true),
            _ => (SKMatrix.Identity, false),
        };
        var result = new SKBitmap(new SKImageInfo(swap ? source.Height : source.Width, swap ? source.Width : source.Height));
        using var canvas = new SKCanvas(result);
        canvas.Clear(SKColors.Transparent);
        canvas.SetMatrix(matrix);
        canvas.DrawBitmap(source, 0, 0);
        return result;
    }

    // x' = a*x + b*y + c, y' = d*x + e*y + f
    private static SKMatrix Matrix(float a, float b, float c, float d, float e, float f) =>
        new(a, b, c, d, e, f, 0, 0, 1);

    private static IResult NotValid() => Results.BadRequest(new { error = "image_not_valid" });

    private static IResult TooLarge() => Results.StatusCode(StatusCodes.Status413PayloadTooLarge);

    private static string? Ip(HttpContext http) => http.Connection.RemoteIpAddress?.ToString();
}
