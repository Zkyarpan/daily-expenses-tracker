-- =============================================================================
-- Migration: 20240004000000_create_spending_alerts.sql
-- Feature 5: Automated Spending Alerts
--
-- STATUS: CREATED FOR REVIEW — NOT YET APPLIED TO THE DATABASE
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates the `spending_alerts` table — stores computed spending alerts
--      per (user, year, month, categoryId, threshold) with read/dismissed state.
--   2. Enforces a UNIQUE constraint preventing duplicate alerts for the same
--      user/year/month/category/threshold combination.
--   3. Enables Row Level Security with the same per-user isolation pattern
--      as `expenses` and `budgets`.
--   4. Adds a performance index on (user_id, year, month).
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT drop any existing table, column, or policy.
--   • Does NOT disable RLS on any table.
--   • Does NOT reference `categories` with a FK (same reason as budgets).
--
-- HOW TO APPLY:
--   Paste into Supabase Dashboard → SQL Editor → New query → Run
--
-- SAFETY:
--   All statements use IF NOT EXISTS / DROP POLICY IF EXISTS — safe to re-run.
--
-- NOTE: The initial implementation persists alerts in localStorage (client-side)
--       to avoid blocking deployment on this migration.  Once this migration is
--       applied, the useSpendingAlerts hook can be switched to Supabase storage
--       by setting NEXT_PUBLIC_ALERTS_STORAGE=supabase in .env.local.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- TABLE: spending_alerts
-- One row = one spending threshold alert for one user/category/month.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.spending_alerts (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The budget period
  year         integer       NOT NULL,
  month        integer       NOT NULL,
  CONSTRAINT spending_alerts_month_range CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT spending_alerts_year_range  CHECK (year  BETWEEN 2000 AND 2100),

  -- The category this alert belongs to
  "categoryId" text          NOT NULL,

  -- Which threshold fired (warning = 80%, critical = 100%, over = >100%)
  threshold    text          NOT NULL,
  CONSTRAINT spending_alerts_threshold_values CHECK (threshold IN ('warning', 'critical', 'over')),

  -- Snapshot of amounts at the time the alert was generated
  "spentAmount"  numeric(12,2) NOT NULL,
  "limitAmount"  numeric(12,2) NOT NULL,

  -- User interaction state
  "isRead"       boolean       NOT NULL DEFAULT false,
  "isDismissed"  boolean       NOT NULL DEFAULT false,

  -- Timestamps
  "createdAt"  timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz   NOT NULL DEFAULT now(),

  -- One alert per user/year/month/category/threshold combination
  CONSTRAINT spending_alerts_unique
    UNIQUE (user_id, year, month, "categoryId", threshold)
);

COMMENT ON TABLE  public.spending_alerts                   IS 'Computed spending threshold alerts; one row per user/year/month/category/threshold.';
COMMENT ON COLUMN public.spending_alerts.user_id           IS 'Owner. RLS enforces isolation.';
COMMENT ON COLUMN public.spending_alerts.threshold         IS 'warning=80%, critical=100%, over=>100%.';
COMMENT ON COLUMN public.spending_alerts."isRead"          IS 'True after the user acknowledges the alert.';
COMMENT ON COLUMN public.spending_alerts."isDismissed"     IS 'True after the user explicitly dismisses the alert.';


-- ---------------------------------------------------------------------------
-- Performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS spending_alerts_user_year_month_idx
  ON public.spending_alerts (user_id, year, month);

CREATE INDEX IF NOT EXISTS spending_alerts_user_unread_idx
  ON public.spending_alerts (user_id, "isRead", "isDismissed")
  WHERE "isDismissed" = false;


-- ---------------------------------------------------------------------------
-- Auto-update updatedAt trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_spending_alert_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spending_alerts_set_updated_at ON public.spending_alerts;
CREATE TRIGGER spending_alerts_set_updated_at
  BEFORE UPDATE ON public.spending_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_spending_alert_updated_at();


-- ===========================================================================
-- ROW LEVEL SECURITY — strict per-user isolation (mirrors budgets policies)
-- ===========================================================================
ALTER TABLE public.spending_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees only their own alerts
DROP POLICY IF EXISTS "spending_alerts_select_own" ON public.spending_alerts;
CREATE POLICY "spending_alerts_select_own"
  ON public.spending_alerts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: user can only insert alerts they own
DROP POLICY IF EXISTS "spending_alerts_insert_own" ON public.spending_alerts;
CREATE POLICY "spending_alerts_insert_own"
  ON public.spending_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: user can only update their own alerts; cannot change user_id
DROP POLICY IF EXISTS "spending_alerts_update_own" ON public.spending_alerts;
CREATE POLICY "spending_alerts_update_own"
  ON public.spending_alerts
  FOR UPDATE
  TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: user can only delete their own alerts
DROP POLICY IF EXISTS "spending_alerts_delete_own" ON public.spending_alerts;
CREATE POLICY "spending_alerts_delete_own"
  ON public.spending_alerts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
