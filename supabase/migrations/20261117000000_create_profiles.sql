-- =============================================================================
-- Migration: 20261117000000_create_profiles.sql
-- Feature: User profiles and account management (backend for /profile)
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates `profiles` — one row per auth user (name, generated-avatar seed,
--      monthly income, theme preference) with CHECK constraints that mirror the
--      API's Zod validation, and RLS so each user reads/writes only their row.
--   2. Creates a row automatically for every new sign-up (trigger on
--      auth.users) and backfills rows for existing users from the values the
--      app previously stored in auth user_metadata.
--   3. Creates `account_activity` — an append-only security/activity log
--      (password changed, email change requested, sign-out everywhere, sample
--      data loaded, export…). Users can read and add their own events only;
--      events older than 365 days are pruned automatically.
--   4. Creates `profile_stats()` — one round-trip summary for the profile page
--      (counts, first expense date, spent this year/month). SECURITY INVOKER,
--      so the caller's RLS applies.
--   5. Creates `delete_my_account()` — deletes the caller's data and their
--      auth user. SECURITY DEFINER (it must delete from auth.users) but it
--      only ever acts on auth.uid(); the API additionally re-checks the
--      password and a typed confirmation before calling it.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT drop or alter any existing table, column or policy.
--   • Does NOT disable RLS anywhere.
--
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--   Until it is applied, the app keeps working: profile fields fall back to
--   auth user_metadata, and activity history / account deletion are shown as
--   unavailable.
--
-- SAFETY:
--   Idempotent — IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS
--   throughout, and the backfill uses ON CONFLICT DO NOTHING. Safe to re-run.
-- =============================================================================


-- ===========================================================================
-- 1. TABLE: profiles
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "fullName"      text,
  "avatarSeed"    text,
  "monthlyIncome" numeric(12,2),
  theme           text,
  "createdAt"     timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT profiles_full_name_length
    CHECK ("fullName" IS NULL OR char_length(btrim("fullName")) BETWEEN 2 AND 80),
  CONSTRAINT profiles_avatar_seed_format
    CHECK ("avatarSeed" IS NULL OR "avatarSeed" ~ '^[A-Za-z0-9-]{1,40}$'),
  CONSTRAINT profiles_monthly_income_range
    CHECK ("monthlyIncome" IS NULL OR ("monthlyIncome" > 0 AND "monthlyIncome" < 10000000)),
  -- NULL = never chosen; the app then adopts the device's current theme.
  CONSTRAINT profiles_theme_values
    CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'))
);

COMMENT ON TABLE  public.profiles                 IS 'One profile per auth user. Secured by RLS (id = auth.uid()).';
COMMENT ON COLUMN public.profiles."avatarSeed"    IS 'Seed for the locally generated avatar; no image is stored.';
COMMENT ON COLUMN public.profiles."monthlyIncome" IS 'Optional; used to show the share of income spent each month.';
COMMENT ON COLUMN public.profiles.theme           IS 'light | dark | system; NULL until the user picks one.';

CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- No DELETE policy: a profile is removed with its auth user (ON DELETE
-- CASCADE) or by delete_my_account().


-- ===========================================================================
-- 2. New sign-ups get a profile; existing users are backfilled
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, "fullName")
  VALUES (
    NEW.id,
    CASE
      WHEN char_length(btrim(coalesce(NEW.raw_user_meta_data->>'full_name', ''))) BETWEEN 2 AND 80
      THEN btrim(NEW.raw_user_meta_data->>'full_name')
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a sign-up; the API creates a missing profile on first read.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill from user_metadata (where the app stored these before this table
-- existed). Nested CASEs guarantee a value is validated before it is cast.
INSERT INTO public.profiles (id, "fullName", "avatarSeed", "monthlyIncome")
SELECT
  u.id,
  CASE
    WHEN char_length(btrim(coalesce(u.raw_user_meta_data->>'full_name', ''))) BETWEEN 2 AND 80
    THEN btrim(u.raw_user_meta_data->>'full_name')
  END,
  CASE
    WHEN coalesce(u.raw_user_meta_data->>'avatar_seed', '') ~ '^[A-Za-z0-9-]{1,40}$'
    THEN u.raw_user_meta_data->>'avatar_seed'
  END,
  CASE
    WHEN coalesce(u.raw_user_meta_data->>'monthly_income', '') ~ '^[0-9]{1,7}(\.[0-9]{1,2})?$'
    THEN CASE
      WHEN (u.raw_user_meta_data->>'monthly_income')::numeric > 0
      THEN (u.raw_user_meta_data->>'monthly_income')::numeric
    END
  END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- 3. TABLE: account_activity (append-only)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.account_activity (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event       text        NOT NULL,
  detail      text,
  device      text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),

  -- Keep in sync with ACTIVITY_EVENTS in src/lib/profile/schemas.ts
  -- (tests/profile.test.ts checks this).
  CONSTRAINT account_activity_event_values CHECK (event IN (
    'profile_updated',
    'password_changed',
    'password_change_failed',
    'email_change_requested',
    'signed_out_everywhere',
    'sample_data_loaded',
    'sample_data_removed',
    'data_exported'
  )),
  CONSTRAINT account_activity_detail_length CHECK (detail IS NULL OR char_length(detail) <= 200),
  CONSTRAINT account_activity_device_length CHECK (device IS NULL OR char_length(device) <= 80)
);

