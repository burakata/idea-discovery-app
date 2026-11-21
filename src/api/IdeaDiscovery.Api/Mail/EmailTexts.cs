using IdeaDiscovery.Api.Auth;

namespace IdeaDiscovery.Api.Mail;

// The emails in both languages: English is the source, Turkish is written with
// it. Owner-facing, so follow .claude/skills/ui-copy. The sign-in email holds no
// names; the invitation emails name the person, Burak and the project.
public static class EmailTexts
{
    private static int Minutes => (int)SignInLinks.SignInLifetime.TotalMinutes;
    private static int InvitationDays => (int)SignInLinks.InvitationLifetime.TotalDays;

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

    // An invitation for a person with no account yet. The names and the project
    // title are Burak's own entries; none of them can hold a line break.
    public static (string Subject, string Body) Invitation(
        string language, string name, string inviter, string project, string link) =>
        language == "tr"
            ? ("Idea Discovery Rooms'a davetlisiniz",
               $"Merhaba {name},\n\n{inviter}, sizi Idea Discovery Rooms'ta \"{project}\" konusunu konuşmaya davet etti. "
               + "Fikrinizi kendi sözlerinizle anlatabileceğiniz ortak bir alan.\n\n"
               + $"Katılmak için bu bağlantıyı kullanın:\n\n{link}\n\n"
               + $"Bağlantı yalnızca bir kez çalışır ve {InvitationDays} gün sonra geçerliliğini yitirir.\n\n"
               + "Bu daveti beklemiyorsanız bu e-postayı yok sayabilirsiniz.\n")
            : ("You are invited to Idea Discovery Rooms",
               $"Hello {name},\n\n{inviter} has invited you to talk about \"{project}\" on Idea Discovery Rooms. "
               + "It is a shared space where you can describe your idea in your own words.\n\n"
               + $"Use this link to join:\n\n{link}\n\n"
               + $"It works once and expires in {InvitationDays} days.\n\n"
               + "If you were not expecting this, you can ignore this email.\n");

    // For someone who already had an account: they are in the project now, and
    // the link only signs them in.
    public static (string Subject, string Body) Added(
        string language, string name, string inviter, string project, string link) =>
        language == "tr"
            ? ("Idea Discovery Rooms'ta bir projeye eklendiniz",
               $"Merhaba {name},\n\n{inviter}, sizi Idea Discovery Rooms'ta \"{project}\" projesine ekledi.\n\n"
               + $"Giriş yapmak için bu bağlantıyı kullanın:\n\n{link}\n\n"
               + $"Bağlantı yalnızca bir kez çalışır ve {Minutes} dakika sonra geçerliliğini yitirir. "
               + "Süresi dolarsa giriş sayfasından yeni bir bağlantı isteyebilirsiniz.\n")
            : ("You have been added to a project on Idea Discovery Rooms",
               $"Hello {name},\n\n{inviter} has added you to \"{project}\" on Idea Discovery Rooms.\n\n"
               + $"Use this sign-in link to go in:\n\n{link}\n\n"
               + $"It works once and expires in {Minutes} minutes. "
               + "If it has expired, you can ask for a new link on the sign-in page.\n");
}
