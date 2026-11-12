-- =============================================================================
-- Verification for migration 20240006000000_create_budgets_table.sql
-- NOT a migration. Run manually in Supabase SQL Editor AFTER applying it.
--
-- Leaves NO data behind: the block always finishes with RAISE EXCEPTION, so the
-- whole transaction is rolled back.
--   • Success shows:  ERROR: PASS — all budgets checks passed ... (rolled back)
--   • Failure shows:  ERROR: FAIL — <which check> ...
--
-- Uses the oldest existing auth user as "user A" (needed for the FK) and a
-- random UUID as "user B" (an outsider). Test rows use year 2099 and the
-- categoryId 'verify-cat', so they can never collide with real budgets.
-- =============================================================================
DO $$
DECLARE
  user_a  uuid;
  user_b  uuid := gen_random_uuid();
  bid     uuid;
  n       integer;
  lim     numeric;
BEGIN
  SELECT id INTO user_a FROM auth.users ORDER BY created_at LIMIT 1;
  IF user_a IS NULL THEN
    RAISE EXCEPTION 'FAIL — no auth.users rows; sign up once in the app first';
  END IF;

  -- ── Act as user A (authenticated) ───────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1. CREATE (user_id omitted → DEFAULT auth.uid(); app sends it explicitly)
  INSERT INTO public.budgets (year, month, "categoryId", "limitAmount")
  VALUES (2099, 11, 'verify-cat', 100.00)
  RETURNING id INTO bid;

  -- 2. READ own row
  SELECT count(*) INTO n FROM public.budgets WHERE id = bid AND user_id = user_a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL — owner cannot read own budget'; END IF;

  -- 3. UPDATE own row
  UPDATE public.budgets SET "limitAmount" = 150.50 WHERE id = bid;
  GET DIAGNOSTICS n = ROW_COUNT;
  SELECT "limitAmount" INTO lim FROM public.budgets WHERE id = bid;
  IF n <> 1 OR lim <> 150.50 THEN RAISE EXCEPTION 'FAIL — owner cannot update own budget'; END IF;

  -- 4. Duplicate user/year/month/category rejected
  BEGIN
    INSERT INTO public.budgets (user_id, year, month, "categoryId", "limitAmount")
    VALUES (user_a, 2099, 11, 'verify-cat', 1);
    RAISE EXCEPTION 'FAIL — duplicate budget was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 5. Validation constraints
  BEGIN
    INSERT INTO public.budgets (user_id, year, month, "categoryId", "limitAmount")
    VALUES (user_a, 2099, 13, 'verify-cat-2', 1);
    RAISE EXCEPTION 'FAIL — month 13 was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.budgets (user_id, year, month, "categoryId", "limitAmount")
    VALUES (user_a, 2099, 10, 'verify-cat-2', 0);
    RAISE EXCEPTION 'FAIL — zero limit was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.budgets (user_id, year, month, "categoryId", "limitAmount")
    VALUES (user_a, 2099, 10, '   ', 1);
    RAISE EXCEPTION 'FAIL — blank categoryId was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ── Act as user B (a different authenticated user) ──────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 6. B cannot see A's budget
  SELECT count(*) INTO n FROM public.budgets WHERE id = bid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL — another user can read the budget'; END IF;

  -- 7. B cannot update A's budget
  UPDATE public.budgets SET "limitAmount" = 1 WHERE id = bid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL — another user can update the budget'; END IF;

  -- 8. B cannot delete A's budget
  DELETE FROM public.budgets WHERE id = bid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL — another user can delete the budget'; END IF;

  -- 9. B cannot insert a budget owned by A
  BEGIN
    INSERT INTO public.budgets (user_id, year, month, "categoryId", "limitAmount")
    VALUES (user_a, 2099, 9, 'verify-cat', 1);
    RAISE EXCEPTION 'FAIL — another user can insert rows owned by A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 10. Signed-in users cannot TRUNCATE (TRUNCATE would bypass RLS)
  BEGIN
    TRUNCATE public.budgets;
    RAISE EXCEPTION 'FAIL — authenticated can TRUNCATE budgets';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- ── Act as anon (not signed in) ─────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('role', 'anon', true);

  -- 11. anon has no access at all
  BEGIN
    SELECT count(*) INTO n FROM public.budgets;
    RAISE EXCEPTION 'FAIL — anon can read budgets';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- ── Back to user A: A's row is untouched, then DELETE it ────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT "limitAmount" INTO lim FROM public.budgets WHERE id = bid;
  IF lim IS DISTINCT FROM 150.50 THEN RAISE EXCEPTION 'FAIL — budget was changed by another user'; END IF;

  -- 12. DELETE own row
  DELETE FROM public.budgets WHERE id = bid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL — owner cannot delete own budget'; END IF;

  RAISE EXCEPTION 'PASS — all 12 budgets checks passed (create, read, update, delete, duplicate, validation, user isolation, no truncate, anon blocked). Transaction rolled back; nothing was saved.';
END;
$$;
