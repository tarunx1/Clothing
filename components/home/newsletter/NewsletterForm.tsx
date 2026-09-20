"use client";

import { useRef, useState, type FormEvent } from "react";
import { newsletterConfig as copy } from "@/config/newsletter";
import { submitNewsletter } from "@/lib/newsletter";
import styles from "./newsletter.module.css";

export function NewsletterForm({ submitLabel = copy.submitLabel }: { submitLabel?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || status === "success") return;
    const field = input.current;
    if (!field) return;
    field.value = field.value.trim();
    if (!field.validity.valid) {
      setError(copy.invalidEmail);
      field.focus();
      return;
    }
    busy.current = true;
    setError("");
    setStatus("pending");
    try {
      await submitNewsletter(field.value);
      field.value = "";
      setStatus("success");
    } catch {
      setError(copy.failure);
      setStatus("idle");
    } finally {
      busy.current = false;
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-label="Next drop signup" aria-busy={status === "pending"}>
      <label htmlFor="newsletter-email" className={styles.label}>{copy.emailLabel}</label>
      <div className={styles.field}>
        <input ref={input} id="newsletter-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} pattern="[^\s@]+@[^\s@]+\.[^\s@]+" aria-invalid={Boolean(error)} aria-describedby="newsletter-feedback" readOnly={status !== "idle"} onChange={() => error && setError("")} />
        <button type="submit" disabled={status !== "idle"}>
          {status === "pending" ? copy.pendingLabel : status === "success" ? copy.success : submitLabel}
          {status === "idle" && <span aria-hidden="true">→</span>}
        </button>
      </div>
      <p id="newsletter-feedback" className={styles.feedback} role="status" aria-live="polite">
        {error || (status === "success" ? <span className="sr-only">{copy.success}</span> : "\u00a0")}
      </p>
    </form>
  );
}
