using System.Net;
using System.Net.Http.Headers;
using IdeaDiscovery.Api.Data;
using SkiaSharp;
using static IdeaDiscovery.Api.Tests.ProjectImageTestSupport;

namespace IdeaDiscovery.Api.Tests;

// The project image: who may upload and see it, what is refused, what the
// stored file is, and the life of the image.
public class ProjectImageTests
{
    private sealed record Room(RoomsFactory F, Person Burak, Guid ProjectId, Guid OwnerId, Person Owner);

    private static async Task<Room> NewRoom(RoomsFactory f)
    {
        var burak = await f.ConsultantSignedIn();
        var projectId = await burak.CreateProject();
        var ownerId = f.SeedOwner("one@example.com", "Ayse Owner");
        f.AddOwnerMember(projectId, ownerId);
        return new Room(f, burak, projectId, ownerId, await f.SignedIn(ownerId));
    }

    private static async Task<byte[]> Served(Person person, Guid projectId)
    {
        var response = await person.Http.GetAsync(ImageUrl(projectId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsByteArrayAsync();
    }

    // ---- Access ----

    [Fact]
    public async Task A_non_member_gets_404_the_same_as_for_no_image()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Burak.SetImage(r.ProjectId);
        var stranger = await f.SignedIn(f.SeedOwner("stranger@example.com", "Stranger"));
        var otherProject = await r.Burak.CreateProject("Other idea");

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
        // A project with no image and an unknown project look the same.
        Assert.Equal(HttpStatusCode.NotFound, (await r.Burak.Http.GetAsync(ImageUrl(otherProject))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await r.Burak.Http.GetAsync(ImageUrl(Guid.NewGuid()))).StatusCode);
        // A member of one project cannot see another project's image.
        Assert.Equal(HttpStatusCode.NotFound, (await r.Owner.Http.GetAsync(ImageUrl(otherProject))).StatusCode);
    }

    [Fact]
    public async Task A_member_and_Burak_get_the_image_with_every_header()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var version = await r.Burak.SetImage(r.ProjectId, Png(120, 80));

        foreach (var person in new[] { r.Owner, r.Burak })
        {
            var response = await person.Http.GetAsync(ImageUrl(r.ProjectId));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("image/webp", response.Content.Headers.ContentType!.MediaType);
            Assert.Equal($"\"{version}\"", response.Headers.ETag!.Tag);
            Assert.True(response.Headers.CacheControl!.Private && response.Headers.CacheControl.NoCache && !response.Headers.CacheControl.Public);
            Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
            Assert.Equal("default-src 'none'; sandbox", Assert.Single(response.Headers.GetValues("Content-Security-Policy")));
            Assert.Equal("inline", response.Content.Headers.ContentDisposition?.DispositionType
                ?? Assert.Single(response.Headers.GetValues("Content-Disposition")));
            Assert.Equal("WEBP", System.Text.Encoding.ASCII.GetString((await response.Content.ReadAsByteArrayAsync())[8..12]));
        }
    }

    [Fact]
    public async Task Revalidating_with_the_ETag_gets_304_and_a_changed_image_gets_200()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var version = await r.Burak.SetImage(r.ProjectId);

