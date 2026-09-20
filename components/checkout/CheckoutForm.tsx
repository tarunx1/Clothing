"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { checkoutConfig, countries, getCountry, type DeliveryMethod } from "@/config/checkout";
import { FormField, SelectField } from "@/components/ui/FormField";
import { buildCheckoutSchema, type CheckoutRules } from "@/lib/checkout/rules";
import type { CheckoutFormValues } from "@/types/checkout";
import type { CurrencyCode } from "@/types/product";
import { DeliveryMethodSelector } from "./DeliveryMethodSelector";
import { PaymentButton } from "./PaymentButton";
import { PaymentStatus } from "./PaymentStatus";
import { usePaymentFlow } from "./usePaymentFlow";
import styles from "./checkout.module.css";

interface CheckoutFormProps {
  rules: CheckoutRules;
  defaultCountry: string;
  onAddressChange: (country: string, region: string) => void;
  deliveryMethods: readonly DeliveryMethod[];
  currency: CurrencyCode;
  onDeliveryChange: (id: string) => void;
  onQuote: (quote: { subtotal: number; shipping: number; tax: number; total: number; currency: CurrencyCode }) => void;
}

export function CheckoutForm({ deliveryMethods, currency, onDeliveryChange, onQuote, rules, defaultCountry, onAddressChange }: CheckoutFormProps) {
  const payment = usePaymentFlow(onQuote);
  const canPersist = useRef(false);
  const defaults = useMemo(() => ({ ...checkoutConfig.defaultValues, shippingAddress: { ...checkoutConfig.defaultValues.shippingAddress, country: rules.allowedCountries.includes(defaultCountry) ? defaultCountry : rules.allowedCountries[0] } }), [rules.allowedCountries, defaultCountry]);
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<CheckoutFormValues>({
    resolver: zodResolver(buildCheckoutSchema(rules)),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const values = useWatch({ control });
  const countryCode = values.shippingAddress?.country ?? checkoutConfig.defaultCountry;
  const country = useMemo(() => getCountry(countryCode), [countryCode]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(checkoutConfig.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CheckoutFormValues>;
        reset({
          ...defaults,
          ...parsed,
          contact: { ...checkoutConfig.defaultValues.contact, ...parsed.contact },
          shippingAddress: { ...defaults.shippingAddress, ...parsed.shippingAddress },
        });
      }
    } catch { /* Ignore invalid or unavailable session storage. */ }
    canPersist.current = true;
  }, [reset, defaults]);

  useEffect(() => {
    if (!canPersist.current) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(checkoutConfig.storageKey, JSON.stringify(values)); } catch { /* Persistence is optional. */ }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [values]);

  useEffect(() => {
    if (canPersist.current && values.deliveryMethodId) onDeliveryChange(values.deliveryMethodId);
  }, [onDeliveryChange, values.deliveryMethodId]);

  useEffect(() => { onAddressChange(countryCode, values.shippingAddress?.region ?? ""); }, [countryCode, values.shippingAddress?.region, onAddressChange]);
  useEffect(() => {
    if (deliveryMethods.length && !deliveryMethods.some((method) => method.id === values.deliveryMethodId)) setValue("deliveryMethodId", deliveryMethods[0].id);
  }, [deliveryMethods, values.deliveryMethodId, setValue]);

  // The server re-prices everything; the form only supplies contact, address and delivery choice.
  const submit = (formValues: CheckoutFormValues) => payment.start(formValues);

  const contactErrors = errors.contact;
  const addressErrors = errors.shippingAddress;
  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      <section aria-labelledby="checkout-contact">
        <div className={styles.sectionHead}><span>01</span><h2 id="checkout-contact">{checkoutConfig.copy.contact}</h2></div>
        <div className={styles.fields}>
          <FormField id="checkout-email" label="Email" type="email" autoComplete="email" error={contactErrors?.email?.message} {...register("contact.email")} />
          <FormField id="checkout-contact-phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" optional error={contactErrors?.phone?.message} {...register("contact.phone")} />
        </div>
      </section>

      <section aria-labelledby="checkout-shipping">
        <div className={styles.sectionHead}><span>02</span><h2 id="checkout-shipping">{checkoutConfig.copy.shipping}</h2></div>
        <div className={styles.fields}>
          <div className={styles.row}>
            <FormField id="checkout-first-name" label="First name" autoComplete="given-name" error={addressErrors?.firstName?.message} {...register("shippingAddress.firstName")} />
            <FormField id="checkout-last-name" label="Last name" autoComplete="family-name" error={addressErrors?.lastName?.message} {...register("shippingAddress.lastName")} />
          </div>
          <FormField id="checkout-address" label="Address" autoComplete="address-line1" error={addressErrors?.address1?.message} {...register("shippingAddress.address1")} />
          {rules.addressLine2Enabled ? <FormField id="checkout-apartment" label="Apartment / unit" autoComplete="address-line2" optional error={addressErrors?.address2?.message} {...register("shippingAddress.address2")} /> : null}
          {rules.companyFieldEnabled ? <FormField id="checkout-company" label="Company" autoComplete="organization" optional error={addressErrors?.company?.message} {...register("shippingAddress.company")} /> : null}
          <div className={styles.row}>
            <FormField id="checkout-city" label="City" autoComplete="address-level2" error={addressErrors?.city?.message} {...register("shippingAddress.city")} />
            <SelectField id="checkout-region" label={country.regionLabel} autoComplete="address-level1" error={addressErrors?.region?.message} {...register("shippingAddress.region")}>
              <option value="">Select {country.regionLabel.toLowerCase()}</option>
              {country.regions.map((region) => <option value={region} key={region}>{region}</option>)}
            </SelectField>
          </div>
          <div className={styles.row}>
            <FormField id="checkout-postal" label={country.postalLabel} autoComplete="postal-code" error={addressErrors?.postalCode?.message} {...register("shippingAddress.postalCode")} />
            <SelectField id="checkout-country" label="Country / region" autoComplete="country" error={addressErrors?.country?.message} {...register("shippingAddress.country", { onChange: () => setValue("shippingAddress.region", "", { shouldValidate: false }) })}>
              {countries.filter((option) => rules.allowedCountries.includes(option.code)).map((option) => <option value={option.code} key={option.code}>{option.name}</option>)}
            </SelectField>
          </div>
          <FormField id="checkout-shipping-phone" label="Delivery phone" type="tel" inputMode="tel" autoComplete="shipping tel" optional={!rules.phoneRequired} error={addressErrors?.phone?.message} {...register("shippingAddress.phone")} />
        </div>
      </section>

      <section aria-labelledby="checkout-delivery">
        <div className={styles.sectionHead}><span>03</span><h2 id="checkout-delivery">{checkoutConfig.copy.delivery}</h2></div>
        {!deliveryMethods.length ? <p role="status">No delivery method is available for this address.</p> : null}
        <DeliveryMethodSelector methods={deliveryMethods} register={register} currency={currency} error={errors.deliveryMethodId?.message} onChange={onDeliveryChange} />
      </section>

      <section aria-labelledby="checkout-payment">
        <div className={styles.sectionHead}><span>04</span><h2 id="checkout-payment">{checkoutConfig.copy.payment}</h2></div>
        <div className={styles.paymentShell}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" /><path d="M3 10h18" /></svg>
          <p>{checkoutConfig.copy.paymentNote}</p>
        </div>
      </section>

      {rules.requireTerms ? <div><label><input type="checkbox" {...register("acceptTerms")} /> I agree to the {rules.termsUrl ? <a href={rules.termsUrl} target="_blank" rel="noopener noreferrer">terms and conditions</a> : "terms and conditions"}.</label>{errors.acceptTerms ? <p role="alert">{errors.acceptTerms.message}</p> : null}</div> : null}
      <PaymentButton phase={payment.phase} validating={isSubmitting && payment.phase === "idle"} retry={Boolean(payment.error)} />
      <PaymentStatus phase={payment.phase} error={payment.error} />
    </form>
  );
}
