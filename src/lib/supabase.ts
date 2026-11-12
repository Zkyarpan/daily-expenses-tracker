import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "@/utils/supabase/config";

export const supabase: SupabaseClient | null = createClient();

export const isSupabaseAvailable = () => supabase !== null;

export const getIsDemoMode = () => !isSupabaseConfigured;

export const requireSupabase = (): SupabaseClient => {
  if (supabase) return supabase;
  throw new Error("Supabase data access is unavailable.");
};

export { getSupabaseConfig, isSupabaseConfigured };