COMMENT ON TABLE  public.account_activity        IS 'Per-user account/security events. Append-only for users; pruned after 365 days.';
COMMENT ON COLUMN public.account_activity.device IS 'Coarse label such as "Chrome on macOS" — never the raw user agent or IP.';

CREATE INDEX IF NOT EXISTS account_activity_user_created_idx
  ON public.account_activity (user_id, "createdAt" DESC);

ALTER TABLE public.account_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_activity_select_own" ON public.account_activity;
CREATE POLICY "account_activity_select_own"
  ON public.account_activity FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "account_activity_insert_own" ON public.account_activity;
CREATE POLICY "account_activity_insert_own"
  ON public.account_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- No UPDATE/DELETE policies: users cannot rewrite their history.

CREATE OR REPLACE FUNCTION public.prune_account_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.account_activity
  WHERE user_id = NEW.user_id
    AND "createdAt" < now() - interval '365 days';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS account_activity_prune ON public.account_activity;
CREATE TRIGGER account_activity_prune
  AFTER INSERT ON public.account_activity
  FOR EACH ROW EXECUTE FUNCTION public.prune_account_activity();


-- ===========================================================================
-- 4. FUNCTION: profile_stats()  — runs with the caller's RLS
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.profile_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  uid         uuid := auth.uid();
  year_start  date := date_trunc('year', current_date)::date;
  month_start date := date_trunc('month', current_date)::date;
  result      jsonb;
  n           bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'expenses',         count(*),
    'firstExpenseDate', min(e.date),
    'spentThisYear',    coalesce(sum(e.amount) FILTER (
                          WHERE e.date >= year_start AND e.date < year_start + interval '1 year'), 0),
    'spentThisMonth',   coalesce(sum(e.amount) FILTER (
                          WHERE e.date >= month_start AND e.date < month_start + interval '1 month'), 0)
  )
  INTO result
  FROM public.expenses e
  WHERE e.user_id = uid;

  -- Budgets and trackers are optional in some databases.
  IF to_regclass('public.budgets') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.budgets WHERE user_id = $1' INTO n USING uid;
    result := result || jsonb_build_object('budgets', n);
  END IF;
  IF to_regclass('public.trackers') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.trackers WHERE user_id = $1' INTO n USING uid;
    result := result || jsonb_build_object('trackers', n);
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_stats() TO authenticated;


-- ===========================================================================
-- 5. FUNCTION: delete_my_account()  — deletes the CALLER only
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  t   text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Tracker entries are owned through their tracker.
  IF to_regclass('public."trackerEntries"') IS NOT NULL AND to_regclass('public.trackers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public."trackerEntries" WHERE "trackerId" IN (SELECT id FROM public.trackers WHERE user_id = $1)'
      USING uid;
  END IF;

  -- Every user-owned table, whether or not it has ON DELETE CASCADE.
  FOREACH t IN ARRAY ARRAY['trackers', 'spending_alerts', 'budgets', 'expenses', 'members', 'account_activity'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', t) USING uid;
    END IF;
  END LOOP;

  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;


-- ===========================================================================
-- VERIFY (optional, run separately after applying)
-- ===========================================================================
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('profiles', 'account_activity');          -- both true
--
--   SELECT count(*) AS users, (SELECT count(*) FROM public.profiles) AS profiles
--   FROM auth.users;                                             -- equal
--
--   SELECT proname, prosecdef FROM pg_proc
--   WHERE proname IN ('profile_stats', 'delete_my_account', 'handle_new_user_profile');
