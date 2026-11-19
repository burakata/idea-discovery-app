---
name: design-review
description: Review a screen or the whole app against docs/design.md at phone and desktop width, in English and Turkish. Use before calling any screen finished, after layout or styling changes, and when Burak says something looks amateur or off.
---

# Design review

Judge what is on screen, not the code. Start the app, open it in the preview,
and look.

## For each screen
Check it four ways: 390px and 1280px wide, in English and in Turkish. Take a
screenshot of each.

Screens: join, the idea, discussion, shared summary, Burak's queue, private
notes, rooms list.

## Checklist

### First impression
- Does it look like a finished professional product, not a form or a demo?
- Is it obvious within five seconds what this screen is for?
- Is there one clear main action?

### Consistency with docs/design.md
- Colours, spacing, radii and shadows come from the tokens only.
- One icon style. No emoji used as icons.
- Cards, pills, buttons and bubbles are the shared components, not one-offs.
- Unconfirmed content is visibly marked as such.

### Layout
- 390px: nothing overflows or scrolls sideways; text is at least 16px; touch
  targets at least 44px; the message input stays reachable above the
  keyboard; bottom navigation shows the three sections.
- 1280px: content does not stretch into very long lines or sit as a narrow
  strip in an empty page; the sidebar and panels are used.
- Nothing important is available at one size and missing at the other.

### Language
- The switch is visible without opening a menu.
- Turkish labels fit their buttons and cards.
- No screen mixes languages, apart from a message with its translation.

### Content
- No "platform", no jargon, nothing stated as fact that is unconfirmed.
- Real-looking names and messages, not "test" or lorem ipsum.
- Simulated behaviour is labelled as simulated.

## Report
For each screen: the four screenshots, then problems in order of how much
they hurt the first impression. For each problem say what is wrong, where,
and the smallest fix. Finish with the three changes that would improve the
look most.

Do not fix anything until Burak has seen the report, unless he asked for
fixes.
