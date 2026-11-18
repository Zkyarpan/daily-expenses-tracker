/**
 * src/lib/api/onboarding.ts — browser client for POST /api/onboarding.
 */

import type { OnboardingAnswers } from "@/lib/onboarding/schemas";

import { json, request } from "./client";

export const onboardingApi = {
  complete: (answers: OnboardingAnswers) =>
    request<{ fixedCostsAdded: number; goalAdded: boolean; sampleLoaded: boolean; warnings: string[] }>(
      "/api/onboarding",
      json("POST", { action: "complete", answers }),
    ),
  skip: () => request<{ skipped: true }>("/api/onboarding", json("POST", { action: "skip" })),
};
