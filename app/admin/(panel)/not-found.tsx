import Link from "next/link";
import styles from "@/components/admin/admin.module.css";

export default function AdminNotFound() {
  return (
    <div className={`${styles.panel} ${styles.empty}`}>
      <strong>Not found</strong>
      <p>This record doesn’t exist or was deleted.</p>
      <Link className={styles.button} href="/admin">Back to dashboard</Link>
    </div>
  );
}
