import "server-only";
import { createHash } from "node:crypto";
import type { StorageProvider } from "./types";

/** Cloudinary signed uploads over the REST API (no SDK). Keys are `<resourceType>:<publicId>`. */
export interface CloudinaryConfig { cloudName: string; apiKey: string; apiSecret: string; folder: string }

const sign = (params: Record<string, string>, secret: string) =>
  createHash("sha1").update(Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&") + secret).digest("hex");

export function createCloudinaryStorageProvider(config: CloudinaryConfig): StorageProvider {
  const base = `https://res.cloudinary.com/${config.cloudName}/`;
  const api = `https://api.cloudinary.com/v1_1/${config.cloudName}`;
  return {
    id: "cloudinary",
    async upload({ key, body, contentType }) {
      const resourceType = contentType.startsWith("image/") ? "image" : "raw";
      const publicId = [config.folder, key.replace(/\.[a-z0-9]+$/i, "")].filter(Boolean).join("/");
      const timestamp = String(Math.floor(Date.now() / 1000));
      const params = { public_id: publicId, timestamp };
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(body)], { type: contentType }));
      form.set("api_key", config.apiKey);
      form.set("timestamp", timestamp);
      form.set("public_id", publicId);
      form.set("signature", sign(params, config.apiSecret));
      const response = await fetch(`${api}/${resourceType}/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Cloudinary upload failed (${response.status}).`);
      const result = (await response.json()) as { secure_url: string; bytes: number };
      return { key: `${resourceType}:${publicId}`, url: result.secure_url, contentType, size: result.bytes ?? body.length };
    },
    async delete(key) {
      const separator = key.indexOf(":");
      const [resourceType, publicId] = separator > 0 ? [key.slice(0, separator), key.slice(separator + 1)] : ["image", key];
      const timestamp = String(Math.floor(Date.now() / 1000));
      const form = new URLSearchParams({ public_id: publicId, timestamp, api_key: config.apiKey, signature: sign({ public_id: publicId, timestamp }, config.apiSecret) });
      const response = await fetch(`${api}/${resourceType}/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`Cloudinary delete failed (${response.status}).`);
    },
    keyFromUrl(url) {
      if (!url.startsWith(base)) return null;
      const match = url.slice(base.length).match(/^(image|raw|video)\/upload\/(?:v\d+\/)?(.+?)(\.[a-z0-9]+)?$/i);
      return match ? `${match[1]}:${match[2]}` : null;
    },
  };
}

/** Verifies credentials with the Admin API ping endpoint. */
export async function pingCloudinary(config: CloudinaryConfig) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/ping`, {
    headers: { authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
  });
  return response.status;
}
