import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout/CheckoutPage";
import { getStoreSettings } from "@/lib/content/siteContent";
import { getCheckoutPolicy } from "@/lib/services/storePolicy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm contact, shipping, and delivery details for your order.",
  robots: { index: false, follow: false },
};

export default async function CheckoutRoute() {
  const [{ storeName }, policy] = await Promise.all([getStoreSettings(), getCheckoutPolicy()]);
  return <CheckoutPage storeName={storeName} policy={policy} />;
}
