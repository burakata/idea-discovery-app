using System.Buffers.Binary;
using System.Text;
using SkiaSharp;

namespace IdeaDiscovery.Api.Tests;

// Helpers for the project image tests: images built in code, a multipart POST
// that carries the Origin and CSRF token, and a reader for WebP chunks.
public static class ProjectImageTestSupport
{
    public static string ImageUrl(Guid projectId) => $"/projects/{projectId}/image";
    public static string UploadUrl(Guid projectId) => $"/consultant/projects/{projectId}/image";
    public static string RemoveUrl(Guid projectId) => $"/consultant/projects/{projectId}/image/remove";

    // A solid image, or one whose left half is red and right half blue.
    // With quadrants: top left green, bottom left red, the right half blue, so that all eight
    // turns and mirrors of the picture look different.
    private static SKBitmap Bitmap(int width, int height, bool halves, bool quadrants = false)
    {
        var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(halves || quadrants ? SKColors.Red : new SKColor(30, 120, 200));
        if (halves || quadrants)
        {
            using var blue = new SKPaint { Color = SKColors.Blue };
            canvas.DrawRect(width / 2f, 0, width - width / 2f, height, blue);
        }
        if (quadrants)
        {
            using var green = new SKPaint { Color = SKColors.Lime };
            canvas.DrawRect(0, 0, width / 2f, height / 2f, green);
        }
        return bitmap;
    }

