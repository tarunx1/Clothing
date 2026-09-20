"use server";

import { runAdminAction } from "@/lib/admin/actionRunner";
import { transitionOrder, updateShipment } from "@/lib/admin/services/orderAdmin";

export async function transitionOrderAction(values: unknown) {
  return runAdminAction("orders:write", (actor) => transitionOrder(actor, values), "Order updated.");
}

export async function updateShipmentAction(orderId: string, values: unknown) {
  return runAdminAction("orders:write", (actor) => updateShipment(actor, orderId, values), "Tracking saved.");
}
