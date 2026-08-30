// What happens the moment an order's payment is confirmed.
//
// Stock is deducted HERE and nowhere else. Specifically NOT when a customer
// adds something to a cart — an abandoned bag must never make a piece look sold.
//
// Safe to call more than once: the Razorpay browser callback and the Razorpay
// webhook both race to confirm the same payment, so this is guarded by a flag
// on the order itself.

import { deductStockForOrder } from "./product-service";
import { updateOrder } from "./repo";

/**
 * Deducts stock for a newly paid order, exactly once.
 *
 * Returns the SKUs that could not be deducted. A failure here does NOT undo the
 * payment — the money is real. It flags the order for the showroom instead,
 * which is the correct trade: never silently oversell, never silently refund.
 */
export async function onOrderPaid(
  userId: string,
  orderId: string,
): Promise<{ alreadyDone: boolean; failed: { sku: string; reason: string }[] }> {
  // Claim the work and observe the PREVIOUS value in one read-modify-write, so
  // a concurrent webhook + callback pair cannot both deduct.
  let alreadyDone = false;
  let items: { code: string; qty: number }[] = [];

  const claimed = await updateOrder(userId, orderId, (current) => {
    alreadyDone = current.stockDeducted === true;
    items = current.items.map((item) => ({ code: item.code, qty: item.qty }));
    return alreadyDone ? current : { ...current, stockDeducted: true };
  });

  if (!claimed) return { alreadyDone: true, failed: [] };
  if (alreadyDone) return { alreadyDone: true, failed: [] };

  const { failed } = await deductStockForOrder(orderId, items);

  if (failed.length) {
    await updateOrder(userId, orderId, (current) => ({
      ...current,
      fulfilmentIssue: failed
        .map((f) => `${f.sku}: ${f.reason}`)
        .join("; ")
        .slice(0, 400),
    }));
  }

  return { alreadyDone: false, failed };
}
