import type { DeliveryMethod } from "@/config/checkout";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types/product";
import type { UseFormRegister } from "react-hook-form";
import type { CheckoutFormValues } from "@/types/checkout";
import styles from "./checkout.module.css";

export function DeliveryMethodSelector({ methods, register, currency, error, onChange }: { methods: readonly DeliveryMethod[]; register: UseFormRegister<CheckoutFormValues>; currency: CurrencyCode; error?: string; onChange: (id: string) => void }) {
  return (
    <fieldset className={styles.delivery} aria-describedby={error ? "delivery-error" : undefined}>
      <legend className={styles.visuallyHidden}>Select a delivery method</legend>
      {methods.map((method) => (
        <label key={method.id}>
          <input type="radio" value={method.id} {...register("deliveryMethodId", { onChange: (event) => onChange(event.target.value) })} />
          <span className={styles.radio} aria-hidden="true" />
          <span><strong>{method.label}</strong><small>{method.estimate}</small></span>
          <b>{method.price === 0 ? "Complimentary" : formatMoney(method.price, currency)}</b>
        </label>
      ))}
      {error ? <p id="delivery-error" role="alert" className={styles.error}>{error}</p> : null}
    </fieldset>
  );
}
