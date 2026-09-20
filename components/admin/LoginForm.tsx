"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/admin/actions/auth";
import { FormField } from "@/components/ui/FormField";
import styles from "./login.module.css";

export function LoginForm({ storeName, next }: { storeName: string; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <main className={styles.page}>
      <form action={action} className={styles.card} noValidate aria-describedby={state.error ? "login-error" : undefined}>
        <p className={styles.brand}>{storeName}</p>
        <h1>Sign in to the store admin</h1>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormField id="admin-email" name="email" label="Email" type="email" autoComplete="username" required defaultValue={state.email} density="compact" />
        <FormField id="admin-password" name="password" label="Password" type="password" autoComplete="current-password" required density="compact" />
        {state.error ? <p id="login-error" className={styles.error} role="alert">{state.error}</p> : null}
        <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending || undefined}>{pending ? "Signing in…" : "Sign in"}</button>
        <p className={styles.note}>Staff accounts are created by an administrator. See README/admin.md.</p>
      </form>
    </main>
  );
}
