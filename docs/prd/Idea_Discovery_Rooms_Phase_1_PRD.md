# Idea Discovery Rooms
## Phase 1 Product Requirements Document & Future Roadmap

**Version:** 0.6 — Scope baseline, with the v1 brief carried over, the Milestone 0 decisions recorded and the home page and project content settled  
**Prepared:** 19 November 2026; updated 20 November 2026  
**Status:** Planning document; not a development contract or an approved technical architecture  
**Product owner / initial consultant:** Private-tool owner  
**First pilot:** A pallet-transport business-idea discussion (project-specific content, not part of the generic app)

> **Central product principle:** The AI helps people explain and check their meaning. It must not decide what their business should be, turn assumptions into requirements, or keep asking questions simply to keep the conversation going.

## 1. Executive summary

**Idea Discovery Rooms** is a private, reusable web application for a consultant and invited business stakeholders to explore an early-stage idea. Participants can join one shared discussion at different times. A selective AI Lead asks useful, non-leading questions, occasionally summarises and, when requested, consults specialist AI assistants. The consultant controls publication and formal confirmation.

The application starts with a **generic dashboard**. Each project has its own name, introduction, optional images, reference businesses, participants, instructions, conversations and outputs. The pallet-transport use case is one configured project; its provisional assumptions must never become global application defaults.

### Problem

Understanding a customer's business idea currently means back-and-forth emails or sending a document and waiting for feedback. The owners are busy, non-technical, and rarely free at the same time as the consultant.

### Purpose and limits

- Collect business requirements: what the business is, who it serves, how a job runs from start to finish, how money is made, what matters first.
- Not for technical details. Not for deep detail at this stage.
- Not for judging whether the idea will succeed. No analysis, scoring or pricing of the idea.
- Separate from the business app the owners eventually want built.
- The app runs alongside a printed feedback document and face-to-face conversations. It does not replace them.

### The first private pilot must prove three things

1. **Real collaboration:** invited people can safely read, contribute and return to the same persistent conversation from different devices.
2. **Better understanding:** the AI notices a significant ambiguity or disagreement and proposes a useful, neutral next move without frustrating participants.
3. **Trusted outcome:** the consultant can review AI contributions and preserve an accurate, attributable summary for the next conversation.

The app is **not** the clients' business software, a marketplace, a general project-management suite or an automatic PRD factory in this first stage.

## 2. Decisions and decision status

### 2.1 Confirmed scope — from prior decisions and latest choices

| Area | Phase 1 decision |
|---|---|
| Purpose | Discover and clarify the intended business, not validate commercial success or design its final software yet. |
| Generic product | Neutral default dashboard; project-specific introductions, visual references and AI instructions. No pallet-related global branding. |
| Participants | Variable number of owners/stakeholders plus one consultant; not hardcoded to three. More than one consultant per project is F14. |
| Access | Invitation with a secure, personal sign-in link, sent by email or shared by the consultant; or a request to join that the consultant approves, where nothing of the project is visible before approval. Project membership determines visibility. |
| Timing | Asynchronous: members can join, leave and return without losing messages. |
| Conversation lifecycle | Consultant marks a conversation finished; its discussion and outputs remain saved; subsequent work starts a new conversation in the project. |
| Languages | English-first app with Turkish support; each participant chooses a language; translations display separately from untouched original messages. |
| Lead assistant | Selective and conversational; not obligated to reply to every message; everyone may mention `@Lead`. |
| Specialist assistants | Only consultant may directly invoke specialists; Lead may consult configured specialists privately. |
| AI oversight | Consultant-visible activity record of agent requests, results and follow-up actions. |
| Publication | AI chat replies require consultant approval by default; a per-conversation mode may permit automatic replies. |
| AI toggle | AI replies can be disabled entirely for a conversation and later re-enabled. |
| Questions | Natural conversation; short multiple-choice questions when they genuinely clarify, not a wall of forms. |
| Shared understanding | Owners react **Right / Not right**, with optional explanation; consultant alone formally confirms summary items. |
| Notifications | Email consultant when an approval needs action; notify participants when their response is needed, without spamming all activity. |
| Outputs requested | Short idea summary; confirmed / unconfirmed / disagreements; next-conversation questions; simple business flow diagram; business-model comparison; optional clickable concept prototype. |
| Devices | Phone and desktop are equal priorities. |

### 2.2 Proposed defaults — implement provisionally, but keep visible as proposals

| Proposal | Why | Status |
|---|---|---|
| One active conversation per project by default | Prevent ambiguous current context; completed conversations remain readable. | Proposed |
| Summary, flow and other *shared* output revisions always require consultant approval, even when AI chat is automatic | Prevent false consensus. | Proposed, strongly recommended |
| Owners can see previous finished discussions in projects they can access | Keeps shared context visible. | Proposed |
| Finished conversation is read-only; reopening requires consultant action with an audit entry | Preserve history and a clear handover. | Proposed |
| Private consultant notes and Clarity Reviewer outputs are never owner-visible | Protect thinking space. | Proposed |
| Agent activity displays task inputs/visible outputs, not the model's hidden reasoning | Auditability without false claims about internal thoughts. | Proposed |
| Core agent rules cannot be overridden by per-project custom instructions | Maintain privacy and truthfulness. | Proposed |
| Initial stack: React + ASP.NET Core + SQLite + server-side configurable AI provider | Familiar, pragmatic; not yet architecture-approved. | Proposed |

