// Browser side of the Razorpay integration.
//
// This file deliberately knows nothing that matters. It receives a Razorpay
// order id and the PUBLIC key id from our server, opens Razorpay's hosted
// Checkout, and hands whatever comes back to /api/payment/verify. It never sees
// the key secret and its opinion about whether a payment succeeded is not
// trusted — the server decides that.

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (response: RazorpayFailure) => void) => void;
  close: () => void;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; escape?: boolean };
  handler: (response: RazorpaySuccess) => void;
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayFailure = {
  error?: {
    description?: string;
    reason?: string;
    step?: string;
    metadata?: { payment_id?: string; order_id?: string };
  };
};

let scriptPromise: Promise<boolean> | undefined;

/** Loads Checkout once, reusing the same promise for later attempts. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (!scriptPromise) {
    scriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => {
        // Let a later attempt retry rather than caching the failure forever.
        scriptPromise = undefined;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export type PaymentOutcome =
  | { kind: "success"; response: RazorpaySuccess }
  | { kind: "failed"; reason: string }
  | { kind: "cancelled" }
  | { kind: "unavailable" };

export type OpenCheckoutInput = {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  customer: { name: string; email: string; contact: string };
};

/**
 * Opens Razorpay Checkout and resolves once the customer is done with it.
 *
 * Resolves exactly once — dismissing the modal after a failure must not fire
 * both "failed" and "cancelled".
 */
export function openRazorpayCheckout(input: OpenCheckoutInput): Promise<PaymentOutcome> {
  return new Promise<PaymentOutcome>((resolve) => {
    if (!window.Razorpay) {
      resolve({ kind: "unavailable" });
      return;
    }

    let settled = false;
    const settle = (outcome: PaymentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const checkout = new window.Razorpay({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: "RAS Jewellers",
      description: `Order ${input.orderId}`,
      order_id: input.razorpayOrderId,
      prefill: {
        name: input.customer.name,
        email: input.customer.email,
        contact: `+91${input.customer.contact}`,
      },
      notes: { rasOrderId: input.orderId },
      // Matches the site's gold accent.
      theme: { color: "#b8935f" },
      modal: {
        ondismiss: () => settle({ kind: "cancelled" }),
      },
      handler: (response) => settle({ kind: "success", response }),
    });

    checkout.on("payment.failed", (response) => {
      settle({
        kind: "failed",
        reason: response.error?.description ?? "Your payment could not be completed.",
      });
    });

    checkout.open();
  });
}
