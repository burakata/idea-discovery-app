# Consultant-only AI Facilitator commands

The consultant selects a command; the AI prepares a **draft** or, when appropriate, recommends **no public reply**. In rooms with review enabled, drafts appear in **Waiting for you**, not in the owner's discussion. Even in automatic public-chat mode, changes to shared summary and job-flow should be reviewed in the recommended pilot design (still a **Proposed** decision).

Commands are **consultant-only**. They cannot be invoked by an owner to reveal private notes. The consultant can edit any public draft before posting it.

| Command | Assistant | Private or public result | Success criterion |
|---|---|---|---|
| **Clarify** | Discovery Guide + optional Reviewer | Public question as draft | Asks about one genuinely ambiguous point |
| **Real example** | Discovery Guide | Public question as draft | Invites one ordinary start-to-end example |
| **Find gaps** | Clarity Reviewer | Private note | Finds up to three high-value unknowns without turning them into feature requirements |
| **Check agreement** | Clarity Reviewer | Private note, optionally public draft | Distinguishes disagreement from unconfirmed alternatives |
| **Summarise** | Discovery Guide | Draft shared summary update | Separates explicit statements / interpretations / open questions |
| **Stay high-level** | Discovery Guide | Ongoing facilitator instruction | Suppresses technical and premature detailed questioning |
| **Pause questions** | Discovery Guide | Draft acknowledgement / no reply | Gives owners time to respond or ends the current round |
| **Call specialist** | Selected Domain Specialist | Draft explanation | Only the named specialist responds; no agent chorus |
| **Correct misunderstanding** | Discovery Guide | Draft correction + optional proposed summary change | Acknowledges error without hiding the original claim |
| **Review pacing** | Clarity Reviewer | Private observation; optional public draft | Spots unnecessary questions or scope drift; recommends asking, recapping or pausing |

## Copy-ready instructions

### `/clarify`
“Review the latest discussion. Decide whether a question is helpful **now**. If so, draft the single highest-value neutral clarification. Otherwise recommend a recap, acknowledgement, or no reply. Preserve modal language and do not introduce a solution.”

### `/real-example`
“Invite one owner to walk through a typical real-world example from beginning to end. Keep it open-ended, with no suggested workflow or feature list. Ask just one question.”

### `/find-gaps`
“Privately identify up to three unanswered points that matter to understanding the intended business. Cite owner statements when available. Label each **now** or **later**; recommend no immediate question if the room should pause. Do not publish to owners or drift into validating the venture.”

### `/check-agreement`
“Privately compare the owners' statements. Identify true disagreements or different interpretations, citing the speakers. Do not assume they disagree when discussing different cases. Suggest one public clarification question only if helpful.”

### `/summarise`
“Draft a short shared understanding with: (1) what individual owners explicitly said, (2) early interpretations needing confirmation, (3) still-open questions. Mark all new or changed points as proposals. Do not confirm any item or overwrite an owner's correction.”

### `/stay-high-level`
“For the next discussion segment, focus on the basic business idea and everyday example journey. Avoid software design, technical implementation, pricing formulas, risk registers, MVP scope and long questionnaires. Do not repeat answered questions.”

### `/pause-questions`
“Do not ask another question now. If a reply is needed, draft one short acknowledgement; otherwise return NO_PUBLIC_REPLY for the host workflow. Wait until an owner or consultant reopens the discussion. Never post the internal token.”

### `/call-specialist {topic}`
“Ask the selected specialist to explain only the requested topic with simple, neutral examples in the target language. Do not choose the owners' business model. Draft a short answer for consultant review.”

### `/correct`
“An owner corrected our interpretation. Quote the corrected meaning faithfully, acknowledge the mistake briefly, and propose any relevant summary change as an unconfirmed draft. Do not restate the wrong assumption as fact.”

### `/review-pacing`
“Privately review the last few Discovery Guide turns. Are we asking useful questions, pushing for answers, suggesting scope, or drifting toward customer acquisition? Identify at most one improvement. Recommend: ask / recap / acknowledge / no reply. Do not publish this review to owners.”

## Implementation notes for a later integration (not a current build decision)

- Keep `actor=consultant`, `room_id`, `visibility`, `language`, `assistant_id`, `approval_mode` and optional `source_message_ids` with the draft.
- The server must enforce who can see consultant-only notes and who can publish/approve; this cannot be secured by instructions alone.
- Every public post should retain a source/approval audit record and clear AI assistant identity.
- Any agent output that claims it has published or confirmed something should be ignored unless the app has actually performed that action.
