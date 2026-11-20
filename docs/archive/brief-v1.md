> **Superseded on 20 November 2026** by the Phase 1 PRD,
> `Idea_Discovery_Rooms_Phase1_Package/Idea_Discovery_Rooms_Phase_1_PRD.md`.
> Kept for reference only; it is not a source of scope.

# Brief: Idea Discovery Rooms

## Problem
Understanding a customer's business idea currently means back-and-forth emails
or sending a document and waiting for feedback. The owners are busy,
non-technical, and rarely free at the same time as Burak.

## Idea
One room per business idea. The owners see what Burak understands so far,
talk it through in a shared discussion with an AI assistant, and react to a
living summary. Burak checks what the AI wants to ask before it is sent, and
decides what counts as confirmed.

The app runs alongside a printed feedback document and face-to-face
conversations. It does not replace them.

## Purpose and limits
- Collect business requirements: what the business is, who it serves, how a
  job runs from start to finish, how money is made, what matters first.
- Not for technical details. Not for deep detail at this stage.
- Not for judging whether the idea will succeed.
- Separate from the business app the owners eventually want built.

## v1 (build only this)

### For owners
1. **Join.** Open an invite link, enter a display name.
2. **The idea.** A welcoming page for the project:
   - a short introduction to what the conversation is for;
   - a simple job-flow diagram;
   - what we understand so far, clearly marked as needing confirmation;
   - similar businesses, as reference examples only;
   - a link to the printable version;
   - a prominent "Join discussion" button.
3. **Discussion.** One shared conversation. Each message shows the writer's
   name and role (Business owner, Software consultant, AI assistant). The
   assistant asks one question at a time. After an owner sends a message, a
   quiet line tells them a reply will follow.
4. **Shared summary.** Three groups: Confirmed, Early interpretations, Open
   questions. On each early interpretation an owner can tap "Right" or "Not
   right" and add a correction. Everyone sees who reacted and how.
5. **Language.** English first, with an EN | TR switch per person. Messages
   written in the other language show a translation beneath the original.

### For Burak
6. **Waiting for you.** A queue of what the AI proposes: draft messages,
   new summary statements, changes to the job flow. Burak approves, edits or
   rejects each. Owners never see drafts.
7. **Automatic switch.** Per room, Burak can let the AI's chat messages go
   out without approval. Summary and job-flow changes always need approval.
8. **Confirming.** Burak moves a statement to Confirmed, edits it, or removes
   it. He can add statements and open questions himself, including answers
   that came back on paper or in person.
9. **Private notes.** On request, the AI writes Burak a private note on what
   the discussion means for the eventual software. Owners never see it.
10. **Export.** Download the shared summary as a text file.
11. **Rooms.** A list of projects. Each project is defined by one config, so
    a second idea can be added without changing components.

### Living outputs
While the discussion continues, the AI keeps two things up to date, both
through the approval queue:
- the shared summary;
- the job-flow diagram, stored as a list of steps and drawn by a fixed
  template. Steps that are still unknown are shown as questions.

The AI does not draw screens or mock-ups of the owners' future product.

### Who sees what
- Owners: the idea, discussion and shared summary of their own room.
- Burak: everything, plus the queue, private notes and room settings.

## Later (do not build now)
- A queue of pre-approved follow-up questions
- Creating a project inside the app instead of editing a config
- Notifications to owners by SMS or WhatsApp
- Voice messages; photo or document upload
- Exporting the full discussion, or export to Word or PDF
- Languages other than English and Turkish
- More than one consultant; teams
- AI-drawn screens or mock-ups of the owners' product
- Any analysis, scoring or pricing of the idea

## Success looks like
- An owner opens the link, understands what it is for and what Burak thinks
  the idea is, without any explanation.
- An owner can correct something Burak got wrong in two taps.
- An owner who prefers Turkish finds the switch without help, and the
  English-only owner can follow everything written in Turkish.
- It looks like a professional product, on a phone and on a desktop.
- Burak ends up with fewer assumptions than he started with.

## Open questions
See docs/decisions.md.
