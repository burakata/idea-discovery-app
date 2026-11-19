# Design direction

The look comes from the reference prototype in `docs/reference/` (the navy
"Idea Discovery Rooms" screens). Take exact colours, spacing and radii from
its source. This file says what to keep, what to change and how each screen
behaves at both sizes.

## Feel
A professional product that is still welcoming to someone with no technical
background. Calm, roomy, clear. Nothing playful, nothing dense.

## Keep from the reference
- White and very light blue-grey backgrounds, navy text and headings.
- One blue accent for primary buttons and links.
- A soft amber pill for "Draft · Needs confirmation".
- Rounded cards with thin borders and very soft shadows.
- Simple line illustrations (warehouse, van, pallet) in SVG.
- Navy sidebar on desktop with the project and the three sections.
- Chat bubbles with the writer's name above the text.
- The "Interactive preview" notice while this is a prototype.

## Change from the reference
- **No emoji as icons.** Use one consistent set of line icons everywhere.
- **Remove the "Visual notes" thumbnails.** Replace with one "Print version"
  link.
- **Neutral wording.** Do not say "platform" for the owners' business. The
  middle step of the job flow is a question, not a statement.
- **"Business owner", not "Founder".** Show real display names.
- **Summary actions.** "Right" and "Not right" for owners, with names shown.
  Only Burak has "Confirm".
- **Similar businesses.** Lead each card with how it works in plain words;
  the brand name is a label. Keep "Examples only" visible.
- Fix the duplicated helper line in the Confirmed column.

## Tokens
Define colours, spacing, radii, shadows and type sizes once as CSS variables
and use only those. One font family. Minimum body size 16px on phones.

## Two sizes, both first-class
Check every screen at 390px and 1280px.

| | Phone (390px) | Desktop (1280px) |
|---|---|---|
| Navigation | Bottom bar: The idea, Discussion, Shared summary | Left sidebar |
| Header | Project name, language switch | Breadcrumb, status pill, language switch |
| The idea | Single column; diagram stacks vertically | Hero with illustration; cards in a row |
| Discussion | Full-height thread; input fixed at the bottom; participants behind a people button | Thread with participants panel on the right |
| Shared summary | Three groups stacked, each collapsible | Three columns |
| Burak's queue | Separate screen with a count badge | Panel or screen with a count badge |

Touch targets at least 44px. The language switch is always visible without
opening a menu. Turkish text is often longer: check buttons and cards in both
languages at both sizes.

## Components to build once and reuse
Card, pill, button (primary, secondary, quiet), message bubble, translation
line, statement card with reactions, job-flow step, participant row, notice
box, language switch, count badge.

## Message bubble
- Name and role above the text.
- If the message is not in the reader's language: the original text, then a
  lighter line beneath with the translation, marked "Translated" /
  "Çeviri".
- AI messages are visually distinct but not louder than people's messages.

## Statement card (shared summary)
- The statement text.
- A status line: "Awaiting confirmation", or who marked it right or not
  right.
- Owners: "Right" and "Not right". "Not right" opens a short text box.
- Burak: "Confirm", "Edit", "Remove".

## Job-flow diagram
Drawn from a list of steps. Each step has who and what, in both languages,
and a flag for "unknown". Unknown steps use a dashed outline and a question
mark. Vertical on phones, horizontal or vertical on desktop, whichever reads
better.

## Prototype labelling
While AI and sharing are simulated, say so plainly on screen. Never present
simulated behaviour as real.
