# Prototype: Idea Discovery Rooms

A clickable front-end prototype. It shows how the app would look and feel.
There is no backend, no database, no login and no AI. Nothing leaves the
browser.

## Run it

Try it online at https://burakata.github.io/idea-discovery-app/ (deployed
from `main` by `.github/workflows/pages.yml`), or run it locally:

```
npm --prefix src/web install
npm --prefix src/web run dev
```

Open http://localhost:5173. It opens on the pallet room's idea page as Murat
Kaya, an owner who has not joined yet and whose app is still in English.

To preview the online build locally under the same sub-path, build it from
PowerShell (Git Bash rewrites the path), then start the `pages-preview`
configuration in `.claude/launch.json`:

```
npm --prefix src/web run build -- --base=/idea-discovery-app/
```

## How to use it

- **The amber strip at the top** is the prototype's own controls. It is not
  part of the app.
  - **View as** switches between the three owners and Burak. The real app is
    asynchronous, so this is how you see every side from one browser.
  - **Reset demo** puts everything back to the start.
- **EN | TR** is the real language switch. It is per person: switch View as
  and you get that person's language.
- Things to try:
  1. As Murat, switch to TR, tap "Sohbete katıl", enter a name and send a
     message. You see "Yanıt gelecek." and no reply.
  2. Switch to Burak and open "Waiting for you". The draft reply is there.
     Approve it and it appears in the Discussion. The queue also starts with
     five seeded items: a reply to David, an answer to an open question, a
     reworded statement, a new open question where two owners disagree, and a
     job-flow change that leaves one part as a question.
  3. Turn on "Send chat replies automatically", switch to an owner and send
     another message. The reply arrives by itself after a moment.
  4. As David, open the Shared summary and tap "Not right" on a statement.
  5. As Burak, confirm, edit, remove or add statements, then Export.
  6. As Burak, open "All rooms" to see the empty example project.

| Person | Role | Starts as |
|---|---|---|
| Selin Aydın | Business owner | joined, Turkish |
| Murat Kaya | Business owner | not joined, English (prefers Turkish) |
| David Harper | Business owner | joined, English only |
| Burak | Software consultant | English |

## What is real

- The look: design tokens in `src/web/src/styles/tokens.css` and the shared
  components in `src/web/src/components/`.
- The project config in `src/web/src/projects/pallet.ts`, in English and
  Turkish. A second project is one more config file.
- The owner-facing strings in `src/web/src/strings/en.ts` and `tr.ts`. The
  build fails if a key is missing from either.
- The approval rules: AI messages wait for Burak unless the room's switch is
  on; summary and job-flow changes always wait; approved statements become
  early interpretations, never confirmed.

## What is simulated

| In the prototype | In the real build |
|---|---|
| The assistant steps through the example questions in `prompts/interviewer.md`, whatever anyone writes. They are read from that file when the app is built | The Claude API, called from the server, with `prompts/interviewer.md` as the system prompt. The prompt must never reach the browser |
| After the last scripted line the assistant produces nothing more | A real discussion has no fixed end |
| The assistant answers every owner message and never stays quiet | `NO_REPLY` when a message is between people |
| Proposed summary statements and the job-flow change are hand-written and seeded | Written by the AI from `prompts/summary.md` after new owner messages |
| The private note is one hand-written sample | Written by the AI from `prompts/consultant-notes.md` when Burak asks |
| Translations of the seeded messages are hand-written. Anything typed in the demo shows "A translation appears here in the real app." | Translations from `prompts/translate.md` for every message, correction and statement |
| The language of a typed message is taken to be the writer's language setting | Detect the language actually written |
| The seeded discussion, reactions and proposals are **invented**. No owner said any of it. Nothing starts as confirmed | Real messages and reactions from the real owners |
| "View as" decides who you are | An invite link per room and each person's own device |
| `?as=burak&lang=tr` in the address sets the viewer and language | Must not exist. It would expose Burak's queue to anyone |
| Everything is saved in this browser's local storage | A server and database shared by everyone in the room |
| Rooms come from config files in the code | The consultant creates projects in the app (PRD R01) |
| The Print version link opens a PDF copied into the app. There is no Turkish PDF yet, so Turkish shows "coming soon" | A document per language, kept in step with the project config |
| No sign-in of any kind | To be decided: open question 4 in docs/decisions.md |

## What the real build needs

- An ASP.NET Core API and a database (proposed: SQLite) for rooms, people,
  messages, statements, reactions, the queue and private notes.
- The Claude API called from the server only, with the model ID and key read
  from configuration.
- Four prompt-driven jobs, each feeding Burak's queue or his notes: draft a
  reply, propose summary and job-flow changes, translate, write a private
  note.
- Invite links and a way to tell who is who.
- A way for owners to learn a reply has arrived, and for Burak to learn
  something is waiting (open questions 2 and 3).
- Rules for who sees what, enforced on the server: owners never receive
  drafts, proposals or private notes.

## Questions the prototype raises

- When Burak edits a statement owners have already reacted to, their
  reactions stay attached to the new wording. (Open question 8.)
- A statement or edit Burak types exists in one language only. (Open
  question 9.)
- The similar-business cards no longer match the printed document word for
  word: no per-card questions and no "platform". The PDF still says
  "platform".
- With approval on, an owner sees "A reply will follow." for as long as Burak
  takes. Nothing tells them when it arrives.
- Burak's own screens (queue, private notes, rooms) are always English and
  have no language switch. On the shared summary his controls stay English
  even when he reads the summary in Turkish.

## Not built

Everything in the PRD's future feature register. Also sign-in, sharing between
devices, creating a project in the app, notifications, exporting the
discussion, and a "request a note" button.
