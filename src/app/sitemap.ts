import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

/** Public pages only — everything else needs a signed-in account. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { changeFrequency: "monthly", priority: 1, url: `${SITE.url}/signup` },
    { changeFrequency: "monthly", priority: 0.8, url: `${SITE.url}/login` },
  ];
}
