import { requireAdminPage, can } from "@/lib/admin/authorization";
import { SETTINGS_PAGES } from "@/lib/settings/registry";
import { SettingsNav } from "@/components/admin/settings/SettingsNav";
import { Reauthenticate } from "@/components/admin/settings/Reauthenticate";
import styles from "@/components/admin/settings/settings.module.css";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminPage("settings:write");
  const pages = SETTINGS_PAGES.filter((page) => can(actor, page.permission)).map(({ slug, title, group }) => ({ slug, title, group }));
  return <div className={styles.layout}><SettingsNav pages={pages} /><div className={styles.content}><Reauthenticate />{children}</div></div>;
}
