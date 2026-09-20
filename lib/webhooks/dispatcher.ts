import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { openWebhookSecret } from "@/lib/settings/secretRecords";
import type { StoreEvent } from "./events";
import { postToSafeEndpoint } from "./urlSafety";

/**
 * Outbound webhooks. Each delivery is signed with the endpoint's secret:
 *   X-Clothin-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
 * Receivers should recompute the HMAC and reject timestamps older than 5 minutes.
 * The delivery log keeps event, status and timing; payloads are not stored.
 */
const RETRY_DELAYS_MS = [2_000, 10_000];

export const signPayload = (secret: string, timestamp: number, body: string) => createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

/** Runs after the response when inside a request; directly otherwise (scripts, tests). */
function inBackground(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task().catch((error) => console.error("[webhooks] Background delivery failed", error instanceof Error ? error.name : "error"));
  }
}

async function attempt(endpoint: { id: string; url: string; secretCiphertext: string; secretIv: string; secretAuthTag: string; secretKeyId: string }, deliveryId: string, event: string, body: string) {
  const started = Date.now();
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const status = await postToSafeEndpoint(endpoint.url, {
      "content-type": "application/json",
      "user-agent": "Clothin-Webhooks/1",
      "x-clothin-event": event,
      "x-clothin-delivery": deliveryId,
      "x-clothin-signature": `t=${timestamp},v1=${signPayload(openWebhookSecret(endpoint), timestamp, body)}`,
    }, body);
    return { ok: status >= 200 && status < 300, httpStatus: status, error: (status >= 200 && status < 300) ? null : `HTTP ${status}`, durationMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? (error.name === "TimeoutError" ? "Timed out after 10s" : "Delivery failed. Check endpoint availability.") : "Delivery failed";
    return { ok: false, httpStatus: null, error: message.slice(0, 200), durationMs: Date.now() - started };
  }
}

/** Delivers with retries, updating the log after each attempt. */
async function deliver(endpointId: string, deliveryId: string, event: string, body: string, maxAttempts = RETRY_DELAYS_MS.length + 1) {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint) return null;
  let result = null;
  for (let index = 0; index < maxAttempts; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[index - 1]));
    result = await attempt(endpoint, deliveryId, event, body);
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: index + 1, httpStatus: result.httpStatus, error: result.error, durationMs: result.durationMs, status: result.ok ? "SUCCEEDED" : index + 1 >= maxAttempts ? "FAILED" : "PENDING", completedAt: result.ok || index + 1 >= maxAttempts ? new Date() : null },
    });
    if (result.ok) break;
  }
  return result;
}

const envelope = (event: string, data: Record<string, unknown>) => {
  const id = randomUUID();
  return { id, body: JSON.stringify({ id, type: event, createdAt: new Date().toISOString(), data }) };
};

/** Queues an event for every enabled endpoint subscribed to it. Never throws into the caller's flow. */
export async function emitStoreEvent(event: StoreEvent, data: Record<string, unknown>) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({ where: { enabled: true, events: { has: event } }, select: { id: true } });
    if (!endpoints.length) return;
    const { id, body } = envelope(event, data);
    for (const endpoint of endpoints) {
      const delivery = await prisma.webhookDelivery.create({ data: { endpointId: endpoint.id, event, eventId: id } });
      inBackground(async () => { await deliver(endpoint.id, delivery.id, event, body); });
    }
  } catch (error) {
    console.error("[webhooks] Could not queue event", event, error instanceof Error ? error.name : "error");
  }
}

/** Admin “Send test event”: one immediate attempt, result returned to the admin. */
export async function sendTestEvent(endpointId: string) {
  const { id, body } = envelope("TEST", { message: "This is a test delivery from your store admin." });
  const delivery = await prisma.webhookDelivery.create({ data: { endpointId, event: "TEST", eventId: id } });
  const result = await deliver(endpointId, delivery.id, "TEST", body, 1);
  return result ?? { ok: false, httpStatus: null, error: "Endpoint not found", durationMs: 0 };
}
