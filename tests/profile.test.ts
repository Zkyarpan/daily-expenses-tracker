/**
 * tests/profile.test.ts
 *
 * Unit tests for the profile backend's pure parts:
 *  1. Request schemas (src/lib/profile/schemas.ts) — what the API accepts
 *  2. Schemas vs. the SQL migration — limits and activity events agree
 *  3. Formatting helpers (src/lib/profile/format.ts) — device labels,
 *     email masking, password strength, CSV export
 *  4. Sample data generator (src/lib/sampleData.ts) — id namespace, dates
 *
 * Run: node_modules/.bin/tsx --test tests/profile.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildExpensesCsv, deviceLabel, EXPORT_HEADERS, maskEmail, passwordStrength } from "../src/lib/profile/format.js";
import {
  ACTIVITY_EVENTS,
  ACTIVITY_LABELS,
  deleteAccountSchema,
  emailChangeSchema,
  passwordChangeSchema,
  profileUpdateSchema,
} from "../src/lib/profile/schemas.js";
import { generateSampleData, isSampleId, SAMPLE_ID_MAX, SAMPLE_ID_MIN } from "../src/lib/sampleData.js";

const MIGRATION = readFileSync(
  new URL("../supabase/migrations/20261117000000_create_profiles.sql", import.meta.url),
  "utf8",
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Request schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("profileUpdateSchema", () => {
  it("accepts a full valid update and trims the name", () => {
    const parsed = profileUpdateSchema.parse({
      avatarSeed: "a1b2c3d4-0-3",
      fullName: "  Jane Doe  ",
      monthlyIncome: 2500.5,
      theme: "dark",
    });
    assert.equal(parsed.fullName, "Jane Doe");
    assert.equal(parsed.monthlyIncome, 2500.5);
  });

  it("accepts partial updates and explicit nulls (clearing a field)", () => {
    assert.ok(profileUpdateSchema.safeParse({ theme: "system" }).success);
    assert.ok(profileUpdateSchema.safeParse({ avatarSeed: null, monthlyIncome: null }).success);
  });

  it("rejects an empty body", () => {
    assert.equal(profileUpdateSchema.safeParse({}).success, false);
  });

  it("rejects unknown keys so clients cannot write other columns", () => {
    assert.equal(profileUpdateSchema.safeParse({ fullName: "Jane Doe", id: "someone-else" }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ user_id: "x" }).success, false);
  });

  it("validates names", () => {
    assert.equal(profileUpdateSchema.safeParse({ fullName: " J " }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ fullName: "x".repeat(81) }).success, false);
    assert.ok(profileUpdateSchema.safeParse({ fullName: "Jo" }).success);
  });

  it("validates avatar seeds", () => {
    assert.equal(profileUpdateSchema.safeParse({ avatarSeed: "<script>" }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ avatarSeed: "a".repeat(41) }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ avatarSeed: "" }).success, false);
  });

  it("validates monthly income: positive, below the cap, whole pence", () => {
    for (const bad of [0, -10, 10_000_000, 2500.123, Number.NaN, "2500"]) {
      assert.equal(profileUpdateSchema.safeParse({ monthlyIncome: bad }).success, false, String(bad));
    }
    for (const good of [0.01, 2500, 2500.1, 1234.56, 9_999_999.99]) {
      assert.ok(profileUpdateSchema.safeParse({ monthlyIncome: good }).success, String(good));
    }
  });

  it("only accepts known themes", () => {
    assert.equal(profileUpdateSchema.safeParse({ theme: "blue" }).success, false);
  });
});

describe("passwordChangeSchema", () => {
  it("requires the current password and an 8–72 character new one", () => {
    assert.equal(passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "longenough1" }).success, false);
    assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-pass", newPassword: "short" }).success, false);
    assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-pass", newPassword: "x".repeat(73) }).success, false);
    assert.ok(passwordChangeSchema.safeParse({ currentPassword: "old-pass", newPassword: "new-pass-123" }).success);
  });

  it("rejects reusing the current password, pointing at newPassword", () => {
    const result = passwordChangeSchema.safeParse({ currentPassword: "same-pass-1", newPassword: "same-pass-1" });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["newPassword"]);
  });
});

describe("emailChangeSchema and deleteAccountSchema", () => {
  it("validates email addresses", () => {
    assert.ok(emailChangeSchema.safeParse({ email: "new@example.com" }).success);
    assert.equal(emailChangeSchema.safeParse({ email: "not-an-email" }).success, false);
  });

  it("requires the exact confirmation word and a password", () => {
    assert.ok(deleteAccountSchema.safeParse({ confirmation: "DELETE", password: "pw" }).success);
    assert.equal(deleteAccountSchema.safeParse({ confirmation: "delete", password: "pw" }).success, false);
    assert.equal(deleteAccountSchema.safeParse({ confirmation: "DELETE", password: "" }).success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Schemas agree with the SQL migration
// ─────────────────────────────────────────────────────────────────────────────

describe("schemas vs. migration", () => {
  it("allows exactly the same activity events as the database CHECK constraint", () => {
    const block = /account_activity_event_values CHECK \(event IN \(([\s\S]*?)\)\)/.exec(MIGRATION)?.[1] ?? "";
    const sqlEvents = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(sqlEvents, [...ACTIVITY_EVENTS].sort());
  });

  it("has a label for every activity event", () => {
    for (const event of ACTIVITY_EVENTS) assert.ok(ACTIVITY_LABELS[event], event);
  });

  it("enforces the same name, seed and income limits", () => {
    assert.match(MIGRATION, /char_length\(btrim\("fullName"\)\) BETWEEN 2 AND 80/);
    assert.match(MIGRATION, /"avatarSeed" ~ '\^\[A-Za-z0-9-\]\{1,40\}\$'/);
    assert.match(MIGRATION, /"monthlyIncome" > 0 AND "monthlyIncome" < 10000000/);
  });

  it("enables row level security on both new tables", () => {
    assert.match(MIGRATION, /ALTER TABLE public\.profiles ENABLE ROW LEVEL SECURITY/);
    assert.match(MIGRATION, /ALTER TABLE public\.account_activity ENABLE ROW LEVEL SECURITY/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("deviceLabel", () => {
  it("summarises common user agents without keeping the raw string", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
    assert.equal(deviceLabel(mac), "Chrome on macOS");
    assert.equal(
      deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0"),
      "Edge on Windows",
    );
    assert.equal(
      deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"),
      "Safari on iOS",
    );
    assert.equal(deviceLabel("Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0"), "Firefox on Linux");
  });

  it("handles missing or unknown agents", () => {
    assert.equal(deviceLabel(null), null);
    assert.equal(deviceLabel("curl/8.0"), "Unknown device");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    assert.equal(maskEmail("jane.doe@example.com"), "j*******@example.com");
    assert.equal(maskEmail("ab@x.io"), "a*@x.io");
    assert.equal(maskEmail("a@x.io"), "a*@x.io");
    assert.equal(maskEmail("broken"), "***");
  });
});

describe("passwordStrength", () => {
  it("scores 0 below the minimum length and rises with variety", () => {
    assert.equal(passwordStrength("Ab1!"), 0);
    assert.equal(passwordStrength("abcdefgh"), 1);
    assert.equal(passwordStrength("abcdefgh1"), 2);
    assert.equal(passwordStrength("Abcdefgh1"), 3);
    assert.equal(passwordStrength("Abcdefgh1!xyz"), 4);
  });
});

describe("buildExpensesCsv", () => {
  const csv = buildExpensesCsv([
    { amount: "12.5", categoryId: "2", date: "2026-03-02", description: "Pizza, extra cheese", memberId: "1", tagId: "joe-and-pie" },
    { amount: -5, categoryId: null, date: "2025-01-01", description: "=HYPERLINK(\"x\")", memberId: null, tagId: null },
  ]);
  const lines = csv.split("\r\n");

  it("writes the header and sorts rows oldest first", () => {
    assert.equal(lines[0], EXPORT_HEADERS.join(","));
    assert.ok(lines[1].startsWith("2025-01-01,"));
    assert.ok(lines[2].startsWith("2026-03-02,"));
  });

  it("resolves names and quotes commas", () => {
    assert.equal(lines[2], '2026-03-02,"Pizza, extra cheese",Takeout,Joe & Pie,Usman,12.5');
  });

  it("neutralises spreadsheet formulas and labels uncategorised rows", () => {
    assert.equal(lines[1], `2025-01-01,"'=HYPERLINK(""x"")",Uncategorized,,,-5`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sample data
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSampleData", () => {
  const today = new Date(2026, 10, 17);
  const data = generateSampleData(today);
  const ids = [
    ...data.expenses.map((e) => e.id),
    ...data.budgets.map((b) => b.id),
    ...data.trackers.map((t) => t.id),
    ...data.trackers.flatMap((t) => t.entries.map((e) => e.id)),
  ];

  it("puts every id in the reserved sample range, uniquely", () => {
    assert.ok(ids.every((id) => isSampleId(id) && id >= SAMPLE_ID_MIN && id <= SAMPLE_ID_MAX));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("covers 1 January last year to today, with nothing in the future", () => {
    const dates = data.expenses.map((e) => e.date).sort();
    assert.equal(dates[0], "2025-01-01");
    assert.ok(dates.at(-1)! <= "2026-11-17");
    assert.equal(data.months, 23);
    assert.ok(data.trackers.flatMap((t) => t.entries).every((e) => e.date <= "2026-11-17"));
  });

  it("includes refunds and uncategorised rows, and never a zero amount", () => {
    assert.ok(data.expenses.some((e) => e.amount < 0));
    assert.ok(data.expenses.some((e) => e.categoryId === null));
    assert.ok(data.expenses.every((e) => e.amount !== 0));
  });

  it("keeps tracker balances consistent with their entries", () => {
    for (const tracker of data.trackers) {
      const expected = tracker.entries.reduce((b, e) => Math.round((b + e.debit - e.credit) * 100) / 100, tracker.initialBalance);
      assert.equal(tracker.currentBalance, expected, tracker.title);
    }
  });

  it("creates six months of budgets with distinct month/category pairs", () => {
    const keys = data.budgets.map((b) => `${b.year}-${b.month}-${b.categoryId}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(new Set(data.budgets.map((b) => `${b.year}-${b.month}`)).size, 6);
  });
});
