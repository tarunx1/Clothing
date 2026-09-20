import Link from "next/link";
import { requireAdminPage, can } from "@/lib/admin/authorization";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SETTINGS_PAGES } from "@/lib/settings/registry";
import { getSettingsFresh } from "@/lib/settings/settingsService";
import { credentialSource } from "@/lib/payments/provider";
import { isEncryptionConfigured } from "@/lib/settings/encryption";
import { prisma } from "@/lib/db/prisma";
import styles from "@/components/admin/settings/settings.module.css";

export default async function SettingsHub() {
  const actor = await requireAdminPage("settings:write");
  const [general, seo, email, payments, productCount, deliveryCount] = await Promise.all([
    getSettingsFresh("general"), getSettingsFresh("seo"), getSettingsFresh("email"), getSettingsFresh("payments.razorpay"),
    prisma.product.count({ where: { enabled: true } }), prisma.deliveryMethod.count({ where: { enabled: true } }),
  ]);
  const paymentReady = payments.enabled && await credentialSource(payments.mode) !== "none";
  const checklist = [
    ["Business information", Boolean(general.storeName && general.legalName)],
    ["Payment credentials", paymentReady],
    ["Delivery methods", deliveryCount > 0], ["Email provider selected", email.provider !== "none"],
    ["Products added", productCount > 0], ["Domain configured", Boolean(seo.canonicalBaseUrl)],
    ["Encrypted credential storage", isEncryptionConfigured()],
  ] as const;
  return <><AdminHeader title="Store settings" description="Configure your store, connections and operating rules." />
    <section className={styles.section}><h2>Setup checklist</h2><ul className={styles.checklist}>{checklist.map(([label, ready]) => <li key={label}>{ready ? "✓" : "○"} {label} — {ready ? "Configured" : "Needs attention"}</li>)}</ul><p className={styles.description}>Configuration checks do not imply a successful provider connection. Use Test connection on the provider page.</p></section>
    <ul className={styles.list}>{SETTINGS_PAGES.filter((page) => can(actor, page.permission)).map((page) => <li key={page.slug}><Link href={`/admin/settings/${page.slug}`}><strong>{page.title}</strong><p>{page.description}</p></Link><span aria-hidden="true">→</span></li>)}</ul>
  </>;
}
