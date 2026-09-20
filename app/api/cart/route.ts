import { NextResponse } from "next/server";
import { getCartSession } from "@/lib/cartSession";
import { errorResponse } from "@/lib/http/domainResponse";
import { getCart, syncCart } from "@/lib/services/cartService";
import { syncCartSchema } from "@/lib/validation/cart";

export async function GET() {
  try {
    const sessionId = await getCartSession();
    return NextResponse.json(await getCart(sessionId!));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = syncCartSchema.parse(await request.json());
    const sessionId = await getCartSession();
    return NextResponse.json(await syncCart(sessionId!, input.lines));
  } catch (error) {
    return errorResponse(error);
  }
}