### 2.3 Still to decide before production deployment

- How often backups run and where they are kept. (Hosting decided on 20 November 2026: a small paid Hetzner cloud server in Germany running Docker, at a subdomain of the consultant's own domain, and the Claude API behind a swappable server-side provider adapter. See `docs/decisions.md`.)
- Invitation expiry, account recovery and whether strong sign-in is mandatory for every return visit. (Decided on 20 November 2026: sign-in by the app's own one-time, expiring email links, sent through Resend's free tier behind a configurable adapter.)
- Export policy, owner privacy notice wording and any required data-processing terms. (Retention decided on 20 November 2026: kept until the consultant deletes the project or an owner asks for deletion; backups roll off after 30 days.)
- Whether paper feedback enters the room as attributed consultant transcription or stays as a linked reference document.
- Exact notification channels and opt-out/digest settings; initial email approach is agreed, delivery rules remain to specify.
- What triggers a specialist automatically and whether the Lead needs explicit consultant approval before invoking a costlier specialist.
- Level of initial support for generated clickable concept prototypes (template-only vs AI-generated interface).

**Interpretation rule:** A feature marked *proposed* is not silently promoted to *decided* merely because it appears in this PRD.

## 3. Users and access

| Role | Can do | Cannot do |
|---|---|---|
| **Consultant / room owner** | Create projects, invite members, view discussions, contribute, configure agents, manage approval queue, privately consult specialists, confirm outputs, finish conversations. | Bypass audit or access unrelated projects without membership. |
| **Invited participant / stakeholder** | Read the project's permitted history, reply at any time, invoke `@Lead`, answer AI questions, react Right / Not right to shared statements. | See consultant-private notes/activity; publish specialist responses; confirm shared summaries; change room settings. |
| **Lead AI** | Suggest a short question, recap, acknowledgement, no reply, MCQ or summary draft; privately consult approved specialists. | Confirm facts, expose private notes, publish in review mode without approval. |
| **Specialist AI** | Return focused private findings or draft material when consultant invokes it or Lead is allowed to consult it. | Interrupt the customer discussion automatically or declare customer choices. |

Access is enforced on the server, not by hiding UI elements alone. Each person's language and notification preferences belong to their account, not to the project.

## 4. Information and conversation structure

![Generic project, conversation and output structure](assets/project_conversation_structure.svg)

### 4.1 Project

A project stores its **title, short purpose, cover/visual materials, provisional background, reference examples, members, language options, agent configurations and versions of project-specific instructions**. Project material may be explicitly labelled `reference`, `provisional`, `owner-confirmed` or `consultant-confirmed`. No project material automatically becomes an agreed requirement.

### 4.2 Conversation

A conversation has a title, sequence number, participants, state (`Active`, `Finished`, and optionally `Reopened`), timestamps, chat, questions, replies, related agent activity and generated outputs. A simple non-numeric progress label can be `Understanding the idea`, `Checking understanding` or `Ready for next conversation`; this is a navigation aid, not an AI-generated completion score. People can return to the **same active conversation** on later days. The consultant may finish it; the next discussion is a **new conversation**, with approved project knowledge available as context rather than copying every old message into the public chat.

### 4.3 Shared knowledge

A project-level knowledge area stores approved summaries and links to prior conversations. It must distinguish who said something, the status of the interpretation and any dissent. The system must never describe silence as agreement or combine different owners' preferences into one invented decision.

### 4.4 What owners see

**Before a room: the home page.**
- Someone who is not signed in sees a neutral page:
  - the app's name;
  - one or two sentences on what it is for;
  - an email field to request a sign-in link;
  - a note that signing in needs the consultant's invitation;
  - the EN | TR switch.

  It shows no project names and nothing about any client.
- A signed-in owner sees the list of the projects they are a member of, even when there is only one, and opens a room from there.
- The consultant sees all projects and can create one.

Each project room has three sections for owners: **The idea**, **Discussion** and **Shared summary**.

- **The idea:** a welcoming page for the project:
  - a short introduction to what the conversation is for;
  - a simple job-flow diagram, drawn from a list of steps, with unknown steps shown as questions (see `docs/design.md`);
  - what we understand so far, clearly marked as needing confirmation;
  - similar businesses, as reference examples only;
  - a link to the printable version;
  - a prominent "Join discussion" button.

  Where the idea page's content comes from:

  | Content | Source | Milestone |
  |---|---|---|
  | Title and introduction | Entered by the consultant when creating the project, in both languages | M1 |
  | Page headings and the fixed "what this is for / what we are not doing yet" text | The app's own text, the same for every project | M1 |
  | Illustration | A generic illustration, the same for every project. The consultant can upload an image per project instead (PNG, JPEG or WebP, with a size limit, shown only to members) | Generic: M1. Upload: M1, before deployment |
  | Job flow, current understanding and open questions | AI drafts (Visual Mapper, Lead) and consultant entries, published only after the consultant approves (R13, R19, R27) | M3 |
  | Similar businesses | Drafted by the AI on the consultant's request, with sources, published after approval (R20) | M3 |
  | Print version | Generated from the idea page and the shared summary, in the reader's language, so it is always current. The link is hidden until then (R22) | M3 |

  Until its content exists, each section shows a plain "nothing here yet" state.
- **Discussion:** the project's active conversation (§4.2). Each message shows the writer's name and role (Business owner, Software consultant, AI assistant). The assistant asks one question at a time. After an owner sends a message, a quiet line tells them a reply will follow.
- **Shared summary:** three groups: Confirmed, Early interpretations, Open questions (§4.3). On each early interpretation an owner can tap "Right" or "Not right" and add a correction. Everyone sees who reacted and how.

## 5. Phase 1 functional requirements

**Priority legend:** **P0** = essential for first secure pilot; **P1** = planned within Phase 1, after the P0 pilot works; **P2** = future roadmap, not a Phase 1 commitment.

| ID | Feature | Priority | Acceptance criterion |
|---|---|---|---|
| R01 | Generic project dashboard | P0 | New user sees generic projects; no default pallet branding. Consultant can create project with title, description and optional visual/reference content. |
| R02 | Secure invitations and membership | P0 | Consultant invites a named person; they sign in through a one-time, expiring link sent by email or copied by the consultant and shared by hand, and can access only projects of which they are a member. Invite can expire or be revoked. The consultant can remove a member: their access and sessions end at once, the removal is audited, their earlier messages stay under their name marked as no longer in the project, and they can be invited again. Where the consultant allows it for a project, a person may ask to join from the project link; they see nothing of the project until the consultant approves. |
| R03 | Multi-person asynchronous chat | P0 | Two people on separate browsers/devices can exchange persisted messages without sharing local storage; author and timestamps display correctly. |
| R04 | Participant count and rejoining | P0 | No fixed number of owners; a participant can return tomorrow to the same active conversation and read missed messages. |
| R05 | Finish and start next conversation | P0 | Only consultant finishes; finished history and output links remain; new conversation is distinct from the finished one. |
| R06 | AI modes: Off / Review / Automatic | P0 | Off sends no unsolicited public AI replies; Review queues drafted replies; Automatic publishes selective replies. Mode changes are authorised and logged. |
| R07 | Lead AI selective conversation | P0 | Lead can ask one question, recap, acknowledge or make no reply; does not force a reply to every message. |
| R08 | `@Lead` mention | P0 | Any member can call the Lead by mention; reply follows the room's current AI mode and authorisation rules. |
| R09 | Consultant AI approval queue | P0 | Consultant can review/edit/approve/reject a draft; owners cannot see unapproved drafts. Publication history is attributable. |
| R10 | Original language + translation | P0 | Messages retain exact original text; readers can view a separate English/Turkish translation without replacing original wording. |
| R11 | Configurable project instructions | P0 | Consultant can supply project-specific context at room/invitation setup; core safety and confirmation rules stay in force. |
| R12 | Owner reactions to summary items | P1 | Each owner marks Right / Not right with optional correction; reactions remain attributable and are not collapsed into unanimity. |
| R13 | Consultant summary confirmation | P1 | Only consultant can mark a statement confirmed; a correction or dissent remains visible. |
| R14 | Multiple predefined agents | P1 | Lead, Clarity Reviewer, Domain Specialist, Summary Editor and Visual Mapper have distinct roles and access rules. |
| R15 | Private multi-agent activity log | P1 | Consultant sees specialist invoked, purpose, supplied context/sources, returned result, timestamps and visibility; owner cannot access it. |
| R16 | Multi-choice AI questions | P1 | AI can present 2–5 concise options when helpful, with Other / Not decided and optional free text; responses belong to the discussion. |
| R17 | Facilitator controls | P1 | Consultant can Clarify, Real example, Find gaps, Check agreement, Summarise, Stay high-level, Pause, Correct and Review pacing. |
| R18 | Short idea summaries / next questions | P1 | Consultant can request draft and approve/version it; clearly separates said, inferred and open. |
| R19 | Simple editable flow diagram | P1 | Diagram labels unsupported steps as unknown; published revisions require approval. |
| R20 | Business-model comparison output | P1 | Requested on demand, neutral and sourced; not used to impose a competitor's model on the client. |
| R21 | Email notifications | P1 | Consultant gets actionable approval alert; owner gets action-needed alert; avoid an email for every activity. |
| R22 | Output persistence and export | P1 | Summaries, diagrams, comparison tables and their versions remain linked to the conversation; consultant can export a readable file. |
| R23 | Optional concept prototype | P1 (late / experimental) | Only consultant explicitly requests a draft clickable concept; it is labelled illustrative/unconfirmed and never generated automatically. |
| R24 | Mobile / desktop usability | P0 | Critical tasks—sign in, read, answer, approve (consultant)—work on phone and desktop without horizontal scrolling. |
| R25 | Simple progress and action-needed status | P1 | Room shows a plain-language stage and whether a human reply or consultant approval is pending; no invented percentage-complete score. |
| R26 | Consultant-private notes | P1 (proposed) | Consultant may save notes separate from shared discussion; owners never see them, and the AI cannot quote them to owners. |
| R27 | Consultant-added statements | P1 | Consultant can add statements and open questions to the shared summary, including answers given on paper or in person; the source is recorded. |

### 5.1 AI response and approval behaviour

![AI response and approval modes](assets/ai_publication_flow.svg)

- **Off:** no AI-generated public messages. Human members continue posting normally. Consultant-only analysis may remain separately available if enabled in private settings (proposed distinction).
- **Review (default):** Lead creates a draft, optionally consults a specialist, and waits for consultant approval. Consultant may edit or reject; owner never sees draft.
- **Automatic:** Lead may post selectively, not after every human message. Shared summary, diagrams and other shared outputs **still** require consultant approval under the recommended pilot rule.
- **Pending question rule:** if an earlier question awaits an answer, default to no new question rather than sending another prompt.
- **Stale draft rule:** if conversation changes while a draft is waiting, show a warning and permit regeneration or informed approval.

### 5.2 Multiple choice without interrogation

The AI uses a short MCQ only when it would materially simplify a real choice. Default is a natural free-text question. A good MCQ includes an opportunity to say **Something else** or **Not decided**. The reply can include explanation, and it is stored as the participant's response—not an automatically confirmed project decision.

### 5.3 Agent roles and routing

| Agent | Trigger | Audience | Expected output |
|---|---|---|---|
| **Lead / Discovery Guide** | Selective response, `@Lead`, consultant instruction | Shared chat (subject to mode) | One relevant question, simple MCQ, recap, acknowledgement or no message. |
| **Clarity Reviewer** | Consultant request; Lead internal consult if configured | Consultant only | One high-value ambiguity, possible disagreement or pacing problem with source references; proposed next question. |
| **Domain Specialist** | Consultant request; private Lead consult | Consultant by default | Plain-language background; distinguishes external example from client intent. |
| **Summary Editor** | Consultant request / conversation-end proposal | Draft review queue | Traceable concise summary, status of claims, 1–3 questions for next conversation. |
| **Visual Mapper** | Consultant request when enough facts exist | Draft review queue | Small, readable business journey diagram marking unknown connections as unknown. On the consultant's request, also a simple line illustration (SVG) for the project's idea page, cleaned of any scripts on the server and published only after approval. |

**The consultant's private assistant.** Each project has a private chat between the consultant and the AI, separate from the shared discussion. The assistant knows the project's context and the shared discussion, and can call the specialists above. Owners never see this chat; the server enforces it. Anything it proposes for owners to see (the idea page, the summary, the job flow, an illustration) goes through the consultant's approval. Built in Milestone 3, with the specialists.

A **Prototype Designer** may be a later optional specialist for consultant-requested concept prototypes. There is one default public Lead—not five agents talking at the owners. The consultant may view the specialists' **visible task requests and outputs**, but not hidden chain-of-thought or inaccessible model internals.

### 5.4 AI facilitator controls

Retain the ten controls from **AI Discovery Playbook v1.1**: `/clarify`, `/real-example`, `/find-gaps`, `/check-agreement`, `/summarise`, `/stay-high-level`, `/pause-questions`, `/call-specialist`, `/correct`, and `/review-pacing`. Controls are consultant-only; the app must not send owner-facing content until it passes the current approval mode.

### 5.5 Bilingual requirements

- English is the initial default UI language; Turkish is selectable per participant and remembered.
- Both original messages and translated text appear, visibly distinguished. AI must not strengthen an English/Turkish statement during translation.
- AI messages are translated where needed for readers of the other language.
- Natural Turkish and British English; names, source quotes and uncertainty preserved.
- Agent activity and consultant-only controls can remain English in the pilot (proposed default).

## 6. Required discovery outputs

| Output | Contents | Trigger | Approval / storage |
|---|---|---|---|
| **Idea snapshot** | Brief description of intended business, explicitly caveated | On request or finishing conversation | Draft → consultant approval → versioned output |
| **Shared understanding** | Explicit owner statements, interpretations, disagreements and open questions, with speakers/source messages | During and at end | Owners react; consultant confirms; versions retained |
| **Next-conversation guide** | One short next topic plus up to three high-value unresolved questions | On finishing or request | Consultant reviews; linked to next conversation |
| **Business journey sketch** | Simple steps from a concrete example; unknown steps shown as questions | When sufficient evidence exists | Consultant approves before sharing |
| **Business-model comparison** | Neutral alternatives/examples and differences, not recommendation or business validation | Consultant request | Clearly attributed as external context; saved on approval |
| **Clickable concept prototype** | Minimal UI demonstration of a possible interaction or service, not functional product scope | **Explicit consultant request only** | Marked exploratory; source assumptions visible; output versioned |

**Output quality rule:** every claim should, where possible, link to the participant's original message or a declared reference. AI interpretation and owner agreement must never be represented as the same thing. A proposed sketch or prototype is not an approved requirement.

## 7. Key end-to-end user journeys

### Journey A — Create and invite

1. Consultant creates an empty generic project and adds optional industry background, images and guidance.
2. Consultant starts Conversation 1 and invites any number of participants by secure email links.
3. Each participant signs in and chooses English or Turkish. They can review the idea page without being steered to one business model.

### Journey B — Discover asynchronously

1. Owner A describes the idea in their own words.
2. Lead decides: **clarify, recap, acknowledge or no reply**. In default mode, any reply goes to consultant queue.
3. Consultant edits/approves the draft, or asks a private specialist for context.
4. Owner B joins later, reads the existing conversation and responds. Owner A can return the next day.
5. At any time, an owner may mention `@Lead` and answer a short MCQ or free-text question.

### Journey C — Check understanding

1. AI proposes concise, source-linked claims and perhaps a simple journey diagram.
2. Owners mark claims Right / Not right with explanations; disagreement remains visible.
3. Consultant formally confirms or leaves open the relevant claims, never claiming unanimous agreement without evidence.

### Journey D — Finish and continue

1. Consultant requests the idea snapshot and the next-conversation questions.
2. Consultant reviews/approves the outputs and marks the conversation **Finished**.
3. Conversation 1 remains available as history and cannot silently change.
4. Consultant starts Conversation 2. The AI can refer to **approved** project knowledge and can consult earlier original messages when relevant, while keeping provenance.

## 8. Acceptance tests and safety gates

| Test | Given | Expected behaviour |
|---|---|---|
| A01 · Cross-device persistence | Two participants sign in on separate devices | Both see the same authorised conversation and new replies. |
| A02 · Variable participation | A project has 1, 3 or 8 owners | No hardcoded owner count; appropriate permissions. |
| A03 · Return later | Owner leaves the browser and returns after a day | History and state persist; no duplicate conversation created. |
| A04 · Conversation finish | Consultant closes Conversation 1 | Messages and outputs remain; Conversation 2 begins separately. |
| A05 · Review mode | Owner writes a message; AI proposes a reply | The owner cannot see the reply until consultant approval. |
| A06 · Off mode | AI mode is Off | No unsolicited public AI answer; chat between humans still works. |
| A07 · Automatic mode | AI is Automatic | Selective public chat replies allowed; shared summary changes are never silently confirmed. |
| A08 · Mention routing | Owner writes `@Lead` | Lead handles mention under current mode; owner cannot summon private Clarity Reviewer. |
| A09 · Specialist privacy | Lead privately consults reviewer | Activity is accessible to consultant, not an owner or unrelated project. |
| A10 · Language fidelity | Turkish owner says “does not have to unload” | Translation does not change meaning to “must never unload”. |
| A11 · Different owner views | Two owners discuss optional unloading | AI labels difference as unconfirmed, asks neutrally and keeps individual reactions. |
| A12 · No endless questions | One question is unanswered | AI can return no message rather than issuing another. |
| A13 · Natural MCQ | AI presents options and owner selects “Not decided” | Response is saved without being treated as a decision. |
| A14 · Output source | Summary item cites an owner statement | Consultant can view supporting original; AI cannot confirm item. |
| A15 · Secure sharing | A link is forwarded to a non-invited person | Access is denied unless that identity is authorised for the project. |
| A16 · Future project | Consultant creates a gardening idea project | No pallet-specific text or agents appear without explicit configuration. |

### Pilot success signals (qualitative)

- At least one ambiguity or disagreement surfaced by AI that materially improves the consultant's understanding.
- Participants report questions are clear and not overwhelming; the AI regularly chooses not to interrupt.
- Consultant can explain every confirmed statement by reference to its source and any recorded objections.
- Every public AI message in review mode has an approval record.
- No cross-project or consultant-private information is exposed to an owner.

### Owner experience success criteria

- An owner opens the link, understands what it is for and what Burak thinks the idea is, without any explanation.
- An owner can correct something Burak got wrong in two taps.
- An owner who prefers Turkish finds the switch without help, and the English-only owner can follow everything written in Turkish.
- It looks like a professional product, on a phone and on a desktop.
- Burak ends up with fewer assumptions than he started with.

## 9. Suggested technical approach (not yet a final decision)

| Layer | Pragmatic proposal | Notes |
|---|---|---|
| Frontend | Supported React + TypeScript | Replace the old offline prototype runtime; reuse design patterns, not its local-only security assumptions. |
| API | ASP.NET Core | Server-side role checks, project isolation, conversation state, draft approval. |
| Persistence | SQLite for small private pilot; migration plan for PostgreSQL if needed | Avoid designing around browser localStorage for production data. |
| Identity / email | Carefully implemented passwordless links (emailed or copied by the consultant), and consultant-approved join requests | Enforce one-time/expiring tokens, consultant approval and authorised membership. |
| AI orchestration | Server-side provider adapter; initially one model plus distinct prompt roles | AI provider configurable; never embed secrets in React bundle. |
| Async work | Background job queue for drafts, translations and notifications | Idempotent processing and error states; no reliance on browser remaining open. |
| Artefacts | Versioned object/file storage + metadata and source references | Generators create **drafts**, not automatically published truths. |
| Audit | Immutable event record for confirmations, publishing, role/setting changes | Private agent activity separated from owner-facing chat. |

### Minimal data model

| Entity | Key fields / relationships |
|---|---|
| User | identity, email, display name, UI language, notification preferences |
| Project | id, title, introduction, visuals, status, default language, project instructions version |
| ProjectMember / Invitation | project id, user/email, role, invite status, expiry, token metadata |
| Conversation | project id, number, title, state, started/finished by/at, AI mode, instruction overrides |
| Message / Translation | conversation id, author type and id, source message id, original text/language, translations, timestamps |
| Question / Option / Response | message id, question mode, ordered options, chosen answers/free text, author |
| AgentDefinition / AgentRun | role, prompt version, visibility, invocation trigger, input references, outcome, timestamps |
| AIDraft / Approval | proposed content, source context, state, approver, edits, decisions, publish event |
| SummaryClaim / Reaction | original source references, claim status, per-owner Right/Not right, consultant confirmation |
| Output / OutputVersion | project + conversation, output type, draft/approved state, artefact path/data, source citations |
| Notification / AuditEvent | recipient, reason, delivery state, actor, action, timestamp |

Design explicit project and conversation scoping into every query. Store raw original messages independently of machine translations. Source references should point to message IDs and never depend on text being copied into prompts without attribution.

## 10. Privacy, security, reliability and accessibility

- **Invitations:** secure identity-bound sign-in, expiry and revoke; never treat an unprotected shared URL as permission to read confidential data.
- **Authorisation:** server-enforced per-project membership, consultant role and private-agent visibility; deny by default.
- **Data controls:** publish a brief privacy notice; define retention, deletion/export and backup policies before real owners submit confidential details.
- **Secrets and AI:** API keys server-side; minimum necessary conversation context sent to the AI provider; log outputs and references but avoid storing sensitive prompts unnecessarily.
- **Audit and provenance:** approvals, summary confirmations, overrides, mode toggles and conversation closure have timestamps and actors.
- **Safe rendering:** sanitise user-supplied text/Markdown, validate attachments and prevent cross-project references in AI tools.
- **Resilience:** temporary AI/email failure must not lose human messages; queued tasks can retry safely without duplicate publication.
- **Accessibility:** legible on phones, keyboard-friendly chat and forms, labelled icons and options, sufficient contrast and meaningful non-image alternatives.

Security, authentication and data-protection obligations are release blockers for inviting real external users, not future nice-to-haves.

## 11. Implementation plan and milestones

### Milestone 0 — Lock the implementation baseline

- Create a repository with the current React prototype as design reference, PRD, Playbook v1.1 and decisions register.
- Decide provisional hosting, AI provider, email sign-in service and retention policy.
- Define key flows as acceptance tests before building UI polish.
- **Exit:** developer can describe first secure pilot and its P0 tests; open questions logged, not guessed.

### Milestone 1 — Real collaborative foundation (**first runnable private pilot**)

- Supported React/TypeScript app and ASP.NET Core API, users, projects and membership.
- Secure email invitations and sign-in; generic project setup with project-specific description.
- The home page and project list (§4.4); removing a member (R02); an optional uploaded image per project.
- Persistent shared messages, translations foundation, device support, join/leave/rejoin.
- Conversation finish/read-only/history/new conversation.
- **Exit:** consultant and one invited participant exchange messages on different devices; access controls and conversation lifecycle pass A01–A04 and A15–A16.

### Milestone 2 — Lead AI, approvals and control

- Integrate real server-side Lead using **Playbook v1.1** with versioned prompts.
- Conversation-level Off / Review / Automatic; default Review.
- `@Lead` mentions, selective response logic and `NO_PUBLIC_REPLY` handling.
- Consultant queue: edit/approve/reject; stale-draft warnings, audited publication.
- **Exit:** A05–A08 and A12 work across browsers; AI never leaks an unapproved draft to owners.

### Milestone 3 — Understanding, specialist oversight and outputs

- Owner reactions, claim provenance, consultant confirmation, approved project summary.
- Clarity Reviewer and Domain Specialist first; Summary Editor and Visual Mapper after that.
- Private agent task/activity log; consultant facilitator controls; the consultant's private assistant chat (§5.3).
- The idea page's job flow, understanding, similar businesses, an AI-drawn illustration on request, and the generated print version (§4.4).
- Draft and approve idea snapshots, diagrams, comparison tables and next-session guide; persistence, simple progress indicators and readable exports.
- Short MCQ component with Other / Not decided.
- **Exit:** A09–A14; one full conversation can produce an approved, attributable output for the next round.

### Milestone 4 — Real pilot hardening and optional prototype output

- Polish bilingual translations, notification preferences/actionable emails, mobile access and error flows.
- Permissions, retention/deletion, operational logs, backups and accessibility QA.
- Pilot with an actual project and owners; evaluate **whether AI added understanding**, not message count.
- Add consultant-triggered exploratory clickable concept prototype generator if time and output reliability allow; otherwise retain it as explicitly planned Phase 1-late scope, not a hidden omission.
- **Exit:** real participants can complete and finish one discovery conversation safely; issues from pilot are tracked.

### Sequencing principle

**Build the first secure human-to-human room before agent orchestration.** Then integrate the Lead and approval flow, and only afterwards broaden the specialist and output capabilities. Do not delay invitation/security work to build visually impressive simulated AI features.

## 12. Future feature register — deliberately retained

These items are **not discarded**. They are tracked so the private tool can evolve into a product without making the first pilot unmanageably large.

| ID | Future capability | Suggested stage | Rationale / condition |
|---|---|---|---|
| F01 | Voice conversations and accurate transcription | Phase 2 | Useful for informal discussions; handle Turkish transcription errors and consent first. |
| F02 | Live shared sessions, presence indicators and video/screen sharing | Phase 2 | Asynchronous collaboration is sufficient initially. |
| F03 | Richer diagram builder (multiple journeys, exceptions, version comparisons) | Phase 2 | Only after basic flow sketches prove useful. |
| F04 | Structured requirements discovery / PRD, user stories and acceptance-criteria generation | Phase 2 | Explicit handoff into a later stage, not automatic in business-idea discovery. |
| F05 | Better concept-prototype generation and revision inside the app | Phase 2 | Expand the Phase 1 exploratory clickable prototype into an editable, reliable design workflow. |
| F06 | Full discussion and all artefact export (PDF, Markdown, DOCX, JSON) | Phase 2 | Portable evidence beyond the Phase 1 readable summary/output export. |
| F07 | Import printed documents, uploaded files, audio and meeting transcripts | Phase 2 | Attribute transcribed material, distinguish original evidence and AI extraction. |
| F08 | Advanced agent orchestration, configurable specialist chains and agent-to-agent coordination rules | Phase 2 | First prove simple Lead → private specialist workflow. |
| F09 | More specialist roles: Prototype Designer, UX Researcher, Legal/Compliance Context, Pricing Context | Phase 2 | Invoked only when relevant to the discovery stage; avoid unsolicited advice. Pricing Context explains how pricing works in the industry; it never prices, scores or judges the idea itself. |
| F10 | Human comments/annotations directly on diagrams and prototypes | Phase 2 | Faster corrections than ordinary chat for visual outputs. |
| F11 | Search across conversations, project memory and semantic retrieval | Phase 2 | Useful once projects contain more history; must respect isolation and provenance. |
| F12 | More notification channels, digests, reminders and calendar scheduling | Phase 2 | Email actionable notifications first; avoid excessive nudges. |
| F13 | Provider choice, model comparison, cost/latency analytics and automated regression tests | Phase 2 | Control quality and spend as agent use grows. |
| F14 | Advanced per-participant roles and multiple consultants within one organisation | Product stage | Requires organisation-based access and governance. |
| F15 | Project templates for logistics, education, retail, healthcare etc. | Product stage | Generic core already supports separate project context. |
| F16 | Self-service onboarding, team workspaces, subscription billing and usage limits | Product stage | Only after the private tool demonstrates customer value. |
| F17 | Multi-tenant SaaS infrastructure, tenant admins, data residency controls and compliance tooling | Product stage | Needed when commercial customers are onboarded at scale. |
| F18 | Integrations (email, calendar, cloud docs, Jira/Linear, design tools, API/webhooks) | Product stage | Based on observed workflows, not speculative connector lists. |
| F19 | Reusable agent/prompt catalogue and marketplace | Product stage | Standardise proven domain modules before packaging. |
| F20 | Aggregate quality metrics and cross-project insights with consent | Product stage | Measure outcomes and privacy-safe product value, not just number of questions. |
| F21 | Native mobile apps | Optional later | Responsive web is the primary experience until usage justifies native capabilities. |
| F22 | Full project-management, estimation and delivery planning modules | Separate later product/stage | Keep initial discovery experience focused; link instead of sprawling. |
| F23 | A queue of pre-approved follow-up questions | Phase 2 | Carried over from the v1 brief's Later list. |
| F24 | Languages other than English and Turkish | Product stage | Carried over from the v1 brief's Later list. |

### Feature admission rules for future work

A future item moves into Phase 1 only when: (a) the pilot reveals a real unmet need, (b) the change has defined acceptance criteria, (c) it does not compromise conversational simplicity, and (d) the consultant explicitly changes scope. Otherwise it stays visible in this register.

## 13. Risk register (product-delivery risks, not clients' business viability)

| Risk | Mitigation |
|---|---|
| AI asks too many questions or leads owners | Playbook v1.1, no-reply option, facilitator controls, pilot transcript evaluation. |
| Unconfirmed statements appear as agreed requirements | Claim status + source messages + consultant confirmation + visible owner reactions. |
| AI's background suggestions leak to client | Server-enforced private activity; approval queue and role tests. |
| Excessive feature scope delays first pilot | P0/P1 separation and explicit future register. |
| Language changes meaning | Preserve originals, show translations separately, test modal wording and corrections. |
| Project-specific context contaminates new projects | Versioned per-project instructions with neutral global defaults and isolation tests. |
| Invitation or data leakage | Identity-bound links, membership checks, audit logs and deletion controls before external pilot. |
| Costs from autonomous specialist calls | Configurable triggers, limits, per-room modes and request/output audit. |

## 14. Definition of Done for the first real pilot

The private pilot is ready when **all** are true:

- [ ] Consultant creates a generic new project and invites at least one external participant securely.
- [ ] Both can communicate asynchronously across devices and rejoin the same active conversation.
- [ ] Consultant finishes a conversation and starts another without losing the previous transcript or approved outputs.
- [ ] Lead AI uses Playbook v1.1 and creates no public response when silence is the better move.
- [ ] `@Lead`, AI Off / Review / Automatic and approval queue function with enforced permissions.
- [ ] English and Turkish users can read original text and separate translations.
- [ ] Owners' Right / Not right feedback and consultant confirmation preserve sources and dissent.
- [ ] At least the idea snapshot, shared understanding and next-conversation questions can be created, reviewed and retained.
- [ ] Consultant can inspect private specialist task results without exposing them to owners.
- [ ] Privacy, access, backup and error-handling checks pass on the deployed environment.
- [ ] Pilot review identifies whether AI surfaced a useful ambiguity or prevented a mistaken assumption.

**Not required for this first pilot:** subscriptions, native apps, complex PRDs, elaborate prototypes, full live-video collaboration or advanced multi-agent autonomy.

## 15. Source materials and change management

This PRD draws on the product choices in the conversation through **19 November 2026**, plus the existing `decisions.md`, the React prototype v2 documentation and the **AI Discovery Playbook v1.1** (`docs/playbook/`). Earlier `Proposed` entries remain proposals unless explicitly confirmed by later choices. The supplied pallet-specific documents inform *one pilot project's context*, not the core product specification.

When an item changes, record: decision date, who confirmed it, the old and new scope, why, affected acceptance tests and whether it moves between P0, P1 and the future backlog. Maintain the PRD and feature register together, rather than keeping future ideas in scattered chats.

### Change log

| Version | Date | Confirmed by | Change | Why | Acceptance tests | Priority moves |
|---|---|---|---|---|---|---|
| 0.2 | 20 November 2026 | Burak | This PRD replaces the v1 brief (`docs/brief.md`, now kept as `docs/archive/brief-v1.md`) as the single source of scope. Carried over from the brief: the problem, purpose and limits (including working alongside paper and meetings, and no analysis, scoring or pricing of the idea), §4.4 What owners see, the owner experience success criteria in §8, R27, F23, F24 and the note on F09. Brief items this PRD reverses are superseded; see `docs/decisions.md`. | One scope source instead of two that disagree, without losing the brief's owner-experience criteria. | None changed. The owner experience success criteria are added to §8. | R27 added as P1. F23 and F24 added to the future feature register. |
| 0.3 | 20 November 2026 | Burak | §2.1: Phase 1 has one (human) consultant; more consultants per project stay in F14. §2.3: hosting (small Linux VPS with Docker), AI provider (Claude API behind a swappable adapter), sign-in (the app's own one-time email links; a no-link sign-in only in demo or local configurations) and retention decided. §9: the prototype client evolves into the real client, keeping a demo configuration that is off in real deployments. The AI Discovery Playbook v1.1 is added at `docs/playbook/`. Details in `docs/decisions.md`. | §2.1 contradicted F14; Milestone 0 asks for these provisional choices. | None changed. | None. |
| 0.4 | 20 November 2026 | Burak | §2.3: hosting provider (Hetzner, Germany), domain (a subdomain of the consultant's own) and budget (a small monthly cost) decided, and the email service (Resend's free tier behind a configurable adapter). | Milestone 0's last open choices. | None changed. | None. |
| 0.5 | 20 November 2026 | Burak | §2.1 Access, R02 and §9 Identity: besides the emailed link, the consultant can copy a person's one-time sign-in link and share it by hand (e.g. WhatsApp), and, where a project allows it, a person can ask to join from the project link and the consultant approves. Nothing of the project is shown before approval. | Simpler ways for owners to join, without weakening the rule that a shared link alone never opens confidential content. | A15 unchanged: a forwarded project link shows only the ask-to-join page, and an unapproved request reads nothing. | None (R02 stays P0). |
| 0.6 | 20 November 2026 | Burak | §4.4: the home page (neutral when signed out; owners always see their project list) and where each part of the idea page comes from, by milestone. R02: the consultant can remove a member; earlier messages stay, marked. §5.3: the consultant's private assistant chat per project (M3), and the Visual Mapper can draw a project illustration on request (M3). §11: M1 and M3 list these. | How the real app looks on first use and how a new project's idea page is filled were not written down; the prototype's hand-written pallet page hid the question. | None changed. A15 also covers the signed-out home page; removing a member gets its own API tests in M1. | Uploaded project images (part of R01, P0) are scheduled in M1. The private assistant and the AI-drawn illustration are added as P1 in M3. |
