import { AdminShell } from "@/components/admin/AdminShell";
import { can, requireAdminPage, type Permission } from "@/lib/admin/authorization";
import { getSettings } from "@/lib/settings/settingsService";

const SECTION_PERMISSIONS: Record<string, Permission> = {
  "/admin": "dashboard:view",
  "/admin/products": "dashboard:view",
  "/admin/collections": "dashboard:view",
  "/admin/inventory": "dashboard:view",
  "/admin/orders": "dashboard:view",
  "/admin/content": "content:write",
  "/admin/settings": "settings:write",
};

/** Admin chrome. Each page below re-verifies the session itself; this layout is not the security boundary. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminPage();
  const { storeName } = await getSettings("general");
  const sections = Object.entries(SECTION_PERMISSIONS).filter(([, permission]) => can(actor, permission)).map(([href]) => href);
  return (
    <AdminShell storeName={storeName} admin={{ name: actor.name, email: actor.email, role: actor.role }} sections={sections} environment={(process.env.APP_ENV || process.env.NODE_ENV || "development").toUpperCase()}>
      {children}
    </AdminShell>
  );
}
