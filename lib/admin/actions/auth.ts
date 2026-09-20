"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { verifyAgainstDummy, verifyPassword } from "@/lib/admin/password";
import { endAdminSession, startAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/db/prisma";
import { clearRateLimit, isRateLimited, recordAttempt } from "@/lib/http/rateLimit";
import { getSettingsFresh } from "@/lib/settings/settingsService";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address").max(200),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().max(300).optional(),
});

export interface LoginState {
  error?: string;
  email?: string;
}

/** Only same-app admin paths are allowed as post-login destinations. */
const safeNext = (value?: string) => (value && /^\/admin(\/[A-Za-z0-9/_?=&%.-]*)?$/.test(value) && !value.startsWith("/admin/login") ? value : "/admin");

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details.", email: String(formData.get("email") ?? "") };
  const { email, password, next } = parsed.data;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // Only failed attempts count, so a busy team signing in normally is never locked out.
  const security = await getSettingsFresh("security");
  const window = security.lockoutMinutes * 60_000;
  const keys = { email: `admin-login:${email}`, ip: `admin-login-ip:${ip}` };
  if (isRateLimited(keys.email, security.maxFailedLogins) || isRateLimited(keys.ip, security.maxFailedLogins * 4)) {
    return { error: `Too many failed sign-in attempts. Wait ${security.lockoutMinutes} minutes and try again.`, email };
  }
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const valid = admin && admin.active ? await verifyPassword(password, admin.passwordHash) : await verifyAgainstDummy(password);
  if (!admin || !admin.active || !valid) {
    recordAttempt(keys.email, window);
    recordAttempt(keys.ip, window);
    return { error: "Email or password is incorrect.", email };
  }
  clearRateLimit(keys.email);
  await startAdminSession(admin.id, requestHeaders.get("user-agent"), security.sessionTimeoutHours);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await recordAudit(prisma, { id: admin.id, email: admin.email, name: admin.name, role: admin.role }, "ADMIN_LOGIN", "admin", admin.id);
  redirect(safeNext(next));
}

export async function logoutAction() {
  const actor = await getAdminActor();
  if (actor) await recordAudit(prisma, actor, "ADMIN_LOGOUT", "admin", actor.id);
  await endAdminSession();
  redirect("/admin/login");
}
