import { NextResponse } from "next/server";
import { paymentConfig } from "@/config/payment";
import { getCartSession } from "@/lib/cartSession";
import { DomainError } from "@/lib/errors";
import { errorResponse } from "@/lib/http/domainResponse";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { assertSameOriginJson, clientAddress } from "@/lib/http/requestGuard";
import { createCheckoutPaymentSession } from "@/lib/services/paymentService";

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const sessionId = await getCartSession(false);
    if (!sessionId) throw new DomainError("SESSION_EXPIRED", "Your checkout session has expired. Refresh and try again.");
    const { limit, windowMs } = paymentConfig.rateLimit;
    enforceRateLimit(`payment-session:${sessionId}`, limit, windowMs);
    enforceRateLimit(`payment-session-ip:${clientAddress(request)}`, limit * 3, windowMs);
    const body = await request.json().catch(() => null);
    return NextResponse.json(await createCheckoutPaymentSession(sessionId, body), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
