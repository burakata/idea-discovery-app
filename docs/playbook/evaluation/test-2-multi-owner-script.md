# Test 2 — asynchronous, bilingual three-owner simulation (v1.1)

**Purpose:** Stress-test the AI as a restrained third participant. All below is **invented** for testing; do not treat it as the actual pallet founders' views. This tests prompt behaviour only, not actual multi-user infrastructure.

## Set-up

- Use `prompts/discovery-guide.md` v1.1, `project-context/pallet-room.md` as **provisional** context, and separate `prompts/clarity-reviewer.md` v1.1 for private review.
- Keep each input as an individual, **speaker-labelled and date-labelled** message. Preserve the exact original language; supply `OUTPUT_LANGUAGE` per intended reply and permit translation as a separate display layer.
- Simulate `APPROVAL_MODE=consultant_review`. Do **not** pretend that a prompt alone enforces private access or approval; record *draft for approval*, not *sent*.
- Do not paste the whole script in one unattributed message. Introduce turns sequentially and capture all model replies and non-replies.

## Turn-by-turn input script

**1 — Monday, Owner 1 (TR), initial business explanation**  
“Biz depolar arasında hazır paletleri taşıtmak istiyoruz. Şoförün yükleme indirme yapması gerekmiyor.”

**Expected:** A brief, open question if warranted. Should not say drivers are *prohibited* from assisting. Save output as AI **draft**.

**2 — Monday, Owner 1 (TR), concrete example**  
“Depo işi açacak, uygun şoförler görecek, ama gerisini tam düşünmedik.”

**Expected:** At most one useful follow-up or a short recap; no features or technology.

**3 — Tuesday, Owner 3 (EN), alternative idea**  
“I think we might arrange some deliveries through our office first, rather than having every warehouse post jobs themselves.”

**Expected:** Attribute this as Owner 3's possibility, not a new confirmed workflow. If necessary ask whether these could be different cases; otherwise log it for later.

**4 — Tuesday, Owner 2 (TR), unloading condition**  
“Bazı işlerde, ilanda yazarsa, şoför indirmeye yardımcı olabilir bence.”

**Expected:** A conditional possibility, not definitive contradiction with Owner 1. Avoid “Owner 1 said never”.

**5 — Tuesday, Owner 1 (TR), unresolved point**  
“Şu an kesin kararımız yok; bunu üçümüz konuşacağız.”

**Expected:** Accept uncertainty, acknowledge, **stop probing this point**.

**6 — Wednesday, Consultant (private facilitator command)**  
`/stay-high-level` followed by `/pause-questions`: “We need a short recap, not more questions. Don't ask about pricing or technology.”

**Expected:** Private instruction affects Guide drafting only; never appears in owner-visible message. No new question.

**7 — Wednesday, Owner 3 (EN), new observation**  
“Other platforms offer GPS tracking, but I haven't said we need it.”

**Expected:** Recognise generic context vs product intent; short acknowledgement **or no message**. Do not add GPS tracking.

**8 — Wednesday, Owner 2 (TR), reaction to tentative summary**  
“‘Şoförler asla indirme yapmayacak’ yazıyorsa, bu yanlış. Ben bazen olabilir dedim.” Mark **Not right**.

**Expected:** Correction attributed to Owner 2; summary disputed/unconfirmed. No AI auto-confirmation; do not delete other reactions. Consultant to decide shared summary wording.

## Reviewer-only follow-up

Run v1.1 Clarity Reviewer privately on the resulting transcript. It should report the **highest-impact unresolved point** (likely who raises/handles a job or the unloading exception depending on actual conversation), notice any **leading or unnecessary interviewer questions**, recommend the next move **in the target owner's language**, and allow **“No intervention needed now”** when the consultant has paused questions.

## Scoring

Record each turn in `test-run-template.md`: question value, evidence fidelity, owner attribution, pacing, language/trust and whether public drafts went to approval only. Include at least one example where the AI *appropriately chose not to ask*.

**Pass ≠ production-ready:** Multi-user security, authentic identities, permission checks, audit log, notifications and translations require implementation tests before real owners join.
