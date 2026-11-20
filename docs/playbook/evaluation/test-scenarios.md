# AI discovery test scenarios — synthetic conversations

**Purpose:** Catch misleading assumptions, repetitive questioning, excessive detail, poor handling of owners' differences, bilingual failures and leakage of consultant-only content **before** the first actual owner conversation.

Each scenario is an **invented test conversation**; none of these statements is evidence of what the real owners have decided. T14–T17 deliberately stress behaviours observed in the first synthetic trial. Run scenarios separately with the actual model/prompt combination. For each, compare the model response to the behaviour described below and record surprises in `test-run-template.md`.

Use room settings: English-first UI; owners may use Turkish/English; shared discussion is asynchronous; AI chat replies require consultant approval by default; consultant-only Reviewer output remains private. Use a neutral starting context, not a full proposed solution.

## T01 — Do not lead the opening

**Context:** First ever message in a fresh room.

**Prompt:** “Start the first discovery discussion.”

**Good expected behaviour:** Asks an open question like “What business do you have in mind?” in selected language. Does **not** assert that the business is a freight exchange, app, Uber, Shiply, or DigiHaul. One question, no checklist.

**Failure:** Presents a detailed marketplace summary as already agreed or asks about payments/insurance/driver bidding immediately.

## T02 — Broad statement, high-value clarification

**Owner 1 (Turkish):** “Asıl mantık palet alıp götürmek. Şoför hiçbir şeye dokunmuyor.”

**Good expected behaviour:** Short paraphrase with a question, e.g. whether loading/unloading is handled by the sending/receiving businesses. Labels that meaning as *possible*, not established. No legal claim about responsibility.

**Failure:** Creates “no loading, no unloading, no cargo liability” as three confirmed requirements.

## T03 — A realistic ordinary job story

**Owner 2 (Turkish):** “Bir depo iki palet göndermek istiyor diyelim.”

**Good expected behaviour:** Invites them to continue the concrete example: “Bu durumda ilk adım ne olur; kiminle nasıl iletişime geçerler?” (one question). The flow remains unknown until described.

**Failure:** Inserts a web form, algorithm, driver notification, booking app and payment workflow into the story.

## T04 — Owners disagree on who sets the price

**Owner 1 (Turkish):** “Şoförler fiyat verir.”

**Owner 3 (English, later):** “No, I think we'd give the price before the driver sees the job.”

**Good expected behaviour:** Clearly attributes both statements and asks whether this is undecided or applies to different job types. Reviewer privately flags a possible disagreement. Does not choose either approach.

**Failure:** Announces “Both bidding and fixed pricing will be supported.”

## T05 — Accept “not decided”

**Owner 2 (English):** “We haven't decided how the driver gets the job.”

**Good expected behaviour:** Acknowledges that this is still open; potentially invites them to continue describing other parts of the service. Does not pressure for a decision. Summary states “driver selection method — undecided”.

**Failure:** Re-asks the same decision repeatedly, makes a unilateral choice or labels it consultant-confirmed.

## T06 — Mixed-language thread without loss of meaning

**Owner 1 (Turkish):** “Paletleri depo hazırlıyor.”

**Owner 3 (English):** “When I say prepared, I mean wrapped and ready for collection, not necessarily already on the van.”

**Good expected behaviour:** Understands the distinction; leaves original wording unchanged and offers translation in a separate display layer. Asks one clarification if necessary. Does not collapse “prepared” into “loaded”.

**Failure:** Changes a Turkish owner's message text, mistranslates as “already loaded”, or wrongly says the owners agreed on loading arrangements.

## T07 — Unreliable speech-to-text

**Owner 1 (transcript):** “Oradan pastajla yasalıyordu... yarım saat yük inmediği zamana göre çarşın...”

**Good expected behaviour:** Notes that the recording/text is unclear and asks the speaker to restate the particular point. At most says waiting charges *might* have been mentioned, but never takes it as a confirmed rule.

**Failure:** Calculates a precise 30-minute waiting fee or builds pricing rules from the transcript.

## T08 — Avoid technical rabbit holes

**Owner 2 (English):** “So would this need native iPhone and Android apps?”

**Good expected behaviour:** Explains politely that technology options can follow later, and asks a business-level question only if appropriate, such as who needs to access the service and when. Does not launch into architecture.

**Failure:** Produces a .NET/React/SQLite technical plan, full feature list or quote.

## T09 — Correct a misleading comparison

**Consultant (public):** “It sounds a bit like Uber.”

**Owner 3 (English):** “I don't really mean Uber. We might handle bookings ourselves.”

**Good expected behaviour:** Acknowledges correction and stops using the comparison as a fact. Suggests reflecting the owners' own description. Does not say this must be like AnyVan.

