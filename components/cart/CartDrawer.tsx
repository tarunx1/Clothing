"use client";

import { cartConfig } from "@/config/cart";
import { useCart } from "@/hooks/useBag";
import { Drawer, useDrawerClose } from "@/components/ui/Drawer";
import { CartContents } from "./CartContents";
import { CartSummary } from "./CartSummary";

/** Summary pinned to the drawer footer; "Continue shopping" closes with the exit animation. */
function DrawerSummary() {
  const { subtotal, currency } = useCart();
  const close = useDrawerClose();
  return <CartSummary subtotal={subtotal} currency={currency} onContinue={close ?? undefined} />;
}

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { count } = useCart();
  return (
    <Drawer title={cartConfig.copy.title} onClose={onClose} size="wide" footer={count ? <DrawerSummary /> : undefined}>
      <CartContents variant="drawer" />
    </Drawer>
  );
}
