/**
 * GET /api/ai/status → { available, provider }
 *
 * Lets the app say up front when AI features (receipt scanning, AI wording
 * for insights) are switched off, instead of failing after the user acts.
 * Reveals only whether a provider is set up — never a key.
 */

import { NextResponse } from "next/server";

import { activeProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export function GET() {
  const provider = activeProvider();
  return NextResponse.json(
    { available: provider !== null, provider },
    { headers: { "Cache-Control": "no-store" } },
  );
}
