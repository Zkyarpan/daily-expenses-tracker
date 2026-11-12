import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@/utils/supabase/server";

/**
 * Auth callback route — handles:
 *  1. Email confirmation (sign-up)
 *  2. Password reset (magic link / recovery)
 *
 * Supabase redirects here after the user clicks a link in their email.
 * We exchange the `code` for a session, then redirect to the intended page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Something went wrong — send to login with an error hint
  return NextResponse.redirect(
    `${origin}/login?error=Could+not+authenticate.+Please+try+again.`,
  );
}
