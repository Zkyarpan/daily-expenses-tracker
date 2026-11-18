/**
 * GET /api/setup/sql — the SQL a signed-in user pastes into the Supabase SQL
 * editor once, to create the tables for profiles, Lend & borrow, the
 * Wishlist and the Savings plan. All migrations are idempotent and are
 * returned in the order they must run. Read-only; nothing is executed here.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { apiError, authenticate, NO_STORE } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATIONS = [
  "20261117000000_create_profiles.sql",
  "20261118000000_create_ious_and_wishlist.sql",
  "20261119000000_create_savings_plan.sql",
];

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  try {
    const parts = await Promise.all(
      MIGRATIONS.map((file) => readFile(path.join(process.cwd(), "supabase", "migrations", file), "utf8")),
    );
    return new Response(parts.join("\n\n"), {
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return apiError(500, "The setup SQL could not be read. Open the files in supabase/migrations instead.");
  }
}
