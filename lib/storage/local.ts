import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./types";

export const LOCAL_MEDIA_PREFIX = "/media/";

/** Uploads live outside /public (Next only serves public files present at build time) and are streamed by app/media. */
// Runtime data, not source: excluded from build tracing.
export const localStorageRoot = () => path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "uploads"));

/** Resolves a key inside the storage root, rejecting traversal. */
export function resolveLocalKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes("..")) return null;
  const root = localStorageRoot();
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

export const localStorageProvider: StorageProvider = {
  id: "local",
  async upload({ key, body, contentType }) {
    const full = resolveLocalKey(key);
    if (!full) throw new Error("Invalid storage key.");
    await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ full, body, { flag: "wx" });
    return { key, url: `${LOCAL_MEDIA_PREFIX}${key}`, contentType, size: body.length };
  },
  async delete(key) {
    const full = resolveLocalKey(key);
    if (full) await rm(/*turbopackIgnore: true*/ full, { force: true });
  },
  keyFromUrl(url) {
    return url.startsWith(LOCAL_MEDIA_PREFIX) ? url.slice(LOCAL_MEDIA_PREFIX.length) : null;
  },
};

export async function readLocalFile(key: string) {
  const full = resolveLocalKey(key);
  if (!full) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ full);
  } catch {
    return null;
  }
}
