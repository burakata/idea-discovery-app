# Decisions log

Add a row whenever something is decided. Newest at the bottom.
Status: **Decided** (Burak confirmed) or **Proposed** (suggestion, not yet
confirmed).

| Date | Decision | Why | Status |
|---|---|---|---|
| 2026-11-16 | This app is separate from the owners' business app | Different purpose: it only gathers requirements | Decided |
| 2026-11-16 | Business requirements only; no technical questions, no deep detail | Owners are non-technical; earlier drafts went too deep too early | Decided |
| 2026-11-16 | Asynchronous; owners, Burak and the assistant share one discussion | Nobody has to be online together | Decided |
| 2026-11-16 | English first; the app and the assistant each have a Turkish switch | One of the three owners is British | Decided |
| 2026-11-16 | First round uses both the printed feedback document and the app | Each owner can choose what suits them | Decided |
| 2026-11-16 | The AI's messages wait for Burak's approval by default; a per-room switch makes them automatic | Burak controls what reaches the owners until he trusts it | Decided |
| 2026-11-16 | Rebuild the second prototype in React, using it as the design reference | It looks professional; the first attempt was a bare chat window | Decided |
| 2026-11-16 | Pallet project starts from "prepared pallets moved between warehouses or businesses" | Burak's best current picture; to be confirmed in the first discussion | Decided |
| 2026-11-16 | Similar businesses appear on the idea page, matching the printed document | The document goes out at the same time | Decided |
| 2026-11-16 | Owners mark statements right or not right; only Burak confirms | Handles owners disagreeing; keeps one person responsible | Decided |
| 2026-11-16 | Phone and desktop are designed and checked equally | Owners use both | Decided |
| 2026-11-16 | A translation is shown beneath any message not in the reader's language | One owner reads only English | Decided |
| 2026-11-16 | Three sections per room: The idea, Discussion, Shared summary | Owners need something to react to, not an empty chat | Proposed |
| 2026-11-16 | The AI keeps two living outputs only: the shared summary and the job-flow diagram | Useful without jumping to solutions | Proposed |
| 2026-11-16 | Summary and job-flow changes always need approval, even in automatic mode | They are shown as shared understanding | Proposed |
| 2026-11-16 | Private notes for Burak on request; owners never see them | Keeps technical thinking out of the owners' conversation | Proposed |
| 2026-11-16 | Export covers the shared summary only, as a text file | Enough for now | Proposed |
| 2026-11-16 | Language choice is per person and remembered; British spelling | Owners in one room prefer different languages | Proposed |
| 2026-11-16 | Code and docs in English; prompts kept in `prompts/` and loaded at runtime | Works best with coding agents; prompts change without code changes | Proposed |
| 2026-11-16 | Real build: ASP.NET Core, React, SQLite, Claude API | Burak's existing skills; small data | Proposed |
| 2026-11-16 | Burak-only screens (queue, private notes, settings) are English only | Less to translate; owners never see them | Proposed |
| 2026-11-16 | Owners read the idea page before giving a name. The name is asked for when they open the Discussion or react in the summary | Nothing stands between the invite link and the idea; the brief lists Join first | Proposed |
| 2026-11-16 | Similar-business cards carry a plain description only, with one shared question beneath. No per-card questions, and "platform" is not used | docs/design.md bans "platform"; the paper's per-card questions suggest answers. The app now differs slightly from the printed document | Decided |
| 2026-11-16 | The Print version link opens the feedback PDF for the reader's language. The PDF is copied to `src/web/public/`. A language with no PDF shows "coming soon" | Only the English PDF exists so far | Decided |
| 2026-11-16 | Drafts already in the queue stay there when the automatic switch is turned on | Burak should not be surprised by old drafts going out | Proposed |
| 2026-11-16 | The summary export uses the language Burak is reading in and keeps the three headings | Interpretations must never read as fact | Proposed |
| 2026-11-16 | Icons come from one set, lucide | docs/design.md asks for one consistent line-icon set and no emoji | Proposed |
| 2026-11-16 | On Burak's own screens (queue, private notes, rooms) the whole screen is English and the language switch is hidden. His language setting applies on the idea, discussion and summary | His screens are English only; a Turkish shell around English content mixed two languages | Proposed |
| 2026-11-16 | Each project config also names its icon and its hero illustration (or none) | The pallet artwork was showing on every project | Proposed |
| 2026-11-16 | On phones every sentence is at least 16px; only pills, badges and time stamps are 13px | docs/design.md asks for 16px minimum body text on phones | Proposed |
| 2026-11-16 | Shared summary on desktop: three columns from 1200px wide, the middle one widest; stacked below that | Early interpretations holds the most cards and is the group owners act on | Proposed |
| 2026-11-16 | Prototype: scripted assistant replies are read from `prompts/interviewer.md` when the app is built, not copied into code | Keeps the rule against duplicating prompts; edit the prompt and the drafts change | Proposed |
| 2026-11-16 | Prototype: the demo starts with nothing confirmed. (It first started with one confirmed statement; owner-tester pointed out that this showed something as decided before the third owner had joined) | Only Burak confirms, and nothing is confirmed at the real start | Proposed |
| 2026-11-16 | A proposal can reword an existing statement or answer an open question, instead of only adding a new one. Answering an open question turns it into an early interpretation | `prompts/summary.md` allows both; without them the summary filled with near-duplicates | Proposed |
| 2026-11-16 | A job-flow proposal fills in only what an owner said. The part still unknown stays in the flow as its own question step | `prompts/summary.md`: an unknown step stays a question, it is not filled in | Proposed |
| 2026-11-16 | The job-flow diagram is a row from 1200px wide and a column below that | A fifth step did not fit a row on narrower desktops | Proposed |
| 2026-11-19 | The main session leads (plans, briefs, reviews, verifies, reports) and does not write app code; the implementer subagent does | Burak's instruction | Decided |
| 2026-11-19 | Every change runs through one dev loop (`.claude/skills/dev-loop/SKILL.md`), with project principles in `docs/engineering.md` | Burak's process, written down once instead of repeated in every request; steering only where agents go wrong | Proposed |
| 2026-11-19 | Two new subagents only: implementer (writes code and its tests, on Sonnet) and code-reviewer (read-only, on Opus, a different model from the implementer) | Fewest roles that cover the work. A reviewer on a different model shares fewer blind spots with the author | Proposed |
| 2026-11-19 | The project lives at github.com/burakata/idea-discovery-app (public). Each task gets its own branch and a pull request into `main`. The lead commits to the branch, pushes it and opens the pull request; only Burak merges | One reviewable diff per task, for code-reviewer and for Burak; `main` only changes when Burak says so | Decided |
| 2026-11-19 | GitHub ruleset "Protect main" on the default branch: no deletion, no force-push, changes only through a pull request (0 approvals, since GitHub does not let anyone approve their own pull request). Nobody can bypass it, Burak included. Required status checks are added once the build runs on GitHub Actions | Stops `main` being deleted, rewritten or pushed to directly by mistake | Decided |
| 2026-11-19 | No separate tester or security-reviewer subagent yet. The implementer writes tests; code-reviewer checks security basics. A security reviewer is added when backend work starts | No backend, deployment or real data yet | Proposed |
| 2026-11-16 | Prototype: `?as=` and `?lang=` in the address set who is viewing and the language | Used for review screenshots. Must not exist in the real build, where `?as=burak` would expose the queue | Proposed |

## Open questions

Move each to the table once decided.

1. **Paper answers.** When an owner answers on the printed document, does
   Burak type the answers into the room as statements, or keep them apart?
2. **How do owners know a reply has arrived?** With approval on, replies are
   delayed. Nothing in v1, or an email or message with the link?
3. **How does Burak know something is waiting?** A count in the app only, or
   an email as well?
4. **How do owners get in?** Invite link plus a display name, or something
   stronger? What stops a stranger with the link from reading the room?
5. **Disagreement.** If one owner marks a statement right and another marks
   it not right, what does Burak do: ask in the discussion, or raise it in
   person?
6. **Where is it hosted, and what does it cost to run?**
7. **How long are rooms kept, and can an owner ask for theirs to be
   deleted?**
8. **Editing a statement owners already reacted to.** In the prototype the
   reactions stay attached when Burak rewrites a statement. Should they be
   cleared, so nobody is shown as agreeing with words they never saw?
9. **Text Burak types.** A statement or edit Burak writes exists in one
   language. Who supplies the other: the AI, with or without approval?
10. **Reviewer from another vendor.** Should code-reviewer, or a second
    reviewer, run on another company's model? It would catch different
    mistakes, but it sends the code to that company and needs its command-line
    tool installed.
