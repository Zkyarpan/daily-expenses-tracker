/**
 * DELETE /api/profile/sessions — sign out of every device, including this
 * one (revokes all refresh tokens and clears this browser's cookies).
 */

import { apiError, apiJson, authenticate, logActivity, rejectCrossSite } from "@/lib/profile/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  // Log first: once signed out, RLS no longer lets this request insert.
  await logActivity(supabase, user.id, "signed_out_everywhere", { request });

  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return apiError(500, "Other devices could not be signed out. Please try again.");
  return apiJson({ ok: true });
}
