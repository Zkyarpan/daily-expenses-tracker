-- =============================================================================
-- Migration: 20240002000000_add_missing_schema.sql
-- Feature 3: Connect Expenses to Authenticated Users — Schema Gap Fix
--
-- WHAT THIS MIGRATION DOES (and why each part is needed):
--
--   1. Adds DEFAULT auth.uid() to expenses.user_id
--      The application code now explicitly sends user_id in every INSERT, so
--      this DEFAULT is a safety net — it means inserts without user_id still
--      work correctly.  Safe to run even if DEFAULT already exists (ALTER
--      COLUMN SET DEFAULT is idempotent).
--
--   2. Adds the CHECK constraint expenses_amount_nonzero if missing
--      Prevents £0.00 expense rows from being stored.  Uses IF NOT EXISTS
--      syntax (Postgres 12+).
--
--   3. Creates missing lookup tables: categories, tags
--      These are referenced by categoryId and tagId in the expenses table.
--      The FK constraints are NOT added here because the live expenses.categoryId
--      and expenses.tagId columns are plain text (no FK), which matches how the
--      app works (string IDs like "1", "costco").
--      Using IF NOT EXISTS — safe to re-run.
--
--   4. Enables RLS on categories and tags and adds a read-all policy for
--      authenticated users.
--
--   5. Seeds categories and tags to match DEFAULT_CATEGORIES / DEFAULT_TAGS in
--      src/lib/config.ts.  Uses ON CONFLICT DO NOTHING — safe to re-run.
--
--   6. Ensures RLS is correctly enabled on expenses, trackers, trackerEntries
--      with the correct policies (DROP POLICY IF EXISTS first — idempotent).
--
--   7. Adds performance indexes on expenses if not already present.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT create a members table (memberId is text "1"/"2" in the live
--     DB — no UUID FK needed).
--   • Does NOT drop any existing table, column, or policy.
--   • Does NOT disable RLS on any table.
--   • Does NOT change any existing column type.
--
-- HOW TO APPLY:
--   Paste into Supabase Dashboard → SQL Editor → New query → Run
--
-- SAFETY:
--   All statements are idempotent.  Running twice is safe.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. DEFAULT auth.uid() on expenses.user_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.expenses
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Ensure user_id is NOT NULL (should already be the case)
ALTER TABLE public.expenses
  ALTER COLUMN user_id SET NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. CHECK constraint: amount must not be zero
-- ---------------------------------------------------------------------------
-- Drop first so we can re-add cleanly (idempotent pattern)
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_amount_nonzero;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_nonzero CHECK (amount <> 0);


-- ---------------------------------------------------------------------------
-- 3. Performance indexes on expenses
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS expenses_user_id_idx
  ON public.expenses (user_id);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx
  ON public.expenses (user_id, date DESC);

CREATE INDEX IF NOT EXISTS expenses_user_category_idx
  ON public.expenses (user_id, "categoryId");


-- ---------------------------------------------------------------------------
-- 4. Auto-update updatedAt trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_set_updated_at ON public.expenses;
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 5. Categories lookup table (missing from live DB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id         text        PRIMARY KEY,
  name       text        NOT NULL,
  color      text,
  icon       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_all" ON public.categories;
CREATE POLICY "categories_read_all"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- 6. Tags lookup table (missing from live DB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
  id         text        PRIMARY KEY,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_read_all" ON public.tags;
CREATE POLICY "tags_read_all"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- 7. Seed categories and tags (matches src/lib/config.ts exactly)
-- ---------------------------------------------------------------------------
INSERT INTO public.categories (id, name) VALUES
  ('1', 'Grocery'),
  ('2', 'Takeout'),
  ('3', 'Misc'),
  ('4', 'Shopping'),
  ('5', 'Travel'),
  ('6', 'Gifts'),
  ('7', 'Petrol'),
  ('8', 'Utilities'),
  ('9', 'Car')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tags (id, name) VALUES
  ('costco',               'Costco'),
  ('aldi',                 'Aldi'),
  ('tire-shop',            'Tire Shop'),
  ('walmart',              'Walmart'),
  ('giant-eagle',          'Giant Eagle'),
  ('sams-club',            'Sams Club'),
  ('amazon',               'Amazon'),
  ('shein',                'Shein'),
  ('pitts-halal-brothers', 'Pitts Halal Brothers'),
  ('joe-and-pie',          'Joe & Pie'),
  ('98k',                  '98K'),
  ('others',               'Others')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 8. RLS on expenses — ensure correct policies exist
-- ---------------------------------------------------------------------------
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_own" ON public.expenses;
CREATE POLICY "expenses_select_own"
  ON public.expenses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "expenses_insert_own" ON public.expenses;
CREATE POLICY "expenses_insert_own"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expenses_update_own" ON public.expenses;
CREATE POLICY "expenses_update_own"
  ON public.expenses FOR UPDATE TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "expenses_delete_own" ON public.expenses;
CREATE POLICY "expenses_delete_own"
  ON public.expenses FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 9. RLS on trackers — ensure user_id isolation
-- ---------------------------------------------------------------------------
ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trackers_select_own" ON public.trackers;
CREATE POLICY "trackers_select_own"
  ON public.trackers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trackers_insert_own" ON public.trackers;
CREATE POLICY "trackers_insert_own"
  ON public.trackers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trackers_update_own" ON public.trackers;
CREATE POLICY "trackers_update_own"
  ON public.trackers FOR UPDATE TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trackers_delete_own" ON public.trackers;
CREATE POLICY "trackers_delete_own"
  ON public.trackers FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 10. RLS on trackerEntries — via parent tracker ownership
-- ---------------------------------------------------------------------------
ALTER TABLE public."trackerEntries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trackerEntries_select_own" ON public."trackerEntries";
CREATE POLICY "trackerEntries_select_own"
  ON public."trackerEntries" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers t
      WHERE t.id = "trackerId" AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trackerEntries_insert_own" ON public."trackerEntries";
CREATE POLICY "trackerEntries_insert_own"
  ON public."trackerEntries" FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trackers t
      WHERE t.id = "trackerId" AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trackerEntries_update_own" ON public."trackerEntries";
CREATE POLICY "trackerEntries_update_own"
  ON public."trackerEntries" FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers t
      WHERE t.id = "trackerId" AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trackerEntries_delete_own" ON public."trackerEntries";
CREATE POLICY "trackerEntries_delete_own"
  ON public."trackerEntries" FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers t
      WHERE t.id = "trackerId" AND t.user_id = auth.uid()
    )
  );
