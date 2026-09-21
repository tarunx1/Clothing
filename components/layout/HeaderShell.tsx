"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface HeaderShellProps {
  children: ReactNode;
}

/**
 * Client wrapper for the marketing header.
 * Automatically slides out of view on scroll down and reveals on scroll up
 * or when returning to the top of the page.
 */
export function HeaderShell({ children }: HeaderShellProps) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const pathname = usePathname();

  // Reset visibility on route change
  useEffect(() => {
    setHidden(false);
    lastScrollY.current = typeof window !== "undefined" ? Math.max(0, window.scrollY) : 0;
  }, [pathname]);

  useEffect(() => {
    lastScrollY.current = Math.max(0, window.scrollY);

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY);
        const delta = currentScrollY - lastScrollY.current;

        // Keep header fully visible near the top of the page
        if (currentScrollY <= 40) {
          setHidden(false);
        }
        // Scrolling down past threshold: hide header
        else if (delta > 6 && currentScrollY > 60) {
          setHidden(true);
        }
        // Scrolling up: reveal header immediately
        else if (delta < -4) {
          setHidden(false);
        }

        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-marketing-header
      data-hidden={hidden ? "true" : "false"}
      className="site-header pointer-events-none fixed inset-x-0 top-0 z-50 text-(--header-fg)"
    >
      {children}
    </header>
  );
}
