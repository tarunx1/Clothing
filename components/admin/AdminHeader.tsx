import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import styles from "./admin.module.css";

/** Page title plus contextual actions. */
export function AdminHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className={styles.pageHead}>
      <div>
        {back ? <Link href={back.href} className={styles.back}><Icon name="back" />{back.label}</Link> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
