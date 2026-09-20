"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./product.module.css";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * One disclosure implementation for every row. Buttons carry aria-expanded
 * and aria-controls; closed panels are inert so hidden content is never
 * focusable. Height animates with a CSS grid transition (no layout jumps).
 */
export function ProductAccordion({ items, defaultOpen }: { items: AccordionItem[]; defaultOpen?: string }) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ? [defaultOpen] : []));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={styles.accordion}>
      {items.map((item) => {
        const expanded = open.has(item.id);
        const triggerId = `${baseId}-${item.id}-trigger`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id} className={styles.accordionItem}>
            <h3>
              <button
                type="button"
                id={triggerId}
                className={styles.accordionTrigger}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
              >
                {item.title}
                <span aria-hidden="true" className={styles.accordionIcon} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className={styles.accordionPanel}
              data-open={expanded || undefined}
              inert={!expanded}
            >
              <div className={styles.accordionInner}>
                <div className={styles.accordionBody}>{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
