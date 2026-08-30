// Orchestrates one payment attempt, end to end.
//
// Shared by the checkout page (first attempt) and the order page (retry), so
// both paths behave identically — including how failure and cancellation are
// reported back to the server.

import { api, AccountApiError } from "@/lib/api";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type PaymentOutcome,
} from "@/lib/razorpay-client";

type CreateResponse = {
  keyId: string;
  testMode: boolean;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  customer: { name: string; email: string; contact: string };
};

type VerifyResponse = {
  status: "Paid" | "Failed" | "Cancelled" | "Pending";
  alreadyPaid?: boolean;
  pendingVerification?: boolean;
};

export type PaymentResult =
  | { status: "Paid"; orderId: string }
  | { status: "Pending"; orderId: string; message: string }
  | { status: "Failed"; orderId: string; message: string }
  | { status: "Cancelled"; orderId: string }
  | { status: "Unavailable"; orderId: string; message: string };

/**
 * Runs the whole flow for one order: create a Razorpay order, open Checkout,
 * then report the outcome to the server for verification.
 *
 * Whatever the customer's browser experienced, the returned status is the
 * SERVER's verdict — the browser only forwards evidence.
 */
export async function payForOrder(orderId: string): Promise<PaymentResult> {
  /* --------------------------------------------- 1. server-side setup -- */
  let created: CreateResponse;
  try {
    created = await api<CreateResponse>("/api/payment/create", {
      method: "POST",
      body: { orderId },
    });
  } catch (error) {
    const message =
      error instanceof AccountApiError ? error.message : "Could not start the payment.";
    // A 503 here means Razorpay is not configured yet — a setup problem, not a
    // payment failure, so the order is left untouched.
    return { status: "Unavailable", orderId, message };
  }

  /* -------------------------------------------------- 2. open Checkout -- */
  const scriptReady = await loadRazorpayScript();
  if (!scriptReady) {
    return {
      status: "Unavailable",
      orderId,
      message:
        "We could not load the secure payment window. Please check your connection and try again.",
    };
  }

  const outcome: PaymentOutcome = await openRazorpayCheckout({
    keyId: created.keyId,
    razorpayOrderId: created.razorpayOrderId,
    amount: created.amount,
    currency: created.currency,
    orderId: created.orderId,
    customer: created.customer,
  });

  if (outcome.kind === "unavailable") {
    return { status: "Unavailable", orderId, message: "The payment window could not open." };
  }

  /* ------------------------------------- 3. tell the server what happened -- */
  // Every branch reports back, including cancellation, so an abandoned payment
  // never sits as "Pending" forever.
  const body =
    outcome.kind === "success"
      ? {
          orderId,
          razorpayOrderId: outcome.response.razorpay_order_id,
          razorpayPaymentId: outcome.response.razorpay_payment_id,
          signature: outcome.response.razorpay_signature,
        }
      : outcome.kind === "cancelled"
        ? { orderId, cancelled: true }
        : { orderId, failureReason: outcome.reason };

  try {
    const verified = await api<VerifyResponse>("/api/payment/verify", { method: "POST", body });

    if (verified.status === "Paid") return { status: "Paid", orderId };

    if (verified.status === "Pending") {
      return {
        status: "Pending",
        orderId,
        message: verified.pendingVerification
          ? "Your payment is being confirmed. This page will update once your bank confirms it — you do not need to pay again."
          : "Your payment is still being processed.",
      };
    }

    if (verified.status === "Cancelled") return { status: "Cancelled", orderId };

    return {
      status: "Failed",
      orderId,
      message: outcome.kind === "failed" ? outcome.reason : "Your payment could not be completed.",
    };
  } catch (error) {
    // The payment may well have succeeded — we just could not confirm it here.
    // Never report failure in that case; the webhook is the safety net.
    console.error("[ras/payment] verification call failed", error);
    return {
      status: "Pending",
      orderId,
      message:
        "We could not confirm your payment just now. If money has left your account, your order will update shortly — please do not pay again.",
    };
  }
}
