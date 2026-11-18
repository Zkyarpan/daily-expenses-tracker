# Receipt scanning, Ask AI and the Savings plan

## Setup

The Savings plan uses two new tables. On any page that shows the **Finish
setup** card, use **Copy setup SQL**: it now copies all three migrations in
order, ending with `20261119000000_create_savings_plan.sql`. Paste it into the
Supabase SQL editor and press Run.

Every AI call goes through `callAI` in `src/lib/ai/provider.ts`, which uses
the first provider that is set up:

1. **Pollinations** — `POLLINATIONS_API_KEY` must be a **secret `sk_` key**
   (https://enter.pollinations.ai/keys). Publishable `pk_` keys are rejected
   by Pollinations for server requests (401), so they count as "not set up".
   Optional: `POLLINATIONS_MODEL`, `POLLINATIONS_VISION_MODEL`.
2. **Google Gemini** — `GOOGLE_GEMINI_API_KEY` (free key from
   https://aistudio.google.com/apikey). Optional: `GEMINI_MODEL`
   (default `gemini-2.5-flash`). Reads receipt photos too.

`GET /api/ai/status` returns `{ available, provider }` (never a key), so the
receipt window says up front when reading is switched off and offers
"Add the expense by hand". Without any key, Ask AI still answers with the
rule-based parser and spending insights use the built-in summary.

## Scan a receipt (header "+ New → Scan a receipt")

1. **In the browser:** the photo is decoded and scaled to at most 1600 px,
   then re-encoded as JPEG. This removes EXIF metadata such as GPS location.
2. **`POST /api/receipts/scan`** is authenticated, same-origin JSON only,
   rate-limited to 10 per 10 minutes, and capped at 4 MB. It checks the
   bytes are a real JPEG, PNG or WebP and match the declared type.
3. **The AI reads the photo.** The prompt tells the model to treat text in the
   image as data, not instructions.
4. **`parseReceiptContent` re-validates every value:**
   - totals must be positive and in range;
   - dates can't be in the future, otherwise today is used;
   - the category must be a known one, or is guessed from the shop name;
   - foreign currencies are flagged.
5. **The user reviews and edits the draft, then saves it** as a normal expense.

The photo is never stored, and nothing is saved without the user's review.

## Ask AI (`/assistant`)

Questions such as "How much did I spend on TfL this month?", "How much do I
owe him?" or "Can I afford the headphones?":

1. **Understand:** the AI turns the question into a structured query:
   intent, period, shop or category, person, wishlist item. Only the
   question, plus the previous question for follow-ups, is sent to the AI.
   The rule-based parser (`src/lib/assistant/query.ts`) is used if the AI is
   unavailable or returns anything invalid.
2. **Look up:** `src/lib/assistant/server.ts` reads only what that question
   needs, with the user's own session (RLS).
3. **Answer:** `src/lib/assistant/answer.ts` builds the reply in code, in
   integer pence. The AI never writes a number, so it can't invent one.

The conversation carries context: "him", "and last month?" and "on that"
refer to the previous answer. The chat is kept in `sessionStorage` for the tab
only.

Shop search matches whole words, so "TfL" doesn't match "Netflix". Terms of
five or more letters can also match inside a word.

## Savings plan (`/plan`)

| Part | What it shows |
|---|---|
| Your month | Salary (profile income) → fixed costs → goal savings → **left for everyday spending** (and per day) |
| How you're doing | Status (on track, behind, goals too big), average saved and average everyday spending over the last 3 months. A one-click option tracks the goals' monthly total on Home. |
| Fixed costs | Rent and bills, with the day each is paid |
| Savings goals | Target, saved, deadline, **monthly amount needed**, and "Add money" |
| Track record | Saved per month for the last 6 months plus this month |
| Long-term | A "what if I save £X a month" slider, totals after 6, 12 and 24 months, a chart, and when each goal is reached (on time or late) |

**Rent isn't double-counted.** An expense whose description contains a fixed
cost's name as whole words (for example "Rent – November" for "Rent") counts
as that fixed cost, not as everyday spending. Monthly saved is salary − fixed
costs − everyday spending.

## API

All routes are authenticated, accept same-origin JSON only, validate input
with Zod and are rate-limited.

| Route | Methods |
|---|---|
| `/api/receipts/scan` | `POST` |
| `/api/assistant` | `POST` |
| `/api/plan` | `GET` |
| `/api/plan/fixed-costs`, `/:id` | `POST`, `PATCH`, `DELETE` |
| `/api/plan/goals`, `/:id` | `POST`, `PATCH` (`edit`, `contribute`), `DELETE` |

## Tests

`tests/aiAndPlan.test.ts` covers:

- the plan maths and the no-double-counting rule;
- image validation and receipt parsing (including the Timberland example);
- question understanding: periods, shop search, people and follow-ups;
- validation of the AI's output;
- the answer text, including the TfL and IOU answers;
- the sample data.
