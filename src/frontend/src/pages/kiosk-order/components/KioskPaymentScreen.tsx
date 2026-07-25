import { DynamicQRPanel } from "@/components/DynamicQRPanel";
import type { QrProvider } from "@/components/PaymentMethodSelector";
import { Button } from "@/components/ui/button";
import {
  type TingeeConfig,
  formatPrice,
  useGetBusinessProfileInfo,
} from "@/hooks/useBackend";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}

interface KioskPaymentScreenProps {
  orderId: bigint;
  orderCode: string;
  totalAmount: number;
  qrUrl: string;
  canShowQr: boolean;
  bankDetails: BankDetails | null | undefined;
  copySuccess: boolean;
  copyError: boolean;
  onCopyQr: (qrUrl: string) => void;
  onBack: () => void;
  onReset: () => void;
  /** Tingee config (device-scoped). When present together with qrProvider='tingee',
   * the screen renders the dynamic QR panel instead of the VietQR <img> path. */
  tingeeConfig?: TingeeConfig | null;
  /** Which QR provider to render. Defaults to 'none' (no QR rendered until a
   * provider is explicitly selected). The kiosk path uses 'tingee' when the
   * business owner has enabled Tingee auto-confirmation, otherwise 'none'. */
  qrProvider?: QrProvider;
  /** Called when the dynamic QR confirms payment success. */
  onPaid?: () => void;
}

export default function KioskPaymentScreen({
  orderId,
  orderCode,
  totalAmount,
  qrUrl,
  canShowQr,
  bankDetails,
  copySuccess,
  copyError,
  onCopyQr,
  onBack,
  onReset,
  tingeeConfig,
  qrProvider = "none",
  onPaid,
}: KioskPaymentScreenProps) {
  // Business profile info — used to detect whether a Tingee Virtual Account
  // (VA) is configured. The dynamic QR path requires a VA; without one we
  // surface a Vietnamese error state instead of rendering the panel.
  const businessProfileInfo = useGetBusinessProfileInfo();
  const hasVA = !!businessProfileInfo.data?.tingeeVA?.trim();

  const useTingee = qrProvider === "tingee" && tingeeConfig != null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-4 top-4 h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
        onClick={onReset}
        data-ocid="kiosk.cancel_order.button"
      >
        <RotateCcw className="mr-1 h-3 w-3" />
        Hủy
      </Button>
      <div className="w-[45vw] max-w-[600px] min-w-[400px] aspect-square rounded-3xl border border-border bg-card p-8 shadow-lg">
        <p className="mb-4 text-center text-lg font-semibold text-foreground">
          Thanh toán — Đơn hàng #{orderId.toString()}
        </p>

        <div className="flex min-h-0 flex-1 flex-row gap-6">
          <div className="flex w-1/2 flex-col justify-between gap-4">
            <div className="rounded-2xl bg-muted/50 p-6 text-left">
              <p className="mb-2 text-base text-muted-foreground">
                Số tiền thanh toán
              </p>
              <p className="text-4xl font-bold text-primary">
                {formatPrice(BigInt(totalAmount))}
              </p>
            </div>

            <div className="mt-auto">
              <Button
                variant="outline"
                className="h-14 px-8 text-lg"
                onClick={onBack}
                data-ocid="kiosk.back_to_cart.button"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Quay lại
              </Button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            {useTingee && hasVA ? (
              <div
                data-ocid="kiosk.payment.dynamic_qr_panel"
                className="w-full"
              >
                <DynamicQRPanel
                  orderId={orderId}
                  variant="kiosk"
                  onPaid={() => {
                    if (onPaid) onPaid();
                  }}
                  onCancel={onBack}
                />
              </div>
            ) : useTingee && !hasVA ? (
              <div
                data-ocid="kiosk.payment.missing_va.error_state"
                className="flex w-full flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-destructive"
              >
                <AlertTriangle className="h-10 w-10" aria-hidden="true" />
                <p className="text-lg font-semibold">
                  Cần nhập VA trong BusinessProfile
                </p>
                <p className="text-sm text-muted-foreground">
                  Vui lòng liên hệ nhân viên để cấu hình tài khoản ảo (VA) trước
                  khi thanh toán bằng mã QR động.
                </p>
              </div>
            ) : canShowQr && qrUrl ? (
              <>
                <div className="mb-4 flex justify-center">
                  <button
                    type="button"
                    className="h-72 w-72 rounded-xl border-2 border-border transition-transform duration-200 hover:scale-105 hover:shadow-lg active:opacity-70"
                    data-ocid="kiosk.qr_image.button"
                    onClick={() => onCopyQr(qrUrl)}
                  >
                    <img
                      src={qrUrl}
                      alt="Mã QR thanh toán"
                      className="h-full w-full rounded-xl object-contain"
                    />
                  </button>
                </div>
                {copySuccess ? (
                  <p className="mb-6 text-base font-medium text-green-600">
                    Đã sao chép!
                  </p>
                ) : copyError ? (
                  <p className="mb-6 text-base font-medium text-amber-600">
                    Nhấn giữ ảnh để lưu
                  </p>
                ) : (
                  <p className="mb-6 animate-pulse text-base font-medium text-primary">
                    Bấm / chạm vào mã để sao chép
                  </p>
                )}
                <div className="mb-6 space-y-1 text-sm text-muted-foreground">
                  <p>
                    Ngân hàng: <strong>{bankDetails!.bankName}</strong>
                  </p>
                  <p>
                    Số tài khoản: <strong>{bankDetails!.accountNumber}</strong>
                  </p>
                  <p>
                    Chủ tài khoản:{" "}
                    <strong>{bankDetails!.accountHolderName}</strong>
                  </p>
                  <p>
                    Nội dung: <strong>{orderCode}</strong>
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
                <p className="text-lg font-semibold">
                  {!bankDetails?.accountNumber
                    ? "Thiếu thông tin ngân hàng"
                    : totalAmount <= 0
                      ? "Số tiền không hợp lệ"
                      : "Không thể tạo mã QR"}
                </p>
                <p className="mt-1 text-sm">
                  Vui lòng liên hệ nhân viên để thanh toán
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
