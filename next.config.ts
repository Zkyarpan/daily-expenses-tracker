import type { NextConfig } from "next";

// Detect if we are running under Turbopack (next dev --turbopack).
// When Turbopack is active, omitting the `webpack` key removes the
// "Webpack is configured while Turbopack is not" warning that forces
// Turbopack into testMode and prevents the HTTP server from binding.
const isTurbopack = process.env.TURBOPACK === "1" ||
  process.argv.some((a) => a === "--turbopack");

const nextConfig: NextConfig = {
  // The dev-only "N" badge defaults to bottom-left, where it covered the
  // sidebar's account details and sign-out button.
  devIndicators: { position: "bottom-right" },

  // Load the PDF reader with Node's own require on the server instead of
  // bundling it: pdf.js ships a worker file that bundlers can't relocate.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // ── Experimental optimisations ────────────────────────────────────────────
  experimental: {
    // Tree-shake large icon/component libraries — import only used symbols.
    // Reduces dashboard module count by ~300 modules for lucide-react alone.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-dropdown-menu",
    ],
  },

  // ── Webpack config (production build and webpack dev mode only) ───────────
  // Omitted when --turbopack is active to prevent testMode activation.
  ...(!isTurbopack && {
    // Typed via NextConfig: `webpack` is not a direct dependency, so
    // import("webpack") types are unresolvable and broke `next build`.
    webpack: ((config, { isServer }) => {
      // Polyfill Node.js built-ins that ExcelJS references
      (config as { resolve: { fallback?: Record<string, boolean> } }).resolve.fallback = {
        ...(config as { resolve: { fallback?: Record<string, boolean> } }).resolve.fallback,
        fs: false,
        stream: false,
        path: false,
        crypto: false,
      };

      if (!isServer) {
        // Keep ExcelJS and pdf-parse out of the client bundle entirely.
        const existing = Array.isArray(config.externals) ? config.externals : [];
        (config as { externals: unknown[] }).externals = [...existing, "exceljs", "pdf-parse"];
      }

      return config;
    }) satisfies NonNullable<NextConfig["webpack"]>,
  }),

  images: {
    remotePatterns: [
      {
        hostname: "images.pexels.com",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
