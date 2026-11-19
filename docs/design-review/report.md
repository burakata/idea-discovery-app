# Design review: Idea Discovery Rooms prototype

Date: 2026-11-16. Reviewed against docs/design.md with the design-review
skill, then every problem found was fixed at Burak's request and the screens
were checked again. The screenshots in `screenshots/` show the app after the
fixes. The ones from the first review are kept in `screenshots-before/`.

## How it was checked

- Screenshots were taken with headless Edge from the running app, each from a
  fresh browser so every shot shows the starting demo data.
- Desktop shots are 1280px wide. Phone shots are a 390px-wide frame captured
  at double resolution, because Edge cannot open a window that narrow.
- Files ending in `-full` use a very tall frame so the whole page shows in one
  image. The others show what fits on one screen (390x844, 1280x800).
- Owner screens were shot in English and Turkish. Burak's three screens are
  English only, so they have two shots each, plus one of the queue with his
  language set to Turkish.

The screenshots were taken again after the seeded demo data was corrected
(see `owner-tester-report.md`), so they show nothing confirmed yet and five
items in Burak's queue. The "before" set shows the earlier seed.

Still not checked: the message box above a real phone keyboard, hover and
focus states, and any browser other than Edge. The participants sheet on
phones was opened and closed in the click-through but has no screenshot.

## What was fixed

### On every screen

| Problem found | What was done | Now |
|---|---|---|
| Sub-headings, help lines and translations were 14px on phones; role labels and bottom-bar labels 13px | Every sentence is 16px on phones. The 14px size applies on desktop only | Fixed. Pills, badges, time stamps, the small capital labels and the prototype strip's own labels stay 13px |
| Language switch was 36px tall on phones | 44px tall below 900px | Fixed |
| The pallet illustration and box icon showed for every project | The project config now has `icon` and `illustration`. The example project has a lightbulb and no illustration | Fixed |
| Burak's screens mixed Turkish shell with English content | On the queue, private notes and rooms list the whole screen is English, and the language switch is hidden there | Fixed. His language setting still applies on the idea, discussion and summary |
| "View as" was cut off on phones | Shows the name only below 900px | Fixed |
| Fixed component sizes were not tokens | Avatar, tiles, switch, rows, panels and page widths are tokens | Fixed. Border widths, letter-spacing and breakpoints are still written as numbers |

### Join

<img src="screenshots/join-390-en.png" width="180"> <img src="screenshots/join-390-tr.png" width="180"> <img src="screenshots/join-1280-en.png" width="380"> <img src="screenshots/join-1280-tr.png" width="380">

| Problem found | What was done | Now |
|---|---|---|
| The "Draft · Needs confirmation" pill showed on this screen | The pill shows only on the idea, discussion and summary | Fixed |

### The idea

<img src="screenshots/idea-390-en.png" width="180"> <img src="screenshots/idea-390-tr.png" width="180"> <img src="screenshots/idea-1280-en.png" width="380"> <img src="screenshots/idea-1280-tr.png" width="380">

Whole page: [390 EN](screenshots/idea-390-en-full.png),
[390 TR](screenshots/idea-390-tr-full.png),
[1280 EN](screenshots/idea-1280-en-full.png),
[1280 TR](screenshots/idea-1280-tr-full.png).
Empty example project: [1280 EN](screenshots/idea-1280-example.png).

| Problem found | What was done | Now |
|---|---|---|
| The example project showed a warehouse and a van | No illustration when the config has none | Fixed |
| Similar-business labels did not line up | The label row is pinned to the bottom of each card | Fixed |
| The left "understanding" card had no title | Titled "Early interpretations" / "İlk yorumlar" | Fixed |
| On a phone the first screen was all hero | The illustration is small and sits beside the buttons | Fixed: the next card now starts on the first screen |

### Discussion

<img src="screenshots/discussion-390-en.png" width="180"> <img src="screenshots/discussion-390-tr.png" width="180"> <img src="screenshots/discussion-1280-en.png" width="380"> <img src="screenshots/discussion-1280-tr.png" width="380">

| Problem found | What was done | Now |
|---|---|---|
| On phones nothing on the first screen said replies are simulated | "Replies here are examples" is pinned under the heading and never scrolls away | Fixed |
| The thread was squeezed on phones | The sub-heading is left out on phones | Fixed |
| The people button was an icon and a number | It now reads "Participants 5" / "Katılımcılar 5" | Fixed |

