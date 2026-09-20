import { z } from "zod";
import { countries } from "@/config/checkout";

const optionalPhone = z.string().trim().refine(
  (value) => !value || /^[+()\d][+()\d .-]{5,24}$/.test(value),
  "Enter a valid phone number",
);

export const checkoutFormSchema = z.object({
  contact: z.object({
    email: z.string().trim().email("Enter a valid email address"),
    phone: optionalPhone,
  }),
  shippingAddress: z.object({
    firstName: z.string().trim().min(1, "Enter a first name").max(80),
    lastName: z.string().trim().min(1, "Enter a last name").max(80),
    address1: z.string().trim().min(3, "Enter a street address").max(160),
    address2: z.string().trim().max(120),
    city: z.string().trim().min(1, "Enter a city").max(100),
    region: z.string().trim().min(1, "Select a state or province").max(100),
    postalCode: z.string().trim().min(2, "Enter a postal code").max(12, "Enter a valid postal code"),
    country: z.string().refine((value) => countries.some((country) => country.code === value), "Select a country"),
    /** Required or optional per Settings → Checkout (see lib/checkout/rules.ts). */
    phone: optionalPhone,
    company: z.string().trim().max(120).optional().default(""),
  }),
  /** Delivery method code (lowercase); the server checks it against the enabled methods and zones. */
  deliveryMethodId: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,30}$/, "Select a delivery method"),
  acceptTerms: z.boolean().optional(),
});

export type CheckoutSchemaValues = z.infer<typeof checkoutFormSchema>;
