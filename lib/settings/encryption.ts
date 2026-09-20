import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets stored through the admin. The key comes from the
 * SETTINGS_ENCRYPTION_KEY environment variable (the root of trust; never
 * stored in the database or editable in the admin). Each ciphertext is bound
 * to its slot through additional authenticated data, so an encrypted value
 * copied into another setting fails to decrypt.
 */
export const ENCRYPTION_VERSION = 1;

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
  version: number;
}

interface KeyEntry { id: string; key: Buffer }

function parseKey(raw: string | undefined): KeyEntry | null {
  if (!raw) return null;
  const text = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64");
  if (key.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters).");
  return { id: createHash("sha256").update(key).digest("hex").slice(0, 12), key };
}

let cached: { current: KeyEntry | null; previous: KeyEntry | null; source: string } | null = null;

function keyring() {
  const source = `${process.env.SETTINGS_ENCRYPTION_KEY ?? ""}|${process.env.SETTINGS_ENCRYPTION_KEY_PREVIOUS ?? ""}`;
  if (!cached || cached.source !== source) {
    cached = { current: parseKey(process.env.SETTINGS_ENCRYPTION_KEY), previous: parseKey(process.env.SETTINGS_ENCRYPTION_KEY_PREVIOUS), source };
  }
  return cached;
}

export const isEncryptionConfigured = () => {
  try {
    return Boolean(keyring().current);
  } catch {
    return false;
  }
};

export const currentKeyId = () => keyring().current?.id ?? null;

export class EncryptionUnavailableError extends Error {
  constructor(message = "Secret storage is not configured on this server (SETTINGS_ENCRYPTION_KEY).") {
    super(message);
    this.name = "EncryptionUnavailableError";
  }
}

export function encryptSecret(plaintext: string, aad: string): EncryptedValue {
  const { current } = keyring();
  if (!current) throw new EncryptionUnavailableError();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current.key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), keyId: current.id, version: ENCRYPTION_VERSION };
}

/** Decrypts with the key that encrypted it (current or previous during rotation). Throws on tampering. */
export function decryptSecret(value: Pick<EncryptedValue, "ciphertext" | "iv" | "authTag" | "keyId">, aad: string): string {
  const { current, previous } = keyring();
  const entry = [current, previous].find((candidate) => candidate?.id === value.keyId);
  if (!entry) throw new EncryptionUnavailableError("This secret was encrypted with a key that is not configured on this server.");
  const decipher = createDecipheriv("aes-256-gcm", entry.key, Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Recognition hint for the UI (last 4 characters), only for secrets long enough that it reveals little. */
export const secretHint = (plaintext: string) => (plaintext.length >= 16 ? plaintext.slice(-4) : null);
