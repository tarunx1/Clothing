import { z } from "zod";

export const cartLineSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  variantId: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive().max(10),
});

export const syncCartSchema = z.object({ lines: z.array(cartLineSchema).max(50) });
export const addCartItemSchema = cartLineSchema;
export const updateCartItemSchema = z.object({ variantId: z.string().trim().min(1).max(120), quantity: z.number().int().positive().max(10) });
export const removeCartItemSchema = z.object({ variantId: z.string().trim().min(1).max(120) });
