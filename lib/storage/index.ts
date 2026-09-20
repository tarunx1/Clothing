import "server-only";
import { randomBytes } from "node:crypto";
import { getSecret, getSettings } from "@/lib/settings/settingsService";
import { createCloudinaryStorageProvider, pingCloudinary } from "./cloudinary";
import { localStorageProvider } from "./local";
import { createS3StorageProvider, s3ConfigFromEnv, type S3Config } from "./s3";
import type { StorageProvider, StoredFile } from "./types";

export type { StoredFile } from "./types";
export type StorageDriver = "local" | "s3" | "r2" | "cloudinary";

let override: StorageProvider | null = null;

/** Provider configuration from Admin → Settings → Storage (secrets decrypted server-side only). */
async function configuredProvider(driver: Exclude<StorageDriver, "local">): Promise<{ provider: StorageProvider | null; reason?: string }> {
  if (driver === "s3") {
    const [settings, secret] = await Promise.all([getSettings("storage.s3"), getSecret("storage.s3", "secretAccessKey")]);
    if (settings.endpoint && settings.bucket && settings.accessKeyId && secret && settings.publicUrl) {
      return { provider: createS3StorageProvider({ endpoint: settings.endpoint.replace(/\/$/, ""), bucket: settings.bucket, region: settings.region || "us-east-1", accessKeyId: settings.accessKeyId, secretAccessKey: secret, publicUrl: settings.publicUrl.replace(/\/$/, "") }) };
    }
    const env = s3ConfigFromEnv();
    return env ? { provider: createS3StorageProvider(env) } : { provider: null, reason: "S3 needs an endpoint, bucket, access key, secret key and public URL." };
  }
  if (driver === "r2") {
    const [settings, secret] = await Promise.all([getSettings("storage.r2"), getSecret("storage.r2", "secretAccessKey")]);
    if (!settings.accountId || !settings.bucket || !settings.accessKeyId || !secret || !settings.publicUrl) return { provider: null, reason: "R2 needs an account ID, bucket, access key, secret key and public URL." };
    const config: S3Config = { endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`, bucket: settings.bucket, region: "auto", accessKeyId: settings.accessKeyId, secretAccessKey: secret, publicUrl: settings.publicUrl.replace(/\/$/, "") };
    return { provider: createS3StorageProvider(config, "r2") };
  }
  const [settings, secret] = await Promise.all([getSettings("storage.cloudinary"), getSecret("storage.cloudinary", "apiSecret")]);
  if (!settings.cloudName || !settings.apiKey || !secret) return { provider: null, reason: "Cloudinary needs a cloud name, API key and API secret." };
  return { provider: createCloudinaryStorageProvider({ cloudName: settings.cloudName, apiKey: settings.apiKey, apiSecret: secret, folder: settings.folder }) };
}

/** The provider new uploads go to. Existing files stay where they are. */
export async function getUploadStorage(): Promise<StorageProvider> {
  if (override) return override;
  const { driver } = await getSettings("storage");
  if (driver !== "local") {
    const { provider } = await configuredProvider(driver as Exclude<StorageDriver, "local">);
    if (!provider) throw new UploadError("The selected storage provider is not fully configured. Check Settings → Storage.");
    return provider;
  }
  // Deployment fallback: STORAGE_DRIVER=s3 with S3_* variables, until an admin chooses a provider.
  const env = process.env.STORAGE_DRIVER === "s3" ? s3ConfigFromEnv() : null;
  return env ? createS3StorageProvider(env) : localStorageProvider;
}

/** Every provider that may own an existing URL (so deletes and URL checks survive a provider switch). */
async function knownProviders(): Promise<StorageProvider[]> {
  if (override) return [override];
  const providers: StorageProvider[] = [localStorageProvider];
  for (const driver of ["s3", "r2", "cloudinary"] as const) {
    const { provider } = await configuredProvider(driver).catch(() => ({ provider: null }));
    if (provider) providers.push(provider);
  }
  return providers;
}

export async function storageReadiness(driver: Exclude<StorageDriver, "local">) {
  const { provider, reason } = await configuredProvider(driver);
  return provider ? { ok: true as const } : { ok: false as const, reason: reason ?? "Not configured." };
}

/** Real round trip: upload a tiny probe object and delete it again. */
export async function testStorage(driver: StorageDriver): Promise<{ ok: boolean; message: string }> {
  try {
    if (driver === "cloudinary") {
      const settings = await getSettings("storage.cloudinary");
      const secret = await getSecret("storage.cloudinary", "apiSecret");
      if (!settings.cloudName || !settings.apiKey || !secret) return { ok: false, message: "Cloudinary is not fully configured." };
      const status = await pingCloudinary({ cloudName: settings.cloudName, apiKey: settings.apiKey, apiSecret: secret, folder: settings.folder });
      return status === 200 ? { ok: true, message: "Cloudinary accepted the credentials." } : { ok: false, message: status === 401 ? "Cloudinary rejected the API key or secret." : `Cloudinary responded with ${status}.` };
    }
    const provider = driver === "local" ? localStorageProvider : (await configuredProvider(driver)).provider;
    if (!provider) return { ok: false, message: "This provider is not fully configured." };
    const probe = await provider.upload({ key: `healthchecks/${randomBytes(6).toString("hex")}.png`, body: TINY_PNG, contentType: "image/png" });
    await provider.delete(probe.key);
    return { ok: true, message: `Uploaded and deleted a test file (${probe.url.replace(/\/healthchecks\/.*$/, "/…")}).` };
  } catch {
    return { ok: false, message: "Storage test failed. Check permissions, credentials and endpoint." };
  }
}

const TINY_PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4740000000049454e44ae426082", "hex");

export const MEDIA_KINDS = {
  image: { maxBytes: 10 * 1024 * 1024, types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } },
  model: { maxBytes: 30 * 1024 * 1024, types: { "model/gltf-binary": "glb" } },
} as const;
export type MediaKind = keyof typeof MEDIA_KINDS;
export type UploadFolder = "products" | "collections" | "lookbook" | "models" | "branding";

/** Identifies the real file type from its first bytes; the browser-supplied type is not trusted. */
export function sniffContentType(body: Buffer): string | null {
  const hex = body.subarray(0, 12).toString("hex");
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (body.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  if (body.subarray(0, 4).toString("ascii") === "glTF") return "model/gltf-binary";
  return null;
}

const slugify = (name: string) => name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";

/** Validates and stores an upload under `<folder>/<yyyy>/<mm>/<random>-<name>.<ext>`. */
export async function storeUpload(input: { folder: UploadFolder; fileName: string; body: Buffer; kind: MediaKind }): Promise<StoredFile> {
  const rules = MEDIA_KINDS[input.kind];
  if (input.body.length === 0) throw new UploadError("The file is empty.");
  if (input.body.length > rules.maxBytes) throw new UploadError(`Files must be under ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`);
  const contentType = sniffContentType(input.body);
  const extension = contentType ? (rules.types as Record<string, string>)[contentType] : undefined;
  if (!contentType || !extension) {
    throw new UploadError(input.kind === "image" ? "Upload a JPEG, PNG, WebP or AVIF image." : "Upload a .glb (binary glTF) file.");
  }
  const now = new Date();
  const key = `${input.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}-${slugify(input.fileName)}.${extension}`;
  return (await getUploadStorage()).upload({ key, body: input.body, contentType });
}

/** Deletes a stored object if the URL belongs to any configured storage. Seed assets under /public are never touched. */
export async function deleteStoredUrl(url: string) {
  for (const provider of await knownProviders()) {
    const key = provider.keyFromUrl(url);
    if (!key) continue;
    try {
      await provider.delete(key);
    } catch (error) {
      console.error("[storage] Delete failed", error instanceof Error ? error.name : "error");
    }
    return;
  }
}

/** Accept only URLs we issued (any configured provider), bundled /images|/models assets, or https links. */
export async function isAcceptableMediaUrl(url: string) {
  if (/^\/(images|models)\/[a-z0-9/_.-]+$/i.test(url) && !url.includes("..")) return true;
  if ((await knownProviders()).some((provider) => provider.keyFromUrl(url))) return true;
  return /^https:\/\/[^\s]+$/.test(url);
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function setStorageForTesting(provider: StorageProvider | null) {
  override = provider;
}
