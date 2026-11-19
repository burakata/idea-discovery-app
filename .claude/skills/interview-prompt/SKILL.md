---
name: interview-prompt
description: Edit or review the AI prompts in prompts/ (interviewer, summary, translate, consultant-notes, idea-context). Use when changing how the assistant questions owners, proposes summary updates, translates messages or writes Burak's private notes.
---

# Editing the AI prompts

| File | Used for | Who sees the output |
|---|---|---|
| `prompts/interviewer.md` | Draft messages in the Discussion | Owners, after Burak approves |
| `prompts/summary.md` | Proposed changes to the shared summary and job flow | Owners, after Burak approves |
| `prompts/translate.md` | Translation beneath a message | Owners, directly |
| `prompts/consultant-notes.md` | Burak's private note | Burak only |
| `prompts/idea-context.*.md` | Background for one project | Appended to the others |

## Before editing
1. Read the prompt file in full.
2. State in one sentence what behaviour should change and why.

## Rules every owner-facing prompt must keep
- The AI clarifies the idea; it never decides what the business should be.
- Nothing unconfirmed is stated as fact. The AI never adds to Confirmed.
- English first; each person is addressed in their language setting, one
  language per message.
- One question per message.
- Business only: who the customers are, how a job runs, who does what, how
  money is made, what comes first. No technology, features or screens.
- No judging the idea. No price or timeline talk.
- Short, everyday language, no jargon.
- Owner-facing examples in a prompt exist in both English and Turkish.
  Change both together. Turkish is natural, not word for word.
- The AI never mentions drafts or approval to owners.

## When editing
- Change the smallest part that fixes the behaviour.
- Prefer one clear instruction over several overlapping ones.
- Industry detail belongs in an idea-context file, never in the shared
  prompts.
- If you change an idea-context file, check the project's idea page still
  says the same thing.
- Keep each prompt under 200 lines.

## After editing
1. Run the owner-tester subagent.
2. Write three short sample exchanges to `docs/prompt-samples.md`, replacing
   the previous ones. Include at least one in each language.
3. If the change alters what the AI covers or how it behaves, add a row to
   `docs/decisions.md`.
