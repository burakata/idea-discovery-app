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
- Read the model ID, the AI provider and the sign-in method from
  configuration.
- People sign in with one-time, expiring email links, and see only the
  projects they are members of. Signing in without a link exists only in
  demo or local configurations.

## Stack
- Client: React + Vite + TypeScript in `src/web`. Today it is the prototype,
  with simulated AI and data in local storage. It grows into the real client;
  the demo stays as a configuration that is off in real deployments.
- API (proposed, not started): ASP.NET Core with SQLite. It alone calls the
  Claude API, through a provider adapter.
- Hosting: a small Linux VPS running Docker.

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
Prototype only so far (see PROTOTYPE.md). No backend and no tests yet.
- Install: `npm --prefix src/web install`
- Run: `npm --prefix src/web run dev` (http://localhost:5173)
- Build and type-check: `npm --prefix src/web run build`
- Check links in the docs: `powershell -File tools/check-doc-links.ps1`
- CI (`.github/workflows/ci.yml`) runs both on every pull request.
