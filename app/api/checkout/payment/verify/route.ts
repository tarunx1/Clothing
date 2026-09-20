import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http/domainResponse";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { assertSameOriginJson, clientAddress } from "@/lib/http/requestGuard";
import { verifyClientPayment } from "@/lib/services/paymentService";

/** Browser-reported success is only a hint; the service verifies signature and provider state. */
export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    enforceRateLimit(`payment-verify:${clientAddress(request)}`, 30, 10 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { payload?: unknown } | null;
    return NextResponse.json(await verifyClientPayment(body?.payload), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
