using IdeaDiscovery.Api.Data;
using IdeaDiscovery.Api.Mail;

namespace IdeaDiscovery.Api.Tests;

// The email texts live in Mail/Templates. These tests pin the exact words and
// the rule that every supported language has every template.
public sealed class EmailTemplateTests
{
    private const string Link = "https://example.test/sign-in#token";

    // The outputs of the hard-coded EmailTexts, captured before the texts moved to files.
    [Fact]
    public void Rendered_emails_are_word_for_word_what_they_were()
    {
        Assert.Equal(
            ("Your sign-in link for Idea Discovery Rooms",
             "Hello,\n\nHere is your sign-in link for Idea Discovery Rooms:\n\nhttps://example.test/sign-in#token\n\n"
             + "It works once and expires in 30 minutes.\n\n"
             + "Do not forward this email: anyone who opens the link can sign in as you. If you asked more than once, only the newest link works.\n\n"
             + "If you did not ask for it, you can ignore this email.\n"),
            Render.SignIn("en"));
        Assert.Equal(
            ("Idea Discovery Rooms giriş bağlantınız",
             "Merhaba,\n\nIdea Discovery Rooms için giriş bağlantınız burada:\n\nhttps://example.test/sign-in#token\n\n"
             + "Bağlantı yalnızca bir kez çalışır ve 30 dakika sonra geçerliliğini yitirir.\n\n"
             + "Bu e-postayı kimseyle paylaşmayın: bağlantıyı açan herkes sizin adınıza giriş yapabilir. Birden fazla kez istediyseniz yalnızca en son bağlantı çalışır.\n\n"
             + "Bağlantıyı siz istemediyseniz bu e-postayı yok sayabilirsiniz.\n"),
            Render.SignIn("tr"));
        Assert.Equal(
            ("You are invited to Idea Discovery Rooms",
             "Hello Ayse,\n\nBurak has invited you to talk about \"Corner Shop\" on Idea Discovery Rooms. "
             + "It is a shared space where you can describe your idea in your own words.\n\n"
             + "Use this link to join:\n\nhttps://example.test/sign-in#token\n\n"
             + "It works once and expires in 7 days. Do not forward this email: anyone who opens the link can sign in as you.\n\n"
             + "If you were not expecting this, you can ignore this email.\n"),
            Render.Invitation("en"));
        Assert.Equal(
            ("Idea Discovery Rooms'a davet edildiniz",
             "Merhaba Ayse,\n\nBurak, sizi Idea Discovery Rooms'ta \"Corner Shop\" hakkında konuşmaya davet etti. "
             + "Fikrinizi kendi sözlerinizle anlatabileceğiniz ortak bir alan.\n\n"
             + "Katılmak için bu bağlantıyı kullanın:\n\nhttps://example.test/sign-in#token\n\n"
             + "Bağlantı yalnızca bir kez çalışır ve 7 gün sonra geçerliliğini yitirir. Bu e-postayı kimseyle paylaşmayın: bağlantıyı açan herkes sizin adınıza giriş yapabilir.\n\n"
             + "Bu daveti beklemiyorsanız bu e-postayı yok sayabilirsiniz.\n"),
            Render.Invitation("tr"));
        Assert.Equal(
            ("You have been added to a project on Idea Discovery Rooms",
             "Hello Ayse,\n\nBurak has added you to \"Corner Shop\" on Idea Discovery Rooms.\n\n"
             + "Use this link to sign in:\n\nhttps://example.test/sign-in#token\n\n"
             + "It works once and expires in 30 minutes. "
             + "If it has expired, you can ask for a new link on the sign-in page. Do not forward this email: anyone who opens the link can sign in as you.\n"),
            Render.Added("en"));
        Assert.Equal(
            ("Idea Discovery Rooms'ta bir projeye eklendiniz",
             "Merhaba Ayse,\n\nBurak, sizi Idea Discovery Rooms'ta \"Corner Shop\" projesine ekledi.\n\n"
             + "Giriş yapmak için bu bağlantıyı kullanın:\n\nhttps://example.test/sign-in#token\n\n"
             + "Bağlantı yalnızca bir kez çalışır ve 30 dakika sonra geçerliliğini yitirir. "
             + "Süresi dolarsa giriş sayfasından yeni bir bağlantı isteyebilirsiniz. Bu e-postayı kimseyle paylaşmayın: bağlantıyı açan herkes sizin adınıza giriş yapabilir.\n"),
            Render.Added("tr"));
    }

    private static readonly EmailTemplates Templates = EmailTemplates.LoadFromBuildOutput();

    private static class Render
    {
        public static (string, string) SignIn(string language) => Templates.RenderSignIn(language, Link);
        public static (string, string) Invitation(string language) =>
            Templates.RenderInvitation(language, "Ayse", "Burak", "Corner Shop", Link);
        public static (string, string) Added(string language) =>
            Templates.RenderAdded(language, "Ayse", "Burak", "Corner Shop", Link);
    }