        var request = new HttpRequestMessage(HttpMethod.Get, ImageUrl(r.ProjectId));
        request.Headers.IfNoneMatch.Add(new EntityTagHeaderValue($"\"{version}\""));
        var same = await r.Owner.Http.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotModified, same.StatusCode);
        Assert.True(same.Headers.CacheControl!.Private && same.Headers.CacheControl.NoCache);
        Assert.Empty(await same.Content.ReadAsByteArrayAsync());

        await r.Burak.SetImage(r.ProjectId, Jpeg());
        var stale = new HttpRequestMessage(HttpMethod.Get, ImageUrl(r.ProjectId));
        stale.Headers.IfNoneMatch.Add(new EntityTagHeaderValue($"\"{version}\""));
        Assert.Equal(HttpStatusCode.OK, (await r.Owner.Http.SendAsync(stale)).StatusCode);
    }

    [Fact]
    public async Task A_revalidation_by_a_non_member_is_404_not_304()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var version = await r.Burak.SetImage(r.ProjectId);
        var stranger = await f.SignedIn(f.SeedOwner("stranger@example.com", "Stranger"));

        var request = new HttpRequestMessage(HttpMethod.Get, ImageUrl(r.ProjectId));
        request.Headers.IfNoneMatch.Add(new EntityTagHeaderValue($"\"{version}\""));
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.Http.SendAsync(request)).StatusCode);
    }

    [Fact]
    public async Task A_member_removed_afterwards_cannot_see_the_image()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Burak.SetImage(r.ProjectId);
        Assert.Equal(HttpStatusCode.OK, (await r.Owner.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);

        var removed = await r.Burak.Post($"/consultant/projects/{r.ProjectId}/members/{r.OwnerId}/remove");
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);

        // Removing a member ends their sessions, so they are signed out.
        Assert.Equal(HttpStatusCode.Unauthorized, (await r.Owner.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
        // Signed in again without the membership: not found.
        var again = await f.SignedIn(r.OwnerId);
        Assert.Equal(HttpStatusCode.NotFound, (await again.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
    }

    [Fact]
    public async Task An_owner_cannot_upload_or_remove()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var version = await r.Burak.SetImage(r.ProjectId);

        Assert.Equal(HttpStatusCode.Forbidden, (await r.Owner.UploadImage(r.ProjectId, Png())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await r.Owner.Post(RemoveUrl(r.ProjectId))).StatusCode);
        Assert.Equal(version, (await r.Burak.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());
    }

    [Fact]
    public async Task Signed_out_gets_401_everywhere()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Burak.SetImage(r.ProjectId);
        var nobody = f.NewPerson();

        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.UploadImage(r.ProjectId, Png())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await nobody.Post(RemoveUrl(r.ProjectId))).StatusCode);
    }

    [Fact]
    public async Task An_upload_without_the_origin_or_the_CSRF_token_is_refused()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await r.Burak.PostForm(UploadUrl(r.ProjectId), FileContent(Png()), origin: null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await r.Burak.PostForm(UploadUrl(r.ProjectId), FileContent(Png()), origin: "https://evil.test")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await r.Burak.PostForm(UploadUrl(r.ProjectId), FileContent(Png()), csrf: false)).StatusCode);
        Assert.Null((await r.Burak.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());
    }

    [Fact]
    public async Task Uploading_to_an_unknown_project_is_404()
    {
        using var f = new RoomsFactory();
        var burak = await f.ConsultantSignedIn();

        Assert.Equal(HttpStatusCode.NotFound, (await burak.UploadImage(Guid.NewGuid(), Png())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await burak.Post(RemoveUrl(Guid.NewGuid()))).StatusCode);
    }

    // ---- Refusals ----

    private static readonly byte[] Html = "<html><script>alert(1)</script></html>"u8.ToArray();
    private static readonly byte[] Svg =
        "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"u8.ToArray();
    private static readonly byte[] Pdf = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"u8.ToArray();
    private static readonly byte[] Gif = "GIF89a\x01\x00\x01\x00\x00\x00\x00;"u8.ToArray();

    public static TheoryData<string, string, string> NotImages => new()
    {
        { "html", "photo.png", "image/png" },
        { "svg", "logo.svg", "image/svg+xml" },
        { "svg-as-png", "photo.png", "image/png" },
        { "pdf", "photo.png", "image/png" },
        { "gif", "photo.png", "image/png" },
        { "truncated-png", "photo.png", "image/png" },
        { "empty-ish", "photo.png", "image/png" },
    };

    [Theory]
    [MemberData(nameof(NotImages))]
    public async Task A_file_that_is_not_a_png_jpeg_or_webp_is_400_image_not_valid(
        string kind, string fileName, string declaredType)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var bytes = kind switch
        {
            "html" => Html,
            "svg" or "svg-as-png" => Svg,
            "pdf" => Pdf,
            "gif" => Gif,
            "truncated-png" => Png()[..30],
            _ => new byte[] { 1 },
        };

        var response = await r.Burak.UploadImage(r.ProjectId, bytes, fileName, declaredType);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("image_not_valid", await r.Burak.ErrorCode(response));
        Assert.Equal(HttpStatusCode.NotFound, (await r.Burak.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
    }

    [Fact]
    public async Task A_real_image_is_accepted_whatever_its_name_and_declared_type_say()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var response = await r.Burak.UploadImage(r.ProjectId, Jpeg(), "notes.txt", "text/plain");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task A_request_without_the_file_field_is_400()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var wrongField = await r.Burak.PostForm(UploadUrl(r.ProjectId), FileContent(Png(), field: "picture"));
        var notMultipart = await r.Burak.PostForm(UploadUrl(r.ProjectId), new ByteArrayContent(Png()));

        Assert.Equal(HttpStatusCode.BadRequest, wrongField.StatusCode);
        Assert.Equal("image_not_valid", await r.Burak.ErrorCode(wrongField));
        Assert.Equal(HttpStatusCode.BadRequest, notMultipart.StatusCode);
    }

    // A body that says how long it is and counts what the server reads.
    private sealed class CountingContent(long length) : HttpContent
    {
        public long Sent;

        protected override async Task SerializeToStreamAsync(Stream stream, System.Net.TransportContext? context)
        {
            var chunk = new byte[64 * 1024];
            try
            {
                for (long sent = 0; sent < length; sent += chunk.Length)
                {
                    await stream.WriteAsync(chunk);
                    Sent += chunk.Length;
                }
            }
            catch (Exception ex) when (ex is IOException or OperationCanceledException or ObjectDisposedException)
            {
                // The server answered and stopped reading.
            }
        }

        protected override bool TryComputeLength(out long l) { l = length; return true; }
    }

    [Fact]
    public async Task A_body_over_the_limit_is_413_without_being_read()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var content = new CountingContent(20 * 1024 * 1024);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=xyz");

        var response = await r.Burak.PostForm(UploadUrl(r.ProjectId), content);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.True(content.Sent < 20 * 1024 * 1024, "the server read the whole body");
        Assert.Equal(HttpStatusCode.NotFound, (await r.Burak.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
    }

    [Fact]
    public async Task A_file_over_5_MB_is_413()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        // Under the request limit, over the file limit.
        var big = new byte[5 * 1024 * 1024 + 1024];
        Png().CopyTo(big, 0);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await r.Burak.UploadImage(r.ProjectId, big)).StatusCode);
    }

    [Theory]
    [InlineData(20_000, 20_000)]
    [InlineData(10_001, 1)]
    [InlineData(1, 10_001)]
    public async Task An_image_whose_header_says_it_is_too_large_is_refused(int width, int height)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        // The big one is only a header; the thin ones are real images that only the side limit refuses.
        var bytes = width * (long)height > 1_000_000 ? PngWithHeader(width, height) : Png(width, height);

        var response = await r.Burak.UploadImage(r.ProjectId, bytes);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("image_not_valid", await r.Burak.ErrorCode(response));
    }

    [Fact]
    public async Task An_image_with_too_many_pixels_but_sides_within_the_limit_is_refused_before_decoding()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        // 64 megapixels, each side under 10,000: only a header, so only the pixel limit can refuse it.
        var response = await r.Burak.UploadImage(r.ProjectId, PngWithHeader(8000, 8000));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("image_not_valid", await r.Burak.ErrorCode(response));
    }

    [Fact]
    public async Task A_real_image_just_over_40_megapixels_is_refused_and_one_just_under_is_accepted()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var over = await r.Burak.UploadImage(r.ProjectId, SolidGreyPng(8000, 5001));
        var under = await r.Burak.UploadImage(r.ProjectId, SolidGreyPng(8000, 5000));

        Assert.Equal(HttpStatusCode.BadRequest, over.StatusCode);
        Assert.Equal(HttpStatusCode.OK, under.StatusCode);
    }

    [Fact]
    public async Task An_image_at_the_side_limit_is_accepted()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var response = await r.Burak.UploadImage(r.ProjectId, Png(10_000, 1));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ---- Re-encoding ----

    [Fact]
    public async Task A_JPEG_with_EXIF_and_GPS_comes_back_as_WebP_with_no_metadata()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var source = JpegWithExif(200, 100, orientation: 1, markers: true);
        // The source really carries each kind of hidden data, so the checks below can fail.
        var sourceText = System.Text.Encoding.Latin1.GetString(source);
        string[] markers = [ExifMarker, XmpMarker, IccMarker, CommentMarker];
        foreach (var marker in markers) Assert.Contains(marker, sourceText);

        await r.Burak.SetImage(r.ProjectId, source);
        var served = await Served(r.Owner, r.ProjectId);

        var chunks = WebPChunks(served);
        Assert.DoesNotContain("EXIF", chunks);
        Assert.DoesNotContain("XMP ", chunks);
        Assert.DoesNotContain("ICCP", chunks);
        var text = System.Text.Encoding.Latin1.GetString(served);
        foreach (var marker in markers) Assert.DoesNotContain(marker, text);
        Assert.DoesNotContain("Exif", text);
        Assert.DoesNotContain("ICC_PROFILE", text);
        Assert.DoesNotContain("xmpmeta", text);
    }

    public static TheoryData<int, bool> Origins => new()
    {
        { 1, false }, { 2, false }, { 3, false }, { 4, false },
        { 5, true }, { 6, true }, { 7, true }, { 8, true },
    };

    // Where a pixel of the stored picture lands once the EXIF origin is applied: the
    // EXIF specification's eight cases.
    private static (int X, int Y) Upright(int origin, int x, int y, int w, int h) => origin switch
    {
        1 => (x, y),
        2 => (w - 1 - x, y),
        3 => (w - 1 - x, h - 1 - y),
        4 => (x, h - 1 - y),
        5 => (y, x),
        6 => (h - 1 - y, x),
        7 => (h - 1 - y, w - 1 - x),
        _ => (y, w - 1 - x),
    };

    [Theory]
    [MemberData(nameof(Origins))]
    public async Task Every_EXIF_orientation_comes_back_upright(int origin, bool swapped)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        const int w = 200, h = 100;
        await r.Burak.SetImage(r.ProjectId, JpegWithExif(w, h, origin, quadrants: true));

        using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));

        Assert.Equal(swapped ? (h, w) : (w, h), (bitmap.Width, bitmap.Height));
        // The middle of each coloured part of the stored picture, and the colour it must have.
        foreach (var (x, y, colour) in new[] { (50, 25, "green"), (50, 75, "red"), (150, 50, "blue") })
        {
            var (ux, uy) = Upright(origin, x, y, w, h);
            var pixel = bitmap.GetPixel(ux, uy);
            var ok = colour switch
            {
                "green" => pixel.Green > 200 && pixel.Red < 90 && pixel.Blue < 90,
                "red" => pixel.Red > 200 && pixel.Green < 90 && pixel.Blue < 90,
                _ => pixel.Blue > 200 && pixel.Red < 90 && pixel.Green < 90,
            };
            Assert.True(ok, $"origin {origin}: expected {colour} at ({ux},{uy}) but found {pixel}");
        }
    }

    [Theory]
    [InlineData("png")]
    [InlineData("webp")]
    public async Task Transparency_is_kept(string type)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        using var source = HalfTransparent();
        await r.Burak.SetImage(r.ProjectId,
            Encoded(source, type == "png" ? SKEncodedImageFormat.Png : SKEncodedImageFormat.Webp));

        using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));

        Assert.True(bitmap.GetPixel(10, 32).Alpha < 10, "the transparent half became opaque");
        var solid = bitmap.GetPixel(54, 32);
        Assert.True(solid.Alpha > 245 && solid.Red > 200, $"the opaque half changed: {solid}");
    }

    [Fact]
    public async Task An_animated_WebP_keeps_only_its_first_frame()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var source = AnimatedWebP();
        Assert.Contains("ANMF", WebPChunks(source));

        await r.Burak.SetImage(r.ProjectId, source);
        var served = await Served(r.Owner, r.ProjectId);

        Assert.DoesNotContain("ANMF", WebPChunks(served));
        Assert.DoesNotContain("ANIM", WebPChunks(served));
        using var bitmap = SKBitmap.Decode(served);
        var pixel = bitmap.GetPixel(8, 8);
        Assert.True(pixel.Red > 200 && pixel.Blue < 90, $"the first frame is red, found {pixel}");
    }

    [Fact]
    public async Task Uploads_are_limited_per_person()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        // Cheap refusals count too: 30 a minute, then 429.
        for (var i = 0; i < 30; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await r.Burak.UploadImage(r.ProjectId, Html)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await r.Burak.UploadImage(r.ProjectId, Png())).StatusCode);
    }

    [Fact]
    public async Task A_JPEG_with_orientation_6_comes_back_upright_with_width_and_height_swapped()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        // Stored 200x100, left half red and right half blue. Orientation 6
        // turns it 90 degrees clockwise: 100x200 with red above blue.
        await r.Burak.SetImage(r.ProjectId, JpegWithExif(200, 100, orientation: 6, halves: true));

        using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));
        Assert.Equal(100, bitmap.Width);
        Assert.Equal(200, bitmap.Height);
        var top = bitmap.GetPixel(50, 30);
        var bottom = bitmap.GetPixel(50, 170);
        Assert.True(top.Red > 200 && top.Blue < 80, $"top is {top}");
        Assert.True(bottom.Blue > 200 && bottom.Red < 80, $"bottom is {bottom}");
        var row = f.WithDb(db => db.ProjectImages.Single(i => i.ProjectId == r.ProjectId));
        Assert.Equal((100, 200), (row.Width, row.Height));
    }

    [Fact]
    public async Task A_3000_px_image_comes_back_with_a_1600_px_long_edge()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        await r.Burak.SetImage(r.ProjectId, Jpeg(3000, 1500));

        using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));
        Assert.Equal((1600, 800), (bitmap.Width, bitmap.Height));
    }

    [Theory]
    [InlineData("jpeg")]
    [InlineData("png")]
    public async Task A_6000_px_image_decoded_at_a_reduced_size_still_ends_at_1600_px(string type)
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var source = type == "jpeg" ? Jpeg(6000, 3000) : Png(6000, 3000);

        await r.Burak.SetImage(r.ProjectId, source);

        using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));
        Assert.Equal((1600, 800), (bitmap.Width, bitmap.Height));
    }

    [Fact]
    public async Task A_small_image_is_not_enlarged_and_every_allowed_type_works()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        foreach (var bytes in new[] { Png(64, 48), Jpeg(64, 48), WebP(64, 48) })
        {
            await r.Burak.SetImage(r.ProjectId, bytes);
            using var bitmap = SKBitmap.Decode(await Served(r.Owner, r.ProjectId));
            Assert.Equal((64, 48), (bitmap.Width, bitmap.Height));
        }
    }

    // ---- Lifecycle ----

    [Fact]
    public async Task Replacing_the_image_changes_the_version_and_keeps_one_row()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        var first = await r.Burak.SetImage(r.ProjectId, Png(64, 48));
        var second = await r.Burak.SetImage(r.ProjectId, Png(32, 32));

        Assert.NotEqual(first, second);
        Assert.Equal(second, (await r.Owner.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());
        var rows = f.WithDb(db => db.ProjectImages.Where(i => i.ProjectId == r.ProjectId).ToList());
        Assert.Equal((32, 32), (Assert.Single(rows).Width, rows[0].Height));
    }

    [Fact]
    public async Task Removing_then_reading_is_404_and_removing_again_is_204()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        await r.Burak.SetImage(r.ProjectId);

        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(RemoveUrl(r.ProjectId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await r.Owner.Http.GetAsync(ImageUrl(r.ProjectId))).StatusCode);
        Assert.Null((await r.Owner.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await r.Burak.Post(RemoveUrl(r.ProjectId))).StatusCode);
        // Only the removal that removed something is audited.
        Assert.Equal(1, f.WithDb(db => db.AuditEvents.Count(e => e.Action == "project_image_removed")));
    }

    [Fact]
    public async Task Setting_and_removing_are_audited_with_ids_only()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);

        await r.Burak.UploadImage(r.ProjectId, Png(), "secret-holiday-photo.png");
        await r.Burak.Post(RemoveUrl(r.ProjectId));

        var events = f.WithDb(db => db.AuditEvents
            .Where(e => e.Action == "project_image_set" || e.Action == "project_image_removed").ToList());
        Assert.Equal(["project_image_removed", "project_image_set"], events.Select(e => e.Action).Order().ToArray());
        foreach (var e in events)
        {
            Assert.Equal(r.ProjectId, e.ProjectId);
            Assert.Equal(f.ConsultantId(), e.ActorUserId);
            Assert.Null(e.Details);
            Assert.DoesNotContain("secret-holiday-photo", $"{e.Action}{e.Details}{e.IpAddress}");
        }
    }

    [Fact]
    public async Task A_refused_upload_is_not_audited_and_keeps_the_earlier_image()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        var version = await r.Burak.SetImage(r.ProjectId);

        Assert.Equal(HttpStatusCode.BadRequest, (await r.Burak.UploadImage(r.ProjectId, Svg, "x.svg")).StatusCode);

        Assert.Equal(version, (await r.Burak.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());
        Assert.Equal(1, f.WithDb(db => db.AuditEvents.Count(e => e.Action == "project_image_set")));
    }

    [Fact]
    public async Task Project_details_show_the_version_and_never_the_bytes()
    {
        using var f = new RoomsFactory();
        var r = await NewRoom(f);
        Assert.Null((await r.Owner.ProjectJson(r.ProjectId)).GetProperty("imageVersion").GetString());

        var version = await r.Burak.SetImage(r.ProjectId, Png(800, 600));

        foreach (var person in new[] { r.Owner, r.Burak })
        {
            var (status, body) = await person.GetProject(r.ProjectId);
            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Contains($"\"imageVersion\":\"{version}\"", body);
            Assert.True(body.Length < 2000, "project details carry something large");
            Assert.DoesNotContain("bytes", body, StringComparison.OrdinalIgnoreCase);
        }
        var (_, list) = await r.Owner.GetProjectList();
        Assert.DoesNotContain("imageVersion", list);
    }

    [Fact]
    public async Task Deleting_the_project_row_deletes_its_image()
    {
        using var f = new RoomsFactory();
        var projectId = f.SeedProject();
        f.WithDb(db =>
        {
            db.ProjectImages.Add(new ProjectImage { ProjectId = projectId, Bytes = [1], Version = "v", UpdatedAt = f.Now });
            db.SaveChanges();
            return 0;
        });

        // Project has no other dependants here, so deleting it cascades to the image.
        f.WithDb(db =>
        {
            db.Projects.Remove(db.Projects.Single(p => p.Id == projectId));
            db.SaveChanges();
            return 0;
        });

        Assert.Empty(f.WithDb(db => db.ProjectImages.ToList()));
    }
}

public static class ProjectImageListSupport
{
    public static async Task<(HttpStatusCode Status, string Body)> GetProjectList(this Person person)
    {
        var response = await person.Http.GetAsync("/projects");
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
