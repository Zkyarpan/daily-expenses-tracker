-- =============================================================================
-- Migration: 20240005000000_fix_expenses_rls.sql
-- Fix: "new row violates row-level security policy for table ..." (42501)
--      on public.expenses, public.trackers and public."trackerEntries".
--
-- WHY THIS IS NEEDED
--   The live tables were created by hand in the Supabase Dashboard. RLS is on,
--   and each table has a uuid `user_id` column, but the policies do not let a
--   logged-in user insert (and read back) their own rows. The app inserts with
--   `user_id = auth.uid()` and then calls `.select()`, so each table needs
--   INSERT *and* SELECT policies that accept rows owned by the current user.
--
-- WHAT THIS MIGRATION DOES (for each of the three tables)
--   1. Drops every existing policy (names in the live DB are unknown, and a
--      leftover RESTRICTIVE policy would keep blocking inserts).
--   2. Makes sure RLS is enabled.
--   3. Creates SELECT / INSERT / UPDATE / DELETE policies for `authenticated`
--      scoped to user_id = auth.uid().
--   4. Sets DEFAULT auth.uid() on user_id as a safety net.
--   5. Grants table privileges to `authenticated` (needed in addition to RLS).
--
-- It does NOT drop or modify any rows, and does NOT disable RLS.
--
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--   Safe to re-run.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['expenses', 'trackers', 'trackerEntries']
  LOOP
    -- 1. Remove all existing (unknown) policies
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- 2. Ensure RLS is on
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- 3. Per-user policies
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (user_id = (SELECT auth.uid()))',
      tbl || '_select_own', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (user_id = (SELECT auth.uid()))',
      tbl || '_insert_own', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (user_id = (SELECT auth.uid()))
         WITH CHECK (user_id = (SELECT auth.uid()))',
      tbl || '_update_own', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (user_id = (SELECT auth.uid()))',
      tbl || '_delete_own', tbl);

    -- 4. Default owner = current user
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()', tbl);

    -- 5. Table privileges for logged-in users (RLS still restricts rows)
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END
$$;

COMMIT;

-- Make PostgREST pick up the changes immediately
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- OPTIONAL — claim old rows that have no owner.
-- Rows created before login existed have user_id = NULL and are now invisible.
-- If you are the only user, uncomment, put in the email you log in with, run:
--
--   UPDATE public.expenses         SET user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com') WHERE user_id IS NULL;
--   UPDATE public.trackers         SET user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com') WHERE user_id IS NULL;
--   UPDATE public."trackerEntries" SET user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com') WHERE user_id IS NULL;
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- VERIFY (optional) — should list four policies per table:
--   SELECT tablename, policyname, cmd, permissive, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('expenses', 'trackers', 'trackerEntries')
--   ORDER BY tablename, cmd;
-- -----------------------------------------------------------------------------
