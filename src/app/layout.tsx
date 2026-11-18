import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { RouteProgress } from "@/components/layout/RouteProgress";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppToaster } from "@/components/shared/AppToaster";
import { SITE } from "@/lib/site";

import "./globals.css";

import { Providers } from "./providers";

/*
 * Inter — the standard premium UI font used by Linear, Stripe, shadcn, Vercel.
 * variable=true emits a CSS custom property so Tailwind can reference it.
 * preload=true ensures the font is loaded before paint.
 */
const inter = Inter({
  display: "swap",
  preload: true,
  subsets: ["latin"],
  variable: "--font-inter",
});

/*
 * JetBrains Mono — premium monospaced font for numbers and code.
 * Used for currency amounts, amounts in tables, etc.
 */
const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

/*
 * Plus Jakarta Sans — display face for page titles and headings (h1/h2 use
 * var(--font-display)), giving the app its own character next to Inter.
 */
const jakarta = Plus_Jakarta_Sans({
  display: "swap",
  preload: true,
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  appleWebApp: { capable: true, statusBarStyle: "default", title: SITE.name },
  applicationName: SITE.name,
  authors: [{ name: SITE.name }],
  category: "finance",
  creator: SITE.name,
  description: SITE.description,
  formatDetection: { address: false, email: false, telephone: false },
  keywords: [...SITE.keywords],
  metadataBase: new URL(SITE.url),
  openGraph: {
    description: SITE.description,
    locale: "en_GB",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    type: "website",
    url: "/",
  },
  robots: { follow: true, index: true },
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE.description,
    title: `${SITE.name} — ${SITE.tagline}`,
  },
};

export const viewport: Viewport = {
  // Pinch-zoom stays available (accessibility). Fields use 16px text on touch
  // screens (globals.css), so iPhones never auto-zoom when one is tapped.
  colorScheme: "light dark",
  initialScale: 1,
  themeColor: [
    { color: SITE.themeColor.light, media: "(prefers-color-scheme: light)" },
    { color: SITE.themeColor.dark, media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
};

/** Structured data so search engines understand what the app is. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  applicationCategory: "FinanceApplication",
  browserRequirements: "Requires JavaScript",
  description: SITE.description,
  inLanguage: "en-GB",
  isAccessibleForFree: true,
  name: SITE.name,
  operatingSystem: "Any",
  url: SITE.url,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
      // Page changes jump straight to the top instead of smooth-scrolling
      // (smooth scrolling stays on for in-page links like "Back to top").
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      {/* Browser extensions (e.g. Grammarly) inject attributes on <body> before
          React hydrates; suppress the resulting attribute-mismatch warning. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          // Static, app-defined JSON (no user input), escaped for <script>.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
        />
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
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
