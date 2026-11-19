# Prompt for the prototype rebuild

Before pasting: copy the second prototype's source files into
`docs/reference/second-prototype/`, its screenshots into
`docs/reference/screenshots/`, and the feedback PDF to
`docs/reference/feedback-document.pdf`. Start in Plan mode.

---

Read CLAUDE.md, docs/brief.md, docs/design.md and docs/decisions.md. Then look
through docs/reference/: the earlier prototype's source, its screenshots and
the printed feedback document.

Replace the current prototype in src/web with a new clickable prototype of
Idea Discovery Rooms. Keep nothing from the current one's look. This is a
front-end prototype only: no backend, no database, no Claude API calls, no
login. Simulated behaviour must be labelled as simulated on screen.

Build in React + Vite + TypeScript in src/web.

Look and layout
- Follow docs/design.md. Take colours, spacing and illustrations from the
  reference prototype, with the changes listed there.
- Every screen must look finished at 390px and at 1280px. Bottom navigation
  on phones, sidebar on desktop.
- Define the design tokens and the shared components first, then the screens.

Project content
- One config for the pallet transport project, in English and Turkish: intro,
  job-flow steps, current understanding, similar businesses, participants,
  starting statements for the summary. Take the wording from the feedback
  document and prompts/idea-context.pallet.md.
- Three owners with realistic display names (two prefer Turkish, one is
  British and reads only English), Burak as software consultant, and the AI
  assistant.
- A seeded discussion of about ten realistic messages, some in Turkish, each
  with a hand-written translation.

Owner screens
- Join, The idea, Discussion, Shared summary, as described in docs/brief.md.
- EN | TR switch that changes all interface text and project content.
- A translation line beneath any message not in the reader's language. For
  messages typed during the demo, show a placeholder saying the translation
  appears in the real app.
- In the summary, "Right" and "Not right" with a correction box, showing who
  reacted.

Burak's screens
- "Waiting for you": a queue with draft AI messages, proposed summary
  statements and a proposed job-flow change. Approve, edit, reject.
- When an owner sends a message, a scripted draft appears in the queue, not
  in the discussion. Approving it posts it. Scripted drafts come from the
  example questions in prompts/interviewer.md.
- A per-room automatic switch: when on, scripted replies post directly after
  a short delay.
- Confirm, edit or remove statements in the summary; add a statement or an
  open question.
- A private notes panel with one sample note.
- Export the summary as a text file.
- A rooms list with the pallet project and one empty example project, to
  show the app is not tied to one idea.

Prototype controls
- A clearly labelled "View as" control to switch between the three owners and
  Burak, since the real app is asynchronous.
- Keep demo data in local storage, with a "Reset demo" button.

Do not
- Call any API or put an API key anywhere.
- Build anything on the "Later" list in docs/brief.md.
- Use emoji as icons, or the word "platform" for the owners' business.

Also
- Add .claude/launch.json so you can run and preview it.
- Write PROTOTYPE.md: what is simulated, and what the real build needs.

Plan first and show me the plan before writing code. Run the scope-guard
subagent on the plan. When the screens are built, run the design-review skill
and show me the report with screenshots before fixing anything.
