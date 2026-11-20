using IdeaDiscovery.Api.Auth;

namespace IdeaDiscovery.Api.Mail;

// The sign-in email in both languages: English is the source, Turkish is written
// with it. Owner-facing, so follow .claude/skills/ui-copy. No names or project
// data go in.
public static class EmailTexts
{
    private static int Minutes => (int)SignInLinks.SignInLifetime.TotalMinutes;

    public static (string Subject, string Body) SignIn(string language, string link) =>
        language == "tr"
            ? ("Idea Discovery Rooms giriş bağlantınız",
               $"Merhaba,\n\nIdea Discovery Rooms için giriş bağlantınız burada:\n\n{link}\n\n"
               + $"Bağlantı yalnızca bir kez çalışır ve {Minutes} dakika sonra geçerliliğini yitirir.\n\n"
               + "Bağlantıyı siz istemediyseniz bu e-postayı yok sayabilirsiniz.\n")
            : ("Your sign-in link for Idea Discovery Rooms",
               $"Hello,\n\nHere is your sign-in link for Idea Discovery Rooms:\n\n{link}\n\n"
               + $"It works once and expires in {Minutes} minutes.\n\n"
               + "If you did not ask for it, you can ignore this email.\n");
}
