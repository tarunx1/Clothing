import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateOrderData = Prisma.OrderCreateArgs["data"];

export const createOrderRecord = (data: CreateOrderData) => prisma.order.create({ data, include: { items: true, shippingAddress: true } });
