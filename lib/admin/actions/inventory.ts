"use server";

import { runAdminAction } from "@/lib/admin/actionRunner";
import { requireAdminAction } from "@/lib/admin/authorization";
import { toActionError } from "@/lib/admin/errors";
import { adjustInventory, listAdjustments } from "@/lib/admin/services/inventoryAdmin";
import { z } from "zod";

export async function adjustInventoryAction(values: unknown) {
  return runAdminAction("inventory:write", (actor) => adjustInventory(actor, values), "Stock adjusted.");
}

export async function inventoryHistoryAction(variantId: string) {
  try {
    await requireAdminAction("dashboard:view");
    return { ok: true as const, data: await listAdjustments(z.string().uuid().parse(variantId)) };
  } catch (error) {
    return toActionError(error);
  }
}
