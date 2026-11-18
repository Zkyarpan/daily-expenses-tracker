import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

/** Only the public sign-in pages are indexable; personal finance pages and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    host: SITE.url,
    rules: [
      {
        allow: ["/login", "/signup", "/opengraph-image", "/twitter-image", "/icon.svg", "/apple-icon"],
        disallow: ["/api/", "/auth/", "/update-password", "/forgot-password", "/"],
        userAgent: "*",
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
