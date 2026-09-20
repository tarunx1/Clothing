import { NextResponse } from "next/server";
import { z } from "zod";
import { getCartSession } from "@/lib/cartSession";
import { DomainError } from "@/lib/errors";
import { errorResponse } from "@/lib/http/domainResponse";
import { assertSameOriginJson } from "@/lib/http/requestGuard";
import { cancelCheckoutPayment } from "@/lib/services/paymentService";

const bodySchema = z.object({ reference: z.string().min(1).max(64) });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const sessionId = await getCartSession(false);
    if (!sessionId) throw new DomainError("SESSION_EXPIRED", "Your checkout session has expired. Refresh and try again.");
    const { reference } = bodySchema.parse(await request.json().catch(() => null));
    return NextResponse.json(await cancelCheckoutPayment(sessionId, reference), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
