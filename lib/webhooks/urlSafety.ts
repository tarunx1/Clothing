import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

/**
 * Outbound URL policy for admin-configured endpoints (webhooks). Requires https
 * and refuses private, loopback and link-local addresses so the store can't be
 * pointed at its own infrastructure. Plain http to localhost is allowed only
 * outside production, for local testing.
 */
const privateV4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^192\.0\./, /^198\.(18|19)\./, /^(22[4-9]|23\d|24\d|25[0-5])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
const isPrivate = (address: string): boolean =>
  isIP(address) === 6
    ? /^(::1|::|fc|fd|fe[89ab])/i.test(address) || address.startsWith("::ffff:") && isPrivate(address.slice(7))
    : privateV4.some((pattern) => pattern.test(address));

export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL.");
  }
  if (url.username || url.password) throw new Error("URLs can't contain credentials.");
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const production = process.env.NODE_ENV === "production";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && !production)) throw new Error("Use an https:// URL.");
  if (local) {
    if (production) throw new Error("Local addresses are not allowed.");
    return url;
  }
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("That host name doesn’t resolve.");
  if (addresses.some((entry) => isPrivate(entry.address))) throw new Error("Private or internal network addresses are not allowed.");
  return url;
}

/** Resolve again at connection time and pin the validated IP; redirects are never followed. */
export async function postToSafeEndpoint(raw: string, headers: Record<string, string>, body: string): Promise<number> {
  const url = await assertSafeOutboundUrl(raw);
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "POST", headers, timeout: 10000,
      lookup: (hostname, _options, callback) => {
        lookup(hostname).then(({ address, family }) => {
          const local = (hostname === "localhost" || hostname === "127.0.0.1") && process.env.NODE_ENV !== "production";
          if (!local && isPrivate(address)) callback(new Error("Private address blocked"), "", 4);
          else callback(null, address, family);
        }, (error) => callback(error, "", 4));
      },
    }, (response) => { response.resume(); resolve(response.statusCode ?? 0); });
    request.on("timeout", () => request.destroy(new Error("Delivery timed out")));
    request.on("error", reject);
    request.end(body);
  });
}
