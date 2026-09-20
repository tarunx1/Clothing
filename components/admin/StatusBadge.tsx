import styles from "./admin.module.css";

export type BadgeTone = "ok" | "warn" | "bad" | "info" | "neutral";

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles[`tone-${tone}`]}`}>{children}</span>;
}

export const orderStatusTone = (status: string): BadgeTone => {
  switch (status) {
    case "PAID": return "info";
    case "PROCESSING": return "warn";
    case "SHIPPED": return "info";
    case "DELIVERED": return "ok";
    case "CANCELLED":
    case "REFUNDED":
    case "PAYMENT_FAILED": return "bad";
    default: return "neutral";
  }
};

export const paymentStatusTone = (status: string | null): BadgeTone =>
  status === "SUCCEEDED" ? "ok" : status === "FAILED" ? "bad" : status === "REFUNDED" ? "warn" : "neutral";

export const stockTone = (status: "in" | "low" | "out"): BadgeTone => (status === "out" ? "bad" : status === "low" ? "warn" : "ok");
export const stockLabel = (status: "in" | "low" | "out") => (status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "In stock");
