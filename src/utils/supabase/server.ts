import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig, isSupabaseConfigured } from "./config";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Uses cookie-based session management via @supabase/ssr.
 */
export async function createServerClient() {
  if (!isSupabaseConfigured) return null;

  const { supabaseKey, supabaseUrl } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createSSRServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll is called from a Server Component — read-only cookies in that
          // context are handled by the middleware refresh instead.
        }
      },
    },
  });
}
