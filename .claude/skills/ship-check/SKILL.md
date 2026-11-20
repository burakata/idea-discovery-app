---
name: ship-check
description: Pre-release checklist for Idea Discovery Rooms, from the PRD's Definition of Done (§14) and release blockers (§10). Run on the deployed environment before inviting real owners.
disable-model-invocation: true
---

# Ship check

Run it against the deployed environment, not a local build or the demo
configuration. Go through every item. Report each as PASS, FAIL or NOT
CHECKED with one line of evidence. Do not fix anything unless asked; report
first. PRD: `docs/prd/Idea_Discovery_Rooms_Phase_1_PRD.md`.

## Build and tests
- [ ] `main` is green: every required CI check passes on its latest commit.
- [ ] The acceptance tests A01 to A16 (PRD §8) pass, or each failing one is
      named with the reason it does not block this pilot.
- [ ] The demo configuration is off. `?as=`, `?lang=`, Reset demo and
      no-link sign-in do not work.

## Secrets
- [ ] No API key, password or token anywhere in the repository or its
      history.
- [ ] The AI provider key and model ID are read from configuration on the
      server only.
- [ ] No request from the browser goes directly to the AI provider.

## Access (PRD §10: release blockers)
- [ ] An invite is bound to its email, works once, expires and can be
      revoked.
- [ ] A forwarded invite or room link opens nothing for anyone else (A15).
- [ ] A signed-in owner sees only the projects they are a member of,
      including by typing addresses or ids directly.
- [ ] Owners cannot see drafts, the queue, specialist results, agent
      activity, private notes or settings, through any screen, address,
      error message or email (A05, A09).
- [ ] Nothing from one project appears in another: text, agents or AI
      context (A16).
- [ ] User text is shown as text, never run as HTML.

## The pilot works (PRD §14)
- [ ] Burak creates a generic project and invites at least one outside
      participant.
- [ ] Both can talk at different times on different devices and come back to
      the same active conversation (A01, A03).
- [ ] Burak finishes a conversation and starts the next; the old transcript
      and approved outputs stay readable and unchanged (A04).
- [ ] AI modes per conversation:
      - Off: no AI message; people still talk (A06);
      - Review: nothing the AI writes reaches owners before Burak approves;
        an edited draft goes out as edited, a rejected one never (A05);
      - Automatic: selective replies only; summary and flow changes still
        wait for approval (A07).
- [ ] `@Lead` follows the current mode; owners cannot call a specialist
      (A08).
- [ ] The Lead stays silent when a question is open, and
      `NO_PUBLIC_REPLY` never appears as a message or draft (A12).
- [ ] Owners mark Right or Not right with a correction, each reaction shows
      who made it, and only Burak confirms; dissent stays visible (A11,
      A14).
- [ ] The idea snapshot, the shared understanding and the next-conversation
      questions can be drafted, approved and kept.
- [ ] Burak can read private specialist results; owners cannot.

## Language
- [ ] The app opens in English; the switch is visible on every owner screen
      without opening a menu.
- [ ] Switching to Türkçe changes all interface text and project content,
      and the AI's next message to that person; the choice is remembered for
      that person only.
- [ ] A message in the other language shows a translation beneath the
      unchanged original, and the translation does not strengthen it (A10).

## Owner experience (390px and 1280px)
- [ ] From the email link, an owner signs in and reaches the idea page in
      under a minute.
- [ ] The idea page explains what this is for without any help from Burak.
- [ ] The design-review skill has been run with no unresolved problems.
- [ ] Keyboard use, labelled icons and contrast are checked (PRD §10).

## Data and operations (PRD §10)
- [ ] Data survives a server restart.
- [ ] Backups run, a restore has been tried, and they roll off as decided.
- [ ] The privacy notice is published and matches the retention decision in
      docs/decisions.md.
- [ ] An AI or email failure loses no human message, and a retry does not
      publish twice.
- [ ] Approvals, confirmations, mode changes and conversation closures are
      recorded with who and when.

## Prompts and scope
- [ ] All prompts are loaded from `prompts/`, not duplicated in code.
- [ ] owner-tester has been run since the last prompt change, with no
      unresolved findings.
- [ ] security-reviewer has reviewed every change to access, sign-in, AI
      calls and configuration, with no unresolved must-fixes.
- [ ] Nothing from the PRD's future feature register has been built.
- [ ] docs/decisions.md is up to date, and the open questions that block
      inviting owners are answered.

Finish with a one-line verdict: ready to invite owners, or not, and the
blocking items. After the pilot, the PRD's last §14 item (did the AI surface
a useful ambiguity or prevent a mistaken assumption?) is Burak's review, not
part of this check.
