// Shapes shared between the API routes and the account UI.
//
// NOTE: `StoredUser` (with its passwordHash) never leaves the server.
// `PublicCustomer` is the only user shape ever serialised to the client.

export type StoredUser = {
  id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
};

export type Address = {
  id: string;
  fullName: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
};

/**
 * The fulfilment ladder, in order. Index position is what drives the customer's
 * tracking timeline, so never reorder these without a migration.
 */
export const ORDER_STATUSES = [
  "Order Placed",
  "Payment Confirmed",
  "Processing",
  "Quality Check",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;

/**
 * Terminal states that sit OUTSIDE the ladder — an order in one of these is no
 * longer progressing, so the timeline shows it as ended rather than advancing.
 */
export const TERMINAL_STATUSES = ["Cancelled", "Returned"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | (typeof TERMINAL_STATUSES)[number];

/** True while an order is still moving along the fulfilment ladder. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Cancelled" | "Refunded";

/**
 * Payment lives alongside the order but is tracked SEPARATELY from it: an order
 * can be "Order Placed" with payment Failed, and a retry must not create a
 * second order.
 */
export type PaymentRecord = {
  provider: "razorpay";
  /** Razorpay order id (order_xxx). */
  razorpayOrderId?: string;
  /** Razorpay payment id (pay_xxx), present once a payment is attempted. */
  razorpayPaymentId?: string;
  /** Amount in paise, as sent to Razorpay. Derived server-side from the order. */
  amountPaise: number;
  method?: string;
  failureReason?: string;
  attempts: number;
  createdAt: string;
  paidAt?: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  /** SKU. */
  code: string;
  image: string;
  qty: number;
  /** Unit price AT THE TIME OF ORDER, captured server-side. */
  price: number;
  /** Recorded on the order so it stays accurate even if the product changes. */
  purity?: string;
  weightGrams?: number;
};

export type TrackingEvent = {
  status: OrderStatus;
  at: string;
  note?: string;
  /** "courier" when the event came from the shipping provider, else internal. */
  source?: "internal" | "courier";
};

/**
 * What the shipping provider has told us. Every field is optional because a
 * shipment goes through stages: created (shipmentId) -> AWB assigned (awb,
 * courier) -> picked up (shippedAt) -> delivered.
 *
 * Nothing here is ever invented. If the provider has not given us an AWB, the
 * customer is told the order is being prepared — not shown a fake number.
 */
export type Shipment = {
  provider: "shiprocket";
  /** Provider's own order id. */
  providerOrderId?: string;
  shipmentId?: string;
  /** Air Waybill — the courier tracking number. */
  awb?: string;
  courier?: string;
  /** Provider-hosted tracking page, when one is available. */
  trackingUrl?: string;
  labelUrl?: string;
  manifestUrl?: string;
  shippedAt?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  /** Last raw status string from the provider, for support/debugging. */
  providerStatus?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type Order = {
  id: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  /** Present once an online payment has been started for this order. */
  payment?: PaymentRecord;
  /** Set once stock has been deducted, so it can never happen twice. */
  stockDeducted?: boolean;
  /** Populated when stock could not be deducted — needs showroom attention. */
  fulfilmentIssue?: string;
  items: OrderItem[];
  subtotal: number;
  gst: number;
  shipping: number;
  total: number;
  address: Address;
  /** Captured at checkout so the courier manifest does not need a user lookup. */
  customerEmail?: string;
  /**
   * Set once a shipment exists with the courier. Absent means "not dispatched
   * yet" — we show the internal timeline but make no tracking claims.
   */
  shipment?: Shipment;
  /** Internal fulfilment history. Always present; independent of the courier. */
  tracking?: {
    events: TrackingEvent[];
  };
};

export function toPublicCustomer(user: StoredUser): PublicCustomer {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    createdAt: user.createdAt,
  };
}
