# Idea Discovery Rooms

## What this is
A web app where a software consultant (Burak) and business owners clarify a
business idea together, helped by an AI assistant. Each idea has its own room
with three sections: **The idea**, **Discussion** and **Shared summary**.
Nobody needs to be online at the same moment.

The goal is to understand what the owners want to achieve and how they
imagine the business working. The AI helps clarify the idea; it never decides
what the business should be.

This is NOT the owners' business app. It only collects business requirements.
No technical details and no deep detail at this stage.

Read before planning: the Phase 1 PRD,
`Idea_Discovery_Rooms_Phase1_Package/Idea_Discovery_Rooms_Phase_1_PRD.md`
(the single source of scope), and @docs/design.md

## Users
- Business owners: non-technical, on phones and desktops. Several owners
  share one room. Some prefer English, some Turkish.
- Burak, the software consultant: sees everything, approves what the AI
  sends, confirms the summary.
- AI assistant: drafts questions and proposes summary updates. Its prompts
  live in `prompts/`.

## Core rules
- **Burak approves first.** By default nothing the AI writes reaches owners
  until Burak approves, edits or rejects it. A per-room switch lets chat
  messages go out automatically. Summary and job-flow changes always need
  approval.
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
- Each project (idea) is one config with its name, intro, job-flow steps,
  current understanding, similar businesses and participants, in both
  languages. No project-specific text inside components.
- AI prompts live in `prompts/` and are loaded from the files at runtime.
  Never inline or duplicate them in code.
- `prompts/idea-context.*.md` and the project config must not contradict each
  other. Update them together.
- `docs/reference/` holds the earlier prototype, screenshots and the printed
  feedback document. Reference only; do not copy its code structure.

## Security (real build)
- The Claude API key stays on the server. Never in the browser, never
  committed.
- Read the model ID from configuration.

## Stack
- Prototype: React + Vite + TypeScript in `src/web`, no backend, simulated AI.
- Real build (proposed): ASP.NET Core API, React, SQLite, Claude API called
  from the API project only.

## Working style
- Every change runs through the dev-loop skill. Principles for anyone writing
  or reviewing code: docs/engineering.md.
- The main session leads and does not write app code; the implementer
  subagent does, and the code-reviewer subagent reviews it.
- Plan before coding. Propose the smallest change that works.
- Ask Burak when a requirement is unclear instead of assuming.
- Record every product or technical decision in docs/decisions.md.
- Before adding a feature, run the scope-guard subagent.
- After changing a prompt, the idea page content or the chat flow, run the
  owner-tester subagent.
- For owner-facing text, use the ui-copy skill.

## Commands
Prototype only so far (see PROTOTYPE.md). No backend and no tests yet.
- Install: `npm --prefix src/web install`
- Run: `npm --prefix src/web run dev` (http://localhost:5173)
- Build and type-check: `npm --prefix src/web run build`