    private static string TemplateDirectory => Path.Combine(AppContext.BaseDirectory, "Mail", "Templates");

    private static readonly System.Text.RegularExpressions.Regex Placeholder = new(@"\{(\w+)\}");

    public static IEnumerable<object[]> EveryTemplate() =>
        from name in EmailTemplates.Names
        from language in Languages.All
        select new object[] { name, language };

    [Theory]
    [MemberData(nameof(EveryTemplate))]
    public void Every_template_exists_for_every_supported_language_with_the_english_placeholders(string name, string language)
    {
        var path = Path.Combine(TemplateDirectory, $"{name}.{language}.txt");
        Assert.True(File.Exists(path), $"Missing template {path}");
        var english = Path.Combine(TemplateDirectory, $"{name}.{Languages.Default}.txt");
        Assert.Equal(PlaceholdersIn(english), PlaceholdersIn(path));
    }

    private static string[] PlaceholdersIn(string path) =>
        Placeholder.Matches(File.ReadAllText(path)).Select(m => m.Groups[1].Value).Distinct().Order().ToArray();

    [Fact]
    public void An_unsupported_language_gets_the_english_email()
    {
        Assert.Equal(Render.SignIn("en"), Render.SignIn("fr"));
        Assert.Equal(Render.Invitation("en"), Render.Invitation("xx"));
        Assert.Equal(Render.Added("en"), Render.Added(""));
        Assert.Equal(Render.Added("en"), Templates.RenderAdded(null, "Ayse", "Burak", "Corner Shop", Link));
    }

    [Fact]
    public void A_value_with_braces_is_not_filled_in_again()
    {
        var (_, body) = Templates.RenderInvitation("en", "{link}", "Burak", "Shop {name}", Link);
        Assert.Contains("Hello {link},", body);
        Assert.Contains("\"Shop {name}\"", body);
    }

    // A temporary copy of the templates, for the startup check.
    private static string CopyTemplates()
    {
        var dir = Path.Combine(Path.GetTempPath(), "templates-" + Guid.NewGuid());
        Directory.CreateDirectory(dir);
        foreach (var file in Directory.GetFiles(TemplateDirectory, "*.txt"))
            File.Copy(file, Path.Combine(dir, Path.GetFileName(file)));
        return dir;
    }

    [Fact]
    public void Startup_refuses_a_missing_template_and_says_which()
    {
        var dir = CopyTemplates();
        try
        {
            File.Delete(Path.Combine(dir, "added.tr.txt"));
            var error = Assert.Throws<InvalidOperationException>(() => new EmailTemplates(dir));
            Assert.Contains("\"added\"", error.Message);
            Assert.Contains("\"tr\"", error.Message);
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void Startup_refuses_a_template_whose_placeholders_differ_from_english()
    {
        var dir = CopyTemplates();
        try
        {
            var path = Path.Combine(dir, "sign-in.tr.txt");
            File.WriteAllText(path, File.ReadAllText(path).Replace("{minutes}", "{minuts}"));
            var error = Assert.Throws<InvalidOperationException>(() => new EmailTemplates(dir));
            Assert.Contains("sign-in", error.Message);
            Assert.Contains("{minutes}", error.Message);
            Assert.Contains("{minuts}", error.Message);
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void Project_title_and_intro_pick_the_language_and_fall_back_to_english()
    {
        var project = new Project { TitleEn = "Shop", TitleTr = "Dukkan", IntroEn = "About", IntroTr = "Hakkinda" };
        Assert.Equal(("Shop", "About"), (project.Title("en"), project.Intro("en")));
        Assert.Equal(("Dukkan", "Hakkinda"), (project.Title("tr"), project.Intro("tr")));
        Assert.Equal(("Shop", "About"), (project.Title("fr"), project.Intro(null)));
    }

    // Project.Title and Intro return the Turkish column for any language that is not the default.
    [Fact]
    public void Project_texts_still_fit_the_two_columns()
    {
        Assert.True(Languages.All.SequenceEqual(["en", "tr"]),
            "Add a per-language translations table for project texts before adding a language "
            + "(decisions: F24): Project.Title and Project.Intro only know the TitleEn/TitleTr pair.");
    }

    [Fact]
    public void Languages_knows_the_supported_codes_and_falls_back()
    {
        Assert.True(Languages.IsSupported("en"));
        Assert.True(Languages.IsSupported("tr"));
        Assert.False(Languages.IsSupported("EN"));
        Assert.False(Languages.IsSupported(null));
        Assert.Equal("tr", Languages.Resolve("tr"));
        Assert.Equal(Languages.Default, Languages.Resolve("fr"));
        Assert.Equal(Languages.Default, Languages.Resolve(null));
    }
}
