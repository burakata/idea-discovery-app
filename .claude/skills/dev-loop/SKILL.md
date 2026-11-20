---
name: dev-loop
description: The single entry point for any change to the Idea Discovery Rooms app, its project content, its seeded demo data or its prompts. Runs understand, plan, implement, review, show, fix, verify, report and learn. Use whenever Burak asks for a new screen, a feature, a fix or a content change.
---

# Dev loop

Burak's way of working, written down once so he does not have to repeat it
in every request. The lead (the main session) runs the loop. Since
2026-11-19 the lead does not write app code: the **implementer** subagent
does. Rules live in CLAUDE.md and docs/design.md; principles in
docs/engineering.md.

## 1. Understand

- Read CLAUDE.md, and the documents the request touches: the Phase 1 PRD
  (`Idea_Discovery_Rooms_Phase1_Package/Idea_Discovery_Rooms_Phase_1_PRD.md`),
  docs/design.md, docs/decisions.md, `prompts/`, docs/reference/.
- Read them again even if you saw them in an earlier session. They change
  between sessions, and Burak has had to say "check again, it should be
  there".
- Look at what already exists before thinking about what to add: components,
  tokens, strings, store actions, project configs. Use the Explore subagent
  for wide searches.
- If a requirement is unclear, ask Burak. Do not assume.

## 2. Plan

- Plan the smallest change that works, built on what exists.
- The plan names:
  - the files to change;
  - what is reused, and what is new and why;
  - what is out of scope;
  - how we will know it is done.
- For new UI, order the work: tokens and shared components first, then the
  screens.
- Run scope-guard on any plan that adds or changes behaviour. Fold its
  verdicts into the plan.
- Show Burak the plan and wait for approval.
  - Exception: when Burak names exactly what to fix from something he has
    already seen ("fix everything", "fix seed data"), his request is the
    approval. State the plan in one line and go.
- Record every decision the plan makes in docs/decisions.md, as Proposed.

## 3. Implement

Every task gets its own branch, cut from an up-to-date `main`:

```
git switch main
git pull --ff-only
git switch -c <type>/<short-name>
```

`<type>` is `feature`, `fix`, `content` or `docs`. Never commit to `main`.

Brief the implementer. It starts with no context, so the brief must stand on
its own:

```
Goal: <what and why, in two sentences>
Files: <files to change>
Reuse: <existing components, tokens, strings or actions to build on>
Do not touch: <areas that are out of scope>
High-risk areas involved: <from docs/engineering.md section 4, or "none">
Done when: <checks the implementer can run itself>
```

- One implementer at a time for a given set of files.
- Owner-facing text: the implementer follows the ui-copy skill.
- The implementer never commits. When it reports, the lead commits its change
  to the task branch, with a message that says why.

## 4. Review

Run these in parallel, as the change requires:

| Reviewer | When |
|---|---|
| code-reviewer subagent | Every change. Give it the brief and the range `main...HEAD` |
| owner-tester subagent | Changes to `prompts/`, the idea page content, seeded demo data or the chat flow |
| design-review skill | Changes to layout or styling: 390px and 1280px, English and Turkish, with screenshots |
| scope-guard subagent | Again, if the change grew beyond the approved plan |

Sort the findings:
- **must-fix:** breaks a core rule, the brief or the plan;
- **worth considering;**
- **noise:** drop it.

## 5. Show before fixing

- Show Burak the findings before fixing anything: the design-review report
  with its screenshots, the code review, the owner-tester report.
- The exception is when Burak asked for fixes up front.
- Save reports he should keep under docs/design-review/.

## 6. Fix

- Send the fixes Burak chooses to the implementer.
- Commit each round of fixes as a new commit on the task branch.
- Run again the reviews those fixes touch.

## 7. Verify

The lead checks the result itself:
- The build passes: `npm --prefix src/web run build`.
- The app does what the plan's "done when" says. Check it in the browser:
  - `?as=<person>&lang=<en|tr>` switches person and language;
  - Reset demo gives fresh data.
- Look at every screenshot before using it. Do not trust exit codes.
- Reset the demo afterwards so Burak starts from fresh data.

## 8. Report

Push the task branch and open a pull request into `main`. Burak chose this on
2026-11-19, so committing to the task branch, pushing it and opening the pull
request are part of every task. Merging into `main` is always Burak's.

The pull request description, and the message to Burak, say:
- what changed;
- what was verified, and what was not;
- which decisions were recorded;
- what is left.

Rules:
- Never push to `main` directly. Never force-push.
- Without the GitHub command-line tool (`gh`), push the branch and give
  Burak the link to open the pull request:
  `https://github.com/burakata/idea-discovery-app/compare/main...<branch>?expand=1`
- The next task starts from `main` again, after Burak has merged.

## 9. Learn

- If Burak corrected anything during the loop, write the principle, its what
  and its why, into docs/engineering.md, or into the agent file it concerns.
- Every few changes, trim steering that no longer earns its place.

## Not in the loop yet

- **Deployment, feature flags and monitoring:** added when the real build is
  hosted.
- **A security-reviewer subagent:** added when backend work starts. Until
  then code-reviewer checks the security basics.
- **A reviewer from another vendor's model:** waiting for Burak's decision.
  It would send code to that vendor.
