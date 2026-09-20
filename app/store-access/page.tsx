import { redirect } from "next/navigation";
import { storeAccessState } from "@/lib/settings/storeAccess";
import { getSettingsFresh } from "@/lib/settings/settingsService";
import { StoreAccessForm } from "@/components/settings/StoreAccessForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Store access", robots: { index: false, follow: false } };
export default async function StoreAccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [state, general, params] = await Promise.all([storeAccessState(), getSettingsFresh("general"), searchParams]);
  if (!state.maintenanceEnabled && !state.passwordEnabled) redirect("/");
  return <main style={{ minHeight: "100svh", padding: "15vh var(--gutter)", background: "var(--paper-warm)", color: "var(--ink-soft)" }}><div style={{ maxWidth: 480, margin: "auto" }}>
    <p>{general.storeName}</p><h1 style={{ fontSize: 48, margin: "24px 0" }}>{state.maintenanceEnabled ? "Back soon." : "Opening soon."}</h1>
    <p style={{ lineHeight: 1.6, marginBottom: 24 }}>{state.maintenanceEnabled ? state.maintenanceMessage : state.passwordMessage}</p>
    {state.maintenanceEnabled && state.maintenanceReturnAt ? <p>Expected back: {state.maintenanceReturnAt}</p> : null}
    {!state.maintenanceEnabled ? <StoreAccessForm next={params.next ?? "/"} /> : null}
  </div></main>;
}
