"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "@/components/animation/SmoothScrollProvider";
import { gsap } from "@/lib/gsap";
import styles from "./drawer.module.css";

const DrawerCloseContext = createContext<(() => void) | null>(null);

/** Close the surrounding drawer with its exit animation (e.g. "Continue shopping"); null outside a drawer. */
export function useDrawerClose(): (() => void) | null {
  return useContext(DrawerCloseContext);
}

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. a cart summary). */
  footer?: ReactNode;
  /** "wide" suits denser content such as the bag. */
  size?: "default" | "wide";
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Shared right-hand drawer. A native modal <dialog> provides aria-modal
 * semantics, an inert page, a keyboard focus trap and ESC; focus returns to
 * the opener on close. GSAP slides the panel in (x 100% → 0, power3.out) and
 * fades a real overlay element, which also closes the drawer when clicked.
 * Page scroll (native and Lenis) is locked while open and restored after.
 * Portalled to <body> so it never inherits the styles of where it was opened
 * (e.g. the header's uppercase type). Drawers mount only after an interaction.
 */
export function Drawer({ title, onClose, children, footer, size = "default" }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  const id = useId();
  const lenis = useLenis();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const scroll = lenis.current;
    scroll?.stop();
    document.body.style.overflow = "hidden";
    if (gutter) document.body.style.paddingRight = `${gutter}px`;
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      scroll?.start();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [lenis]);

  useLayoutEffect(() => {
    const instant = reducedMotion();
    const tween = gsap.context(() => {
      gsap.fromTo(panelRef.current, { xPercent: 100 }, { xPercent: 0, duration: instant ? 0 : 0.6, ease: "power3.out" });
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: instant ? 0 : 0.45, ease: "power1.out" });
    });
    return () => tween.revert();
  }, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const instant = reducedMotion();
    gsap.to(overlayRef.current, { opacity: 0, duration: instant ? 0 : 0.35, ease: "power1.in" });
    gsap.to(panelRef.current, {
      xPercent: 100,
      duration: instant ? 0 : 0.42,
      ease: "power3.in",
      onComplete: () => onCloseRef.current(),
    });
  }, []);

  // The modal dialog already makes the page inert; this also keeps Tab cycling
  // inside the panel instead of stepping out to the browser UI.
  const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    ).filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={id}
      aria-modal="true"
      className={styles.drawer}
      data-size={size}
      data-lenis-prevent
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={trapTab}
    >
      <div ref={overlayRef} className={styles.overlay} onClick={requestClose} aria-hidden="true" />
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.heading}>
          <h2 id={id}>{title}</h2>
          <button type="button" onClick={requestClose} aria-label={`Close ${title.toLowerCase()}`}>
            CLOSE <span aria-hidden="true">×</span>
          </button>
        </div>
        <DrawerCloseContext.Provider value={requestClose}>
          <div className={styles.content}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </DrawerCloseContext.Provider>
      </div>
    </dialog>,
    document.body,
  );
}
