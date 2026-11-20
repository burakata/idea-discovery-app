# Idea Discovery Rooms — AI Discovery Playbook v1.1

**Version:** 1.1 · **Prepared:** 17 November 2026 · **Status:** Prompt-revised after one synthetic test; not yet production-tested

## Purpose

Help a consultant understand what non-technical business owners **actually want**, through a shared, asynchronous, bilingual (English/Turkish) AI-assisted discussion. The AI facilitates understanding; it does not design their solution, judge whether the venture is commercially viable, or invent requirements.

The first pilot concerns a **possible pallet-transport business**. The conversation on foot was *not* a discovery meeting; the current description is provisional. The playbook remains reusable for other project rooms.

## Start here

1. Read [`discovery-playbook.md`](discovery-playbook.md): objectives, rules and stages.
2. Use [`prompts/discovery-guide.md`](prompts/discovery-guide.md) as the default **customer-facing interviewer**.
3. Use [`prompts/clarity-reviewer.md`](prompts/clarity-reviewer.md) **privately** after a few turns or when requested.
4. Bring in [`prompts/domain-specialist.md`](prompts/domain-specialist.md) **only when explicitly selected**.
5. Use [`facilitator/commands.md`](facilitator/commands.md) for consultant-only interventions.
6. Test with [`evaluation/test-scenarios.md`](evaluation/test-scenarios.md); score with [`evaluation/scoring-rubric.md`](evaluation/scoring-rubric.md), recording results in [`evaluation/test-run-template.md`](evaluation/test-run-template.md).
7. Review findings from the first simulated interview in [`evaluation/test-1-findings.md`](evaluation/test-1-findings.md); run the stronger async three-owner script in [`evaluation/test-2-multi-owner-script.md`](evaluation/test-2-multi-owner-script.md).
8. Load [`project-context/pallet-room.md`](project-context/pallet-room.md) only for the first project; substitute another project brief for future rooms.

## What this package does and doesn't do

**It does:** define prompts, dialogue rules, human-approval boundaries, a simple stage progression, and test scenarios.

**It does not:** connect to an AI API, create accounts, send messages to owners, run an actual collaborative session, verify competitor claims, or replace the real application's authorisation controls. All examples are synthetic.

## Agreed decisions vs recommendations

According to the existing `decisions.md`, the following are **Decided**: English-first UI with Turkish options; asynchronous joint discussion; business-level questions only; AI chat replies held for consultant approval by default (optional per-room automatic posting); owner “Right / Not right” reactions; consultant-only confirmation; translation beneath other-language messages; idea-page competitor examples; the initial pallet description is unconfirmed.

Other items (including always approving proposed changes to the shared summary and job-flow, private reviewer outputs, specific export formats, prompts loaded at runtime, notification choices and production stack) were **Proposed** in that log. This package recommends consultant approval for *all shared summary/job-flow edits* in the pilot, but does not silently promote that recommendation to an agreed product decision.

## Private pilot readiness

Before inviting an owner: (a) run at least one simulation of each test; (b) approve the first-message wording; (c) implement genuine invitations, roles and server-side permission checks; (d) connect a real model server-side; (e) verify the approval queue and bilingual rendering; (f) agree what information may be collected, who may see it and how long it is retained. The current v2 prototype is **not** suitable for real private business discussions because it only simulates users and AI in one browser.


## What's new in v1.1

Based on the **17 November 2026 synthetic transcript**, not a real interview with the owners:

- The Discovery Guide now chooses between **one question, a brief recap, acknowledgement, or no message**; it must not interrogate after every owner response.
- It defers customer acquisition / market validation and detailed software design in the first conversation.
- It preserves **modal wording**: “doesn't have to unload” is not the same as “must never unload.”
- Explicit corrections by **one speaker** replace only that speaker's previous position, not everybody's.
- The Clarity Reviewer now checks **interviewer quality and pacing**, prioritises the most useful intervention, and provides it in the intended owner's language.
- The evaluation suite adds pricing-correction, leading-language, over-questioning, broad industry-example and asynchronous multi-owner tests.

**File inventory:** Original eleven Markdown files retained, plus two evaluation notes/scripts (`test-1-findings.md`, `test-2-multi-owner-script.md`). Product choices still marked *Proposed* remain proposals.
