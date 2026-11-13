import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { RouteProgress } from "@/components/layout/RouteProgress";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

import { Providers } from "./providers";

/*
 * Inter — the standard premium UI font used by Linear, Stripe, shadcn, Vercel.
 * variable=true emits a CSS custom property so Tailwind can reference it.
 * preload=true ensures the font is loaded before paint.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

/*
 * JetBrains Mono — premium monospaced font for numbers and code.
 * Used for currency amounts, amounts in tables, etc.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  description:
    "A focused workspace for tracking daily expenses and spending trends.",
  title: "Daily Expenses Tracker",
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#ffffff", media: "(prefers-color-scheme: light)" },
    { color: "#09090b", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <RouteProgress />
            {children}
          </ThemeProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
