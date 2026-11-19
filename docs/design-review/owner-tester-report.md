# Owner-tester report

Date: 2026-11-16. Run after the prototype rebuild, on the prompts, the pallet
project config, the strings and the seeded demo discussion. The subagent read
the files; it did not see the screens.

## Status

The findings in the **seeded demo data** have been fixed, and the subagent was
run again on the changed seed. The findings in `prompts/`, the project config
and the strings have **not** been changed.

| Finding | Where | Status |
|---|---|---|
| 1. Picks a side when owners disagree | prompt and seed | Seed fixed: the queue now proposes an open question with both views. The rule in `prompts/summary.md` is unchanged |
| 2. Assumes how the business works | prompt and seed | Open. The question "a customer gets in touch" comes from `prompts/interviewer.md`, and the seeded answers follow it |
| 3. Proposals say more than their quotes | seed | Fixed: one fact per proposal, the waiting-time proposal rewords the existing statement, and the job-flow proposal keeps the unknown part as a question |
| 4. Printed document | prompt | Open |
| 5. Two meanings of "price" | prompt and config | Open |
| 6. A reply that does not follow | seed | Fixed: David's answer is now the last message, so the queued reply follows it. No reply is drafted for Selin's answer to Burak |
| 7. Wrong language in the prototype's flow | prototype code | Open. The draft's language still comes from the writer's setting |
| 8. Opening message is six sentences | prompt | Open |
| 9. Similar businesses | prompt and config | Open |
| 10. Decided without Murat | seed | Fixed: nothing starts as confirmed |
| 11. Turkish wording | seed, config, strings, prompt | Seed fixed (Burak's translated message). Config, strings and prompt wording unchanged |

The second run confirmed these and found four further points in the new
seed. All four were then fixed, and checked in the browser rather than by a
third run:

- The new open question overstated Selin's view. It now quotes the statement
  she agreed with in full ("may not be part of the driver's role") and is two
  sentences.
- The queued reply would have landed under Selin's message. David's answer is
  now last in the thread.
- "A job starts when the customer phones the office" sat beside the open
  question it answers. It is now proposed as the answer to "Who asks for a
  job, and how?", which moves to Early interpretations when approved.
- The sample note's question "who decides which driver goes?" assumed an
  answer. It now asks how the job reaches a driver.

The findings below are the first run's, kept as written.

Findings are in the subagent's order, most serious first. "Prompt" means the
real assistant would do this. "Prototype" means it is in the config, strings
or invented demo data.

## Findings

1. **Picks a side when owners disagree (prompt and prototype).**
   `prompts/summary.md` lines 26-27 allow removing an early interpretation an
   owner marked "not right", even when another owner marked it right. The
   seed has exactly this case (Selin right, David not right on loading and
   unloading) and the queue holds no open question for it.
2. **Assumes how the business works (prompt and prototype).** The example
   question "a customer gets in touch. What happens first?"
   (`prompts/interviewer.md` line 137) presupposes the answer to the open
   question "Who asks for a job, and how?". The seeded reply follows that
   lead, and two seeded proposals carry it into the summary.
3. **Seeded proposals say more than their quotes (prototype).**
   - The job-flow proposal overwrites the unknown step although "how does it
     reach a driver?" is still unanswered.
   - "A customer phones the office, and a day and time for collection are
     agreed" holds two facts and repeats "Jobs may be booked by appointment".
     An owner cannot tap Right on half of it.
   - "If the driver waits more than half an hour..." duplicates "There may be
     extra charges for waiting time" instead of rewording it.
4. **Printed document (prompt).** "Go along with it" lets the assistant accept
   "point 3 on the sheet is wrong" without knowing what point 3 is. The idea
   context gives no numbering.
5. **Two meanings of "price" (prompt and prototype).** "Do not talk about
   price" does not separate Burak's fee from the business's own prices, which
   the assistant is meant to ask about. The idea page says "We are not
   settling prices" next to "Who sets the price?".
6. **A reply that does not follow (prototype).** The seeded draft "Peki sonra
   ne oluyor?" answers Selin's waiting-time message, which was her reply to
   Burak's question to Murat. David's last message never gets a reply.
7. **Wrong language in the prototype's flow (prototype).** The draft's
   language comes from the writer's setting. Murat, set to English but
   writing Turkish, gets an English draft, and David gets no translation of
   Murat's message.
8. **The opening message is six sentences (prompt)**, against the prompt's own
   "two or three sentences at most".
9. **Similar businesses (prompt and prototype).** The shared question asks two
   things at once. Two of the four examples are job exchanges, and "see which
   feel closest" makes choosing one an aim, which steers mildly.
10. **Decided without Murat (prototype).** A statement shows as Confirmed
    before Murat, the person the demo opens as, has joined.
11. **Turkish wording (prototype and prompt).** No wrong characters.
    - "İlk yorumlar" reads as "first comments".
    - "Kısa bir konuşmadan." and "Bir işin baştan sona ilk hâli" are stiff.
    - "hazırlanmış paletleri" in one place, "hazır" in another.
    - "bekleme süresini nasıl gördüğünüzü" and "O noktada" read as
      translations.
    - English and Turkish differ: "van" against "aracınızla"; the title "Tell
      us..." against "...birlikte anlayalım".

## Where owners would stop replying

- **David** asks about cost repeatedly and gets the identical line each time.
  His last answer sits unanswered overnight.
- **Murat** arrives to ten messages, his question already answered by Selin
  and one item already confirmed.
- **Selin** receives "Peki sonra ne oluyor?" after her waiting-time answer.

## Suggested wording changes

1. `prompts/interviewer.md` line 137: "Let's take one real job as an example.
   How does it start?" / "Bir işi örnek alalım. İş nasıl başlıyor?"
2. `prompts/summary.md` line 26: add "If one owner marked it right and another
   not right, change nothing; propose an open question stating both views."
3. `prompts/interviewer.md` line 90: "Do not talk about what Burak's work will
   cost, how long it will take or what he will build. Asking how the business
   itself sets prices is fine."
