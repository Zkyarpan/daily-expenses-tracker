"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for protected pages. A rendering error now shows a
 * recoverable message inside the app shell (sidebar and header stay usable)
 * instead of replacing the whole screen.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <ErrorState
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Go to dashboard</Link>
          </Button>
        }
        message={
          <>
            This page hit an unexpected problem while loading. Try again, or
            return to the dashboard.
            {error.digest && (
              <span className="mt-1 block text-xs">Reference: {error.digest}</span>
            )}
          </>
        }
        onRetry={reset}
        title="This page couldn’t be displayed"
      />
    </div>
  );
}
