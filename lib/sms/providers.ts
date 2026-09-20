import "server-only";
import { getSecret, getSettings } from "@/lib/settings/settingsService";

export type SmsResult = { sent: true } | { sent: false; error: string };
const clean = (message: string) => message.replace(/[A-Za-z0-9_\-+=/.]{24,}/g, "…").slice(0, 200);

/** Sends a text through Settings → SMS. For MSG91, `template` picks the DLT template (shipped/delivered). */
export async function sendSms(input: { to: string; body: string; template?: "shipped" | "delivered"; variables?: Record<string, string> }): Promise<SmsResult> {
  const { provider } = await getSettings("sms");
  const to = input.to.replace(/[^\d+]/g, "");
  if (provider === "none") return { sent: false, error: "No SMS provider is configured." };
  try {
    if (provider === "twilio") {
      const settings = await getSettings("sms.twilio");
      const token = await getSecret("sms.twilio", "authToken");
      if (!settings.accountSid || !token || !settings.fromNumber) return { sent: false, error: "Twilio is not fully configured." };
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${settings.accountSid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: settings.fromNumber, Body: input.body.slice(0, 320) }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok ? { sent: true } : { sent: false, error: clean(`Twilio responded ${response.status}`) };
    }
    const settings = await getSettings("sms.msg91");
    const authKey = await getSecret("sms.msg91", "authKey");
    const templateId = input.template === "delivered" ? settings.templateDelivered : settings.templateShipped;
    if (!authKey || !templateId) return { sent: false, error: "MSG91 needs an auth key and a DLT template ID." };
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: authKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: templateId, short_url: "0", recipients: [{ mobiles: to.replace(/^\+/, ""), ...input.variables }] }),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? { sent: true } : { sent: false, error: clean(`MSG91 responded ${response.status}`) };
  } catch {
    return { sent: false, error: "Sending failed. Check provider configuration and network access." };
  }
}

/** Credential check without sending (Twilio account lookup). */
export async function checkTwilioCredentials() {
  const settings = await getSettings("sms.twilio");
  const token = await getSecret("sms.twilio", "authToken");
  if (!settings.accountSid || !token) return { ok: false, message: "Add the account SID and auth token." };
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}.json`, { headers: { authorization: `Basic ${Buffer.from(`${settings.accountSid}:${token}`).toString("base64")}` }, signal: AbortSignal.timeout(15_000) });
  return response.ok ? { ok: true, message: "Twilio accepted the credentials." } : { ok: false, message: response.status === 401 ? "Twilio rejected the account SID or auth token." : `Twilio responded ${response.status}.` };
}
