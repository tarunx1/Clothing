import { z } from "zod";
import { checkoutFormSchema } from "@/lib/validation/checkout";

/** Checkout rules from Settings → Checkout that both the form and the server enforce. */
export interface CheckoutRules {
  phoneRequired: boolean;
  addressLine2Enabled: boolean;
  companyFieldEnabled: boolean;
  requireTerms: boolean;
  termsUrl: string;
  minimumOrder: number;
  maxQuantityPerItem: number;
  allowedCountries: string[];
}

/** The base checkout schema tightened by the store's rules. Used by the form resolver and the server. */
export function buildCheckoutSchema(rules: Pick<CheckoutRules, "phoneRequired" | "requireTerms" | "allowedCountries">) {
  return checkoutFormSchema.superRefine((values, context) => {
    if (rules.phoneRequired && !values.shippingAddress.phone) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingAddress", "phone"], message: "Enter a delivery phone number" });
    }
    if (!rules.allowedCountries.includes(values.shippingAddress.country)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingAddress", "country"], message: "We don’t ship to this country yet" });
    }
    if (rules.requireTerms && values.acceptTerms !== true) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["acceptTerms"], message: "Agree to the terms to continue" });
    }
  });
}
