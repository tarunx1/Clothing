import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { contentDefaults, contentSchemas, type ContentKey, type ContentValue } from "@/lib/content/schemas";
import type { LookbookImage } from "@/types/lookbook";

/** Reads one content slot, validated; invalid or missing values fall back to launch copy. */
export async function readContent<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key } });
    if (!row) return contentDefaults[key];
    const parsed = contentSchemas[key].safeParse(row.value);
    if (parsed.success) return parsed.data as ContentValue<K>;
    console.warn(`[content] Stored "${key}" is invalid; using defaults.`);
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    console.warn(`[content] Database unavailable; using default "${key}".`);
  }
  return contentDefaults[key];
}

const cachedContent = unstable_cache(
  async () => {
    const [hero, brandStory, newsletter] = await Promise.all([readContent("hero"), readContent("brandStory"), readContent("newsletter")]);
    return { hero, brandStory, newsletter };
  },
  ["homepage-content"],
  { revalidate: 300, tags: ["content"] },
);

export const getHomepageContent = () => cachedContent();

/** Store identity for storefront chrome, from Settings → General. */
export const getStoreSettings = async () => {
  const { getSettings } = await import("@/lib/settings/settingsService");
  return getSettings("general");
};

async function readLookbook(): Promise<LookbookImage[]> {
  try {
    const rows = await prisma.lookbookImage.findMany({ where: { enabled: true }, orderBy: [{ lane: "asc" }, { order: "asc" }] });
    return rows
      .filter((row) => row.lane >= 1 && row.lane <= 3)
      .map((row) => ({
        id: row.id,
        src: row.src,
        alt: row.alt,
        lane: row.lane as 1 | 2 | 3,
        order: row.order,
        position: row.position ?? undefined,
        credit: row.creditName ? { photographer: row.creditName, url: row.creditUrl ?? "" } : undefined,
      }));
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    const { lookbookImages } = await import("@/data/lookbook");
    return lookbookImages;
  }
}

export const getLookbookImages = unstable_cache(readLookbook, ["lookbook-images"], { revalidate: 300, tags: ["content", "lookbook"] });
