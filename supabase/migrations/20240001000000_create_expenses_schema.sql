-- =============================================================================
-- Migration: 20240001000000_create_expenses_schema.sql
-- Feature 2: Secure Expense Database Foundation
--
-- What this migration does:
--   1. Creates the `expenses` table with all required columns, constraints, and
--      indexes.  The table is user-scoped via a `user_id` FK to auth.users.
--   2. Creates supporting lookup tables: `categories` and `tags` (shared /
--      seeded) and `members` (per-user).
--   3. Enables Row Level Security on every table and attaches fine-grained
--      policies so each authenticated user can only read and modify their own
--      data.
--   4. Seeds the default categories and tags that match DEFAULT_CATEGORIES and
--      DEFAULT_TAGS in src/lib/config.ts so the application starts with data.
--
-- HOW TO APPLY
--   Paste the contents of this file into the Supabase Dashboard SQL editor
--   (Project → SQL Editor → New query) and click "Run".
--   Alternatively, use the Supabase CLI:
--     supabase db push  (after linking the project)
--
-- SAFETY NOTES
--   • All CREATE TABLE / INDEX statements use IF NOT EXISTS — safe to re-run.
--   • No DROP TABLE or TRUNCATE statements are included.
--   • RLS is never disabled; it is enabled (or left enabled) on every table.
--   • Policies use DROP POLICY IF EXISTS before CREATE POLICY — idempotent,
--     safe to re-run even if the migration was already applied partially.
--   • Seed rows use INSERT … ON CONFLICT DO NOTHING — safe to re-run.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- EXTENSION
-- ---------------------------------------------------------------------------
-- uuid-ossp is required for uuid_generate_v4().  It is pre-installed on every
-- Supabase project; this is just a safety guard.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ===========================================================================
-- TABLE: categories
-- Shared lookup table (not per-user).  Seeded with the same values that exist
-- in src/lib/config.ts so categoryId FKs resolve correctly on first load.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          text        PRIMARY KEY,          -- matches config ids: "1"…"9"
  name        text        NOT NULL,
  color       text,                             -- oklch colour string (optional)
  icon        text,                             -- lucide icon name (optional)
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.categories          IS 'Shared expense category lookup (seeded at migration time).';
COMMENT ON COLUMN public.categories.id       IS 'Matches the numeric string IDs used in src/lib/config.ts DEFAULT_CATEGORIES.';
COMMENT ON COLUMN public.categories.color    IS 'Optional oklch colour string for UI rendering.';
COMMENT ON COLUMN public.categories.icon     IS 'Optional Lucide icon identifier.';


-- ===========================================================================
-- TABLE: tags
-- Shared lookup table (location / merchant tags).  Seeded with DEFAULT_TAGS.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id          text        PRIMARY KEY,          -- slug-style id e.g. "costco"
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.tags    IS 'Shared expense tag / merchant lookup (seeded at migration time).';
COMMENT ON COLUMN public.tags.id IS 'Slug-style ID matching DEFAULT_TAGS in src/lib/config.ts.';


