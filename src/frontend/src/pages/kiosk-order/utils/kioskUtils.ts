// Normalize payment/order status enum from backend.
// Backend Motoko returns variants as {Paid: null}, {Preparing: null}, {Ready: null}
// but JS binding may also serialize them as plain strings.
// After migrating to useGetOrderForTracking, the kiosk receives an
// OrderTrackingPublic object whose `paymentStatus` field is a normalized
// string ("Paid", "TingeePaid", "SepayPaid", ...) and whose `orderStatus`
// field is a normalized string ("Preparing", "Ready", ...).
const PAID_OR_COMPLETE_VALUES = new Set([
  "Paid",
  "TingeePaid",
  "SepayPaid",
  "Preparing",
  "Ready",
]);

export function isPaidOrComplete(data: unknown): boolean {
  if (!data) return false;
  if (typeof data === "string") {
    return PAID_OR_COMPLETE_VALUES.has(data);
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    // Legacy variant-object shape: {Paid: null}, {Preparing: null}, ...
    for (const key of PAID_OR_COMPLETE_VALUES) {
      if (key in obj) return true;
    }
    // OrderTrackingPublic shape: read normalized string fields.
    const paymentStatus = (obj as { paymentStatus?: unknown }).paymentStatus;
    if (
      typeof paymentStatus === "string" &&
      PAID_OR_COMPLETE_VALUES.has(paymentStatus)
    ) {
      return true;
    }
    const orderStatus = (obj as { orderStatus?: unknown }).orderStatus;
    if (
      typeof orderStatus === "string" &&
      PAID_OR_COMPLETE_VALUES.has(orderStatus)
    ) {
      return true;
    }
    // Legacy tuple shape: recurse into `status` if present.
    const inner = (obj as { status?: unknown }).status;
    if (inner !== undefined) return isPaidOrComplete(inner);
  }
  return false;
}

export function getKioskRestaurantId(): bigint | null {
  const raw = localStorage.getItem(`deviceRestaurantId_${ROLE}`);
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export const ROLE = "kioskorder";
