import { NextResponse } from "next/server";
import { getCartSession } from "@/lib/cartSession";
import { errorResponse } from "@/lib/http/domainResponse";
import { addCartItem, removeCartItem, updateCartItem } from "@/lib/services/cartService";
import { addCartItemSchema, removeCartItemSchema, updateCartItemSchema } from "@/lib/validation/cart";

export async function POST(request: Request) {
  try {
    const input = addCartItemSchema.parse(await request.json());
    return NextResponse.json(await addCartItem((await getCartSession())!, input));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const input = updateCartItemSchema.parse(await request.json());
    return NextResponse.json(await updateCartItem((await getCartSession())!, input.variantId, input.quantity));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const input = removeCartItemSchema.parse(await request.json());
    return NextResponse.json(await removeCartItem((await getCartSession())!, input.variantId));
  } catch (error) { return errorResponse(error); }
}
