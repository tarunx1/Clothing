import "server-only";
import { prisma } from "@/lib/db/prisma";
import { PAID_ORDER_STATUSES } from "@/config/payment";
import { getSettings } from "@/lib/settings/settingsService";

/** Operational snapshot from data the store actually records. No projections or invented analytics. */
export async function getDashboardSnapshot(lowStockThreshold: number) {
  const { timezone } = await getSettings("localization");
  const [day] = await prisma.$queryRaw<{ start: Date }[]>`SELECT date_trunc('day', now() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone} AS start`;
  const startOfDay = day.start;
  const paidStatuses = PAID_ORDER_STATUSES.filter((status) => status !== "REFUNDED");
  const available = "(COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))";
  const [ordersToday, revenueToday, toFulfil, productCounts, lowStock, recentOrders] = await Promise.all([
    prisma.order.count({ where: { paidAt: { gte: startOfDay }, status: { in: [...paidStatuses] } } }),
    prisma.order.groupBy({ by: ["currency"], where: { paidAt: { gte: startOfDay }, status: { in: [...paidStatuses] } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    prisma.product.groupBy({ by: ["enabled"], _count: { _all: true } }),
    prisma.$queryRawUnsafe<{ variantId: string; productId: string; productName: string; sku: string; color: string; size: string; available: number }[]>(
      `SELECT v.id AS "variantId", p.id AS "productId", p.name AS "productName", v.sku, c.name AS color, s.name AS size, ${available}::int AS available
       FROM product_variants v JOIN products p ON p.id = v.product_id JOIN colors c ON c.id = v.color_id JOIN sizes s ON s.id = v.size_id
       LEFT JOIN inventory i ON i.variant_id = v.id
       WHERE v.enabled AND p.enabled AND ${available} <= $1
       ORDER BY ${available} ASC, p.name ASC LIMIT 8`,
      lowStockThreshold,
    ),
    prisma.order.findMany({
      where: { status: { notIn: ["DRAFT"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, orderNumber: true, email: true, status: true, total: true, currency: true, createdAt: true },
    }),
  ]);
  const lowStockCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM product_variants v JOIN products p ON p.id = v.product_id LEFT JOIN inventory i ON i.variant_id = v.id WHERE v.enabled AND p.enabled AND ${available} <= $1`,
    lowStockThreshold,
  );
  return {
    ordersToday,
    revenueToday: revenueToday.map((row) => ({ currency: row.currency, total: Number(row._sum.total ?? 0) / 100 })),
    toFulfil,
    products: {
      total: productCounts.reduce((sum, row) => sum + row._count._all, 0),
      enabled: productCounts.find((row) => row.enabled)?._count._all ?? 0,
    },
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
    lowStock,
    recentOrders: recentOrders.map((order) => ({ ...order, total: Number(order.total) / 100 })),
  };
}
