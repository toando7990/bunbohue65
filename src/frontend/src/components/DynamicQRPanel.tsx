import {
  type DynamicQRRecordPublic,
  type DynamicQRStatus,
  useConfirmPaymentByTingeeStatus,
  useDeleteDynamicQR,
  useGenerateDynamicQR,
  useGetDynamicQRStatus,
  useMarkTingeeExpired,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

/** QR lifetime in minutes — matches the backend's `expireInMinute = 15`. */
const QR_EXPIRE_MINUTES = 15;

/**
 * Props for {@link DynamicQRPanel}.
 *
 * Mirrors the existing {@link TingeeQRPanel} props shape so the two panels
 * can be swapped in {@link PaymentMethodSelector} with the same callback
 * semantics:
 * - `orderId` — the order id the dynamic QR is generated for (passed as a
 *   string to the backend, which accepts Text).
 * - `onPaid` — fired once when the polled status transitions to `paid`.
 * - `onCancel` — fired after the user cancels (the QR is deleted on the
 *   backend and the QR display is cleared).
 * - `variant` — `'default'` (online checkout, smaller QR + amount + cancel
 *   button) or `'kiosk'` (large QR, no amount, no internal cancel button —
 *   the kiosk screen manages cancel externally via `onCancel`).
 */
export interface DynamicQRPanelProps {
  orderId?: bigint;
  onPaid: () => void;
  onCancel?: () => void;
  /** Display variant — see {@link DynamicQRPanelProps}. */
  variant?: "default" | "kiosk";
}

/**
 * Status badge label + design-token class for a given {@link DynamicQRStatus}.
 * `deleted` is treated like `expired` for display purposes (the QR is no
 * longer usable).
 */
function statusBadge(status: DynamicQRStatus | null): {
  label: string;
  className: string;
  dotClassName: string;
} {
  switch (status) {
    case "paid":
      return {
        label: "Đã thanh toán",
        className: "qr-status-badge is-paid",
        dotClassName: "qr-status-dot",
      };
    case "expired":
    case "deleted":
      return {
        label: "Đã hết hạn",
        className: "qr-status-badge is-expired",
        dotClassName: "qr-status-dot",
      };
    default:
      return {
        label: "Đang chờ thanh toán",
        className: "qr-status-badge is-pending",
        dotClassName: "qr-status-dot is-pending",
      };
  }
}

/**
 * Renders a dynamic QR payment panel backed by the backend's Tingee
 * http-outcalls path (`generateDynamicQR` / `getDynamicQRStatus` /
 * `deleteDynamicQR`).
 *
 * On mount (when `orderId` is available) it calls `useGenerateDynamicQR`,
 * renders the returned `qrString` with `react-qr-code`, and polls
 * `useGetDynamicQRStatus` every 5s while the status is `pending` (the hook
 * owns the refetchInterval logic). When the user cancels, it calls
 * `useDeleteDynamicQR` and clears the QR display.
 */
export function DynamicQRPanel({
  orderId,
  onPaid,
  onCancel,
  variant = "default",
}: DynamicQRPanelProps) {
  const { language } = useLanguage();
  const isKiosk = variant === "kiosk";

  const generateQr = useGenerateDynamicQR();
  const deleteQr = useDeleteDynamicQR();
  const confirmByStatus = useConfirmPaymentByTingeeStatus();
  const markExpired = useMarkTingeeExpired();

  const [qrRecord, setQrRecord] = useState<DynamicQRRecordPublic | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  /** Set when get-status reports `expired` — drives the regenerate UI. */
  const [isExpired, setIsExpired] = useState(false);
  /** Amount-mismatch error message shown while still pending. */
  const [amountMismatchError, setAmountMismatchError] = useState<string | null>(
    null,
  );
  /** Bumped to force a fresh generate + poll cycle after regenerate. */
  const [regenerateNonce, setRegenerateNonce] = useState(0);
  /** Countdown: seconds remaining until the QR expires. */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const orderIdStr = orderId != null ? orderId.toString() : null;
  // Poll while not cancelled and not locally expired (regenerate handles
  // re-enabling). The `regenerateNonce` is part of the key so a regenerate
  // resets the query cache and starts a fresh poll cycle.
  const pollOrderId = !cancelled && !isExpired ? orderIdStr : null;
  const { data: polledStatusResult } = useGetDynamicQRStatus(pollOrderId);

  // The effective status: prefer the polled status once we have one (it is
  // the source of truth for paid/expired/deleted transitions), otherwise
  // fall back to the status returned at generation time. The polled result
  // is now a `DynamicQRStatusResult` (status + totalAmountPaid +
  // transactionInfos); we read `.status` here.
  const effectiveStatus: DynamicQRStatus | null =
    polledStatusResult?.status ?? qrRecord?.status ?? null;

  const paidFiredRef = useRef(false);
  const confirmFiredRef = useRef(false);
  const expiredFiredRef = useRef(false);

  // ── Countdown timer ────────────────────────────────────────────────────
  // The QR lives for `QR_EXPIRE_MINUTES` from `createdAt`. We tick every
  // second and stop at 0. When the timer hits 0 we show "QR hết hạn".
  useEffect(() => {
    if (!qrRecord?.createdAt) {
      setSecondsLeft(null);
      return;
    }
    const expiresAtMs =
      Number(qrRecord.createdAt) * 1000 + QR_EXPIRE_MINUTES * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAtMs - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [qrRecord?.createdAt]);

  // ── Paid → fallback confirm via get-status, then fire onPaid once ──────
  // When get-status reports `paid` with a `totalAmountPaid`, call
  // `confirmPaymentByTingeeStatus` as the webhook fallback. Error handling:
  //   AlreadyPaid → already paid upstream, treat as paid, fire onPaid.
  //   AmountMismatch → show "Số tiền thanh toán không khớp", keep pending.
  //   NotTingeePending → log + stop polling (don't fire onPaid).
  useEffect(() => {
    if (effectiveStatus !== "paid") return;
    if (paidFiredRef.current) return;

    const totalAmountPaid = polledStatusResult?.totalAmountPaid ?? null;
    const orderIdBig = orderId ?? null;

    // If we have an amount, run the fallback confirm first.
    if (
      !confirmFiredRef.current &&
      orderIdBig != null &&
      totalAmountPaid != null
    ) {
      confirmFiredRef.current = true;
      confirmByStatus
        .mutateAsync({
          orderId: orderIdBig,
          totalAmountPaid,
          transactionCode: null,
        })
        .then(() => {
          if (paidFiredRef.current) return;
          paidFiredRef.current = true;
          onPaid();
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("đã được thanh toán")) {
            // AlreadyPaid — treat as paid.
            if (paidFiredRef.current) return;
            paidFiredRef.current = true;
            onPaid();
            return;
          }
          if (msg.includes("mệnh giá")) {
            // AmountMismatch — show error, keep pending (do NOT fire onPaid).
            setAmountMismatchError(
              language === "vi"
                ? "Số tiền thanh toán không khớp"
                : "Paid amount does not match",
            );
            confirmFiredRef.current = false;
            return;
          }
          // NotTingeePending / other — log + stop polling (no onPaid).
          console.warn(
            "[DynamicQRPanel] confirmPaymentByTingeeStatus failed:",
            msg,
          );
          // Stop polling by marking expired locally so the UI shows a
          // recoverable state without firing onPaid.
          setIsExpired(true);
        });
      return;
    }

    // No amount to confirm with (e.g. webhook already confirmed) — just
    // fire onPaid.
    paidFiredRef.current = true;
    onPaid();
  }, [
    effectiveStatus,
    polledStatusResult?.totalAmountPaid,
    orderId,
    onPaid,
    confirmByStatus,
    language,
  ]);

  // ── Expired → mark backend, show regenerate UI, stop polling ───────────
  useEffect(() => {
    if (effectiveStatus !== "expired" && effectiveStatus !== "deleted") return;
    if (expiredFiredRef.current) return;
    expiredFiredRef.current = true;
    setIsExpired(true);
    setSecondsLeft(0);
    if (orderId != null) {
      markExpired.mutateAsync(orderId).catch((err) => {
        // Best-effort: the local expired UI is already shown.
        console.warn(
          "[DynamicQRPanel] markTingeeExpired failed (best effort):",
          err,
        );
      });
    }
  }, [effectiveStatus, orderId, markExpired]);

  // ── Regenerate: create a fresh QR for the same order ──────────────────
  const handleRegenerate = useCallback(() => {
    if (orderIdStr == null) return;
    // Reset all per-cycle state so the panel starts fresh.
    paidFiredRef.current = false;
    confirmFiredRef.current = false;
    expiredFiredRef.current = false;
    setIsExpired(false);
    setAmountMismatchError(null);
    setSecondsLeft(null);
    setQrRecord(null);
    setQrError(null);
    setRegenerateNonce((n) => n + 1);
    generateQr
      .mutateAsync({
        orderId: orderIdStr,
        regenerateNonce: BigInt(regenerateNonce + 1),
      })
      .then((record) => {
        setQrRecord(record);
      })
      .catch((err) => {
        console.error("[DynamicQRPanel] regenerate error:", err);
        setQrError(
          err instanceof Error
            ? err.message
            : language === "vi"
              ? "Không thể tạo mã QR động"
              : "Could not generate dynamic QR",
        );
      });
  }, [orderIdStr, generateQr, language, regenerateNonce]);

  // Generate the dynamic QR once when orderId becomes available, or when
  // the regenerate nonce bumps (a fresh cycle).
  // biome-ignore lint/correctness/useExhaustiveDependencies: generate once per orderId/nonce
  useEffect(() => {
    if (orderIdStr == null) return;
    let cancelledFetch = false;
    setQrError(null);
    setQrRecord(null);
    generateQr
      .mutateAsync({ orderId: orderIdStr })
      .then((record) => {
        if (cancelledFetch) return;
        setQrRecord(record);
      })
      .catch((err) => {
        if (cancelledFetch) return;
        console.error("[DynamicQRPanel] generate error:", err);
        setQrError(
          err instanceof Error
            ? err.message
            : language === "vi"
              ? "Không thể tạo mã QR động"
              : "Could not generate dynamic QR",
        );
      });
    return () => {
      cancelledFetch = true;
    };
  }, [orderIdStr, regenerateNonce]);

  async function handleCancelConfirm() {
    setShowCancelConfirm(false);
    if (orderIdStr != null) {
      try {
        await deleteQr.mutateAsync(orderIdStr);
      } catch (err) {
        console.warn(
          "[DynamicQRPanel] deleteDynamicQR failed (best effort):",
          err,
        );
      }
    }
    setCancelled(true);
    setQrRecord(null);
    onCancel?.();
  }

  // ── Loading: orderId not yet available ──────────────────────────────────
  if (orderIdStr == null) {
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

  // ── Generation error ────────────────────────────────────────────────────
  if (qrError && !qrRecord) {
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
            ? "Không thể tạo mã QR động."
            : "Could not generate dynamic QR."}
        </p>
        <p className="text-xs text-muted-foreground break-words max-w-xs">
          {qrError}
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-ocid="order.payment.cancel_button"
            className="qr-cancel-btn is-ghost"
            style={{ maxWidth: 280 }}
          >
            {language === "vi" ? "Hủy & Đặt đơn mới" : "Cancel & New Order"}
          </button>
        )}
      </div>
    );
  }

  // ── Generating (no record yet) ──────────────────────────────────────────
  if (!qrRecord) {
    return (
      <div
        data-ocid="order.payment.loading_state"
        className="flex flex-col items-center gap-4 py-8 w-full"
      >
        <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {language === "vi"
            ? "Đang tạo mã QR động..."
            : "Generating dynamic QR..."}
        </p>
      </div>
    );
  }

  const badge = statusBadge(effectiveStatus);
  const isPending = effectiveStatus === "pending";
  const isPaid = effectiveStatus === "paid";
  const isTerminal =
    isExpired ||
    effectiveStatus === "expired" ||
    effectiveStatus === "deleted" ||
    effectiveStatus === "paid";

  // Countdown display: mm:ss, or "QR hết hạn" when 0.
  const countdownLabel =
    secondsLeft === null
      ? null
      : secondsLeft <= 0
        ? language === "vi"
          ? "QR hết hạn"
          : "QR expired"
        : `${Math.floor(secondsLeft / 60)
            .toString()
            .padStart(
              2,
              "0",
            )}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  // QR size: kiosk renders a large square (~60% of viewport), default
  // renders a 280px QR.
  const qrSize = isKiosk ? "60vmin" : 280;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Status badge — pill-shaped, design-token driven */}
      <div
        className={badge.className}
        data-ocid="order.payment.qr_status_badge"
      >
        <span className={badge.dotClassName} aria-hidden="true" />
        {badge.label}
      </div>

      {/* Countdown timer — remaining time from createdAt + 15 min */}
      {countdownLabel && !isTerminal && (
        <div
          data-ocid="order.payment.qr_countdown"
          className="text-sm font-mono font-medium text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {language === "vi" ? "Còn lại: " : "Remaining: "}
          <span
            className={
              secondsLeft !== null && secondsLeft <= 60
                ? "text-destructive font-bold"
                : "text-foreground"
            }
          >
            {countdownLabel}
          </span>
        </div>
      )}

      {/* QR surface — white rounded card holding the QR */}
      <div
        className="qr-surface rounded-2xl border border-border shadow-sm flex items-center justify-center p-4 w-full"
        style={
          isKiosk
            ? { aspectRatio: "1 / 1", maxWidth: "60vmin" }
            : { maxWidth: 312 }
        }
        data-ocid="order.payment.qr_panel"
      >
        <QRCode
          value={qrRecord.qrString}
          size={isKiosk ? 480 : 256}
          style={{
            width: qrSize,
            height: qrSize,
            display: isTerminal ? "none" : "block",
          }}
          bgColor="transparent"
          fgColor="currentColor"
          level="M"
        />
        {isTerminal && (
          <div className="flex flex-col items-center gap-3 py-6 text-center w-full">
            <span className="text-3xl">{isPaid ? "✅" : "⏳"}</span>
            <p className="text-sm font-medium text-foreground">
              {isPaid
                ? language === "vi"
                  ? "Thanh toán đã xác nhận"
                  : "Payment confirmed"
                : language === "vi"
                  ? "QR đã hết hạn"
                  : "QR code expired"}
            </p>
            {/* Regenerate button — shown on expired in BOTH variants.
                Kiosk omits the internal cancel button but still shows
                regenerate so the customer can get a fresh QR. */}
            {!isPaid && isExpired && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={generateQr.isPending}
                data-ocid="order.payment.regenerate_button"
                className="qr-cancel-btn is-primary"
                style={{ maxWidth: isKiosk ? "80%" : 280 }}
              >
                {generateQr.isPending
                  ? language === "vi"
                    ? "Đang tạo QR mới..."
                    : "Generating new QR..."
                  : language === "vi"
                    ? "Tạo QR mới"
                    : "Generate new QR"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bill id — helps the customer reconcile with their bank app */}
      {!isKiosk && qrRecord.billId && (
        <div className="w-full rounded-xl bg-muted/50 border border-border px-4 py-2.5 flex flex-col items-center gap-0.5">
          <p className="text-xs text-muted-foreground">
            {language === "vi" ? "Mã giao dịch" : "Bill ID"}
          </p>
          <p className="text-base font-bold tracking-widest text-primary font-mono break-all">
            {qrRecord.billId}
          </p>
        </div>
      )}

      {/* Amount-mismatch error — kept pending, customer can retry/await */}
      {amountMismatchError && isPending && (
        <div
          data-ocid="order.payment.amount_mismatch_error"
          className="w-full rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">
            {amountMismatchError}
          </p>
        </div>
      )}

      {/* Waiting hint while pending */}
      {isPending && (
        <div
          data-ocid="order.payment.loading_state"
          className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
          {language === "vi"
            ? "Đang chờ xác nhận chuyển khoản..."
            : "Waiting for transfer confirmation..."}
        </div>
      )}

      {/* Cancel button — full-width destructive, design-token driven.
          Kiosk variant omits the internal cancel button (the kiosk screen
          manages cancel externally via onCancel). */}
      {!isKiosk && isPending && onCancel && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="qr-cancel-btn"
          disabled={deleteQr.isPending}
          data-ocid="order.payment.cancel_button"
          style={{ maxWidth: 312 }}
        >
          {deleteQr.isPending
            ? language === "vi"
              ? "Đang hủy..."
              : "Cancelling..."
            : language === "vi"
              ? "Hủy mã QR"
              : "Cancel QR"}
        </button>
      )}

      {/* Cancel confirmation overlay */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-4">
          <div
            data-ocid="order.payment.cancel_confirm.dialog"
            className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full shadow-xl flex flex-col gap-4 text-center"
          >
            <p className="text-sm text-foreground font-medium">
              {language === "vi"
                ? "Mã QR hiện tại sẽ bị hủy. Bạn có chắc muốn tiếp tục không?"
                : "The current QR will be cancelled. Are you sure?"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelConfirm}
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
    </div>
  );
}
