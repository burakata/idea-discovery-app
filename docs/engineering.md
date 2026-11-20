# Engineering principles

Every agent reads this before working on the app. It holds only what agents
get wrong on this project. CLAUDE.md, docs/design.md and the skills cover the
rest; do not repeat them here.

Each principle says what to do and why, so you can judge cases it does not
name. When Burak corrects something, add the principle here. Remove anything
that no longer earns its place.

## 1. Make the smallest, sharpest change

Change only what the task needs. Prefer one more parameter or line in
existing code over a new component, hook or file. When you notice a rare edge
case, name it in your report instead of building for it.

**Why:** a change that guards against everything is long to review and hides
the real change. For a prototype with three owners, a fix that works in the
normal case is already valuable.

**Seen here:** a "fix everything" pass turned every fixed size into a design
token. docs/design.md asks for tokens for colours, spacing, radii, shadows and
type sizes, not for every component size.

## 2. Reuse before you add

Before writing a component, hook, helper, token or string, look for one that
exists:
- components: `src/web/src/components/`
- tokens: `src/web/src/styles/tokens.css`
- strings: `src/web/src/strings/`
- data changes: actions in `src/web/src/state/store.tsx`

Two similar pieces of code are fine. Extract a shared one on the third, and
only if all three change for the same reason.

**Why:** agents lean towards writing new code. A second version of something
that exists doubles what has to be kept in step, and in this app that often
means two languages and the design tokens too. Premature abstraction is just
as costly: it ties together code that would have changed apart.

## 3. Stay inside the brief

Touch only the files the task needs. If you must change another file, say
which and why in your report. Never tidy unrelated code in the same change.

**Why:** unrelated edits are where regressions hide, and a reviewer cannot
tell an intended change from an accidental one.

## 4. Take extra care in the high-risk areas

Name it in your report whenever a change touches:
- `prompts/`: what the AI says to owners. owner-tester must run afterwards.
- The approval and confirmation rules in the store: nothing the AI writes
  reaches owners unapproved, and only Burak moves a statement to Confirmed.
- The language rules: both languages, translations beneath messages.
- Seeded demo data that is shown as the owners' own words.
- Who can see or change what: sign-in, membership and roles, and the
  project and conversation scoping of queries (§10, §11).

**Why:** these are the product's core promises (CLAUDE.md, "Core rules"), and
breaking them does not break the build. Nothing fails; owners are simply
misled.

**Seen here:** a seeded statement started as Confirmed before the third owner
had even joined.

## 5. Meet the intent, not only the wording

Check the result against why the task exists. A proposed statement must say
no more than the words it rests on. A finished screen must look right, not
only build.

**Why:** "technically correct" work passes every check and still misleads the
owners or embarrasses Burak in front of them.

**Seen here:** seeded summary proposals quoted an owner but claimed more than
the quote said.

## 6. Verify by looking at the result

Report something as done only after seeing the outcome: the build and tests
for code, the screen or a screenshot for anything visible. Say plainly what
you did not check.

**Why:** a passing build or a zero exit code hides blank pages, wrong data
and broken layouts.

**Seen here:** blank screenshots were nearly reported as taken.

## 7. Check data only where it comes in

Validate and handle errors where data enters the app:
- now: saved demo data, the parsing of `prompts/*.md`, address parameters;
- later: API responses, Claude calls and translations.

Inside the app, trust the types.

**Why:** checks everywhere add code without catching more. Real failures come
from the edges.

**Known gap:** if the headings in `prompts/interviewer.md` change, the
prototype silently produces no scripted drafts. It only logs to the console.

## 8. Keep the store as the one door to the data

Screens read and change data only through the store (`useStore`, `dispatch`).
Only the store touches local storage.

**Why:** the real build replaces local storage with the API. If knowledge of
where data lives spreads into screens, that swap touches every screen instead
of one file.

## 9. Test the rules, not the markup

Test the rules that fail silently: access and scoping, approval and
confirmation, the prompt parser, language fallbacks. Do not snapshot
components; screenshots and design-review cover how things look.

**Why:** those rules are cheap to test and invisible when broken. Markup
changes often and its tests mostly break for no reason.

The API has xUnit tests in `src/api` (`dotnet test src/api`). The web client
has no test framework yet; Vitest is proposed for it in the next M1 pull
request, as a decision for Burak.

## 10. Deny by default

Every API endpoint needs a signed-in user, and checks on the server that the
user is a member of the project, with the right role, before it reads or
changes anything. Access comes from an explicit rule, never from a missing
one: an endpoint without a rule refuses. Hiding a button in the client is not
a check. Each endpoint gets a test that a non-member is refused, and that an
owner is refused anything only Burak may see.

**Why:** a missing check breaks nothing visible. An owner simply sees
another project, a draft or a private note. PRD §3 and §10 require access to
be enforced on the server; A09 and A15 test it.

## 11. Scope every query to its project and conversation

Every query that reads or changes project data filters by the project, and by
the conversation where the data belongs to one, using the ids the access
check approved. Never trust an id from the request body on its own. Private
data (drafts, specialist results, agent activity, private notes) is also
filtered by who may see it. The same holds for what is sent to the AI: only
the current project's material.

**Why:** one unscoped query puts one project's owners' words in front of
another project's owners. PRD §9 asks for this scoping in every query; §10
forbids cross-project references in AI tools; A16 tests it.

## 12. Configure what varies, not everything

Read from configuration what differs between deployments or providers: the
sign-in method, the email service, the AI provider and model, demo mode,
hosting settings and secrets. A setting that switches off a safety rule (for
example signing in without an email link) is refused outside demo and local
configurations. Do not add a setting for behaviour that never varies; that
is §1.

**Why:** Burak asked for things to be configurable (decisions, 2026-11-20),
so that providers can change and the demo can run without code changes. A
setting nobody changes is untested code.
