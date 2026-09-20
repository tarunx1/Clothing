import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getSecret, getSettings } from "@/lib/settings/settingsService";

/** Explicit sign-ups only. No provider response or submitted address is logged. */
export async function subscribeNewsletter(email: string) {
  const { provider } = await getSettings("marketing");
  if (provider !== "native") {
    let response: Response;
    const options = { signal: AbortSignal.timeout(15000), redirect: "error" as const };
    if (provider === "mailchimp") {
      const key = await getSecret("marketing.mailchimp", "apiKey");
      const { audienceId } = await getSettings("marketing.mailchimp");
      const dc = key?.match(/-([a-z]{2,4}\d{1,3})$/)?.[1];
      if (!key || !dc || !audienceId) throw new Error("Newsletter provider is not configured.");
      const hash = createHash("md5").update(email).digest("hex");
      response = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${hash}`, { ...options, method: "PUT", headers: { authorization: `Basic ${Buffer.from(`store:${key}`).toString("base64")}`, "content-type": "application/json" }, body: JSON.stringify({ email_address: email, status_if_new: "pending" }) });
    } else if (provider === "klaviyo") {
      const key = await getSecret("marketing.klaviyo", "privateKey");
      const { listId } = await getSettings("marketing.klaviyo");
      if (!key || !listId) throw new Error("Newsletter provider is not configured.");
      response = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs", { ...options, method: "POST", headers: { authorization: `Klaviyo-API-Key ${key}`, revision: "2025-01-15", "content-type": "application/json" }, body: JSON.stringify({ data: { type: "profile-subscription-bulk-create-job", attributes: { profiles: { data: [{ type: "profile", attributes: { email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }] } }, relationships: { list: { data: { type: "list", id: listId } } } } }) });
    } else {
      const key = await getSecret("marketing.brevo", "apiKey");
      const { listId } = await getSettings("marketing.brevo");
      if (!key || !listId) throw new Error("Newsletter provider is not configured.");
      response = await fetch("https://api.brevo.com/v3/contacts", { ...options, method: "POST", headers: { "api-key": key, "content-type": "application/json" }, body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }) });
    }
    if (!response.ok) throw new Error("Newsletter provider did not accept the request.");
  }
  await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email, source: provider, status: provider === "native" ? "SUBSCRIBED" : "SUBMITTED" }, update: { source: provider, status: provider === "native" ? "SUBSCRIBED" : "SUBMITTED" } });
}
