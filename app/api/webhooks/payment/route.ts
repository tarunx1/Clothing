import { NextResponse } from "next/server";
import { isWebhookConfigured } from "@/lib/payments/provider";
import { PaymentVerificationError } from "@/lib/payments/types";
import { handlePaymentWebhook } from "@/lib/services/paymentService";

/** Provider → server notifications. Verified against the raw body; responses carry no internals. */
export async function POST(request: Request) {
  if (!(await isWebhookConfigured())) {
    console.error("[webhook] Payment webhook secret is not configured.");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const { duplicate } = await handlePaymentWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true, duplicate });
  } catch (error) {
    if (error instanceof PaymentVerificationError) return NextResponse.json({ ok: false }, { status: 401 });
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) return NextResponse.json({ ok: false }, { status: 400 });
    console.error("[webhook] Processing failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
