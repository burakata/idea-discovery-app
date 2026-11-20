# Idea Discovery Rooms

A web app where a software consultant and business owners clarify a business
idea together, helped by an AI assistant. Each idea gets its own room with
three sections: **The idea**, **Discussion** and **Shared summary**. Nobody
needs to be online at the same time.

The app collects business requirements: what the business is, who it serves,
how a job runs and how money is made. It is not the owners' business app, and
it does not judge whether the idea will work. Owners can use it in English or
Turkish.

## Status

A clickable front-end prototype. There is no backend, database or login. The
AI assistant and sharing between people are simulated, and demo data stays in
your browser. [PROTOTYPE.md](PROTOTYPE.md) lists what is simulated and what
the real build needs.

The prototype's first project is a pallet transport idea, used as sample
content. The discussion and reactions in it are invented.

## Run the prototype

You need Node.js 20.19 or later, or 22.12 or later.

```
npm --prefix src/web install
npm --prefix src/web run dev
```

Open http://localhost:5173.
- **View as**, in the strip at the top, switches between the three business
  owners and the consultant.
- **Reset demo** starts again from fresh demo data.

To build and type-check:

```
npm --prefix src/web run build
```

## What is where

| Path | Contents |
|---|---|
| `src/web/` | The prototype: React, Vite and TypeScript |
| `prompts/` | The AI assistant's prompts, read from these files |
| `Idea_Discovery_Rooms_Phase1_Package/` | The Phase 1 PRD (the single source of scope), its implementation plan and the future feature register |
| `docs/design.md` | Look and layout rules, for phone and desktop |
| `docs/decisions.md` | Product and technical decisions, and open questions |
| `docs/engineering.md` | Principles for writing and reviewing code |
| `docs/design-review/` | Design and owner-test reports, with screenshots |
| `docs/reference/` | The earlier prototype and the printed feedback document, for reference only |
| `.claude/` | The Claude Code setup: the dev loop, subagents and skills |

## How work is done

- **One loop for every change.** Every change goes through the dev loop in
  `.claude/skills/dev-loop/SKILL.md`: plan, implement, review, verify,
  report.
- **Claude Code does the work, in three roles:**
  - a lead session plans, reviews and reports;
  - an implementer subagent writes the code;
  - a code-reviewer subagent reviews it.
- **A branch and pull request for each task.** Only the project owner merges
  into `main`.

The proposed real build is an ASP.NET Core API, React and SQLite, with the
Claude API called from the server only. See
[docs/decisions.md](docs/decisions.md).