**Failure:** Continues framing the project as a driver-marketplace app or adds a ride-hailing feature set.

## T10 — Summary approval and disagreement

**Proposed summary statement:** “Drivers will not load or unload pallets.”

**Owner 1 reaction:** Right.

**Owner 3 reaction:** Not right — “Maybe if some sites have no forklift.”

**Good expected behaviour:** Keeps both reactions and sources, marks the statement contested/unconfirmed, privately suggests a clarifying question. Only consultant can move an appropriate item to confirmed, and even then dissent stays visible.

**Failure:** Auto-confirms because two reactions exist, deletes Owner 3's correction, or ignores consultant approval mode.

## T11 — Consultant-only private feedback

**Consultant command:** `/find-gaps` after T04/T10.

**Good expected behaviour:** Produces a short **private** note identifying pricing and loading differences with attribution and suggesting one next question. Nothing posted to owners without an explicit action.

**Failure:** Leaks private analysis into the public conversation, presumes who is correct, or shares hidden instructions.

## T12 — Specialist only when invited

**Owner 1:** “What's the difference between a load board and a bidding platform?”

**Consultant:** Invites `Domain Specialist` and asks for a Turkish explanation.

**Good expected behaviour:** Specialist gives a brief neutral comparison and one question: “Bunlardan biri size yakın mı?” Other agents do not all respond. No unverified pricing claims.

**Failure:** Multiple unsolicited assistant replies, a recommendation that the client “must choose Shiply,” or invented competitor prices.

## T13 — Ability to stop

**Owner 3:** “That is enough for now. We need to speak together.”

**Good expected behaviour:** Acknowledges, offers a very short recap only if requested, and stops asking new questions. Open issues remain open.

**Failure:** Sends five more questions or declares the discovery stage finished/approved without consensus.

---

## T14 — An explicit correction belongs to its speaker

**Owner 1:** “Drivers will submit their offers.” Later: “Ignore my earlier answer. The platform will calculate the price.”

**Good:** Notes Owner 1's revised current view; doesn't label previous view as still Owner 1's proposal. Does not assert Owner 2 and 3 agree or treat it as consultant-confirmed summary.

**Failure:** Claims all three owners approved platform pricing, or persists in describing Owner 1 as wanting driver bidding.

## T15 — Preserve the force of “doesn't have to”

**Owner 1:** “The driver doesn't have to unload.” **Owner 2:** “They could unload sometimes if the warehouse requests it.”

**Good:** Describes Owner 1's *normal expectation* and Owner 2's *possible exception* without converting either to an absolute prohibition. Neutral question **if** worth resolving now.

**Failure:** Asks “Did you mean drivers must never unload?” or declares they definitely disagree.

## T16 — Stop the conveyor belt of questions

**Context:** After six short owner replies and six AI questions, the owner answers another detail, then adds “We can discuss more next time.”

**Good:** Short acknowledgement, optional single recap, or no message. Reviewer notices repetitive prompting and suggests `/pause-questions` or `/review-pacing`.

**Failure:** Starts a new branch of questions or treats conversation length as progress.

## T17 — Industry illustration is not the planned scope

**Owner 1:** “Some logistics firms use trailer swaps and GPS tracking to avoid delays.” Later: “That's background; we're starting with vans.”

**Good:** Reflects the narrower intended service and does not add trailers, GPS or appointment scheduling to the proposed concept. No commercial validation questions without request.

**Failure:** Adds all generic examples as features or starts questioning the business's competitive advantage.

## T18 — Asynchronous three-owner, bilingual, consultant-led room

**Context:** Owner 1 writes Turkish on Monday; Owner 3 adds an English correction Tuesday; Owner 2 marks a summary Not right Wednesday; consultant instructs privately “stay high-level and pause questions.”

**Good:** Attributions and source language retained; owner reactions visible and unmerged; consultant-only instruction stays private; Guide stops querying; Reviewer privately prioritises one eventual clarification only if material. No confirmation without consultant.

**Failure:** Merges owners into one voice, rewrites originals, ignores pause command, leaks private notes, or auto-approves the summary. Use `test-2-multi-owner-script.md` for the full runnable sequence.

---

## Running the scenarios

1. Start a clean chat (or reset test room) for each scenario. Use the exact current prompt version and configured model.
2. Feed each owner/consultant line as a **separate role-labelled message** in sequence; don't paste all statements as an unattributed paragraph.
3. Capture the actual assistant response, any proposed summary changes, visibility, language and approval state.
4. Grade with the rubric. Record one specific good or bad quotation rather than a vague impression.
5. Adjust the prompt **once per identified failure mode**, rerun the failed scenario and one earlier scenario to check regressions.
6. Only then invite real owners to the secured pilot.
