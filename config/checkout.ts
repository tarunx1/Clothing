import type { CheckoutFormValues } from "@/types/checkout";

export interface CountryOption {
  code: string;
  name: string;
  regionLabel: string;
  postalLabel: string;
  regions: readonly string[];
}

export interface DeliveryMethod {
  id: string;
  label: string;
  estimate: string;
  price: number;
}

export const countries: readonly CountryOption[] = [
  {
    code: "IN",
    name: "India",
    regionLabel: "State",
    postalLabel: "PIN code",
    regions: ["Delhi", "Gujarat", "Haryana", "Karnataka", "Maharashtra", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal"],
  },
  {
    code: "CA",
    name: "Canada",
    regionLabel: "Province",
    postalLabel: "Postal code",
    regions: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"],
  },
  {
    code: "US",
    name: "United States",
    regionLabel: "State",
    postalLabel: "ZIP code",
    regions: ["California", "Florida", "Illinois", "Massachusetts", "New Jersey", "New York", "Texas", "Virginia", "Washington"],
  },
] as const;

export const deliveryMethods: readonly DeliveryMethod[] = [
  { id: "standard", label: "Standard", estimate: "3–7 business days", price: 0 },
  { id: "express", label: "Express", estimate: "1–3 business days", price: 450 },
] as const;

export const checkoutConfig = {
  storageKey: "clothin.checkout.v1",
  defaultCountry: "IN",
  editBagHref: "/cart",
  returnHref: "/shop",
  defaultValues: {
    contact: { email: "", phone: "" },
    shippingAddress: {
      firstName: "",
      lastName: "",
      address1: "",
      address2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "IN",
      phone: "",
      company: "",
    },
    deliveryMethodId: "standard",
    acceptTerms: false,
  } satisfies CheckoutFormValues,
  copy: {
    secure: "Secure checkout",
    title: "Checkout",
    contact: "Contact",
    shipping: "Shipping address",
    delivery: "Delivery method",
    payment: "Payment",
    paymentNote: "Payment opens in a secure window from our payment partner. Card and UPI details never touch our servers, and your total is confirmed before you pay.",
    submit: "Continue to payment",
    retry: "Try payment again",
    reviewBag: "Review bag",
    paymentPhases: {
      preparing: "Preparing payment…",
      open: "Complete payment in the secure window",
      verifying: "Verifying payment…",
      redirecting: "Payment confirmed",
    },
    paymentErrors: {
      unavailable: { title: "Payment could not be completed", body: "No order was placed. Try again in a moment." },
      verification: { title: "Payment verification failed", body: "We could not confirm this payment, so no order was placed. If you were charged, the amount is returned automatically." },
      stock: { title: "Item no longer available", body: "Something in your bag sold out during checkout. Nothing was charged." },
      session: { title: "Session expired", body: "Your checkout session ended. Refresh the page to continue." },
      incomplete: { title: "Payment was not completed. Try again", body: "Your bag is saved and nothing was charged." },
      rate: { title: "Payment could not be completed", body: "Too many attempts. Wait a few minutes, then try again." },
      invalid: { title: "Check your details", body: "Some checkout details need attention before payment." },
    },
    summary: "Order summary",
    editBag: "Edit bag",
    subtotal: "Subtotal",
    shippingCost: "Shipping",
    total: "Total",
    empty: "Your bag is empty.",
    returnToShop: "Return to shop",
  },
} as const;

export const getCountry = (code: string) => countries.find((country) => country.code === code) ?? countries[0];
export const getDeliveryMethod = (id: string) => deliveryMethods.find((method) => method.id === id) ?? deliveryMethods[0];
