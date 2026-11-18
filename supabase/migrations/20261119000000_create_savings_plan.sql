-- =============================================================================
-- Migration: 20261119000000_create_savings_plan.sql
-- Feature: Savings plan — fixed monthly costs and long-term savings goals
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates `fixed_costs` — money that leaves every month whatever happens
--      (rent, phone, gym…), optionally with the day of the month it is paid.
--   2. Creates `savings_goals` — long-term targets (emergency fund, holiday…)
--      with the amount saved so far and an optional deadline. The app works
--      out how much to put aside each month to hit each deadline.
--   3. Enables RLS on both: each user can only see and change their own rows.
--
-- Salary comes from profiles."monthlyIncome" (20261117000000_create_profiles.sql).
--
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--   (The app's "Finish setup" card copies all three setup files in order.)
--
-- SAFETY:
--   Idempotent — IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS.
--   No existing table, column or policy is changed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;


-- ===========================================================================
-- 1. TABLE: fixed_costs
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text          NOT NULL,
  amount       numeric(12,2) NOT NULL,
  "dueDay"     integer,
  "createdAt"  timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT fixed_costs_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT fixed_costs_amount_range CHECK (amount > 0 AND amount < 10000000),
  CONSTRAINT fixed_costs_due_day      CHECK ("dueDay" IS NULL OR "dueDay" BETWEEN 1 AND 31)
);

COMMENT ON TABLE public.fixed_costs IS 'Recurring monthly costs (rent, bills). Secured by RLS.';

CREATE INDEX IF NOT EXISTS fixed_costs_user_idx ON public.fixed_costs (user_id);

DROP TRIGGER IF EXISTS fixed_costs_set_updated_at ON public.fixed_costs;
CREATE TRIGGER fixed_costs_set_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_updated_at();

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixed_costs_select_own" ON public.fixed_costs;
CREATE POLICY "fixed_costs_select_own" ON public.fixed_costs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "fixed_costs_insert_own" ON public.fixed_costs;
CREATE POLICY "fixed_costs_insert_own" ON public.fixed_costs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "fixed_costs_update_own" ON public.fixed_costs;
CREATE POLICY "fixed_costs_update_own" ON public.fixed_costs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "fixed_costs_delete_own" ON public.fixed_costs;
CREATE POLICY "fixed_costs_delete_own" ON public.fixed_costs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ===========================================================================
-- 2. TABLE: savings_goals
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  "targetAmount"  numeric(12,2) NOT NULL,
  "savedAmount"   numeric(12,2) NOT NULL DEFAULT 0,
  "targetDate"    date,
  "createdAt"     timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT savings_goals_name_length  CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT savings_goals_target_range CHECK ("targetAmount" > 0 AND "targetAmount" < 10000000),
  CONSTRAINT savings_goals_saved_range  CHECK ("savedAmount" >= 0 AND "savedAmount" < 10000000)
);

COMMENT ON TABLE public.savings_goals IS 'Long-term savings targets with optional deadlines. Secured by RLS.';

CREATE INDEX IF NOT EXISTS savings_goals_user_idx ON public.savings_goals (user_id, "targetDate");

DROP TRIGGER IF EXISTS savings_goals_set_updated_at ON public.savings_goals;
CREATE TRIGGER savings_goals_set_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_updated_at();

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings_goals_select_own" ON public.savings_goals;
CREATE POLICY "savings_goals_select_own" ON public.savings_goals FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "savings_goals_insert_own" ON public.savings_goals;
CREATE POLICY "savings_goals_insert_own" ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "savings_goals_update_own" ON public.savings_goals;
CREATE POLICY "savings_goals_update_own" ON public.savings_goals FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "savings_goals_delete_own" ON public.savings_goals;
CREATE POLICY "savings_goals_delete_own" ON public.savings_goals FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ===========================================================================
-- VERIFY (optional)
-- ===========================================================================
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('fixed_costs', 'savings_goals');
