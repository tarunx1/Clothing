import "server-only";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret, secretHint } from "./encryption";

/**
 * Encryption for secrets that live on their own records (webhook signing
 * secrets, custom credentials). Same AES-256-GCM envelope as settings, bound to
 * the record id through additional authenticated data.
 */
export const webhookAad = (id: string) => `webhook:${id}`;
export const credentialAad = (id: string) => `credential:${id}`;

export function sealWebhookSecret(id: string, secret: string) {
  const sealed = encryptSecret(secret, webhookAad(id));
  return { secretCiphertext: sealed.ciphertext, secretIv: sealed.iv, secretAuthTag: sealed.authTag, secretKeyId: sealed.keyId, secretHint: secretHint(secret) };
}

export function openWebhookSecret(record: { id: string; secretCiphertext: string; secretIv: string; secretAuthTag: string; secretKeyId: string }) {
  return decryptSecret({ ciphertext: record.secretCiphertext, iv: record.secretIv, authTag: record.secretAuthTag, keyId: record.secretKeyId }, webhookAad(record.id));
}

export function sealCredentialSecret(id: string, secret: string) {
  const sealed = encryptSecret(secret, credentialAad(id));
  return { secretCiphertext: sealed.ciphertext, secretIv: sealed.iv, secretAuthTag: sealed.authTag, secretKeyId: sealed.keyId, secretHint: secretHint(secret) };
}

export function openCredentialSecret(record: { id: string; secretCiphertext: string | null; secretIv: string | null; secretAuthTag: string | null; secretKeyId: string | null }) {
  if (!record.secretCiphertext || !record.secretIv || !record.secretAuthTag || !record.secretKeyId) return null;
  return decryptSecret({ ciphertext: record.secretCiphertext, iv: record.secretIv, authTag: record.secretAuthTag, keyId: record.secretKeyId }, credentialAad(record.id));
}

/** Key rotation: re-seal webhook and credential secrets not yet under `targetKeyId`. */
export async function reencryptWebhookAndCredentialSecrets(targetKeyId: string) {
  let rotated = 0;
  for (const endpoint of await prisma.webhookEndpoint.findMany({ where: { secretKeyId: { not: targetKeyId } } })) {
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: sealWebhookSecret(endpoint.id, openWebhookSecret(endpoint)) });
    rotated += 1;
  }
  for (const credential of await prisma.customCredential.findMany({ where: { secretKeyId: { not: targetKeyId }, secretCiphertext: { not: null } } })) {
    const secret = openCredentialSecret(credential);
    if (secret) await prisma.customCredential.update({ where: { id: credential.id }, data: sealCredentialSecret(credential.id, secret) });
    rotated += 1;
  }
  return rotated;
}
