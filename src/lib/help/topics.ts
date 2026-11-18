/**
 * src/lib/help/topics.ts — the "Need help?" panel's built-in answers.
 *
 * Questions about how the app works are answered from here instantly (no AI,
 * works offline and in demo mode). Questions about the user's own money go
 * to the assistant (/api/assistant), which computes the answer from their data.
 */

export type HelpAction =
  | { href: string; kind: "link"; label: string }
  | { kind: "quickAdd"; label: string; target: "expense" | "iou" | "receipt" | "wishlist" }
  | { kind: "tour"; label: string };

export type HelpGroup = "Getting started" | "Budgets & alerts" | "Importing & receipts" | "Money & planning" | "Account & privacy";

export interface HelpTopic {
  action?: HelpAction;
  answer: string;
  /** Section on the Help page. */
  group: HelpGroup;
  id: string;
  /** Lower-case words and phrases that point to this topic. */
  keywords: string[];
  question: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    action: { kind: "quickAdd", label: "Add an expense", target: "expense" },
    answer:
      "Press “+ New” at the top of any page and choose Expense. Type the amount, pick a category, and save — that’s it. On the Expenses page you can also tap any expense to change it.",
    group: "Getting started",
    id: "add-expense",
    keywords: ["add", "expense", "record", "log", "new expense", "spent", "enter"],
    question: "How do I add an expense?",
  },
  {
    action: { kind: "quickAdd", label: "Scan a receipt", target: "receipt" },
    answer:
      "Choose “+ New → Scan a receipt”, take or upload a photo, and the AI fills in the amount, date and shop for you to check before saving. The photo isn’t stored.",
    group: "Importing & receipts",
    id: "receipt",
    keywords: ["receipt", "scan", "photo", "camera", "picture"],
    question: "How does receipt scanning work?",
  },
  {
    action: { href: "/import-expenses", kind: "link", label: "Import a statement" },
    answer:
      "Go to Import, upload a CSV export or a PDF bank statement, match the columns, then review every row before anything is saved.",
    group: "Importing & receipts",
    id: "import",
    keywords: ["import", "csv", "pdf", "statement", "bank", "upload", "file"],
    question: "How do I import a bank statement?",
  },
  {
    action: { href: "/budgets", kind: "link", label: "Open budgets" },
    answer:
      "Set a monthly limit for any category on the Budgets page. You’ll get a warning at 80% of the limit and an alert when you go over — on screen, and as a notification if you allow them.",
    group: "Budgets & alerts",
    id: "budgets",
    keywords: ["budget", "limit", "overspend", "over budget", "80%", "cap"],
    question: "How do budgets and alerts work?",
  },
  {
    action: { kind: "quickAdd", label: "Record money lent", target: "iou" },
    answer:
      "Use Lend & borrow to note money you lent or borrowed. Mark part payments as they come in and “Settled” when it’s paid back — the totals at the top always show who owes who.",
    group: "Money & planning",
    id: "lend",
    keywords: ["lend", "lent", "borrow", "owe", "owes", "iou", "debt", "paid back", "friend"],
    question: "How do I track money I lent or borrowed?",
  },
  {
    action: { href: "/plan", kind: "link", label: "Open my plan" },
    answer:
      "The Plan page takes your salary, fixed bills and goals and works out how much to save each month and what’s left to spend each day.",
    group: "Money & planning",
    id: "plan",
    keywords: ["plan", "save", "saving", "salary", "goal", "goals", "income"],
    question: "How does the savings plan work?",
  },
  {
    action: { kind: "quickAdd", label: "Add a wishlist item", target: "wishlist" },
    answer:
      "Add things you want to buy to the Wishlist, put money aside for each one, and see when you can afford it.",
    group: "Money & planning",
    id: "wishlist",
    keywords: ["wishlist", "wish", "afford", "buy", "want"],
    question: "What is the wishlist for?",
  },
  {
    action: { href: "/analytics", kind: "link", label: "Open analytics" },
    answer:
      "Analytics compares months, shows trends and your biggest categories, and exports PDF or Excel reports. Yearly charts give the full-year picture.",
    group: "Money & planning",
    id: "analytics",
    keywords: ["analytics", "report", "chart", "trend", "export", "excel", "compare"],
    question: "Where can I see reports and charts?",
  },
  {
    action: { href: "/profile?tab=notifications", kind: "link", label: "Notification settings" },
    answer:
      "The app sends a heads-up when something stands out — a big expense, a busy day, a category past last month, or your monthly pace — plus budget alerts. Turn each one on or off under Profile → Notifications.",
    group: "Budgets & alerts",
    id: "alerts",
    keywords: ["alert", "alerts", "notification", "notifications", "remind", "reminder", "pop-up", "popup"],
    question: "What alerts will I get?",
  },
  {
    action: { href: "/profile?tab=data", kind: "link", label: "Your data" },
    answer:
      "Your records are private to your account. The AI only ever sees your question (or a receipt photo to read) — never your names, notes or figures — and every answer is worked out from your own data in code.",
    group: "Account & privacy",
    id: "privacy",
    keywords: ["private", "privacy", "secure", "safe", "data", "delete", "export my data", "gdpr"],
    question: "Is my data private?",
  },
  {
    action: { kind: "tour", label: "Start the tour" },
    answer: "The tour shows every page and button in about a minute. You can skip it at any time.",
    group: "Getting started",
    id: "tour",
    keywords: ["tour", "show me", "how does", "get started", "start", "new here", "guide"],
    question: "Can you show me around?",
  },
  {
    answer:
      "On the Expenses page, tap the expense (or the ⋮ menu beside it) and choose Edit or Delete. On a computer you can also click any cell in the table to change it, then press “Save changes”.",
    group: "Getting started",
    id: "edit-expense",
    keywords: ["edit", "change", "delete", "remove", "wrong expense", "mistake", "undo"],
    question: "How do I edit or delete an expense?",
  },
  {
    answer:
      "Yes. Open the app in your phone’s browser and choose “Add to Home Screen” (Safari: Share → Add to Home Screen; Chrome: ⋮ → Install app). It opens full-screen like a normal app.",
    group: "Getting started",
    id: "phone",
    keywords: ["phone", "mobile", "iphone", "android", "install", "home screen", "app store"],
    question: "Can I use it on my phone?",
  },
  {
    answer:
      "Green means you’re on track, amber means a budget is at 80% or more, and red means it has gone over. Amounts are never shown in red just for being spending — only when a limit is passed.",
    group: "Budgets & alerts",
    id: "colours",
    keywords: ["colour", "color", "red", "amber", "green", "over budget", "meaning"],
    question: "What do the colours mean?",
  },
  {
    action: { href: "/budgets", kind: "link", label: "Open budgets" },
    answer:
      "Raise the limit if it was set too low, or leave it — the alert simply tells you where the month went. You can dismiss an alert with ✕; it won’t come back for that month.",
    group: "Budgets & alerts",
    id: "over-budget",
    keywords: ["over budget", "went over", "overspent", "exceeded", "dismiss"],
    question: "I went over a budget — what now?",
  },
  {
    answer:
      "Make sure the whole receipt is in the photo, flat and well lit. If the AI service isn’t switched on for this server, you’ll see a note in the scan window — you can still add the expense by hand in seconds.",
    group: "Importing & receipts",
    id: "receipt-failed",
    keywords: ["receipt failed", "couldn't read", "not working", "scan failed", "ai not configured"],
    question: "Why didn’t my receipt scan work?",
  },
  {
    action: { href: "/profile?tab=security", kind: "link", label: "Password & security" },
    answer:
      "Go to Profile → Password & security to change your password. Forgot it? Use “Forgot password?” on the sign-in page and we’ll email you a link.",
    group: "Account & privacy",
    id: "password",
    keywords: ["password", "reset", "forgot", "sign in", "login", "log in"],
    question: "How do I change or reset my password?",
  },
  {
    action: { href: "/profile?tab=data", kind: "link", label: "Export my data" },
    answer:
      "Profile → Your data lets you download everything as a file at any time, or delete your account and all its records.",
    group: "Account & privacy",
    id: "export",
    keywords: ["export my data", "download", "backup", "delete account", "close account"],
    question: "How do I export or delete my data?",
  },
];

