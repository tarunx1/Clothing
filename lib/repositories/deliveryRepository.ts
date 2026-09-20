import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { DeliveryMethod } from "@/config/checkout";

export async function findDeliveryMethods(): Promise<DeliveryMethod[]> {
  const records = await prisma.deliveryMethod.findMany({ where: { enabled: true }, orderBy: { price: "asc" } });
  return records.map((record) => ({
    id: record.code.toLowerCase(),
    label: record.name,
    estimate: `${record.estimatedMinDays}–${record.estimatedMaxDays} business days`,
    price: Number(record.price) / 100,
  }));
}
