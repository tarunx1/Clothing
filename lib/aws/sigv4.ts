import "server-only";
import { createHash, createHmac } from "node:crypto";

/** AWS Signature Version 4 for any service (S3, R2, SES). Returns the URL and headers to send. */
export interface AwsCredentials { region: string; accessKeyId: string; secretAccessKey: string }

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

export function signAwsRequest(credentials: AwsCredentials, service: string, method: string, url: URL, body: Buffer | string, headers: Record<string, string>, now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const all: Record<string, string> = { ...headers, host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const names = Object.keys(all).map((name) => name.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([name, value]) => [name.toLowerCase(), value.trim()]));
  const query = [...url.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  const canonical = [method, url.pathname, query, names.map((name) => `${name}:${lower[name]}\n`).join(""), names.join(";"), payloadHash].join("\n");
  const scope = `${date}/${credentials.region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, date), credentials.region), service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return { url: url.toString(), headers: { ...all, authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` } };
}
