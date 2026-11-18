-- =============================================================================
-- Migration: 20261118000000_create_ious_and_wishlist.sql
-- Feature: Lend & borrow (IOUs), Wishlist, monthly savings goal
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates `ious` — money lent to or borrowed from a person, with partial
--      repayments (`paidAmount`) and a settled date. A trigger keeps
--      `settledAt` consistent with `paidAmount` (settled ⇔ fully paid).
--   2. Creates `wishlist_items` — things the user wants to buy: price,
--      priority, money already set aside, optional link/notes/target date,
--      and the purchase date (+ the expense created when it was bought).
--   3. Adds `monthlySavingsGoal` to `profiles` (if that table exists — it is
--      created by 20261117000000_create_profiles.sql; run that one first).
--   4. Enables RLS on both new tables: each user can only see and change
--      their own rows.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT drop or alter existing tables, columns or policies
--     (apart from adding one nullable column to profiles).
--
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--   (The app's "Finish setup" card copies this file together with the
--   profiles migration, in the right order.)
--
-- SAFETY:
--   Idempotent — IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS.
-- =============================================================================


-- ===========================================================================
-- Shared: keep "updatedAt" current
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.set_money_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;


-- ===========================================================================
-- 1. TABLE: ious (lend & borrow)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ious (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'lent'     = I gave money → they owe me
  -- 'borrowed' = they gave me money → I owe them
  direction     text          NOT NULL,
  person        text          NOT NULL,
  amount        numeric(12,2) NOT NULL,
  "paidAmount"  numeric(12,2) NOT NULL DEFAULT 0,
  description   text,
  date          date          NOT NULL DEFAULT current_date,
  "dueDate"     date,
  "settledAt"   timestamptz,
  "createdAt"   timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT ious_direction_values  CHECK (direction IN ('lent', 'borrowed')),
  CONSTRAINT ious_person_length     CHECK (char_length(btrim(person)) BETWEEN 1 AND 60),
  CONSTRAINT ious_amount_range      CHECK (amount > 0 AND amount < 10000000),
  CONSTRAINT ious_paid_range        CHECK ("paidAmount" >= 0 AND "paidAmount" <= amount),
  CONSTRAINT ious_description_len   CHECK (description IS NULL OR char_length(description) <= 200)
);

COMMENT ON TABLE  public.ious              IS 'Money lent to / borrowed from people. Secured by RLS.';
COMMENT ON COLUMN public.ious.direction    IS 'lent = they owe the user; borrowed = the user owes them.';
COMMENT ON COLUMN public.ious."paidAmount" IS 'Repaid so far (0 … amount).';
COMMENT ON COLUMN public.ious."settledAt"  IS 'Set automatically when paidAmount reaches amount.';

CREATE INDEX IF NOT EXISTS ious_user_open_idx ON public.ious (user_id, "settledAt", date DESC);
CREATE INDEX IF NOT EXISTS ious_user_person_idx ON public.ious (user_id, lower(person));

-- Settled ⇔ fully repaid, whatever the client sends.
CREATE OR REPLACE FUNCTION public.ious_sync_settled()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.person := btrim(NEW.person);
  IF NEW."paidAmount" >= NEW.amount THEN
    NEW."settledAt" := coalesce(NEW."settledAt", now());
  ELSE
    NEW."settledAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ious_sync_settled ON public.ious;
CREATE TRIGGER ious_sync_settled
  BEFORE INSERT OR UPDATE ON public.ious
  FOR EACH ROW EXECUTE FUNCTION public.ious_sync_settled();

DROP TRIGGER IF EXISTS ious_set_updated_at ON public.ious;
CREATE TRIGGER ious_set_updated_at
  BEFORE UPDATE ON public.ious
  FOR EACH ROW EXECUTE FUNCTION public.set_money_updated_at();

ALTER TABLE public.ious ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ious_select_own" ON public.ious;
CREATE POLICY "ious_select_own" ON public.ious FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ious_insert_own" ON public.ious;
CREATE POLICY "ious_insert_own" ON public.ious FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ious_update_own" ON public.ious;
CREATE POLICY "ious_update_own" ON public.ious FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ious_delete_own" ON public.ious;
CREATE POLICY "ious_delete_own" ON public.ious FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ===========================================================================
-- 2. TABLE: wishlist_items
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid          NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text          NOT NULL,
  price          numeric(12,2) NOT NULL,
  "savedAmount"  numeric(12,2) NOT NULL DEFAULT 0,
  priority       text          NOT NULL DEFAULT 'medium',
  "categoryId"   text          NOT NULL DEFAULT '4',      -- Shopping; used for the expense when bought
  url            text,
  notes          text,
  "targetDate"   date,
  "purchasedAt"  date,
  "expenseId"    uuid,                                    -- expense created when marked bought
  "createdAt"    timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT wishlist_name_length    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT wishlist_price_range    CHECK (price > 0 AND price < 10000000),
  CONSTRAINT wishlist_saved_range    CHECK ("savedAmount" >= 0 AND "savedAmount" < 10000000),
  CONSTRAINT wishlist_priority_values CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT wishlist_category_length CHECK (char_length("categoryId") BETWEEN 1 AND 64),
  CONSTRAINT wishlist_url_format     CHECK (url IS NULL OR (char_length(url) <= 500 AND url ~* '^https?://')),
  CONSTRAINT wishlist_notes_length   CHECK (notes IS NULL OR char_length(notes) <= 300)
);

COMMENT ON TABLE  public.wishlist_items               IS 'Things the user wants to buy. Secured by RLS.';
COMMENT ON COLUMN public.wishlist_items."savedAmount" IS 'Money already set aside for this item.';
COMMENT ON COLUMN public.wishlist_items."expenseId"   IS 'Expense recorded when the item was marked bought (if any).';

CREATE INDEX IF NOT EXISTS wishlist_user_open_idx ON public.wishlist_items (user_id, "purchasedAt", priority);

DROP TRIGGER IF EXISTS wishlist_set_updated_at ON public.wishlist_items;
CREATE TRIGGER wishlist_set_updated_at
  BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_money_updated_at();

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist_items;
CREATE POLICY "wishlist_select_own" ON public.wishlist_items FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist_items;
CREATE POLICY "wishlist_insert_own" ON public.wishlist_items FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "wishlist_update_own" ON public.wishlist_items;
CREATE POLICY "wishlist_update_own" ON public.wishlist_items FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist_items;
CREATE POLICY "wishlist_delete_own" ON public.wishlist_items FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ===========================================================================
-- 3. profiles."monthlySavingsGoal"
-- ===========================================================================
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS "monthlySavingsGoal" numeric(12,2);

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_monthly_savings_goal_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_monthly_savings_goal_range
      CHECK ("monthlySavingsGoal" IS NULL OR ("monthlySavingsGoal" > 0 AND "monthlySavingsGoal" < 10000000));
  END IF;
END;
$$;


-- ===========================================================================
-- 4. delete_my_account() also removes the new tables
--    (both reference auth.users ON DELETE CASCADE, so this is belt and braces)
-- ===========================================================================
-- No change needed: rows cascade when the auth user is deleted.


-- ===========================================================================
-- VERIFY (optional)
-- ===========================================================================
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('ious', 'wishlist_items');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'profiles' AND column_name = 'monthlySavingsGoal';
