import { createActor } from "@/backend";
import { DynamicQRPanel } from "@/components/DynamicQRPanel";
import {
  type TingeeConfig,
  formatPrice,
  useCreatePaymentIntent,
  useGetBusinessProfileInfo,
  useGetOrderForTracking,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import type { RestaurantPublic } from "@/types";
import { PaymentMethod, PaymentStatus } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── QR provider selection ──────────────────────────────────────────────────

export type QrProvider = "tingee" | "none";

// ─── Business Bank Details type (mirrors hook type) ───────────────────────────
export interface BusinessBankDetailsForQR {
  accountNumber: string;
  bankName: string;
  accountHolderName: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PayStep = "loading" | "qr" | "success";

export interface PaymentMethodSelectorProps {
  orderId?: bigint;
  /** Order code (e.g. BBH000001) — used as QR transfer content when available */
  orderCode?: string;
  restaurant: RestaurantPublic;
  orderItems: Array<{ name: string; quantity: bigint; price: bigint }>;
  totalAmount?: bigint;
  onSuccess: () => void;
  onCancel?: () => void;
  /** @deprecated kept for backward compat, no longer used */
  showCashOption?: boolean;
  /**
   * When provided along with `onCreateOrder`, the QR is shown immediately
   * using these bank details WITHOUT creating an order first.
   */
  businessBankDetails?: BusinessBankDetailsForQR;
  /**
   * Called when the customer confirms they've transferred. Returns the new
   * orderId so we can finalize the payment intent.
   */
  onCreateOrder?: () => Promise<bigint>;
  /** Tingee config — when present, Tingee QR is available as a provider */
  tingeeConfig?: TingeeConfig | null;
  /** Which QR provider to render. Defaults to "none". */
  qrProvider?: QrProvider;
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function PaymentSuccessScreen({
  orderItems,
  total,
}: {
  orderItems: Array<{ name: string; quantity: bigint; price: bigint }>;
  total: bigint;
}) {
  const { language } = useLanguage();
  return (
    <div
      data-ocid="order.payment.success_state"
      className="flex flex-col items-center gap-5 w-full py-4"
    >
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-2xl italic text-foreground mb-1">
          {language === "vi" ? "Thanh toán thành công!" : "Payment Successful!"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === "vi"
            ? "Đơn hàng của bạn đã được thanh toán."
            : "Your order payment has been confirmed."}
        </p>
      </div>
      {/* Order summary */}
      <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {language === "vi" ? "Chi tiết đơn hàng" : "Order Summary"}
          </p>
        </div>
        <div className="divide-y divide-border">
          {orderItems.map((item) => (
            <div
              key={`payment-success-item-${item.name}`}
              className="flex justify-between items-center px-4 py-2.5"
            >
              <span className="text-sm text-foreground">
                {item.name}
                {item.quantity > 1n && (
                  <span className="text-muted-foreground ml-1">
                    ×{item.quantity.toString()}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground">
            {language === "vi" ? "Tổng cộng" : "Total"}
          </span>
          <span className="font-bold text-primary text-lg">
            {formatPrice(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Pre-Order Dynamic QR Panel (no orderId yet) ─────────────────────────────

/**
 * Pre-order wrapper for {@link DynamicQRPanel}.
 *
 * Mirrors the order-creation flow (call `onCreateOrder`, wait for the orderId,
 * surface loading/error/retry states) but renders {@link DynamicQRPanel} once
 * the orderId is available. Used when a Tingee Virtual Account (VA) is
 * configured — the dynamic QR is generated server-side via the backend's
 * http-outcalls path and polled for payment status.
 */
function PreOrderDynamicQRPanel({
  orderItems,
  totalAmount,
  onCreateOrder,
  onSuccess,
  onCancel,
}: {
  orderItems: Array<{ name: string; quantity: bigint; price: bigint }>;
  totalAmount: bigint;
  onCreateOrder?: () => Promise<bigint>;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const { language } = useLanguage();
  const { actor } = useActor(createActor);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  // orderId state — null = still creating, bigint = ready, "error" = failed
  const [createdOrderId, setCreatedOrderId] = useState<bigint | null | "error">(
    null,
  );
  const [retryCount, setRetryCount] = useState(0);
  const calledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount drives retry logic
  useEffect(() => {
    if (!onCreateOrder) {
      return;
    }
    if (calledRef.current) return;
    calledRef.current = true;
    setCreatedOrderId(null);

    // 15 second timeout
    timeoutRef.current = setTimeout(() => {
      setCreatedOrderId("error");
    }, 15000);

    onCreateOrder()
      .then((id) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCreatedOrderId(id);
      })
      .catch(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCreatedOrderId("error");
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [retryCount]);

  function handleRetry() {
    calledRef.current = false;
    setCreatedOrderId(null);
    setRetryCount((c) => c + 1);
  }

  // Pass null when order hasn't been created yet so polling doesn't fire with 0n
  const resolvedOrderId =
    createdOrderId != null && typeof createdOrderId !== "string"
      ? createdOrderId
      : null;
  const { data: preOrderStatusData } = useGetOrderForTracking(
    resolvedOrderId ?? undefined,
    5000,
  );
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const paidFiredRef = useRef(false);
  useEffect(() => {
    if (
      resolvedOrderId !== null &&
      (preOrderStatusData?.paymentStatus === PaymentStatus.Paid ||
        preOrderStatusData?.paymentStatus === PaymentStatus.TingeePaid) &&
      !paidFiredRef.current
    ) {
      paidFiredRef.current = true;
      setSuccess(true);
      onSuccessRef.current();
    }
  }, [resolvedOrderId, preOrderStatusData?.paymentStatus]);

  if (success) {
    return <PaymentSuccessScreen orderItems={orderItems} total={totalAmount} />;
  }

  // Still waiting for orderId
  if (createdOrderId === null) {
    return (
      <div
        data-ocid="order.payment.loading_state"
        className="flex flex-col items-center gap-4 py-8 w-full"
      >
        <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Đang tạo đơn hàng..." : "Creating order..."}
        </p>
      </div>
    );
  }

  // Order creation failed
  if (createdOrderId === "error") {
    return (
      <div
        data-ocid="order.payment.error_state"
        className="flex flex-col items-center gap-4 py-8 w-full text-center"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <p className="text-sm text-destructive font-medium">
          {language === "vi"
            ? "Không thể tạo đơn hàng. Vui lòng thử lại."
            : "Could not create order. Please try again."}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          data-ocid="order.payment.retry_button"
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {language === "vi" ? "Thử lại" : "Retry"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-ocid="order.payment.cancel_button"
            className="text-sm text-red-500 underline cursor-pointer"
          >
            {language === "vi"
              ? "Hủy & Đặt đơn mới"
              : "Cancel & Place New Order"}
          </button>
        )}
      </div>
    );
  }

  // Order created — render the dynamic QR panel with the real orderId.
  // The dynamic panel handles its own cancel (which deletes the QR on the
  // backend); we also cancel the order itself (best effort) when the user
  // confirms.
  return (
    <>
      <DynamicQRPanel
        orderId={createdOrderId}
        onPaid={onSuccess}
        onCancel={() => setShowCancelConfirm(true)}
      />

      {/* Cancel confirmation overlay — cancels the order on the backend */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-4">
          <div
            data-ocid="order.payment.cancel_confirm.dialog"
            className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full shadow-xl flex flex-col gap-4 text-center"
          >
            <p className="text-sm text-foreground font-medium">
              {language === "vi"
                ? "Bạn có chắc muốn đặt đơn mới không? Đơn hiện tại sẽ không được tạo."
                : "Are you sure you want to start a new order? No order will be created."}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  setShowCancelConfirm(false);
                  if (actor) {
                    try {
                      await actor.cancelOrder(createdOrderId);
                    } catch (err) {
                      console.warn(
                        "[PreOrderDynamicQRPanel] cancelOrder failed (best effort):",
                        err,
                      );
                    }
                  }
                  onCancel?.();
                }}
                data-ocid="order.payment.cancel_confirm.confirm_button"
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                {language === "vi" ? "Xác nhận hủy" : "Confirm Cancel"}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                data-ocid="order.payment.cancel_confirm.cancel_button"
                className="flex-1 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 transition-colors"
              >
                {language === "vi" ? "Tiếp tục chờ" : "Keep Waiting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Notice: VA missing ──────────────────────────────────────────────────────

/**
 * Rendered when the customer selected Tingee (`qrProvider === "tingee"`) and a
 * Tingee config is present, but no Tingee Virtual Account (VA) has been entered
 * in the business profile. The dynamic QR path requires a VA, so we surface a
 * Vietnamese notice instead of falling back to a static QR.
 */
function VaMissingNotice() {
  return (
    <div
      data-ocid="order.payment.tingee.no_va_state"
      className="flex flex-col items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/30 text-destructive text-center"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <p className="text-sm font-medium">
        Cần nhập Virtual Account (VA) trong BusinessProfile để thanh toán QR
        Tingee.
      </p>
    </div>
  );
}

// ─── Notice: Tingee not selected ──────────────────────────────────────────────

/**
 * Rendered when `qrProvider === "none"` — no QR provider is selected. We
 * surface a Vietnamese notice asking the customer to choose Tingee rather than
 * rendering any static QR.
 */
function NoProviderNotice() {
  return (
    <div
      data-ocid="order.payment.no_provider_state"
      className="flex flex-col items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/30 text-destructive text-center"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <p className="text-sm font-medium">
        Vui lòng chọn Tingee để thanh toán QR.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentMethodSelector({
  orderId,
  restaurant,
  orderItems,
  totalAmount: totalAmountProp,
  onSuccess,
  onCancel,
  businessBankDetails,
  onCreateOrder,
  tingeeConfig,
  qrProvider = "none",
}: PaymentMethodSelectorProps) {
  const { language } = useLanguage();
  const createIntent = useCreatePaymentIntent();
  const [payStep, setPayStep] = useState<PayStep>("loading");
  const [totalAmount, setTotalAmount] = useState<bigint>(totalAmountProp ?? 0n);
  const calledRef = useRef(false);

  // Business profile info — used to detect whether a Tingee Virtual Account
  // (VA) is configured. When a VA is present, the customer-facing payment flow
  // renders the dynamic QR panel (DynamicQRPanel). The VA is entered manually
  // by the owner in the business profile settings and stored at the
  // business-profile level.
  const businessProfileInfo = useGetBusinessProfileInfo();
  const hasVA = !!businessProfileInfo.data?.tingeeVA?.trim();

  // ── QR provider routing ────────────────────────────────────────────────────
  // When qrProvider === "tingee" AND tingeeConfig is non-null, the Tingee
  // dynamic QR path is active (requires a VA). When qrProvider === "tingee"
  // but tingeeConfig is null, surface a Vietnamese error state — do NOT fall
  // back to any static QR. When qrProvider === "none", surface a notice asking
  // the customer to choose Tingee.
  const useTingee = qrProvider === "tingee" && tingeeConfig != null;
  const tingeeMissingConfig = qrProvider === "tingee" && tingeeConfig == null;

  // ── Pre-order mode: businessBankDetails provided (preferred path) ───────────
  // This covers both dine-in (orderId provided) and delivery (onCreateOrder provided).
  // Always prefer businessBankDetails when available — it is the single source of truth.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    // Only run intent creation when businessBankDetails is NOT available
    if (businessBankDetails) return;
    if (!orderId) return;
    if (calledRef.current) return;
    calledRef.current = true;
    createIntent
      .mutateAsync({
        orderId,
        method: PaymentMethod.BankTransfer,
        restaurantId: restaurant.id,
      })
      .then((result) => {
        setTotalAmount(result.totalAmount);
        setPayStep("qr");
      })
      .catch(() => {
        setPayStep("qr");
      });
  }, []);

  // ── Tingee selected but not configured — surface Vietnamese error ─────────
  // Rendered AFTER all hooks so the Rules of Hooks are preserved.
  if (tingeeMissingConfig) {
    return (
      <div
        data-ocid="order.payment.tingee.no_config_state"
        className="flex flex-col items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/30 text-destructive text-center"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <p className="text-sm font-medium">
          QR Tingee chưa sẵn sàng. Vui lòng liên hệ nhà hàng hoặc thử lại sau.
        </p>
      </div>
    );
  }

  // ── No QR provider selected — surface Vietnamese notice ────────────────────
  if (!useTingee) {
    return <NoProviderNotice />;
  }

  // ── Tingee selected but no VA configured — surface Vietnamese notice ───────
  if (!hasVA) {
    return <VaMissingNotice />;
  }

  // ── Use businessBankDetails when present (covers dine-in + delivery) ──────
  if (businessBankDetails) {
    // Use snapshotted totalAmountProp when available and > 0.
    // Treat 0n the same as undefined — fall back to recalculating from items.
    // This guards against the race condition where the prop is passed as 0n
    // because state hasn't settled yet.
    const recalcTotal = orderItems.reduce(
      (s, i) => s + i.price * i.quantity,
      0n,
    );
    const preOrderTotal =
      totalAmountProp !== undefined && totalAmountProp > 0n
        ? totalAmountProp
        : recalcTotal;
    if (preOrderTotal === 0n) {
      console.error(
        "[PaymentMethodSelector] preOrderTotal is 0n — totalAmountProp:",
        totalAmountProp,
        "recalcTotal:",
        recalcTotal,
      );
    }

    // ── Routing: orderId already known → skip PreOrder panels ──────────────
    // When both businessBankDetails AND orderId are provided (e.g. dine-in
    // OrderConfirmation path), render the dynamic QR panel directly with the
    // real orderId so we never attempt to call onCreateOrder (which would be
    // undefined in that flow).
    if (orderId != null) {
      return (
        <DynamicQRPanel
          orderId={orderId}
          onPaid={onSuccess}
          onCancel={onCancel}
        />
      );
    }

    // ── orderId not yet known → use PreOrder panel to create it ─────────────
    // The dynamic QR backend path requires an orderId, so we use the
    // PreOrderDynamicQRPanel's order-creation flow and render DynamicQRPanel
    // once the orderId is known.
    return (
      <PreOrderDynamicQRPanel
        orderItems={orderItems}
        totalAmount={preOrderTotal}
        onCreateOrder={onCreateOrder}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );
  }

  // ── businessBankDetails not yet loaded — show spinner ─────────────────────
  if (!businessBankDetails && !orderId) {
    return (
      <div
        data-ocid="order.payment.loading_state"
        className="flex flex-col items-center gap-4 py-8 w-full"
      >
        <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {language === "vi"
            ? "Đang tải thông tin thanh toán..."
            : "Loading payment info..."}
        </p>
      </div>
    );
  }

  function handlePaid() {
    setPayStep("success");
    onSuccess();
  }

  if (payStep === "success") {
    return <PaymentSuccessScreen orderItems={orderItems} total={totalAmount} />;
  }

  if (payStep === "loading") {
    return (
      <div
        data-ocid="order.payment.loading_state"
        className="flex flex-col items-center gap-4 py-8 w-full"
      >
        <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {language === "vi" ? "Đang tạo mã QR..." : "Generating QR code..."}
        </p>
      </div>
    );
  }

  // ── orderId known, businessBankDetails absent (intent-based path) ──────────
  // The dynamic QR panel only needs the orderId; bankDetails is no longer
  // required for rendering. We still call createIntent above to keep the
  // orderId/payment-intent logic intact, but the rendered output is the
  // dynamic QR panel once the intent resolves.
  if (orderId != null) {
    return (
      <DynamicQRPanel
        orderId={orderId}
        onPaid={handlePaid}
        onCancel={onCancel}
      />
    );
  }

  // Bank not configured fallback
  return (
    <div
      data-ocid="order.payment.bank_transfer.no_config_state"
      className="flex flex-col items-center gap-3 py-6 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
        🏦
      </div>
      <p className="text-sm text-muted-foreground">
        {language === "vi"
          ? "Vui lòng cấu hình thông tin ngân hàng trong hồ sơ doanh nghiệp."
          : "Please configure bank account information in the business profile."}
      </p>
    </div>
  );
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
// DynamicQRPanel is re-exported so consumers that previously imported it from
// this module continue to compile. The canonical implementation lives in
// `@/components/DynamicQRPanel`.
export { DynamicQRPanel } from "@/components/DynamicQRPanel";
