import "server-only";
import { deliveryMethods as mockDeliveryMethods, type DeliveryMethod } from "@/config/checkout";
import { findDeliveryMethods } from "@/lib/repositories/deliveryRepository";

export async function getDeliveryMethods(): Promise<DeliveryMethod[]> {
  try {
    const methods = await findDeliveryMethods();
    return methods.length ? methods : [...mockDeliveryMethods];
  } catch (error) {
    if (process.env.NODE_ENV === "production" || process.env.CATALOG_FALLBACK_TO_MOCKS === "false") throw error;
    console.warn("Delivery methods unavailable; using development defaults.", error instanceof Error ? error.message : error);
    return [...mockDeliveryMethods];
  }
}
