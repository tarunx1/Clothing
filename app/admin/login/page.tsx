import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminActor } from "@/lib/admin/authorization";
import { getSettings } from "@/lib/settings/settingsService";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdminActor()) redirect("/admin");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const { storeName } = await getSettings("general");
  return <LoginForm storeName={storeName} next={next} />;
}
