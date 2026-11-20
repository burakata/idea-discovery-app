# Idea Discovery Rooms — Phase 1 Implementation Plan

**Extract from PRD v0.1, 19 November 2026.** See full PRD for acceptance criteria and status of decisions.

## 11. Implementation plan and milestones

### Milestone 0 — Lock the implementation baseline

- Create a repository with the current React prototype as design reference, PRD, Playbook v1.1 and decisions register.
- Decide provisional hosting, AI provider, email sign-in service and retention policy.
- Define key flows as acceptance tests before building UI polish.
- **Exit:** developer can describe first secure pilot and its P0 tests; open questions logged, not guessed.

### Milestone 1 — Real collaborative foundation (**first runnable private pilot**)

- Supported React/TypeScript app and ASP.NET Core API, users, projects and membership.
- Secure email invitations and sign-in; generic project setup with project-specific description.
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
- Private agent task/activity log; consultant facilitator controls.
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

