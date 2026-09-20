import "server-only";
import { signAwsRequest } from "@/lib/aws/sigv4";
import { getSecret, getSettings } from "@/lib/settings/settingsService";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult = { sent: true; provider: string } | { sent: false; provider: string; error: string };

/** Short, credential-free error text. Provider responses are never echoed wholesale. */
async function httpError(response: Response) {
  return `Provider returned HTTP ${response.status}. Check the saved sender and credentials.`;
}

/**
 * Sends one transactional email through the provider chosen in Settings → Email.
 * Returns a result instead of throwing; nothing is pretended when no provider is set.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const settings = await getSettings("email");
  const provider = settings.provider;
  if (provider === "none") return { sent: false, provider, error: "No email provider is configured." };
  if (!settings.fromEmail) return { sent: false, provider, error: "No sender address is configured." };
  const from = settings.fromName ? `${settings.fromName.replace(/["<>]/g, "")} <${settings.fromEmail}>` : settings.fromEmail;
  const replyTo = settings.replyTo || undefined;
  try {
    if (provider === "smtp") {
      const smtp = await getSettings("email.smtp");
      if (smtp.security === "none" && process.env.NODE_ENV === "production") return { sent: false, provider, error: "Enable TLS for SMTP in production." };
      const password = await getSecret("email.smtp", "password");
      if (!smtp.host) return { sent: false, provider, error: "SMTP host is missing." };
      const { createTransport } = await import("nodemailer");
      const transport = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.security === "tls",
        requireTLS: smtp.security === "starttls",
        ignoreTLS: smtp.security === "none",
        auth: smtp.username ? { user: smtp.username, pass: password ?? "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      await transport.sendMail({ from, to: message.to, replyTo, subject: message.subject, text: message.text, html: message.html });
      return { sent: true, provider };
    }
    if (provider === "resend") {
      const key = await getSecret("email.resend", "apiKey");
      if (!key) return { sent: false, provider, error: "Resend API key is missing." };
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text, reply_to: replyTo }), signal: AbortSignal.timeout(15_000) });
      return response.ok ? { sent: true, provider } : { sent: false, provider, error: await httpError(response) };
    }
    if (provider === "sendgrid") {
      const key = await getSecret("email.sendgrid", "apiKey");
      if (!key) return { sent: false, provider, error: "SendGrid API key is missing." };
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: message.to }] }], from: { email: settings.fromEmail, name: settings.fromName || undefined }, reply_to: replyTo ? { email: replyTo } : undefined, subject: message.subject, content: [{ type: "text/plain", value: message.text }, { type: "text/html", value: message.html }] }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok ? { sent: true, provider } : { sent: false, provider, error: await httpError(response) };
    }
    if (provider === "postmark") {
      const token = await getSecret("email.postmark", "serverToken");
      const { messageStream } = await getSettings("email.postmark");
      if (!token) return { sent: false, provider, error: "Postmark server token is missing." };
      const response = await fetch("https://api.postmarkapp.com/email", { method: "POST", headers: { "x-postmark-server-token": token, accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ From: from, To: message.to, Subject: message.subject, HtmlBody: message.html, TextBody: message.text, ReplyTo: replyTo, MessageStream: messageStream || "outbound" }), signal: AbortSignal.timeout(15_000) });
      return response.ok ? { sent: true, provider } : { sent: false, provider, error: await httpError(response) };
    }
    if (provider === "ses") {
      const ses = await getSettings("email.ses");
      const secret = await getSecret("email.ses", "secretAccessKey");
      if (!ses.accessKeyId || !secret) return { sent: false, provider, error: "SES credentials are missing." };
      const url = new URL(`https://email.${ses.region}.amazonaws.com/v2/email/outbound-emails`);
      const body = JSON.stringify({ FromEmailAddress: from, Destination: { ToAddresses: [message.to] }, ReplyToAddresses: replyTo ? [replyTo] : undefined, Content: { Simple: { Subject: { Data: message.subject }, Body: { Text: { Data: message.text }, Html: { Data: message.html } } } } });
      const signed = signAwsRequest({ region: ses.region, accessKeyId: ses.accessKeyId, secretAccessKey: secret }, "ses", "POST", url, body, { "content-type": "application/json" });
      const response = await fetch(signed.url, { method: "POST", headers: signed.headers, body, signal: AbortSignal.timeout(15_000) });
      return response.ok ? { sent: true, provider } : { sent: false, provider, error: await httpError(response) };
    }
    return { sent: false, provider, error: "Unknown email provider." };
  } catch {
    return { sent: false, provider, error: "Sending failed. Check provider configuration and network access." };
  }
}
