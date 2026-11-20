# Idea Discovery Rooms

## What this is
A web app where a software consultant (Burak) and business owners clarify a
business idea together, helped by an AI assistant. Burak creates a project
for each idea and invites its people by email. Each project's room has three
sections: **The idea**, **Discussion** and **Shared summary**. The discussion
is the project's active conversation; Burak finishes it and starts the next,
and finished ones stay readable. Nobody needs to be online at the same moment.

The goal is to understand what the owners want to achieve and how they
imagine the business working. The AI helps clarify the idea; it never decides
what the business should be.

This is NOT the owners' business app. It only collects business requirements.
No technical details and no deep detail at this stage.

Read before planning: the Phase 1 PRD,
`docs/prd/Idea_Discovery_Rooms_Phase_1_PRD.md`
(the single source of scope), and @docs/design.md

## Users
- Business owners: non-technical, on phones and desktops. Any number of
  owners share one project. Some prefer English, some Turkish.
- Burak, the software consultant, the only one in Phase 1: sees everything,
  creates projects, approves what the AI sends, confirms the summary.
- AI assistants: one public Lead drafts questions, recaps and summary
  updates; private specialists answer only Burak or the Lead. Their prompts
  live in `prompts/` and are written from the AI Discovery Playbook v1.1 in
  `docs/playbook/`.

## Core rules
- **Burak approves first.** Each conversation has an AI mode: Off, Review
  (the default: nothing the AI writes reaches owners until Burak approves,
  edits or rejects it) or Automatic (chat replies go out selectively).
  Summary and job-flow changes always need approval.
- **Private stays private.** Owners never see drafts, specialist results,
  agent activity or Burak's private notes. The server enforces this, not the
  screens.
- **Nothing unconfirmed is shown as fact.** Every statement is Confirmed, an
  Early interpretation, or an Open question, and is labelled as such.
- **Owners react, Burak confirms.** Owners mark a statement "Right" or "Not
  right". Only Burak moves it to Confirmed.
- The assistant never asks owners about technology, platforms or features.
- Build Phase 1 only, as listed in the PRD. Anything else goes to the PRD's
  future feature register, not into code.

## Language
- English first. Each person can switch to Turkish (EN | TR). The switch
  changes the app's text and the language the AI uses with that person. It is
  per person and remembered.
- Messages are stored as written and never replaced. When a message is not in
  the reader's language, a translation is shown beneath the original.
- Every owner-facing string and all project content exist in both languages.
  English is the source; Turkish is added in the same change.
- English uses British spelling.
- Code, comments, commits and docs are English.

## Design
- Follow docs/design.md. It describes the look taken from the reference
  prototype in `docs/reference/`.
- Every screen is designed and checked at phone width (390px) and desktop
  width (1280px). Neither is an afterthought.
- Run the design-review skill before calling any screen finished.

## Content and prompts
- Each project's name, intro, job-flow steps, current understanding, similar
  businesses, participants and AI instructions are project data, in both
  languages. No project-specific text inside components, and nothing from one
  project becomes a default for another.
- In the prototype, project data still comes from config files in the code,
  and `prompts/idea-context.*.md` must not contradict the project config.
  Update them together. In the real build Burak enters project data in the
  app (PRD R01, R11).
- AI prompts live in `prompts/` and are loaded from the files at runtime.
  Never inline or duplicate them in code.
- `docs/reference/` holds the earlier prototype, screenshots and the printed
  feedback document. Reference only; do not copy its code structure.

## Security (real build)
- The Claude API key stays on the server. Never in the browser, never
  committed.
- Read the model ID, the AI provider and the email service from
  configuration.
- People sign in with one-time, expiring links (emailed or copied by Burak),
  and see only the projects they are members of. The API has no way to sign
  in without a link; only the browser demo simulates sign-in.

## Stack
- Client: React + Vite + TypeScript in `src/web`. Today it is the prototype,
  with simulated AI and data in local storage. It grows into the real client;
  the demo stays as a configuration that is off in real deployments.
- API: ASP.NET Core on .NET 10 in `src/api`, with EF Core and SQLite
  (migrations applied on startup). It alone calls the Claude API, through a
  provider adapter.
- Hosting: a small Hetzner cloud server in Germany running Docker. Email
  through Resend's free tier, behind a configurable adapter.

## Working style
- Every change runs through the dev-loop skill: it says when to plan, which
  subagents and skills to run, and how to verify and report. Principles for
  anyone writing or reviewing code: docs/engineering.md.
- The main session leads and does not write app code; the implementer
  subagent does, and the code-reviewer subagent reviews it.
- Work in small steps, one pull request each, and wait for Burak's go-ahead
  before starting the next.
- Ask Burak when a requirement is unclear instead of assuming. Put decisions
  to him one at a time, with a recommendation.
- Record every product or technical decision in docs/decisions.md.

## Commands
The client is still the prototype (see PROTOTYPE.md). The API in `src/api`
has deny-by-default access, a health endpoint, the M1 database and sign-in
with one-time links and server-side sessions (`/auth/*`, `/consultant/*`),
but no project endpoints yet.
- Install: `npm --prefix src/web install`
- Run: `npm --prefix src/web run dev` (http://localhost:5173)
- Build and type-check: `npm --prefix src/web run build`
- Web tests (Vitest): `npm --prefix src/web test`
- API build and tests (.NET 10 SDK): `dotnet test src/api`
- New database migration: `dotnet tool restore`, then
  `dotnet ef migrations add <Name> --project src/api/IdeaDiscovery.Api`
- Outside Development the API refuses to start without
  `ConnectionStrings:Default`, `Auth:TokenKey` (a secret of at least 32
  characters) and `App:PublicBaseUrl` (the https address links are built
  from). It also needs `Consultant:Email`. Set them as environment
  variables or server settings, never committed.
- Emails: in Development `Email:Provider` is `Folder`, so sign-in emails
  are saved as `.eml` files in `src/api/IdeaDiscovery.Api/emails/` (open one
  to sign in locally). `Folder` is refused outside Development; with no
  provider set there, the API starts with a warning and sends nothing.
- Check links in the docs: `powershell -File tools/check-doc-links.ps1`
- CI (`.github/workflows/ci.yml`) runs all of these on every pull request.
