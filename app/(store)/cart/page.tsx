import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { CartPage } from "@/components/cart/CartPage";
import { getSettings } from "@/lib/settings/settingsService";

export const metadata: Metadata = {
  title: "Bag",
  description: "Review the pieces in your bag.",
  robots: { index: false },
};

export default async function CartRoute() {
  const { storeNotice } = await getSettings("site");
  return (
    <>
      <CartPage storeNotice={storeNotice} />
      <Footer />
    </>
  );
}
