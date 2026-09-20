import styles from "@/components/admin/admin.module.css";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={styles.skeleton} style={{ width: 220, height: 26, marginBottom: 20 }} />
      <div className={styles.panel}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} style={{ padding: "12px 16px", borderBottom: "1px solid var(--a-line)" }}>
            <div className={styles.skeleton} style={{ height: 18, width: `${90 - index * 8}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
