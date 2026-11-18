"use client";

import { useQuery } from "@tanstack/react-query";

import { profileApi } from "@/lib/api/profile";
import { getIsDemoMode } from "@/lib/supabase";

export const PROFILE_KEYS = {
  activity: ["profile", "activity"] as const,
  all: ["profile"] as const,
  sampleData: ["profile", "sample-data"] as const,
  stats: ["profile", "stats"] as const,
};

const enabled = !getIsDemoMode();

/** Counts and totals for the profile header (GET /api/profile/stats). */
export const useProfileStats = () =>
  useQuery({ enabled, queryFn: profileApi.stats, queryKey: PROFILE_KEYS.stats, staleTime: 30_000 });

/** Recent account/security events (GET /api/profile/activity). */
export const useProfileActivity = () =>
  useQuery({ enabled, queryFn: profileApi.activity, queryKey: PROFILE_KEYS.activity, staleTime: 15_000 });

/** Sample rows currently in the account (GET /api/profile/sample-data). */
export const useSampleDataStatus = () =>
  useQuery({
    enabled,
    queryFn: async () => (await profileApi.sampleDataStatus()).counts,
    queryKey: PROFILE_KEYS.sampleData,
  });
