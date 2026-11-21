# Prototype: Idea Discovery Rooms

The demo build of the client: a clickable version that shows how the app
looks and feels. It has no backend, no database, no real sign-in and no AI.
Nothing leaves the browser. The same client also builds against the real
API (`npm --prefix src/web run dev:api`, see CLAUDE.md); this file is about
the demo.

## Run it

Try it online at https://burakata.github.io/idea-discovery-app/ (deployed
from `main` by `.github/workflows/pages.yml`), or run it locally:

```
npm --prefix src/web install
npm --prefix src/web run dev
```

Open http://localhost:5173. It opens on the signed-out home page, as the
real app does; press **Try the demo** to go in as Burak. The sample
project, "Home-cooked meals" / "Ev yemekleri", is **invented**: its owners,
messages and reactions are sample data, not a real idea.

To preview the online build locally under the same sub-path, build it from
PowerShell (Git Bash rewrites the path), then start the `pages-preview`
configuration in `.claude/launch.json`:

```
npm --prefix src/web run build:demo -- --base=/idea-discovery-app/
```

## How to use it

- **The amber strip at the top** is the prototype's own controls. It is not
  part of the app.
  - **View as** switches between the three owners and Burak once you are
    signed in. The real app is asynchronous, so this is how you see every
    side from one browser.
  - **Reset demo** puts everything back to the start, signed out.
- **EN | TR** is the real language switch. It is per person: switch View as
  and you get that person's language.
- Things to try:
  1. Press **Try the demo**, then open "Home-cooked meals" from the project
     list.
  2. Switch View as to Hasan, switch to TR, tap "Sohbete katıl", enter a name
     and send a message. You see "Yanıt gelecek." and no reply.
  3. Switch back to Burak and open "Waiting for you". The draft reply is
     there. Approve it and it appears in the Discussion. The queue also starts
     with seeded items: a proposed summary change where two owners disagree,
     and a job-flow change that records one owner's view while the step stays
     a question.
  4. Turn on "Send chat replies automatically", switch to an owner and send
     another message. The reply arrives by itself after a moment.
  5. As Tom, open the Shared summary and tap "Not right" on a statement.
  6. As Burak, confirm, edit, remove or add statements, then Export.
  7. As Burak, open "All rooms" to see the empty example project.

| Person | Role | Starts as |
|---|---|---|
| Elif Yıldız | Business owner | joined, Turkish |
| Hasan Aksoy | Business owner | not joined, Turkish |
| Tom Bennett | Business owner | joined, English only |
| Burak | Software consultant | English; the demo starts as him |

## What is real

- The look: design tokens in `src/web/src/styles/tokens.css` and the shared
  components in `src/web/src/components/`.
- The project config in `src/web/src/projects/homeMeals.ts`, in English and
  Turkish, with its seeded demo data in `src/web/src/demo/seed.ts`. A second
  project is one more config file. The earlier pallet project is real client
  work and is kept only as reference in `docs/reference/`.
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
| "View as" decides who you are | Each person signs in on their own device with a one-time link from their email, a link Burak copies, or an approved request to join |
| `?as=burak&lang=tr` in the address sets the viewer and language | Must not exist. It would expose Burak's queue to anyone |
| Everything is saved in this browser's local storage | A server and database shared by everyone in the room |
| Rooms come from config files in the code | The consultant creates projects in the app (PRD R01) |
| No Print version link | Generated from the idea page and shared summary, in the reader's language (M3) |
| "Try the demo" signs in as Burak; the email form sends nothing, and the sign-in link page is a labelled sample | One-time email sign-in links, a copied link or an approved join request (built in M1) |

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
- With approval on, an owner sees "A reply will follow." for as long as Burak
  takes. Nothing tells them when it arrives.
- Burak's own screens (queue, private notes, rooms) are always English and
  have no language switch. On the shared summary his controls stay English
  even when he reads the summary in Turkish.

## Not built

Everything in the PRD's future feature register. In the demo also sharing
between devices, creating a project in the app, notifications, exporting
the discussion, and a "request a note" button.
