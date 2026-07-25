// Local-only store of orders placed on THIS device. Used to gate the in-page
// order tracking progress bar so it only shows orders actually placed on the
// current device. Nothing here is sent to the backend.

import { getDeviceFingerprint } from "./deviceFingerprint";

const STORAGE_KEY = "placedOrders";

interface StoredPlacedOrder {
  orderId: string;
  fingerprint: string;
}

function readStore(): StoredPlacedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StoredPlacedOrder =>
        e != null &&
        typeof e === "object" &&
        typeof (e as StoredPlacedOrder).orderId === "string" &&
        typeof (e as StoredPlacedOrder).fingerprint === "string",
    );
  } catch {
    return [];
  }
}

function writeStore(entries: StoredPlacedOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / privacy mode errors
  }
}

/**
 * Append { orderId, fingerprint } to localStorage, deduped by orderId.
 * Stores orderId as string (bigint is not JSON-serializable).
 */
export function savePlacedOrder(orderId: bigint): void {
  if (typeof window === "undefined") return;
  try {
    const idStr = orderId.toString();
    const fingerprint = getDeviceFingerprint();
    const entries = readStore();
    const withoutDup = entries.filter((e) => e.orderId !== idStr);
    withoutDup.push({ orderId: idStr, fingerprint });
    writeStore(withoutDup);
  } catch {
    // ignore
  }
}

/**
 * Returns true iff the given orderId is stored AND its stored fingerprint
 * matches the current device fingerprint.
 */
export function isPlacedOnThisDevice(orderId: bigint): boolean {
  if (typeof window === "undefined") return false;
  try {
    const idStr = orderId.toString();
    const fingerprint = getDeviceFingerprint();
    const entries = readStore();
    return entries.some(
      (e) => e.orderId === idStr && e.fingerprint === fingerprint,
    );
  } catch {
    return false;
  }
}

/** Removes the placedOrders key from localStorage. */
export function clearPlacedOrders(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
