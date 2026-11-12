// src/app/providers.tsx
"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
            staleTime: 1000 * 60 * 5, // 5 minutes
          },
        },
      })
  );

  // Security: the query cache lives for the whole browser tab, and sign-in /
  // sign-out are client-side navigations. Without this, a second user signing
  // in on the same tab could briefly be shown the previous user's cached
  // financial data. Clear every cached query whenever the signed-in user
  // changes (sign-out, or sign-in as a different account).
  useEffect(() => {
    if (!supabase) return;
    let currentUserId: string | null | undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (
        event === "SIGNED_OUT" ||
        (currentUserId !== undefined && nextUserId !== currentUserId)
      ) {
        queryClient.clear();
      }
      currentUserId = nextUserId;
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