### Shared summary

<img src="screenshots/summary-390-en.png" width="180"> <img src="screenshots/summary-390-tr.png" width="180"> <img src="screenshots/summary-1280-en.png" width="380"> <img src="screenshots/summary-1280-tr.png" width="380">

Whole page: [390 EN](screenshots/summary-390-en-full.png),
[390 TR](screenshots/summary-390-tr-full.png),
[1280 EN](screenshots/summary-1280-en-full.png),
[1280 TR](screenshots/summary-1280-tr-full.png).
As Burak: [390](screenshots/summary-390-burak.png),
[1280](screenshots/summary-1280-burak.png).

| Problem found | What was done | Now |
|---|---|---|
| Burak's "Remove" wrapped to its own line in every card | Edit and Remove are icon buttons with a tooltip; all three sit on one line | Fixed |
| The three desktop columns were very uneven | The middle column is wider and reactions sit side by side, so its cards are shorter | Improved, not equal. Early interpretations is still the tallest column because it holds the most cards. Below 1200px the groups stack instead of squeezing into three |
| On phones two of three groups started closed | A group with four or fewer items starts open | Fixed |
| Corrections were in 14px text | 16px on phones | Fixed |

### Burak's queue

<img src="screenshots/queue-390-en.png" width="180"> <img src="screenshots/queue-1280-en.png" width="380"> <img src="screenshots/queue-1280-tr.png" width="380">

Whole page: [390](screenshots/queue-390-en-full.png),
[1280](screenshots/queue-1280-en-full.png).

| Problem found | What was done | Now |
|---|---|---|
| Burak's links were cut off on phones and scrolled sideways | Short labels on phones: Waiting, Notes, Rooms | Fixed: all three fit |
| The count badge was stranded | It sits beside the title | Fixed |
| The second language of a proposal was labelled "Translated" | It is labelled with the language's name | Fixed |
| "Now" and "Proposed" job-flow cards differed in height | Both are the same height | Fixed |

### Private notes

<img src="screenshots/notes-390-en.png" width="180"> <img src="screenshots/notes-1280-en.png" width="380">

Whole page: [390](screenshots/notes-390-en-full.png),
[1280](screenshots/notes-1280-en-full.png).

No problems of its own. The clipped links are fixed as in the queue.

### Rooms list

<img src="screenshots/rooms-390-en.png" width="180"> <img src="screenshots/rooms-1280-en.png" width="380">

| Problem found | What was done | Now |
|---|---|---|
| "Rooms" was on screen three times on phones | The link strip is hidden here and the header shows the app's name | Fixed: it appears once |
| The waiting count showed twice | The badge is gone; the pill stays | Fixed |

## Checklist after the fixes

| Check | Result |
|---|---|
| Looks finished, purpose clear, one main action | Yes on all seven screens |
| One icon style, no emoji | Yes |
| Shared components, no one-offs | Yes |
| Unconfirmed content marked | Yes |
| 390px: nothing scrolls sideways | Yes |
| 390px: text at least 16px | Yes for every sentence. Pills, badges, time stamps and small capital labels are 13px |
| 390px: touch targets at least 44px | Yes |
| 390px: bottom navigation shows three sections | Yes |
| 1280px: no long lines, no narrow strip | Yes |
| Same things available at both sizes | Yes |
| Language switch always visible | Yes on owner screens. Hidden on Burak's three English-only screens |
| Turkish fits buttons and cards | Yes |
| No screen mixes languages | Yes, apart from messages with their translations |
| No "platform", no jargon | Yes |
| Real-looking names and messages | Yes |
| Simulated behaviour labelled | Yes at both sizes |

## Left as it is

- **A five-step job flow at 1280px** has not been seen in a screenshot. The
  diagram gains a fifth step only after Burak approves the seeded job-flow
  change, and the screenshots start from fresh demo data. It was measured in
  the browser at 1024px, where it now stacks as a column without overflowing.
- **Summary columns on desktop** are better balanced but not equal.
- **Burak's controls on the summary are English** when he reads it in
  Turkish (Confirm, the tooltips, "Add a statement", "Export summary"). The
  decision is that his own controls are English only.
- **13px labels** remain for pills, badges and time stamps. Say so if the
  16px rule should cover those too.
