---
name: ship-check
description: Pre-release checklist for Idea Discovery Rooms. Run before sharing an invite link with real owners.
disable-model-invocation: true
---

# Ship check

Go through every item. Report each as PASS, FAIL or NOT CHECKED with one line
of evidence. Do not fix anything unless asked; report first.

## Build
- [ ] Backend builds and tests pass.
- [ ] Frontend builds with no errors.

## Secrets
- [ ] No API key or secret anywhere in the repository or its history.
- [ ] The Claude API key is read from configuration on the server only.
- [ ] No request from the browser goes directly to the Claude API.

## Owner experience (check at 390px and 1280px)
- [ ] An invite link opens the idea page for the right project.
- [ ] Entering a name and reaching the discussion takes under a minute.
- [ ] The idea page explains what this is for without any help from Burak.
- [ ] Closing the page and reopening the link shows the same room.
- [ ] The design-review skill has been run with no unresolved problems.

## Approval
- [ ] With approval on, nothing the AI writes appears to owners before Burak
      approves it.
- [ ] An edited draft is sent as edited. A rejected draft never appears.
- [ ] The automatic switch works per room and affects chat messages only.
- [ ] Summary and job-flow changes need approval even in automatic mode.
- [ ] Owners cannot see drafts, the queue, private notes or room settings,
      including by typing an address directly.
- [ ] `NO_REPLY` never appears as a visible message or a draft.

## Shared summary
- [ ] Owners can mark "Right" or "Not right" and add a correction.
- [ ] Each reaction shows who made it.
- [ ] Only Burak can move a statement to Confirmed.
- [ ] Nothing reaches Confirmed without Burak's action.
- [ ] Export downloads the summary with all three groups.

## Language and translation
- [ ] The app opens in English; the AI's opening message is in English.
- [ ] The switch is visible without opening a menu, on every screen.
- [ ] Switching to Türkçe changes all interface text and project content.
- [ ] After switching, the AI's next message to that person is in Turkish.
- [ ] The choice survives closing and reopening the link, and does not
      affect anyone else.
- [ ] A Turkish message shows an English translation beneath it for an
      English reader, and the other way round. The original is unchanged.
- [ ] The two strings files have identical keys.

## Prompts
- [ ] All prompts are loaded from `prompts/`, not duplicated in code.
- [ ] The idea-context file for the project is appended.
- [ ] The idea page and the idea-context file say the same thing.
- [ ] owner-tester has been run since the last prompt change, with no
      unresolved findings.

## Data
- [ ] Rooms survive a server restart.
- [ ] There is a way to back up a room.

## Scope
- [ ] Nothing from the "Later" list in docs/brief.md has been built.
- [ ] docs/decisions.md is up to date.

Finish with a one-line verdict: ready to share, or not, and the blocking
items.