    // Left half transparent, right half opaque red.
    public static SKBitmap HalfTransparent(int width = 64, int height = 64)
    {
        var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.Transparent);
        using var paint = new SKPaint { Color = SKColors.Red };
        canvas.DrawRect(width / 2f, 0, width - width / 2f, height, paint);
        return bitmap;
    }

    public static byte[] Encoded(SKBitmap bitmap, SKEncodedImageFormat format) => Encode(bitmap, format);

    // A real PNG of many pixels that is tiny on disk: one grey level.
    public static byte[] SolidGreyPng(int width, int height)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Gray8, SKAlphaType.Opaque));
        bitmap.Erase(SKColors.Gray);
        return Encode(bitmap, SKEncodedImageFormat.Png);
    }

    private static byte[] Encode(SKBitmap bitmap, SKEncodedImageFormat format) =>
        SKImage.FromBitmap(bitmap).Encode(format, 90).ToArray();

    public static byte[] Png(int width = 64, int height = 48) =>
        Encode(Bitmap(width, height, false), SKEncodedImageFormat.Png);

    public static byte[] Jpeg(int width = 64, int height = 48, bool halves = false) =>
        Encode(Bitmap(width, height, halves), SKEncodedImageFormat.Jpeg);

    public static byte[] WebP(int width = 64, int height = 48) =>
        Encode(Bitmap(width, height, false), SKEncodedImageFormat.Webp);

    // A JPEG with an EXIF block (APP1) after the start marker: an orientation
    // and a GPS block with a latitude reference, built byte by byte.
    public static byte[] JpegWithExif(
        int width, int height, int orientation, bool halves = false, bool quadrants = false, bool markers = false)
    {
        var jpeg = Encode(Bitmap(width, height, halves, quadrants), SKEncodedImageFormat.Jpeg);
        var tiff = new List<byte>();
        void U16(int v) { tiff.Add((byte)v); tiff.Add((byte)(v >> 8)); }
        void U32(int v) { U16(v & 0xFFFF); U16(v >> 16); }
        tiff.AddRange("II"u8.ToArray()); U16(42); U32(8);
        // IFD0 at 8: Orientation, and a pointer to the GPS block at 38.
        U16(2);
        U16(0x0112); U16(3); U32(1); U16(orientation); U16(0);
        U16(0x8825); U16(4); U32(1); U32(38);
        U32(0);
        // GPS IFD at 38: GPSLatitudeRef = "N".
        U16(1);
        U16(0x0001); U16(2); U32(2); tiff.AddRange(new byte[] { (byte)'N', 0, 0, 0 });
        U32(0);
        // Text after the structure, still inside the EXIF block.
        if (markers) tiff.AddRange(Encoding.ASCII.GetBytes(ExifMarker));

        var payload = new List<byte>();
        payload.AddRange("Exif\0\0"u8.ToArray());
        payload.AddRange(tiff);
        var segment = new List<byte> { 0xFF, 0xE1, (byte)((payload.Count + 2) >> 8), (byte)(payload.Count + 2) };
        segment.AddRange(payload);
        var more = new List<byte>(segment);
        if (markers)
        {
            more.AddRange(Segment(0xE1, Encoding.ASCII.GetBytes("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>" + XmpMarker + "</x:xmpmeta>")));
            more.AddRange(Segment(0xE2, [.. "ICC_PROFILE\0"u8.ToArray(), 1, 1, .. Encoding.ASCII.GetBytes(IccMarker)]));
            more.AddRange(Segment(0xFE, Encoding.ASCII.GetBytes(CommentMarker)));
        }
        return [.. jpeg.Take(2), .. more, .. jpeg.Skip(2)];
    }

    public const string ExifMarker = "MARKER-EXIF-GPS-HOME";
    public const string XmpMarker = "MARKER-XMP-AUTHOR";
    public const string IccMarker = "MARKER-ICC-PROFILE";
    public const string CommentMarker = "MARKER-COM-CAMERA";

    private static byte[] Segment(byte marker, byte[] payload) =>
        [0xFF, marker, (byte)((payload.Length + 2) >> 8), (byte)(payload.Length + 2), .. payload];

    // A two-frame animated WebP, built by hand from two still images: the first frame is
    // red, the second blue. Skia cannot write animations, so the frames are wrapped here.
    public static byte[] AnimatedWebP(int size = 16)
    {
        byte[] Still(SKColor colour)
        {
            using var bitmap = new SKBitmap(size, size);
            bitmap.Erase(colour);
            return Encode(bitmap, SKEncodedImageFormat.Webp);
        }
        // The image chunk of a still file: everything after "RIFF", the size and "WEBP".
        byte[] ImageChunk(byte[] still) => still[12..];
        static void U24(List<byte> into, int v) { into.Add((byte)v); into.Add((byte)(v >> 8)); into.Add((byte)(v >> 16)); }
        static void U32(List<byte> into, int v) { U24(into, v); into.Add((byte)(v >> 24)); }
        static byte[] Chunk(string type, List<byte> data)
        {
            var chunk = new List<byte>(Encoding.ASCII.GetBytes(type));
            U32(chunk, data.Count);
            chunk.AddRange(data);
            if (data.Count % 2 == 1) chunk.Add(0);
            return [.. chunk];
        }

        var body = new List<byte>(Encoding.ASCII.GetBytes("WEBP"));
        var vp8x = new List<byte> { 0x02, 0, 0, 0 };
        U24(vp8x, size - 1); U24(vp8x, size - 1);
        body.AddRange(Chunk("VP8X", vp8x));
        var anim = new List<byte> { 255, 255, 255, 255, 0, 0 };
        body.AddRange(Chunk("ANIM", anim));
        foreach (var colour in new[] { SKColors.Red, SKColors.Blue })
        {
            var frame = new List<byte>();
            U24(frame, 0); U24(frame, 0); U24(frame, size - 1); U24(frame, size - 1); U24(frame, 100);
            frame.Add(0);
            frame.AddRange(ImageChunk(Still(colour)));
            body.AddRange(Chunk("ANMF", frame));
        }
        var file = new List<byte>(Encoding.ASCII.GetBytes("RIFF"));
        U32(file, body.Count);
        file.AddRange(body);
        return [.. file];
    }

    // A PNG whose header says width x height but whose pixels are one empty
    // chunk. Everything else is well formed, so only the size can refuse it.
    public static byte[] PngWithHeader(int width, int height)
    {
        var png = new List<byte> { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        var ihdr = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(0), width);
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), height);
        ihdr[8] = 8; ihdr[9] = 6; // 8 bits per channel, RGBA
        Chunk(png, "IHDR", ihdr);
        Chunk(png, "IDAT", [0x78, 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
        Chunk(png, "IEND", []);
        return [.. png];
    }

    private static void Chunk(List<byte> into, string type, byte[] data)
    {
        var length = new byte[4];
        BinaryPrimitives.WriteInt32BigEndian(length, data.Length);
        var body = Encoding.ASCII.GetBytes(type).Concat(data).ToArray();
        var crc = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crc, Crc32(body));
        into.AddRange(length); into.AddRange(body); into.AddRange(crc);
    }

    private static uint Crc32(byte[] data)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in data)
        {
            crc ^= b;
            for (var i = 0; i < 8; i++) crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
        }
        return ~crc;
    }

    // The four-letter codes of a WebP file's chunks, in order.
    public static List<string> WebPChunks(byte[] webp)
    {
        Assert.Equal("RIFF", Encoding.ASCII.GetString(webp, 0, 4));
        Assert.Equal("WEBP", Encoding.ASCII.GetString(webp, 8, 4));
        var chunks = new List<string>();
        var position = 12;
        while (position + 8 <= webp.Length)
        {
            chunks.Add(Encoding.ASCII.GetString(webp, position, 4));
            var size = (int)BinaryPrimitives.ReadUInt32LittleEndian(webp.AsSpan(position + 4));
            position += 8 + size + (size & 1);
        }
        return chunks;
    }

    public static MultipartFormDataContent FileContent(
        byte[] bytes, string fileName = "image.png", string contentType = "image/png", string field = "file")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, field, fileName } };
    }

    // A multipart POST that carries the Origin and CSRF token, unless a test removes them.
    public static async Task<HttpResponseMessage> PostForm(
        this Person person, string url, HttpContent content,
        string? origin = RoomsFactory.BaseUrl, bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        if (origin is not null) request.Headers.TryAddWithoutValidation("Origin", origin);
        if (csrf) request.Headers.TryAddWithoutValidation("X-CSRF-TOKEN", await person.CsrfToken());
        return await person.Http.SendAsync(request);
    }

    public static Task<HttpResponseMessage> UploadImage(
        this Person person, Guid projectId, byte[] bytes, string fileName = "image.png",
        string contentType = "image/png", string field = "file") =>
        person.PostForm(UploadUrl(projectId), FileContent(bytes, fileName, contentType, field));

    // Uploads and expects 200; returns the new version.
    public static async Task<string> SetImage(this Person burak, Guid projectId, byte[]? bytes = null)
    {
        var response = await burak.UploadImage(projectId, bytes ?? Png());
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return (await burak.Json(response)).GetProperty("imageVersion").GetString()!;
    }
}
