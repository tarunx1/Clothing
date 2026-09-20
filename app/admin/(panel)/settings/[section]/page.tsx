import { notFound } from "next/navigation";
import { requireAdminPage, can } from "@/lib/admin/authorization";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { ConnectionTest } from "@/components/admin/settings/ConnectionTest";
import { AdvancedSettings } from "@/components/admin/settings/AdvancedSettings";
import { CredentialManager } from "@/components/admin/settings/CredentialManager";
import { DeliveryMethods } from "@/components/admin/settings/DeliveryMethods";
import { getSettingsPage, getNamespace, NAMESPACE_IDS, type NamespaceId } from "@/lib/settings/registry";
import { getSettingsFresh, getSecretStatuses, getSettingsHistory } from "@/lib/settings/settingsService";
import { prisma } from "@/lib/db/prisma";
import styles from "@/components/admin/settings/settings.module.css";

export default async function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = getSettingsPage(section);
  if (!page) notFound();
  const actor = await requireAdminPage(page.permission);
  let namespaces = page.namespaces?.map((entry) => entry.id) ?? [];
  if (section === "payments") namespaces = NAMESPACE_IDS.filter((id) => id.startsWith("payments."));
  if (section === "shipping") namespaces = NAMESPACE_IDS.filter((id) => id === "shipping" || id.startsWith("shipping."));
  if (section === "security") namespaces = ["security", "status"];
  const forms = await Promise.all(namespaces.filter((id) => can(actor, getNamespace(id)!.permission)).map(async (id) => ({ id, values: await getSettingsFresh(id), statuses: can(actor, "integrations:manage") ? await getSecretStatuses(id) : {} })));
  const tests: Partial<Record<string, string[]>> = { payments: ["payments.razorpay", "payments.stripe", "payments.paypal"], email: ["email"], storage: ["storage.local", "storage.s3", "storage.r2", "storage.cloudinary"], sms: ["sms.twilio"], analytics: ["analytics"] };
  const history = await getSettingsHistory({ namespace: section === "advanced" ? undefined : section, take: 15 });
  return <>
    <AdminHeader title={page.title} description={page.description} />
    {forms.map((form) => <SettingsSection key={form.id} namespace={form.id as NamespaceId} initial={form.values} statuses={form.statuses} manageCredentials={can(actor, "integrations:manage")} />)}
    {tests[section]?.map((id) => <div key={id}><h2>{getNamespace(id)?.title ?? id}</h2><ConnectionTest id={id} /></div>)}
    {section === "shipping" ? <DeliveryMethods methods={(await prisma.deliveryMethod.findMany({ orderBy: { price: "asc" } })).map((method) => ({ id: method.id, name: method.name, code: method.code, description: method.description, price: Number(method.price), currency: method.currency, enabled: method.enabled, estimatedMinDays: method.estimatedMinDays, estimatedMaxDays: method.estimatedMaxDays }))} /> : null}
    {section === "security" ? <AdvancedSettings security /> : null}
    {section === "advanced" ? <AdvancedSettings /> : null}
    {section === "webhooks" ? <>
      <CredentialManager kind="webhooks" records={(await prisma.webhookEndpoint.findMany({ select: { id: true, name: true, url: true, enabled: true } })).map((record) => ({ ...record, detail: record.url }))} />
      <section className={styles.section}><h2>Delivery log</h2><ul className={styles.list}>{(await prisma.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { endpoint: { select: { url: true } } } })).map((record) => <li key={record.id}><span>{record.event} · {record.endpoint.url}<br />{record.createdAt.toISOString()}</span><span>{record.status} · HTTP {record.httpStatus ?? "—"} · {record.attempts} attempts</span></li>)}</ul></section>
    </> : null}
    {section === "api-keys" ? <CredentialManager kind="api-keys" records={(await prisma.apiKey.findMany({ select: { id: true, name: true, prefix: true, permissions: true, revokedAt: true } })).map((record) => ({ id: record.id, name: record.name, detail: `${record.prefix}… · ${record.permissions.join(", ")}`, revoked: Boolean(record.revokedAt) }))} /> : null}
    {section === "integrations" ? <>
      <h2>Connection health</h2><ul className={styles.list}><li>Database <span>Connected</span></li>{(await prisma.integrationHealth.findMany()).map((record) => <li key={record.id}><span>{record.id}<br />Last tested: {record.lastTestedAt.toISOString()}</span><span>{record.status}</span></li>)}</ul>
      <p className={styles.description}>Providers without a recorded test are unverified. Configure and test them in their settings section.</p>
      <CredentialManager kind="credentials" records={(await prisma.customCredential.findMany({ select: { id: true, label: true, service: true } })).map((record) => ({ id: record.id, name: record.label, detail: record.service }))} />
    </> : null}
    {history.length ? <section className={styles.section}><h2>Recent changes</h2><div className={styles.history}><table><thead><tr><th>Setting</th><th>Change</th><th>Admin</th><th>Time</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.namespace} · {entry.label}</td><td>{entry.action.startsWith("SECRET") ? entry.action.replaceAll("_", " ").toLowerCase() : `${JSON.stringify(entry.previous)} → ${JSON.stringify(entry.next)}`}</td><td>{entry.by}</td><td>{entry.at}</td></tr>)}</tbody></table></div></section> : null}
  </>;
}
