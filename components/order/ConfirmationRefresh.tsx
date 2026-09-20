"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While the provider webhook settles a payment, re-render the server page a few times. */
export function ConfirmationRefresh({ attempts = 10, intervalMs = 3000 }: { attempts?: number; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= attempts) window.clearInterval(timer);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [attempts, intervalMs, router]);
  return null;
}
