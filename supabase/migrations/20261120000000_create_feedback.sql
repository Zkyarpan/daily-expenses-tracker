-- =============================================================================
-- Migration: 20261120000000_create_feedback.sql
-- Feature: Help & support — "Report a problem / Send feedback" form
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates `feedback` — reports and suggestions sent from the Help page:
--      kind (problem, idea, wrong numbers, question, other), subject,
--      message, the page it's about, optional device details, and a status
--      the team can move from "new" → "in_review" → "resolved".
--   2. Enables RLS: each user can send reports and read back their own
--      (to see the status). Users cannot edit or delete them; the team
--      manages status with the service role (Supabase dashboard).
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT touch any existing table, column or policy.
--
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- SAFETY:
--   Idempotent — IF NOT EXISTS / DROP … IF EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('problem', 'idea', 'wrong_data', 'question', 'other')),
  subject     text        NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  message     text        NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  page        text        CHECK (page IS NULL OR char_length(page) <= 200),
  "contactOk" boolean     NOT NULL DEFAULT true,
  -- Browser, screen size and app version, only when the user ticks the box.
  device      jsonb,
  status      text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'resolved')),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, "createdAt" DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback: insert own" ON public.feedback;
CREATE POLICY "feedback: insert own" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'new');

DROP POLICY IF EXISTS "feedback: read own" ON public.feedback;
CREATE POLICY "feedback: read own" ON public.feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
