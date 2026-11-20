# Decisions log

Add a row whenever something is decided. Newest at the bottom.
Status: **Decided** (Burak confirmed), **Proposed** (suggestion, not yet
confirmed) or **Superseded** (replaced; the row says by what).

Since 2026-11-20 the PRD (`docs/prd/Idea_Discovery_Rooms_Phase_1_PRD.md`) is
the single source of scope. Rows from before it also name where the PRD
stands: a PRD section (§2.1 confirmed, §2.2 proposed, §2.3 still to decide),
or "not in PRD" for design, process and prototype details. Where a row and the
PRD disagree, the PRD wins.

| Date | Decision | Why | Status |
|---|---|---|---|
| 2026-11-16 | This app is separate from the owners' business app | Different purpose: it only gathers requirements | Decided · PRD §1 |
| 2026-11-16 | Business requirements only; no technical questions, no deep detail | Owners are non-technical; earlier drafts went too deep too early | Decided · PRD §1 |
| 2026-11-16 | Asynchronous; owners, Burak and the assistant share one discussion | Nobody has to be online together | Decided · PRD §2.1 |
| 2026-11-16 | English first; the app and the assistant each have a Turkish switch | One of the three owners is British | Decided · PRD §2.1 |
| 2026-11-16 | First round uses both the printed feedback document and the app | Each owner can choose what suits them | Decided · PRD §1 |
| 2026-11-16 | The AI's messages wait for Burak's approval by default; a per-room switch makes them automatic | Burak controls what reaches the owners until he trusts it | Superseded by PRD §2.1 and R06: an AI mode per conversation, Off / Review / Automatic |
| 2026-11-16 | Rebuild the second prototype in React, using it as the design reference | It looks professional; the first attempt was a bare chat window | Decided · done; see the 2026-11-20 `src/web` row |
| 2026-11-16 | Pallet project starts from "prepared pallets moved between warehouses or businesses" | Burak's best current picture; to be confirmed in the first discussion | Decided · pallet project only (PRD §1: project content, not a default) |
| 2026-11-16 | Similar businesses appear on the idea page, matching the printed document | The document goes out at the same time | Decided · PRD §4.4 |
| 2026-11-16 | Owners mark statements right or not right; only Burak confirms | Handles owners disagreeing; keeps one person responsible | Decided · PRD §2.1 |
| 2026-11-16 | Phone and desktop are designed and checked equally | Owners use both | Decided · PRD §2.1 |
| 2026-11-16 | A translation is shown beneath any message not in the reader's language | One owner reads only English | Decided · PRD §2.1 |
| 2026-11-16 | Three sections per room: The idea, Discussion, Shared summary | Owners need something to react to, not an empty chat | Decided · PRD §4.4 (confirmed with the PRD on 2026-11-20) |
| 2026-11-16 | The AI keeps two living outputs only: the shared summary and the job-flow diagram | Useful without jumping to solutions | Superseded by PRD §6: more outputs (idea snapshot, next-conversation guide, comparison, concept prototype) |
| 2026-11-16 | Summary and job-flow changes always need approval, even in automatic mode | They are shown as shared understanding | Proposed · PRD §2.2 |
| 2026-11-16 | Private notes for Burak on request; owners never see them | Keeps technical thinking out of the owners' conversation | Proposed · PRD §2.2, R26 |
| 2026-11-16 | Export covers the shared summary only, as a text file | Enough for now | Superseded by PRD R22: a readable export of the outputs; full export is F06 |
| 2026-11-16 | Language choice is per person and remembered; British spelling | Owners in one room prefer different languages | Decided · PRD §2.1, §5.5 |
| 2026-11-16 | Code and docs in English; prompts kept in `prompts/` and loaded at runtime | Works best with coding agents; prompts change without code changes | Proposed · not in PRD |
| 2026-11-16 | Real build: ASP.NET Core, React, SQLite, Claude API | Burak's existing skills; small data | Proposed · PRD §2.2; the AI provider was decided on 2026-11-20 |
| 2026-11-16 | Burak-only screens (queue, private notes, settings) are English only | Less to translate; owners never see them | Proposed · PRD §5.5 |
| 2026-11-16 | Owners read the idea page before giving a name. The name is asked for when they open the Discussion or react in the summary | Nothing stands between the invite link and the idea; the brief lists Join first | Superseded by PRD R02 and the 2026-11-20 sign-in row: owners sign in through their email link first |
| 2026-11-16 | Similar-business cards carry a plain description only, with one shared question beneath. No per-card questions, and "platform" is not used | docs/design.md bans "platform"; the paper's per-card questions suggest answers. The app now differs slightly from the printed document | Decided · design, not in PRD |
| 2026-11-16 | The Print version link opens the feedback PDF for the reader's language. The PDF is copied to `src/web/public/`. A language with no PDF shows "coming soon" | Only the English PDF exists so far | Decided · PRD §4.4 |
| 2026-11-16 | Drafts already in the queue stay there when the automatic switch is turned on | Burak should not be surprised by old drafts going out | Proposed · not in PRD; now per conversation |
| 2026-11-16 | The summary export uses the language Burak is reading in and keeps the three headings | Interpretations must never read as fact | Proposed · not in PRD (export is R22) |
| 2026-11-16 | Icons come from one set, lucide | docs/design.md asks for one consistent line-icon set and no emoji | Proposed · design, not in PRD |
| 2026-11-16 | On Burak's own screens (queue, private notes, rooms) the whole screen is English and the language switch is hidden. His language setting applies on the idea, discussion and summary | His screens are English only; a Turkish shell around English content mixed two languages | Proposed · PRD §5.5 |
| 2026-11-16 | Each project config also names its icon and its hero illustration (or none) | The pallet artwork was showing on every project | Proposed · prototype config; in the real build, project data (PRD R01) |
| 2026-11-16 | On phones every sentence is at least 16px; only pills, badges and time stamps are 13px | docs/design.md asks for 16px minimum body text on phones | Proposed · design, not in PRD |
| 2026-11-16 | Shared summary on desktop: three columns from 1200px wide, the middle one widest; stacked below that | Early interpretations holds the most cards and is the group owners act on | Proposed · design, not in PRD |
| 2026-11-16 | Prototype: scripted assistant replies are read from `prompts/interviewer.md` when the app is built, not copied into code | Keeps the rule against duplicating prompts; edit the prompt and the drafts change | Proposed · prototype only |
| 2026-11-16 | Prototype: the demo starts with nothing confirmed. (It first started with one confirmed statement; owner-tester pointed out that this showed something as decided before the third owner had joined) | Only Burak confirms, and nothing is confirmed at the real start | Proposed · prototype and demo only |
| 2026-11-16 | A proposal can reword an existing statement or answer an open question, instead of only adding a new one. Answering an open question turns it into an early interpretation | `prompts/summary.md` allows both; without them the summary filled with near-duplicates | Proposed · not in PRD |
| 2026-11-16 | A job-flow proposal fills in only what an owner said. The part still unknown stays in the flow as its own question step | `prompts/summary.md`: an unknown step stays a question, it is not filled in | Decided · PRD R19, §6 |
| 2026-11-16 | The job-flow diagram is a row from 1200px wide and a column below that | A fifth step did not fit a row on narrower desktops | Proposed · design, not in PRD |
| 2026-11-19 | The main session leads (plans, briefs, reviews, verifies, reports) and does not write app code; the implementer subagent does | Burak's instruction | Decided · process, not in PRD |
| 2026-11-19 | Every change runs through one dev loop (`.claude/skills/dev-loop/SKILL.md`), with project principles in `docs/engineering.md` | Burak's process, written down once instead of repeated in every request; steering only where agents go wrong | Proposed · process, not in PRD |
| 2026-11-19 | Two new subagents only: implementer (writes code and its tests, on Sonnet) and code-reviewer (read-only, on Opus, a different model from the implementer) | Fewest roles that cover the work. A reviewer on a different model shares fewer blind spots with the author | Proposed · process, not in PRD |
| 2026-11-19 | The project lives at github.com/burakata/idea-discovery-app (public). Each task gets its own branch and a pull request into `main`. The lead commits to the branch, pushes it and opens the pull request; only Burak merges | One reviewable diff per task, for code-reviewer and for Burak; `main` only changes when Burak says so | Decided · process, not in PRD |
| 2026-11-19 | GitHub ruleset "Protect main" on the default branch: no deletion, no force-push, changes only through a pull request (0 approvals, since GitHub does not let anyone approve their own pull request). Nobody can bypass it, Burak included. Required status checks are added once the build runs on GitHub Actions | Stops `main` being deleted, rewritten or pushed to directly by mistake | Decided · process, not in PRD |
| 2026-11-19 | No separate tester or security-reviewer subagent yet. The implementer writes tests; code-reviewer checks security basics. A security reviewer is added when backend work starts | No backend, deployment or real data yet | Superseded by the 2026-11-20 security-reviewer row |
| 2026-11-16 | Prototype: `?as=` and `?lang=` in the address set who is viewing and the language | Used for review screenshots. Must not exist in the real build, where `?as=burak` would expose the queue | Proposed · demo configuration only (2026-11-20 `src/web` row) |
| 2026-11-20 | The Phase 1 PRD (`docs/prd/Idea_Discovery_Rooms_Phase_1_PRD.md`, v0.2) replaces `docs/brief.md` as the single source of scope. The brief's items the PRD lacked were carried into it: the problem, purpose and limits (working alongside paper and meetings; no analysis, scoring or pricing of the idea), what owners see (§4.4), the owner experience success criteria (§8), consultant-added statements (R27) and two Later items (F23, F24). The brief is kept as `docs/archive/brief-v1.md`, for reference only. The PRD's reversals of the brief now apply: the consultant creates projects in the app (R01); a consultant-requested concept prototype (R23, P1 late); several conversations per project; AI modes Off / Review / Automatic per conversation; email sign-in; private specialist agents; multiple-choice questions | Two scope sources that disagree would give every agent conflicting instructions | Decided |
| 2026-11-20 | Phase 1 has one human consultant per project: Burak. Several AI assistants stay as the PRD has them (one public Lead, private specialists, R14). More human consultants stay in F14 | PRD §2.1 said "consultant(s)" while F14 put multiple consultants at Product stage. §2.1 now matches F14 | Decided |
| 2026-11-20 | The AI Discovery Playbook v1.1 lives in `docs/playbook/`, exactly as Burak supplied it. It is the source the Lead and specialist prompts and the facilitator controls (PRD §5.4) are written from in M2. It is reference, not loaded at runtime: the app's prompts stay in `prompts/`. Its `project-context/pallet-room.md` is context for the pallet project only | The PRD bases the Lead and the controls on the Playbook, but it was not in the repository | Decided |
| 2026-11-20 | `src/web` grows into the real client instead of a fresh start. Its components, tokens and strings stay; the store's demo data and local storage are replaced by an API client. The demo stays available as a configuration (demo data, simulated AI, choosing who is viewing) that is off in real deployments. `?as=`, `?lang=` and Reset demo exist only in demo mode | Burak: evolve it if the demo can stay configurable. The store is already the one door to the data (docs/engineering.md §8), so the swap stays in one place. PRD §9: reuse design patterns, not local-only security assumptions | Decided |
| 2026-11-20 | Make things configurable where they differ between deployments or providers: sign-in method, email service, AI provider and model, demo mode, hosting settings | Burak: "make things configurable as much as possible". Lead's reading, Proposed: settings for what genuinely varies, not a switch for every behaviour (docs/engineering.md §1) | Decided |
| 2026-11-20 | Sign-in: the API sends its own one-time, expiring email sign-in links, through a transactional email service (open question 11). No managed sign-in service. The sign-in method is configurable, but signing in without a link (choosing a user) works only in a demo or local configuration, and the app refuses that setting anywhere else | Owners' identities stay in our database, as the PRD's data model assumes. PRD §10 and A15 make identity-bound sign-in a release blocker for real users | Decided |
| 2026-11-20 | AI provider: the Claude API, called only from the server, behind a provider adapter so another provider can be configured later. The model ID is read from configuration. Confirms the AI part of the 2026-11-16 "Real build" row | Burak's choice; PRD §9 asks for a server-side, configurable provider. Building several providers now is F13 (Phase 2) | Decided |
| 2026-11-20 | Hosting: one small Linux VPS running Docker, with the SQLite file on its local disk; we handle updates and backups. Which provider, the domain and the budget are open question 6 | Cheap and simple for a small private pilot; SQLite needs a local disk, not shared network storage | Decided |
| 2026-11-20 | Retention: a project and its conversations are kept until Burak deletes the project. An owner can ask for their project to be deleted. Backups roll off after 30 days (provisional figure). A short privacy notice says this before real owners join | PRD §10: retention and deletion must be defined before real owners submit confidential details | Decided |
| 2026-11-20 | The PRD lives in `docs/prd/`, its diagrams in `docs/prd/assets/`. The package's `Implementation_Plan.md` and `Future_Feature_Register.md` were removed: they were copies of PRD §11 and §12, which are kept only in the PRD. The v0.1 PDF is kept as `docs/archive/Idea_Discovery_Rooms_Phase_1_PRD_v0.1.pdf` | One copy of each text cannot drift; the PRD's image paths already pointed to `assets/` | Decided |
| 2026-11-20 | CI on GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request into `main`: the `src/web` build with its type check, and a check that relative links in Markdown files resolve (`tools/check-doc-links.ps1`). Tests and the API build join it when they exist. Making it a required check on "Protect main" is the next step | Burak asked whether checks run between steps; until now every check was run by hand | Decided |
| 2026-11-20 | The "Protect main" ruleset now requires both CI checks, "Web build and type-check" and "Docs links", from GitHub Actions, before a pull request can merge. Branches do not have to be up to date with `main` first. Nobody can bypass it, Burak included. When CI gains a job (tests, the API build), it is added to the ruleset in the same pull request | Completes the 2026-11-19 ruleset row: nothing reaches `main` unless it builds and its links resolve. Up-to-date branches are not required because only Burak merges, one pull request at a time | Decided |
| 2026-11-20 | `docs/engineering.md` gains three principles for the real build: deny by default (§10), scope every query to its project and conversation (§11), and configure what varies, not everything (§12). Access rules join the high-risk areas (§4) | PRD §3, §9 and §10, and Burak's configurability decision, written where every agent reads before coding | Decided |
| 2026-11-20 | scope-guard's lists follow the PRD: its "in scope, do not challenge" list is PRD §2.1 and §5 (R01 to R27), its "Later or Out" list names the F-numbers of §12, and it also flags work out of milestone order (§11) and access not checked on the server | Its old lists came from the v1 brief and called sign-in, notifications to owners, creating projects in the app and more than one AI agent out of scope, all of which the PRD includes | Decided |
| 2026-11-20 | The implementer subagent covers `src/api` (ASP.NET Core) as well as `src/web`. In the API it denies by default, scopes every query, writes the non-member test with each endpoint, keeps secrets out of code and runs `dotnet build` and `dotnet test` before reporting. It still never commits, adds dependencies only when the brief says so, and stays on Sonnet | One implementer for both sides keeps the lead-briefs, implementer-writes, reviewer-checks loop unchanged; the API rules come from docs/engineering.md §10 to §12 | Decided |
| 2026-11-20 | A security-reviewer subagent (`.claude/agents/security-reviewer.md`): read-only, on Opus, run alongside code-reviewer on every change that touches `src/api`, sign-in, membership or roles, AI calls, configuration or secrets. It checks access, scoping, private data, sign-in links, secrets, AI context, safe rendering, audit and the refusal tests. code-reviewer keeps its security basics for other changes. The dev loop calls it from the next setup step | The real build starts the backend work the 2026-11-19 row waited for; PRD §10 makes these checks release blockers | Decided |

