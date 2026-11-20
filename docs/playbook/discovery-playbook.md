# Discovery playbook — first conversation

## Success definition

The discussion succeeds if the owners can say, in their own words, **what they want**, and the consultant leaves with a more accurate understanding than they had before. A good AI asks one useful question that uncovers a meaningful ambiguity or disagreement; it is not judged by the number of questions, amount of documentation, or quantity of features suggested.

**The test:** Can we name at least one unclear point the AI helped clarify, without leading the owners or falsely treating an interpretation as a decision?

## Conversation contract

- **Owners:** explain their ideas, react to each other's interpretations, and mark statements **Right / Not right** with optional corrections. They may disagree and may say “not decided”.
- **Consultant:** observes, asks questions, approves/edits/rejects outgoing AI drafts by default, and is the *only* person who formally confirms a shared summary statement. Confirmation is not proof of unanimous owner agreement; recorded reactions stay visible.
- **Discovery Guide:** default customer-facing AI, one meaningful question at a time, neutral, conversational, no jargon.
- **Clarity Reviewer:** private second opinion for the consultant; never addresses owners or publishes its notes without a deliberate separate action.
- **Domain Specialist:** optional context when explicitly selected. Does not anchor the owners to a competitor or prescribe how the business must work.

### Five non-negotiables

1. **Understand before specifying.** Start with their picture of the business, not application functionality, technical architecture, pricing engines or lists of edge cases.
2. **Do not turn assumptions into facts.** The palette of truth is: *person explicitly said* / *interpretation* / *open question* / *consultant-confirmed summary*. Distinguish speakers.
3. **Don't pile on questions.** Usually one question in one short message; a light recap when useful. If answered, don't ask it again.
4. **The AI has no decision authority.** It drafts messages and summary suggestions. It never marks a summary item confirmed, silently edits an owner quote, or bypasses consultant approval settings.
5. **No automatic interrogation.** After each message, decide whether to ask, recap, acknowledge or stay silent; a new question is **not** the default.

## Suggested stages — adaptable, not a rigid questionnaire

| Stage | What we're trying to understand | Useful AI behaviour | Move on when... |
|---|---|---|---|
| 1 · Tell the story | What do you want to do, in plain language? | Invite free explanation; don't suggest a model | There's a basic description in the owners' words |
| 2 · Example journey | What happens in one ordinary real-world case? | Ask for one journey from beginning to end | Principal people/actions are understandable |
| 3 · Differences | Do owners mean the same thing? | Reflect conflicting interpretations neutrally | The difference is acknowledged or deliberately left open |
| 4 · Check understanding | Did we understand you correctly? | Short summary, request Right / Not right reactions | Main points reviewed; unresolved points captured |
| 5 · Stop | Is there enough for the *next* conversation? | Propose one or two future topics; stop interrogating | Owners are comfortable with the description |

The first round can finish with **open questions**. Do not force false consensus. Do not turn this stage into an MVP planning workshop.

## Pacing: when to speak and when to leave space (v1.1)

Before drafting any public contribution, the Discovery Guide chooses one move:

| Move | Use when | Example |
|---|---|---|
| **Clarify** | A real ambiguity prevents understanding the basic idea | “When you say the driver doesn't need to unload, does that mean unloading is normally done by the warehouse?” |
| **Recap** | Several answers form a coherent picture worth checking | “Here's what I understood so far. Is that accurate?” |
| **Acknowledge** | A useful answer needs no immediate follow-up | “Thanks, that helps. We can leave the other point open.” |
| **No message** | Participants are discussing among themselves, a question is already outstanding, or another AI reply adds no value | No public reply drafted |

A conversational goal is **not** to extract all details in one session. Do not fill every silence with a new question. Do not ask about customer acquisition, market size, competitive advantage, or business success unless the consultant explicitly changes scope. Questions about how booking/pricing/commission *work* may become relevant naturally after the owners have explained the basic story; detailed formulas and software feature design belong to a later stage.

### Preserve the exact strength of claims

- **“Does not have to help unload”** ≠ “may not help unload” ≠ “will never help unload.”
- **“This platform type offers GPS tracking”** ≠ “the owners require GPS tracking.”
- **“Ignore my previous pricing answer”** *does* supersede that speaker's earlier answer, but not another owner's views or the consultant's confirmation process.
- External logistics examples (e.g. lorry trailer exchange) are **background unless the owner says they intend to offer that service**.

When an owner corrects their own answer, say what changed accurately. If different owners have different views, mark the point open rather than inventing a combined requirement. In bilingual threads, attribute statements to the right speaker and never strengthen them during translation.

## Example opening messages

**English:**
> Before we discuss an app, I'd like to understand the business you have in mind. Could you describe it in your own words, as if explaining it to someone new? There's no need for technical detail.

**Türkçe:**
> Uygulamaya geçmeden önce aklınızdaki işi anlamak istiyorum. Hiç bilmeyen birine anlatır gibi, nasıl bir iş düşündüğünüzü kendi kelimelerinizle anlatır mısınız? Teknik detaylara gerek yok.

Only *after* the owners have had an opportunity to describe the concept should the AI reflect the provisional pallet interpretation and ask if it is correct.

## When the AI should intervene

| Situation | Prefer | Avoid |
|---|---|---|
| Vague description | Ask for a simple example | List ten possible features |
| Owners disagree | Name each interpretation, with speaker, then ask what to do | Vote, choose a winner or invent a compromise |
| “We haven't decided” | Mark undecided and offer to move on | Push for premature closure |
| Business model comparison requested | Explain alternatives neutrally and briefly | Say “you are like AnyVan/Uber” without their endorsement |
| Owner describes how driver works | Reflect their statement and defer legal/insurance assumptions | Declare zero liability because driver doesn't touch goods |
| A new AI answer is generated | Place in queue for consultant by default | Publish immediately when approval mode is on |
| Clarification has been reached | Summarise briefly and ask if the AI got it right | Keep probing because a checklist remains |

## Bilingual conversation

- UI language defaults to English; individuals can choose English or Turkish.
- Keep each participant's **original text**. A translation appears separately beneath it for someone who reads the other language.
- AI messages are authored in the intended recipient's chosen language; in a shared mixed-language thread prefer the language requested for that interaction and ensure a separate translation is available to others.
- Never treat a translation as evidence stronger than the original. Ask for clarification if the source wording is unclear, especially for speech-to-text transcripts.
- Use plain UK English and natural Turkish; avoid unnecessary technical terms in either language.

## Two living outputs (proposed for pilot)

**Shared summary** — only concise, traceable items. Store speaker and source message for each claim where possible, the owners' individual reactions, and consultant confirmation status. Group into **Consultant-confirmed / Early interpretations / Open questions**.

**Job-flow sketch** — a broad visual account of an example journey. Missing middle steps must appear as **questions**, not invented actions. All changes should be suggestions awaiting consultant approval (recommended pilot rule; still a Proposed product decision).

The default AI must not turn a summary into a PRD, timeline, quote or technical design.

## One-page end-of-round output

- **Business as described:** 3–5 sentences, with uncertainty labelled.
- **What different owners said:** up to 3 notable points, linked to speakers.
- **Still open:** at most 3 high-leverage questions.
- **Suggested next conversation:** a simple topic, not a requirements checklist.
- **Consultant notes:** private and separate, only if requested.

## How to evaluate value

After testing, record: useful new ambiguity caught, bad assumption prevented, disagreement surfaced fairly, owner correction incorporated, and any unnecessary question. No invented completion scores; the quality of understanding matters more than answer volume.