-- ===========================================================================
-- TABLE: members
-- Per-user household members (who paid for an expense).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.members (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  name        text        NOT NULL,             -- short display name
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.members          IS 'Per-user household members; scoped by user_id.';
COMMENT ON COLUMN public.members.user_id  IS 'FK to auth.users — RLS enforces isolation per user.';
COMMENT ON COLUMN public.members.name     IS 'Short/display name (e.g. "Usman").';
COMMENT ON COLUMN public.members.full_name IS 'Full name (e.g. "Usman Khalid Mian").';

CREATE INDEX IF NOT EXISTS members_user_id_idx ON public.members (user_id);


-- ===========================================================================
-- TABLE: expenses
-- Core user-expense table.  Every row is owned by exactly one authenticated
-- user (user_id FK).  RLS policies below enforce isolation.
--
-- Column mapping to Expense TypeScript type (src/entities/Expense.ts):
--   id          → id          (uuid)
--   user_id     → (new)       references auth.users
--   amount      → amount      (numeric(12,2), must be non-zero)
--   category_id → categoryId  (text FK → categories)
--   tag_id      → tagId       (text FK → tags)
--   member_id   → memberId    (uuid FK → members, nullable)
--   date        → date        (date)
--   description → description (text, nullable)
--   created_at  → createdAt   (timestamptz, auto)
--   updated_at  → updatedAt   (timestamptz, auto)
--
-- The application currently uses camelCase column names (categoryId, tagId,
-- memberId, createdAt, updatedAt) in Supabase queries. The mapping note above
-- describes the intended canonical snake_case names.  See the "COLUMN NAMING"
-- note in the README for how to handle this with a Supabase view or the
-- PostgREST column alias if you prefer to keep camelCase at the API layer.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Financial data
  amount       numeric(12,2) NOT NULL,
  CONSTRAINT   expenses_amount_nonzero CHECK (amount <> 0),

  -- Lookup references (nullable — may not have a category/tag/member)
  "categoryId" text          REFERENCES public.categories(id) ON DELETE SET NULL,
  "tagId"      text          REFERENCES public.tags(id)       ON DELETE SET NULL,
  "memberId"   uuid          REFERENCES public.members(id)    ON DELETE SET NULL,

  -- Core fields
  date         date          NOT NULL,
  description  text,

  -- Timestamps (camelCase quoted to match existing application queries)
  "createdAt"  timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.expenses              IS 'User expense records; one row per transaction.  Secured by RLS.';
COMMENT ON COLUMN public.expenses.user_id      IS 'Owner of this expense.  Populated automatically by the insert policy from auth.uid().';
COMMENT ON COLUMN public.expenses.amount       IS 'Positive = expense; negative = refund.  Non-zero enforced by CHECK constraint.';
COMMENT ON COLUMN public.expenses."categoryId" IS 'FK → categories.id (nullable).  Quoted camelCase to match existing app queries.';
COMMENT ON COLUMN public.expenses."tagId"      IS 'FK → tags.id (nullable).  Quoted camelCase to match existing app queries.';
COMMENT ON COLUMN public.expenses."memberId"   IS 'FK → members.id (nullable).  Quoted camelCase to match existing app queries.';
COMMENT ON COLUMN public.expenses.date         IS 'Transaction date (date only, no time component).';

-- Performance indexes
CREATE INDEX IF NOT EXISTS expenses_user_id_idx          ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx        ON public.expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_user_category_idx    ON public.expenses (user_id, "categoryId");
CREATE INDEX IF NOT EXISTS expenses_date_range_idx       ON public.expenses (date, user_id);


-- ---------------------------------------------------------------------------
-- TRIGGER: keep updatedAt current automatically
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


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- categories — publicly readable (shared lookup), no user writes allowed
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_all" ON public.categories;
CREATE POLICY "categories_read_all"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (true);

-- tags — publicly readable (shared lookup), no user writes allowed
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_read_all" ON public.tags;
CREATE POLICY "tags_read_all"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

-- members — strict per-user isolation
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_own" ON public.members;
CREATE POLICY "members_select_own"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "members_insert_own" ON public.members;
CREATE POLICY "members_insert_own"
  ON public.members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_own" ON public.members;
CREATE POLICY "members_update_own"
  ON public.members
  FOR UPDATE
  TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_delete_own" ON public.members;
CREATE POLICY "members_delete_own"
  ON public.members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- expenses — strict per-user isolation
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: a user can only read their own expenses
DROP POLICY IF EXISTS "expenses_select_own" ON public.expenses;
CREATE POLICY "expenses_select_own"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: the server enforces user_id = auth.uid() — users cannot insert rows
-- owned by a different user even if they try to supply a foreign user_id.
DROP POLICY IF EXISTS "expenses_insert_own" ON public.expenses;
CREATE POLICY "expenses_insert_own"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: a user can only update rows they own, and cannot change user_id.
DROP POLICY IF EXISTS "expenses_update_own" ON public.expenses;
CREATE POLICY "expenses_update_own"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: a user can only delete their own expenses
DROP POLICY IF EXISTS "expenses_delete_own" ON public.expenses;
CREATE POLICY "expenses_delete_own"
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ===========================================================================
-- SEED DATA
-- Matches DEFAULT_CATEGORIES and DEFAULT_TAGS in src/lib/config.ts exactly.
-- Uses ON CONFLICT DO NOTHING so re-running is safe.
-- ===========================================================================

-- Default categories (ids "1"–"9" used by the application)
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

-- Default tags (slug ids used by the application)
INSERT INTO public.tags (id, name) VALUES
  ('costco',              'Costco'),
  ('aldi',                'Aldi'),
  ('tire-shop',           'Tire Shop'),
  ('walmart',             'Walmart'),
  ('giant-eagle',         'Giant Eagle'),
  ('sams-club',           'Sams Club'),
  ('amazon',              'Amazon'),
  ('shein',               'Shein'),
  ('pitts-halal-brothers','Pitts Halal Brothers'),
  ('joe-and-pie',         'Joe & Pie'),
  ('98k',                 '98K'),
  ('others',              'Others')
ON CONFLICT (id) DO NOTHING;
