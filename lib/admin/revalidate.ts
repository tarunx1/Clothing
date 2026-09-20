import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

export interface InvalidationTarget {
  paths?: string[];
  tags?: string[];
  /** Layout paths: everything rendered under them is refreshed (global chrome, metadata). */
  layouts?: string[];
}

let recorder: ((target: InvalidationTarget) => void) | null = null;

/**
 * Expires storefront caches after an admin change. Tags are expired
 * immediately (the owner expects to see edits on the next visit); paths cover
 * the statically rendered homepage.
 */
export function invalidateStorefront(target: InvalidationTarget) {
  if (recorder) return recorder(target);
  for (const tag of new Set(target.tags ?? [])) revalidateTag(tag, { expire: 0 });
  for (const path of new Set(target.paths ?? [])) revalidatePath(path);
  for (const path of new Set(target.layouts ?? [])) revalidatePath(path, "layout");
}

export const storefrontTargets = {
  product: (slug: string, previousSlug?: string | null): InvalidationTarget => ({
    tags: ["catalog"],
    paths: ["/", "/shop", `/product/${slug}`, ...(previousSlug && previousSlug !== slug ? [`/product/${previousSlug}`] : [])],
  }),
  collections: (): InvalidationTarget => ({ tags: ["catalog", "collections"], paths: ["/", "/shop"] }),
  content: (): InvalidationTarget => ({ tags: ["content"], paths: ["/"] }),
  settings: (): InvalidationTarget => ({ tags: ["content", "settings"], paths: ["/", "/shop", "/cart", "/checkout"] }),
};

/** Test seam: capture invalidations instead of calling Next.js cache APIs. */
export function setInvalidationRecorderForTesting(fn: ((target: InvalidationTarget) => void) | null) {
  recorder = fn;
}
