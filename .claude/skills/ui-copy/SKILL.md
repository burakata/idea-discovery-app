---
name: ui-copy
description: Write or review text that owners see in the app, in English and Turkish, including buttons, labels, hints, empty states, error messages, the language switch and project content on the idea page. Use whenever adding or changing owner-facing text.
---

# Owner-facing text (English and Turkish)

Owners are non-technical. Text must be understood at a glance in either
language.

## Language rules
- English is the default and the source. Turkish is written in the same
  change, never left for later.
- Every string has both an English and a Turkish version. No key may exist in
  only one language. This includes project content: intro, job-flow steps,
  statements, similar businesses.
- English uses British spelling (organise, colour, cancelled).
- Turkish is natural Turkish, not a word-for-word translation. Polite "siz"
  form.
- Never show two languages on the same screen, except the language switch
  and a message with its translation beneath.

## Writing rules (both languages)
- Plain, everyday words. No technical terms, no abbreviations.
- Buttons: one or two words. Labels: as short as possible.
- Say what happens, not how the system works.
  Good: "Your message was sent." / "Mesajınız gönderildi."
  Not: "Request processed successfully." / "İstek başarıyla işlendi."
- Error messages say what to do next.
  Good: "Connection lost. Try again." / "Bağlantı kesildi. Tekrar deneyin."
- No exclamation marks except in a greeting.
- Do not call the owners' business a "platform", and do not describe it with
  words they have not used.
- Anything unconfirmed says so: "may", "we think", "needs confirmation".
- Turkish: use correct characters (ç, ğ, ı, İ, ö, ş, ü). Check capital İ and
  lowercase ı in particular. Turkish text is often longer than English; check
  it fits at both screen sizes.

## Language switch
- Label each language in its own language: "English" and "Türkçe", or "EN"
  and "TR" where space is tight. No flags.
- Visible on every screen without opening a menu.
- Takes effect immediately and is remembered for that person.

## Where text lives
Interface strings: two files, one per language, with identical keys. Project
content: in the project's config, in both languages. Never hardcode
owner-facing text inside components.

## Word list
Use these consistently.

| Meaning | English | Turkish | Avoid |
|---|---|---|---|
| Section: the idea | The idea | Fikir | Overview, Proje |
| Section: discussion | Discussion | Sohbet | Chat, Thread, Oturum |
| Section: summary | Shared summary | Ortak özet | Report, Rapor |
| Business owner | Business owner | İş sahibi | Founder, User, Kullanıcı |
| Burak's role | Software consultant | Yazılım danışmanı | Admin, Developer |
| The AI | AI assistant | Yapay zekâ yardımcısı | Bot, Interviewer |
| Confirmed | Confirmed | Onaylandı | Approved, Verified |
| Early interpretation | Early interpretation | İlk yorum | Assumption, Varsayım |
| Open question | Open question | Açık soru | Issue, Sorun |
| Needs confirmation | Needs confirmation | Teyit bekliyor | Pending, Beklemede |
| Owner agrees | Right | Doğru | OK, Approve |
| Owner disagrees | Not right | Doğru değil | Reject, Wrong, Yanlış |
| Translation label | Translated | Çeviri | Auto-translated |
| Send | Send | Gönder | Submit, İlet |
| Your name | Your name | Adınız | Username, Kullanıcı adı |
| Join | Join discussion | Sohbete katıl | Enter, Giriş yap |
| Print version | Print version | Yazdırılabilir sürüm | Download PDF |
| After sending | A reply will follow. | Yanıt gelecek. | Processing |

Burak-only screens (the queue, private notes, room settings) are in English
and do not need Turkish.

## When reviewing
List each string that breaks a rule, with a suggested replacement in both
languages. Flag any key missing from either file and any screen that mixes
languages.