export const HELP_GROUPS: HelpGroup[] = [
  "Getting started",
  "Budgets & alerts",
  "Importing & receipts",
  "Money & planning",
  "Account & privacy",
];

/** Starter questions about the user's own money (answered by the assistant). */
export const MONEY_QUESTIONS = [
  "How much did I spend this month?",
  "What did I spend most on last month?",
  "Who owes me money?",
  "How much have I saved this month?",
];

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9%&\s-]/g, " ");

/**
 * Best-matching help topic for a typed question, or null when it's more
 * likely about the user's own figures ("how much did I spend on TfL?").
 */
export function matchTopic(question: string): HelpTopic | null {
  const text = ` ${words(question)} `;
  // Questions about amounts belong to the assistant, not the help pages.
  if (/\b(how much|spent on|did i spend|total|owes? me|who owes|i owe|saved)\b/.test(text) && !/\bhow do\b/.test(text)) return null;

  let best: { score: number; topic: HelpTopic } | null = null;
  for (const topic of HELP_TOPICS) {
    let score = 0;
    for (const keyword of topic.keywords) {
      // Whole words, plurals too ("budget" matches "budgets").
      const hit = keyword.includes(" ")
        ? text.includes(keyword)
        : text.includes(` ${keyword} `) || text.includes(` ${keyword}s `) || text.includes(` ${keyword}es `);
      if (hit) score += keyword.includes(" ") ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { score, topic };
  }
  return best?.topic ?? null;
}
