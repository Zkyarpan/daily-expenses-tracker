"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig, isSupabaseConfigured } from "./config";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  if (!browserClient) {
    const { supabaseKey, supabaseUrl } = getSupabaseConfig();
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
}