## Open questions

Move each to the table once decided.

1. **Paper answers.** When an owner answers on the printed document, does
   Burak type the answers into the room as statements, or keep them apart?
   Still open in PRD §2.3; R27 already lets Burak add a paper answer as a
   statement with its source.
2. **How do owners know a reply has arrived?** With approval on, replies are
   delayed. Nothing in v1, or an email or message with the link? Partly
   answered by PRD §2.1 and R21: an email when their response is needed, not
   for every activity. The delivery rules are still open (PRD §2.3).
3. **How does Burak know something is waiting?** Answered by PRD §2.1 and
   R21: an email when an approval needs action.
4. **How do owners get in?** Decided 2026-11-20: one-time, expiring email
   sign-in links bound to the invited person (see the table).
5. **Disagreement.** If one owner marks a statement right and another marks
   it not right, what does Burak do: ask in the discussion, or raise it in
   person? Partly answered by PRD A11 and R13: both reactions stay visible,
   the AI asks neutrally, and Burak confirms or leaves the statement open.
   How he follows up stays his call.
6. **Hosting provider, domain and budget.** A small Linux VPS with Docker was
   decided on 2026-11-20. Still open: which provider, the domain and the
   rough monthly budget. Needed by the end of M1.
7. **How long are rooms kept?** Decided 2026-11-20 (see the table).
8. **Editing a statement owners already reacted to.** In the prototype the
   reactions stay attached when Burak rewrites a statement. Should they be
   cleared, so nobody is shown as agreeing with words they never saw? Not in
   the PRD.
9. **Text Burak types.** A statement or edit Burak writes exists in one
   language. Who supplies the other: the AI, with or without approval? Not
   settled by the PRD: §5.5 covers translating messages, not Burak's
   statements.
10. **Reviewer from another vendor.** Should code-reviewer, or a second
    reviewer, run on another company's model? It would catch different
    mistakes, but it sends the code to that company and needs its command-line
    tool installed.
11. **Email service.** Which transactional email service sends the sign-in
    links and notifications? Needed in M1.
