-- =============================================================================
-- Migration: 20240006000000_create_budgets_table.sql
-- Fixes: "Could not find the table 'public.budgets' in the schema cache"
--        (PostgREST PGRST205 on the Budgets page).
--
-- CAUSE:
--   20240003000000_create_budgets.sql was written but never applied, so the
--   live database has no public.budgets table (verified 2026-11-12 via the
--   Data API: budgets → 404 PGRST205; expenses/trackers → 200).
--
-- WHAT THIS MIGRATION DOES (forward-only, one transaction):
--   1. Creates public.budgets with exactly the columns used by
--      src/lib/supabase/budgets.ts and src/entities/Budget.ts:
--        id, user_id, year, month, "categoryId", "limitAmount",
--        "createdAt", "updatedAt"
--   2. Per-user ownership: user_id → auth.users(id), defaulting to auth.uid().
--   3. Validation mirroring src/lib/budgetValidation.ts:
--        month 1–12, year 2000–2100, limit > 0 and ≤ 9,999,999,999.99
--        (numeric(12,2)), categoryId non-blank; one budget per
--        user/year/month/category.
--   4. Keeps "updatedAt" current on UPDATE (trigger).
--   5. RLS: authenticated users can only select/insert/update/delete their own
--      rows (no TRUNCATE); anon has no table privileges.
--   6. Reloads the PostgREST schema cache so the API sees the table at once.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does not touch expenses, trackers, trackerEntries or any existing data.
--   • No DROP TABLE / TRUNCATE / DELETE / ALTER of existing objects.
--   • No FK on "categoryId": public.categories does not exist in the live DB
--     (verified 2026-11-12) and expenses."categoryId" is plain text too.
--
-- SUPERSEDES: 20240003000000_create_budgets.sql (never applied). Do not run
--   that file in addition to this one; it is not needed.
--
-- HOW TO APPLY (manually):
--   Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--   If public.budgets already exists, CREATE TABLE fails and the whole
--   transaction rolls back with nothing changed. That is deliberate, so a
--   mismatched table is never silently kept.
--
-- ROLLBACK (only if you need to undo before any budgets are saved):
--   DROP TABLE public.budgets;  DROP FUNCTION public.budgets_touch_updated_at();
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE public.budgets (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner. The app sends user_id on INSERT; the default is a safety net.
  -- ON DELETE CASCADE matches expenses: deleting an account removes its budgets.
  user_id       uuid          NOT NULL DEFAULT auth.uid()
                              REFERENCES auth.users (id) ON DELETE CASCADE,

  year          integer       NOT NULL,
  month         integer       NOT NULL,          -- 1-based: 1 = January
  "categoryId"  text          NOT NULL,          -- matches expenses."categoryId"
  "limitAmount" numeric(12,2) NOT NULL,

  "createdAt"   timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT budgets_month_range        CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT budgets_year_range         CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT budgets_limit_positive     CHECK ("limitAmount" > 0),
  CONSTRAINT budgets_category_not_blank CHECK (length(btrim("categoryId")) BETWEEN 1 AND 64),

  -- One budget per user per month per category. The app maps the resulting
  -- 23505 error to "A budget for this category and month already exists."
  -- Its index (user_id, year, month, "categoryId") also serves the app's
  -- month query (RLS user_id + year + month) and user_id lookups for the FK,
  -- so no separate index is needed.
  CONSTRAINT budgets_unique_user_month_category
    UNIQUE (user_id, year, month, "categoryId")
);

COMMENT ON TABLE  public.budgets               IS 'Monthly category spending limits; one row per user/year/month/category.';
COMMENT ON COLUMN public.budgets.user_id       IS 'Owner (auth.users.id). RLS restricts every operation to the owner.';
COMMENT ON COLUMN public.budgets.month         IS '1-based month: 1 = January … 12 = December.';
COMMENT ON COLUMN public.budgets."categoryId"  IS 'Text category ID matching expenses."categoryId" (e.g. "1" = Grocery).';
COMMENT ON COLUMN public.budgets."limitAmount" IS 'Spending limit for the category/month. Must be > 0.';

-- ---------------------------------------------------------------------------
-- Keep "updatedAt" current on every UPDATE
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.budgets_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER budgets_set_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.budgets_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only (RLS below narrows to their own rows)
-- Supabase's default privileges grant ALL (incl. TRUNCATE, which bypasses
-- RLS) to anon and authenticated on new public tables; reset to the four
-- operations the app needs.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.budgets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.budgets TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: strict per-user isolation
-- ---------------------------------------------------------------------------
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_select_own ON public.budgets
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY budgets_insert_own ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- USING limits which rows can be targeted; WITH CHECK stops reassigning
-- a budget to another user.
CREATE POLICY budgets_update_own ON public.budgets
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY budgets_delete_own ON public.budgets
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;

-- Make the Data API (PostgREST) pick up the new table immediately.
NOTIFY pgrst, 'reload schema';
