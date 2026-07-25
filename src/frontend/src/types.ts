import type { BusinessProfileUpdate, RestaurantId } from "./backend.d";
// Re-export all backend types with friendly aliases
export type {
  MenuCategory,
  MenuItem,
  OrderItem,
  OrderPublic,
  StaffMember,
  Table,
  RestaurantId,
  MenuCategoryId,
  MenuItemId,
  TableId,
  OrderId,
  Timestamp,
  Option,
  Some,
  None,
} from "./backend.d";

// Re-export analytics types from backend.d.ts (single source of truth)
export type {
  AnalyticsEntry,
  WeeklyAnalyticsEntry,
} from "./backend.d";

export interface DeveloperProfile {
  developerPrincipalId: import("@icp-sdk/core/principal").Principal;
  businessOwnerPrincipalId?: import("@icp-sdk/core/principal").Principal;
  email: string;
}

export type ReservationId = bigint;

export interface ReservationPublic {
  id: ReservationId;
  restaurantId: RestaurantId;
  customerName: string;
  customerPhone: string;
  partySize: bigint;
  date: string;
  timeSlot: string;
  status: ReservationStatus;
  durationMinutes: bigint;
  notes?: string;
}

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
// Frontend-only enums for types not present in backend
export enum ReservationStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Arrived = "Arrived",
  Cancelled = "Cancelled",
}

export {
  OrderStatus,
  StaffRole,
  PaymentStatus,
} from "./backend.d";
export enum PaymentMethod {
  CreditCard = "CreditCard",
  CustomerOnline = "CustomerOnline",
  CashierTerminal = "CashierTerminal",
  BankTransfer = "BankTransfer",
  ApplePay = "ApplePay",
}

// Re-export RestaurantPublic and BusinessProfileUpdate directly from backend.d
export type {
  RestaurantPublic,
  BankDetails,
  BusinessProfileUpdate,
} from "./backend.d";

// Alias for payload convenience — same type, exposed under a shorter name
export type { BusinessProfileUpdate as BusinessProfilePayload };

// Frontend-only types
// Brand name extensions (synced with backend after bindgen)
export interface BrandNames {
  brand1Name?: string;
  brand2Name?: string;
  brand3Name?: string;
  brand4Name?: string;
  brand5Name?: string;
}

export interface CartItem {
  menuItemId: bigint;
  name: string;
  price: bigint;
  quantity: number;
  itemNote?: string;
  unit?: string;
}

export interface OrderFormData {
  restaurantId: bigint;
  tableIdentifier: string;
  items: CartItem[];
  notes?: string;
}

export interface RestaurantParams {
  restaurantId: string;
}

export interface OrderParams {
  restaurantId: string;
  tableId?: string;
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

// ─── Tingee get-banks (http-outcalls) ─────────────────────────────────────────
//
// Re-exported here (in addition to `./types/index.ts`) because the path alias
// `@/types` resolves to THIS file (`src/types.ts`) under
// `moduleResolution: "bundler"` — the file takes precedence over the
// `src/types/` directory. Without this re-export, `import { TingeeBank } from
// "@/types"` fails with TS2305 even though `src/types/index.ts` exports it.
// Mirrors the backend Candid `TingeeBank` shape (bankBin, bankCode, bankName,
// bankLogo, shortName).
export interface TingeeBank {
  bankBin: string;
  bankCode: string;
  bankName: string;
  bankLogo: string;
  shortName: string;
}
