"use client";

import { ArrowLeft, Home, LifeBuoy, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LogoMark } from "@/components/brand/Logo";
import { NAV_GROUPS } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";

/** Friendly "page not found" with a way back and the most-used pages. */
export function NotFoundView() {
  const router = useRouter();
  const popular = NAV_GROUPS.flatMap((g) => g.items).slice(0, 6);

  return (
    <main className="bg-background app-backdrop flex min-h-svh items-center justify-center overflow-x-clip px-5 py-12">
      <div className="w-full max-w-xl text-center">
        <Link href="/" aria-label="Home" className="inline-flex">
          <LogoMark className="size-14 drop-shadow-lg" />
        </Link>

        <p className="text-primary mt-8 text-sm font-semibold tracking-wider uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">We can’t find that page</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-6">
          The link may be old, or the page has moved. Your money and data are safe — pick up from one of these.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="gap-1.5">
            <Link href="/">
              <Home className="size-4" aria-hidden />
              Go to home
            </Link>
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => router.back()}>
            <ArrowLeft className="size-4" aria-hidden />
            Go back
          </Button>
          <Button asChild variant="ghost" className="gap-1.5">
            <Link href="/help">
              <LifeBuoy className="size-4" aria-hidden />
              Get help
            </Link>
          </Button>
        </div>

        <nav aria-label="Popular pages" className="bg-card mt-10 rounded-2xl p-4 text-left shadow-md sm:p-5">
          <p className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <Search className="size-3.5" aria-hidden />
            Popular pages
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {popular.map((item) => (
              <li key={item.url}>
                <Link href={item.url} className="hover:bg-muted/60 flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <item.icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">{item.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
