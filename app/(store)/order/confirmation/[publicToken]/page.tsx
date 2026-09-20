import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderConfirmation } from "@/components/order/OrderConfirmation";
import { getOrderConfirmation } from "@/lib/services/orderService";
import { getStoreSettings } from "@/lib/content/siteContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OrderConfirmationRoute({ params }: PageProps<"/order/confirmation/[publicToken]">) {
  const { publicToken } = await params;
  const [order, { storeName }] = await Promise.all([getOrderConfirmation(publicToken), getStoreSettings()]);
  if (!order) notFound();
  return <OrderConfirmation order={order} storeName={storeName} />;
}
