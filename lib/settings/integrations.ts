import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSecret, getSettingsFresh } from "./settingsService";
import { sendEmail } from "@/lib/email/providers";
import { testStorage } from "@/lib/storage";
import { testRazorpayCredentials } from "@/lib/payments/razorpay/server";
import { checkTwilioCredentials } from "@/lib/sms/providers";

export async function testIntegration(id: string, recipient?: string): Promise<{ ok: boolean; message: string }> {
  let result: { ok: boolean; message: string };
  try {
    if (id === "payments.razorpay") {
      const config = await getSettingsFresh(id);
      const keyId = config.mode === "live" ? config.liveKeyId : config.testKeyId;
      const keySecret = await getSecret(id, config.mode === "live" ? "liveKeySecret" : "testKeySecret");
      if (!keyId || !keySecret) result = { ok: false, message: "Save the selected mode’s credentials first." };
      else { const status = await testRazorpayCredentials({ keyId, keySecret }); result = { ok: status === 200, message: status === 200 ? "Credentials verified. No payment was created." : `Provider returned HTTP ${status}.` }; }
    } else if (id === "payments.stripe") {
      const config = await getSettingsFresh(id);
      const secret = await getSecret(id, config.mode === "live" ? "liveSecretKey" : "testSecretKey");
      if (!secret) result = { ok: false, message: "Save credentials first." };
      else { const response = await fetch("https://api.stripe.com/v1/balance", { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10000), cache: "no-store" }); result = { ok: response.ok, message: response.ok ? "Credentials verified. Checkout adapter is not installed." : `Provider returned HTTP ${response.status}.` }; }
    } else if (id === "payments.paypal") {
      const config = await getSettingsFresh(id);
      const key = config.mode === "live" ? config.liveClientId : config.testClientId;
      const secret = await getSecret(id, config.mode === "live" ? "liveClientSecret" : "testClientSecret");
      if (!key || !secret) result = { ok: false, message: "Save credentials first." };
      else { const response = await fetch(`https://api-m${config.mode === "live" ? "" : ".sandbox"}.paypal.com/v1/oauth2/token`, { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(10000), cache: "no-store" }); result = { ok: response.ok, message: response.ok ? "Credentials verified. Checkout adapter is not installed." : `Provider returned HTTP ${response.status}.` }; }
    } else if (id === "email") {
      const to = z.string().email().max(200).parse(recipient);
      const sent = await sendEmail({ to, subject: "Store email connection test", html: "<p>Your store email connection works.</p>", text: "Your store email connection works." });
      result = { ok: sent.sent, message: sent.sent ? "Test email accepted by the provider." : "Email could not be sent. Check the saved provider, sender and credentials." };
    } else if (id.startsWith("storage.")) {
      const driver = z.enum(["local", "s3", "r2", "cloudinary"]).parse(id.split(".")[1]);
      result = await testStorage(driver);
    } else if (id === "sms.twilio") {
      const checked = await checkTwilioCredentials();
      result = { ok: checked.ok, message: checked.message };
    } else if (id === "analytics") {
      const config = await getSettingsFresh("analytics");
      result = { ok: true, message: config.consentRequired ? "Configuration validated. Tracking waits for visitor consent." : "Configuration validated. Enabled trackers load on the storefront." };
    } else {
      result = { ok: false, message: "No connection probe is available for this adapter yet. Configuration can be saved." };
    }
  } catch { result = { ok: false, message: "Connection test failed. Check configuration and provider access." }; }
  await prisma.integrationHealth.upsert({ where: { id }, create: { id, status: result.ok ? "CONNECTED" : "ERROR", lastTestedAt: new Date(), lastError: result.ok ? null : result.message }, update: { status: result.ok ? "CONNECTED" : "ERROR", lastTestedAt: new Date(), lastError: result.ok ? null : result.message } });
  return result;
}
