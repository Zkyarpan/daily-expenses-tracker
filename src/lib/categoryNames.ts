/**
 * src/lib/categoryNames.ts
 *
 * Category key → display name, shared by client (analytics) and server
 * (AI insights) code. Names come from the fixed DEFAULT_CATEGORIES config,
 * never from user input.
 */

import { UNCATEGORIZED_KEY } from "@/lib/analytics";
import { DEFAULT_CATEGORIES } from "@/lib/config";

const CATEGORY_NAMES = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));

export const categoryNameOf = (key: string): string =>
  key === UNCATEGORIZED_KEY ? "Uncategorized" : (CATEGORY_NAMES.get(key) ?? `Category ${key}`);
