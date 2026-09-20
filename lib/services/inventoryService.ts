import "server-only";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/errors";

export interface StockLine {
  variantId: string | null;
  quantity: number;
}

/** Merges lines per variant so each inventory row is touched once. */
function perVariant(lines: readonly StockLine[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.variantId || line.quantity <= 0) continue;
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...totals];
}

/**
 * Holds stock for an order awaiting payment. The guarded UPDATE only succeeds
 * while unreserved stock covers the request, so concurrent checkouts cannot oversell.
 */
export async function reserveStock(tx: Prisma.TransactionClient, lines: readonly StockLine[], enforce = true) {
  for (const [variantId, quantity] of perVariant(lines)) {
    if (!enforce) {
      // Inventory not enforced (Settings → Inventory): record the hold without the availability guard.
      await tx.$executeRaw`UPDATE "inventory" SET "reserved_quantity" = "reserved_quantity" + ${quantity}, "updated_at" = now() WHERE "variant_id" = ${variantId}::uuid`;
      continue;
    }
    const updated = await tx.$executeRaw`
      UPDATE "inventory"
      SET "reserved_quantity" = "reserved_quantity" + ${quantity}, "updated_at" = now()
      WHERE "variant_id" = ${variantId}::uuid AND "quantity" - "reserved_quantity" >= ${quantity}`;
    if (updated !== 1) throw new DomainError("OUT_OF_STOCK", "An item in your bag is no longer available in that quantity.");
  }
}

export async function releaseStock(tx: Prisma.TransactionClient, lines: readonly StockLine[]) {
  for (const [variantId, quantity] of perVariant(lines)) {
    await tx.$executeRaw`
      UPDATE "inventory"
      SET "reserved_quantity" = GREATEST("reserved_quantity" - ${quantity}, 0), "updated_at" = now()
      WHERE "variant_id" = ${variantId}::uuid`;
  }
}

/** Converts held stock into sold stock: quantity -= n, reserved -= n. */
export async function commitReservedStock(tx: Prisma.TransactionClient, lines: readonly StockLine[]) {
  for (const [variantId, quantity] of perVariant(lines)) {
    await tx.$executeRaw`
      UPDATE "inventory"
      SET "quantity" = "quantity" - ${quantity},
          "reserved_quantity" = GREATEST("reserved_quantity" - ${quantity}, 0),
          "updated_at" = now()
      WHERE "variant_id" = ${variantId}::uuid`;
  }
}

/**
 * Sells stock whose reservation already lapsed (payment captured after expiry).
 * Money has been taken, so the sale is recorded even if it oversells; that case is logged.
 */
export async function commitUnreservedStock(tx: Prisma.TransactionClient, lines: readonly StockLine[]) {
  for (const [variantId, quantity] of perVariant(lines)) {
    const rows = await tx.$queryRaw<{ available: number }[]>`
      UPDATE "inventory"
      SET "quantity" = "quantity" - ${quantity}, "updated_at" = now()
      WHERE "variant_id" = ${variantId}::uuid
      RETURNING ("quantity" - "reserved_quantity")::int AS "available"`;
    if (rows[0] && rows[0].available < 0) console.error("[inventory] Oversold after late payment", { variantId, available: rows[0].available });
  }
}
