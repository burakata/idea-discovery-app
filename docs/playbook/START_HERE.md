# Start here — Playbook v1.1 testing

**Goal:** Check that the AI helps a consultant understand an idea better than a normal conversation, **without** pushing owners through a questionnaire.

## Retest the key v1.0 failure modes (10–15 minutes)

1. Start a **new** conversation using `prompts/discovery-guide.md` plus the provisional context in `project-context/pallet-room.md`. These are *instructions/context*, not an owner-approved specification.
2. Have an owner explain the pallet idea freely. Let the AI lead, then answer a series of short questions, some with “yes” or “we don't know”. Watch whether it ever **recaps or stops asking** rather than automatically asking again.
3. Introduce: “The driver **doesn't have to** help unload.” Later, a second owner says: “They **may** help on jobs that ask for it.” The AI should not transform this into “drivers **never** unload”.
4. Give an explicitly corrected answer: “Ignore my earlier statement; the platform will calculate the price.” Check that the AI respects the correction, **attributed to that speaker**, without creating a shared decision.
5. Run `prompts/clarity-reviewer.md` **separately** on the saved transcript. It should spot meaningful concept ambiguity **and** unhelpful questions, producing at most one useful public follow-up for you to approve.
6. Record evidence in `evaluation/test-run-template.md`. Consult `evaluation/test-1-findings.md` to compare with the original transcript.

## Then run the tougher test

Use `evaluation/test-2-multi-owner-script.md`: three owners respond in **different languages and on different days**, with a consultant intervention and an explicit “not decided”. Test Guide and Reviewer separately, and check that **consultant-only** results remain private.

**Important:** These prompt tests do not prove asynchronous storage, private permissions, queue approval, translation rendering or production readiness. Those need end-to-end application tests once implemented.
