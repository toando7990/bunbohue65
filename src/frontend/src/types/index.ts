export type {
  AnalyticsEntry,
  DeveloperProfile,
  MenuCategoryId,
  MenuItem,
  MenuItemId,
  OrderItem,
  OrderPublic,
  ReservationId,
  ReservationPublic,
  RestaurantId,
  StaffRole,
  TableId,
  WeeklyAnalyticsEntry,
} from "@/backend";

export {
  OrderStatus,
  ReservationStatus,
} from "@/backend";

export interface BannerImagePublic {
  id: bigint;
  imageUrl: string;
  sortOrder: bigint;
}

export interface SavedRecipientInfo {
  recipientName: string;
  recipientPhone: string;
  locationName: string;
}

export interface OrderTrackingPublic {
  orderId: bigint;
  orderStatus: string;
  shippingStatus: string;
  shipperName?: string;
  shipperPhone?: string;
  driverInfo?: { lat: number; lng: number } | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  invoiceInfo?: unknown;
  paymentStatus?: string;
}

export interface PlaceDeliveryOrderResult {
  orderId: bigint;
  orderCode?: string;
}

// ─── Dynamic QR (Tingee http-outcalls) ────────────────────────────────────────

/**
 * Status of a dynamic QR payment, mirroring the backend Candid variant
 * `DynamicQRStatus` ({ pending; paid; expired; deleted }).
 */
export type DynamicQRStatus = "pending" | "paid" | "expired" | "deleted";

/**
 * Public shape of a dynamic QR record returned by `generateDynamicQR`.
 * Mirrors the backend Candid `DynamicQRRecordPublic`.
 * - `orderId` is the numeric order id (bigint) the QR was generated for.
 * - `qrString` is the QR payload string (typically a VietQR data URL or
 *   base64 image) the frontend renders.
 * - `expiresAt` is optional (null when the QR has no expiry set).
 */
export interface DynamicQRRecordPublic {
  qrId: string;
  qrString: string;
  status: DynamicQRStatus;
  billId: string;
  idempotencyKey: string;
  orderId: bigint;
  createdAt: bigint;
  expiresAt?: bigint | null;
}

/**
 * Result of `getDynamicQRStatus`, mirroring the backend Candid variant
 * `DynamicQRStatusResult`.
 * - `status` — the current QR payment status (pending/paid/expired/deleted).
 * - `totalAmountPaid` — present (as a bigint) only when Tingee reports a paid
 *   amount; `null` while pending or when Tingee omits the field. Used by the
 *   frontend get-status fallback path to confirm payment when the webhook
 *   hasn't fired yet.
 * - `transactionInfos` — raw reconciliation text from Tingee
 *   (`data.transactionInfos`). Used ONLY for đối soát / display, never as a
 *   payment confirmation signal.
 */
export interface DynamicQRStatusResult {
  status: DynamicQRStatus;
  totalAmountPaid?: bigint | null;
  transactionInfos?: string | null;
}

// ─── Tingee Banks (Tingee get-banks http-outcalls) ───────────────────────────

/**
 * A bank entry returned by the backend `getTingeeBanks()` http-outcall path
 * (Tingee get-banks). Mirrors the backend Candid `TingeeBank` type.
 *
 * - `bankBin` — the bank's BIN code (e.g. "970407" for OCB). Used as the
 *   value stored in `BusinessProfile.tingeeBankBin` when the user picks a
 *   bank for auto payment confirmation. The frontend NEVER auto-fills this
 *   — the user must explicitly choose a bank and press Lưu.
 * - `bankCode` — the bank's short code (e.g. "OCB").
 * - `bankName` — the bank's full display name (e.g. "Ngân hàng TMCP Phương Đông").
 * - `bankLogo` — URL to the bank's logo image (Tingee-hosted).
 * - `shortName` — the bank's short/brand name (e.g. "OCB").
 */
export interface TingeeBank {
  bankBin: string;
  bankCode: string;
  bankName: string;
  bankLogo: string;
  shortName: string;
}
