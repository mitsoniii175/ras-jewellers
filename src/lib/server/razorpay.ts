// Razorpay integration — server side only.
//
// CREDENTIALS
// -----------
//   RAZORPAY_KEY_ID         public-ish; the browser needs it to open Checkout
//   RAZORPAY_KEY_SECRET     SECRET. Never sent to the browser, never logged.
//   RAZORPAY_WEBHOOK_SECRET SECRET. Verifies webhooks really came from Razorpay.
//
// Set these in the Netlify UI (Site settings > Environment variables). Nothing
// here reads a hard-coded key, and there is no fallback value — if the vars are
// missing the payment endpoints refuse to run rather than pretending to work.
//
// Docs: https://razorpay.com/docs/api/orders/  and  /docs/webhooks/

import { timingSafeEqual } from "./crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
};

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** Returns null when Razorpay has not been configured yet. */
export function razorpayConfig(): RazorpayConfig | null {
  const keyId = env("RAZORPAY_KEY_ID");
  const keySecret = env("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: env("RAZORPAY_WEBHOOK_SECRET") };
}

/** True while the keys are Razorpay's test keys, so the UI can say so. */
export function isTestMode(config: RazorpayConfig): boolean {
  return config.keyId.startsWith("rzp_test_");
}

/* ------------------------------------------------------------ HMAC utils -- */

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies a Checkout callback.
 *
 * Razorpay signs `<razorpay_order_id>|<razorpay_payment_id>` with the key
 * secret. Because the secret never leaves our server, a browser cannot forge
 * this — which is exactly why a "success" claim from the browser is worthless
 * without it.
 */
export async function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): Promise<boolean> {
  const expected = await hmacSha256Hex(
    `${input.razorpayOrderId}|${input.razorpayPaymentId}`,
    input.keySecret,
  );
  return timingSafeEqual(expected, input.signature.toLowerCase());
}

/** Verifies a webhook. Razorpay signs the RAW request body. */
export async function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): Promise<boolean> {
  const expected = await hmacSha256Hex(input.rawBody, input.webhookSecret);
  return timingSafeEqual(expected, input.signature.toLowerCase());
}

/* -------------------------------------------------------------- REST API -- */

function authHeader(config: RazorpayConfig): string {
  // btoa is available in every runtime we target (Node 18+, Netlify Edge).
  return `Basic ${btoa(`${config.keyId}:${config.keySecret}`)}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
};

/**
 * Creates the Razorpay order. `amountPaise` is derived from OUR stored order —
 * never from anything the browser sent.
 */
export async function createRazorpayOrder(
  config: RazorpayConfig,
  input: { amountPaise: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { authorization: authHeader(config), "content-type": "application/json" },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      // Razorpay caps receipt at 40 characters.
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    // Never echo the raw Razorpay error to the customer — it can leak config.
    console.error("[ras/payment] Razorpay order creation failed", response.status, detail);
    throw new Error("Could not start the payment. Please try again.");
  }

  return (await response.json()) as RazorpayOrder;
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  method?: string;
  error_description?: string;
};

/**
 * Fetches the payment straight from Razorpay.
 *
 * The signature proves the callback was not forged; this proves the payment was
 * actually captured for the right amount. We do both before marking an order
 * paid — a valid signature on an uncaptured payment is still not money.
 */
export async function fetchRazorpayPayment(
  config: RazorpayConfig,
  paymentId: string,
): Promise<RazorpayPayment | null> {
  try {
    const response = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: authHeader(config) },
    });
    if (!response.ok) {
      console.error("[ras/payment] Razorpay payment fetch failed", response.status);
      return null;
    }
    return (await response.json()) as RazorpayPayment;
  } catch (error) {
    console.error("[ras/payment] Razorpay payment fetch threw", error);
    return null;
  }
}

/** Rupees -> paise, the integer unit Razorpay works in. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
