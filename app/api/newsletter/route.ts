import { z } from "zod";
import { assertSameOriginJson, clientAddress } from "@/lib/http/requestGuard";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { subscribeNewsletter } from "@/lib/services/newsletterService";
import { getSettings } from "@/lib/settings/settingsService";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    enforceRateLimit(`newsletter:${clientAddress(request)}`, 5, 15 * 60_000);
    if (!(await getSettings("features")).newsletter) return Response.json({ error: "Sign-ups are currently closed." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 1024) return Response.json({ error: "Invalid request." }, { status: 400 });
    const parsed = z.object({ email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()) }).safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    await subscribeNewsletter(parsed.data.email);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to subscribe right now. Please try again later." }, { status: 400 });
  }
}
