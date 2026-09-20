import "server-only";
import { signAwsRequest } from "@/lib/aws/sigv4";
import type { StorageProvider } from "./types";

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) using SigV4 over
 * fetch, so no SDK is bundled. Configure with S3_* environment variables.
 */
export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

export function s3ConfigFromEnv(): S3Config | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_PUBLIC_URL) return null;
  return { endpoint: S3_ENDPOINT.replace(/\/$/, ""), bucket: S3_BUCKET, region: S3_REGION || "auto", accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, publicUrl: S3_PUBLIC_URL.replace(/\/$/, "") };
}

/** AWS Signature Version 4 headers for a path-style S3 request. Exported for tests. */
export function signS3Request(config: Pick<S3Config, "endpoint" | "region" | "accessKeyId" | "secretAccessKey">, method: string, path: string, body: Buffer | string, headers: Record<string, string>, now = new Date()) {
  return signAwsRequest(config, "s3", method, new URL(config.endpoint + path), body, headers, now);
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export function createS3StorageProvider(config: S3Config, id: "s3" | "r2" = "s3"): StorageProvider {
  const request = async (method: string, key: string, body: Buffer = Buffer.alloc(0), headers: Record<string, string> = {}) => {
    const signed = signS3Request(config, method, `/${config.bucket}/${encodeKey(key)}`, body, headers);
    const response = await fetch(signed.url, { method, headers: signed.headers, body: method === "PUT" ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(30_000) });
    if (!response.ok && !(method === "DELETE" && response.status === 404)) throw new Error(`Object storage request failed (${response.status}).`);
  };
  return {
    id,
    async upload({ key, body, contentType }) {
      await request("PUT", key, body, { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" });
      return { key, url: `${config.publicUrl}/${encodeKey(key)}`, contentType, size: body.length };
    },
    async delete(key) {
      await request("DELETE", key);
    },
    keyFromUrl(url) {
      return url.startsWith(`${config.publicUrl}/`) ? decodeURIComponent(url.slice(config.publicUrl.length + 1)) : null;
    },
  };
}
