import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

/** Installable web app (Add to Home Screen / desktop install). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: SITE.themeColor.dark,
    categories: ["finance", "productivity"],
    description: SITE.description,
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "any", src: "/icon.svg", type: "image/svg+xml" },
      { sizes: "180x180", src: "/apple-icon", type: "image/png" },
    ],
    lang: "en-GB",
    name: SITE.name,
    short_name: "Expenses",
    start_url: "/",
    theme_color: "#007c72",
  };
}
