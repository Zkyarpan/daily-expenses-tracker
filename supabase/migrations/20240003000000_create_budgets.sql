-- =============================================================================
-- Migration: 20240003000000_create_budgets.sql
-- Feature 4: Monthly Category Budget Management
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates the `budgets` table — one row per (user, year, month, categoryId).
--      A UNIQUE constraint prevents duplicate budgets for the same month/category.
--   2. Enables Row Level Security with per-user isolation identical to expenses.
--   3. Adds a performance index on (user_id, year, month).
--   4. Adds a CHECK constraint preventing negative limit values.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT drop any existing table, column, or policy.
--   • Does NOT disable RLS on any table.
--   • Does NOT reference the `categories` table with a FK constraint because
--     the live database may not have `categories` (the app resolves category
--     names from DEFAULT_CATEGORIES in src/lib/config.ts).
--
-- HOW TO APPLY:
--   Paste into Supabase Dashboard → SQL Editor → New query → Run
--
-- SAFETY:
--   All statements use IF NOT EXISTS / DROP POLICY IF EXISTS — safe to re-run.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- TABLE: budgets
-- One row = one monthly category budget for one user.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The year and month this budget applies to (e.g. 2025, 11 for November 2025)
  year         integer       NOT NULL,
  month        integer       NOT NULL,     -- 1-based: 1 = January … 12 = December
  CONSTRAINT budgets_month_range CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT budgets_year_range  CHECK (year  BETWEEN 2000 AND 2100),

  -- Category reference — stored as text to match expenses.categoryId (no FK)
  "categoryId" text          NOT NULL,

  -- The spending limit for this category in this month
  "limitAmount" numeric(12,2) NOT NULL,
  CONSTRAINT budgets_limit_positive CHECK ("limitAmount" > 0),

  -- Timestamps
  "createdAt"  timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz   NOT NULL DEFAULT now(),

  -- One budget per user per month per category
  CONSTRAINT budgets_unique_user_month_category
    UNIQUE (user_id, year, month, "categoryId")
);

COMMENT ON TABLE  public.budgets                  IS 'Monthly category spending limits; one row per user/year/month/category.';
COMMENT ON COLUMN public.budgets.user_id          IS 'Owner of this budget.  RLS enforces isolation.';
COMMENT ON COLUMN public.budgets.year             IS 'Calendar year (e.g. 2025).';
COMMENT ON COLUMN public.budgets.month            IS '1-based month number: 1=Jan … 12=Dec.';
COMMENT ON COLUMN public.budgets."categoryId"     IS 'Text category ID matching expenses.categoryId (e.g. "1" for Grocery).';
COMMENT ON COLUMN public.budgets."limitAmount"    IS 'Maximum allowed spend for this category/month.  Must be positive.';


-- ---------------------------------------------------------------------------
-- Performance index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS budgets_user_year_month_idx
  ON public.budgets (user_id, year, month);

CREATE INDEX IF NOT EXISTS budgets_user_category_idx
  ON public.budgets (user_id, "categoryId");


-- ---------------------------------------------------------------------------
-- Auto-update updatedAt trigger (reuse the function from migration 20240002)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_budget_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_set_updated_at ON public.budgets;
CREATE TRIGGER budgets_set_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_budget_updated_at();


-- ===========================================================================
-- ROW LEVEL SECURITY — strict per-user isolation (mirrors expenses policies)
-- ===========================================================================
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees only their own budgets
DROP POLICY IF EXISTS "budgets_select_own" ON public.budgets;
CREATE POLICY "budgets_select_own"
  ON public.budgets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: user can only insert budgets they own
DROP POLICY IF EXISTS "budgets_insert_own" ON public.budgets;
CREATE POLICY "budgets_insert_own"
  ON public.budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: user can only update their own budgets; cannot change user_id
DROP POLICY IF EXISTS "budgets_update_own" ON public.budgets;
CREATE POLICY "budgets_update_own"
  ON public.budgets
  FOR UPDATE
  TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: user can only delete their own budgets
DROP POLICY IF EXISTS "budgets_delete_own" ON public.budgets;
CREATE POLICY "budgets_delete_own"
  ON public.budgets
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
