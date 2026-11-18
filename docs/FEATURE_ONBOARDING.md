# Onboarding, tour, reminders and live sync

How a new user gets set up, and what keeps the app useful every day.

## First-run questions

- `needsOnboarding(user_metadata.onboarding)` is read in `src/app/(protected)/layout.tsx`. When it's true, `EngagementProvider` opens `OnboardingWizard` on the user's first visit.
- The six steps: name and interests → savings goal → monthly pay → rent and bills → monthly saving → reminders, tips and example data. A live summary shows pay minus bills minus saving, and how much that leaves per day.
- `POST /api/onboarding` with `{ action: "complete", answers }`:
  - saves the profile (name, pay, savings goal) using `saveProfile`
  - adds fixed costs and one goal, skipping any names that already exist, so running setup again never creates duplicates
  - loads example data if the user asked for it and has none yet
  - stores `{ completedAt, interests }` in the user's metadata
  - parts whose tables don't exist yet come back as `warnings`, not as errors
- `{ action: "skip" }` stores `skippedAt`, so the questions aren't asked again.
- Users can run setup again or take the tour from the account menu or from Profile → Preferences.

## Tour

`ProductTour` spotlights elements marked with `data-tour`: `home`, `glance`, `new`, `money` / `insights` (or `menu` on mobile), `ask-ai`, `search`, `alerts`, `account` and `checklist`. Steps marked `optional` are skipped when their element isn't on the page. While the tour runs, `body[data-tour-active]` keeps the navbar visible.

## Daily use

- **Getting-started checklist** (Home, `GettingStarted`) has nine steps. Each step is ticked from real data where data exists (pay, bills, goal, expenses, budgets, IOUs). Otherwise it's ticked from `markDone(id)` flags saved on the device (receipt scan, asking the AI).
- **Tips**: one a day, about 20 seconds after the app opens. `pickTip` prefers tips that match the user's interests and skips anything they've already done.
- **Daily reminder**: off by default and set in the wizard or Preferences. The app checks every minute whether it's due. If the tab is in the background and the user has allowed notifications, they get a system notification; otherwise they get a toast.
- **Budget alerts**: each new unread `SpendingAlert` triggers one pop-up or notification. IDs that have already been shown are kept in localStorage.
- Tips, reminders and alerts are paused while the wizard or the tour is open.

## Live while online

`useLiveSync` (in `EngagementProvider`):

- shows offline and back-online toasts (toast id `network`)
- refetches everything when the connection comes back
- refreshes the money, profile stats and plan summaries every 2 minutes, and whenever the tab becomes visible again
- after any successful change, sends a `BroadcastChannel("daily-expenses-sync")` message so other open tabs refetch

## Navbar

The navbar hides when the user scrolls down and comes back when they scroll up. It stays visible:

- near the top of the page
- while one of its menus is open
- while it has keyboard focus
- during the tour

## Tests

`tests/onboarding.test.ts` covers answer validation, the setup maths, the stored setup state, tip choice and rotation, and reminder timing.
