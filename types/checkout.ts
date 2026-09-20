export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  company?: string;
}

export interface CheckoutContact {
  email: string;
  phone: string;
}

export interface CheckoutFormValues {
  contact: CheckoutContact;
  shippingAddress: ShippingAddress;
  deliveryMethodId: string;
  acceptTerms?: boolean;
}
