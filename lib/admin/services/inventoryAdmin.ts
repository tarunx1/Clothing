import "server-only";
import { Prisma } from "@prisma/client";
import type { AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import type { ListParams } from "@/lib/admin/listParams";
import { invalidateStorefront, storefrontTargets } from "@/lib/admin/revalidate";
import { inventoryAdjustmentSchema } from "@/lib/admin/validation";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { checkLowStock } from "@/lib/notifications/notificationService";

export const INVENTORY_SORTS = ["product", "available-asc", "available-desc", "sku"] as const;
export type InventorySort = (typeof INVENTORY_SORTS)[number];

interface InventoryRow {
  variantId: string;
  sku: string;
  enabled: boolean;
  productId: string;
  productName: string;
  productSlug: string;
  color: string;
  colorHex: string | null;
  size: string;
  quantity: number;
  reserved: number;
  available: number;
  image: string | null;
}

const orderBy: Record<InventorySort, Prisma.Sql> = {
  product: Prisma.sql`p.name ASC, c.name ASC, s."order" ASC`,
  "available-asc": Prisma.sql`available ASC, p.name ASC`,
  "available-desc": Prisma.sql`available DESC, p.name ASC`,
  sku: Prisma.sql`v.sku ASC`,
};

export async function listInventory(params: ListParams<InventorySort>, lowStockThreshold: number) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (params.search) {
    const like = `%${params.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${like} OR v.sku ILIKE ${like})`);
  }
  const available = Prisma.sql`(COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))`;
  if (params.filters.status === "out") conditions.push(Prisma.sql`${available} <= 0`);
  if (params.filters.status === "low") conditions.push(Prisma.sql`${available} BETWEEN 1 AND ${lowStockThreshold}`);
  if (params.filters.status === "in") conditions.push(Prisma.sql`${available} > ${lowStockThreshold}`);
  const where = Prisma.join(conditions, " AND ");
  const from = Prisma.sql`
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN colors c ON c.id = v.color_id
    JOIN sizes s ON s.id = v.size_id
    LEFT JOIN inventory i ON i.variant_id = v.id`;
  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count ${from} WHERE ${where}`,
    prisma.$queryRaw<InventoryRow[]>`
      SELECT v.id AS "variantId", v.sku, v.enabled, p.id AS "productId", p.name AS "productName", p.slug AS "productSlug",
             c.name AS color, c.hex AS "colorHex", s.name AS size,
             COALESCE(i.quantity, 0)::int AS quantity, COALESCE(i.reserved_quantity, 0)::int AS reserved, ${available}::int AS available,
             (SELECT pi.src FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi."order" ASC LIMIT 1) AS image
      ${from} WHERE ${where}
      ORDER BY ${orderBy[params.sort]}
      LIMIT ${params.limit} OFFSET ${params.skip}`,
  ]);
  return {
    total: Number(countRows[0]?.count ?? 0),
    rows: rows.map((row) => ({ ...row, status: row.available <= 0 ? ("out" as const) : row.available <= lowStockThreshold ? ("low" as const) : ("in" as const) })),
  };
}

/**
 * Applies a recorded stock delta. The guarded UPDATE refuses any result below
 * zero or below the units held by in-progress checkouts, so admin edits can
 * never corrupt active payment reservations.
 */
export async function adjustInventory(actor: AdminActor, values: unknown) {
  const input = inventoryAdjustmentSchema.parse(values);
  const result = await withSerializableRetry(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: input.variantId }, include: { product: { select: { slug: true, name: true } } } });
    if (!variant) throw new AdminError("NOT_FOUND", "This variant no longer exists.");
    await tx.inventory.upsert({ where: { variantId: variant.id }, update: {}, create: { variantId: variant.id, quantity: 0 } });
    const rows = await tx.$queryRaw<{ quantity: number; reserved: number }[]>`
      UPDATE inventory
      SET quantity = quantity + ${input.delta}, updated_at = now()
      WHERE variant_id = ${variant.id}::uuid AND quantity + ${input.delta} >= GREATEST(reserved_quantity, 0)
      RETURNING quantity, reserved_quantity AS reserved`;
    if (!rows[0]) {
      const current = await tx.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
      const floor = Math.max(current.reservedQuantity, 0);
      throw new AdminError(
        "INVALID_STATE",
        floor > 0
          ? `Stock can't go below ${floor}: ${floor} unit${floor === 1 ? " is" : "s are"} reserved by checkouts in progress. The largest reduction is ${current.quantity - floor}.`
          : `Stock can't go below 0. The largest reduction is ${current.quantity}.`,
        "delta",
      );
    }
    const after = rows[0].quantity;
    const adjustment = await tx.inventoryAdjustment.create({
      data: { variantId: variant.id, quantityDelta: input.delta, quantityBefore: after - input.delta, quantityAfter: after, reason: input.reason, note: input.note || null, adminId: actor.id },
    });
    await recordAudit(tx, actor, "INVENTORY_ADJUSTED", "variant", variant.id, { sku: variant.sku, delta: input.delta, reason: input.reason, before: adjustment.quantityBefore, after });
    return { slug: variant.product.slug, quantity: after, reserved: rows[0].reserved, available: after - rows[0].reserved };
  });
  invalidateStorefront(storefrontTargets.product(result.slug));
  if (input.delta < 0) await checkLowStock([input.variantId]).catch(() => undefined);
  return { quantity: result.quantity, reserved: result.reserved, available: result.available };
}

export async function listAdjustments(variantId: string, take = 15) {
  const rows = await prisma.inventoryAdjustment.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take,
    include: { admin: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    delta: row.quantityDelta,
    before: row.quantityBefore,
    after: row.quantityAfter,
    reason: row.reason,
    note: row.note,
    by: row.admin?.name ?? "System",
    at: row.createdAt.toISOString(),
  }));
}
