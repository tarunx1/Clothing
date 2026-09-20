import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./form.module.css";

interface BaseFieldProps {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  /** Helper text under the control, linked with aria-describedby. */
  hint?: ReactNode;
  /** "compact" is the dense admin variant; the storefront uses the default. */
  density?: "default" | "compact";
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
const fieldClass = (density: BaseFieldProps["density"], className?: string) => `${styles.field} ${density === "compact" ? styles.compact : ""} ${className ?? ""}`;

function Messages({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  return (
    <>
      {hint ? <span id={`${id}-hint`} className={styles.hint}>{hint}</span> : null}
      {error ? <p id={`${id}-error`} role="alert">{error}</p> : null}
    </>
  );
}

export function FormField({ id, label, error, optional, hint, density, className, ...props }: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={fieldClass(density, className)}>
      <label htmlFor={id}>{label}{optional ? <span>Optional</span> : null}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} {...props} />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({ id, label, error, optional, hint, density, children, className, ...props }: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={fieldClass(density, className)}>
      <label htmlFor={id}>{label}{optional ? <span>Optional</span> : null}</label>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} {...props}>{children}</select>
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

export function TextareaField({ id, label, error, optional, hint, density, className, ...props }: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={fieldClass(density, className)}>
      <label htmlFor={id}>{label}{optional ? <span>Optional</span> : null}</label>
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error, hint)} {...props} />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

/** Checkbox styled as a switch; keeps native semantics (role="switch") and keyboard behaviour. */
export function SwitchField({ id, label, hint, error, className, ...props }: Omit<BaseFieldProps, "density" | "optional"> & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className={`${styles.switchField} ${className ?? ""}`}>
      <input id={id} type="checkbox" role="switch" aria-describedby={describedBy(id, error, hint)} aria-invalid={Boolean(error)} {...props} />
      <label htmlFor={id}><span className={styles.track} aria-hidden="true" />{label}</label>
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}
