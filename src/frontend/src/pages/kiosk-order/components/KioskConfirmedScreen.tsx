import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Printer, RotateCcw, X } from "lucide-react";

interface InvoiceInfo {
  invoiceStatus: string;
  invoiceNo?: string;
}

interface KioskConfirmedScreenProps {
  orderId: bigint;
  orderCode?: string;
  restaurantName?: string;
  invoiceInfo: InvoiceInfo | null | undefined;
  resetCountdown: number;
  printStyles: string;
  onNewOrder: () => void;
}

export default function KioskConfirmedScreen({
  orderId,
  restaurantName,
  invoiceInfo,
  resetCountdown,
  printStyles,
  onNewOrder,
}: KioskConfirmedScreenProps) {
  const now = new Date();
  const dateTimeStr = now.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 via-background to-primary/5 p-6">
      {/* Inject print styles — plain JSX style tag */}
      <style>{printStyles}</style>

      <div className="kiosk-print-area w-full max-w-lg rounded-3xl border border-border bg-card p-10 text-center shadow-lg">
        {/* Screen-only decorative elements */}
        <div className="print-hide mb-6 inline-flex rounded-full bg-green-100 p-6">
          <CheckCircle2 className="h-20 w-20 text-green-600" />
        </div>
        <h2 className="print-hide mb-3 text-3xl font-bold text-foreground">
          Đặt hàng thành công!
        </h2>
        <p className="print-hide mb-8 text-lg text-muted-foreground">
          Đơn hàng của bạn đã được gửi vào bếp
        </p>

        {/* Print-visible receipt content */}
        <div className="print-restaurant-name mb-2 text-xl font-bold text-foreground">
          {restaurantName ?? "Bunbohue65"}
        </div>

        <div className="mb-8 rounded-2xl border-2 border-primary/30 bg-primary/5 p-8">
          <p className="print-order-label mb-2 text-base text-muted-foreground">
            Số đơn hàng của bạn
          </p>
          <p className="print-order-number text-7xl font-black text-primary">
            #{orderId.toString()}
          </p>
        </div>

        <div className="mb-8 space-y-2 text-base text-muted-foreground">
          <p className="print-instruction">
            Vui lòng theo dõi bảng thông báo để nhận đồ ăn của bạn
          </p>
          <p className="print-hide font-semibold text-foreground">
            Cảm ơn quý khách!
          </p>
          <p className="print-datetime text-sm text-muted-foreground">
            {dateTimeStr}
          </p>
        </div>

        {/* Invoice status — subtle line below the main message */}
        {invoiceInfo && invoiceInfo.invoiceStatus !== "NotRequested" && (
          <div className="print-hide mb-6 text-sm">
            {invoiceInfo.invoiceStatus === "Pending" && (
              <p className="flex items-center justify-center gap-2 text-amber-600">
                <Clock className="h-4 w-4 animate-spin" />
                Đang phát hành hóa đơn...
              </p>
            )}
            {invoiceInfo.invoiceStatus === "Issued" && (
              <p className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Hóa đơn đã phát hành
                {invoiceInfo.invoiceNo && (
                  <span className="font-medium">
                    {" "}
                    — Số: {invoiceInfo.invoiceNo}
                  </span>
                )}
              </p>
            )}
            {invoiceInfo.invoiceStatus === "Error" && (
              <p className="flex items-center justify-center gap-2 text-destructive">
                <X className="h-4 w-4" />
                Lỗi phát hành hóa đơn
              </p>
            )}
          </div>
        )}

        <div className="print-hide flex gap-3">
          <Button
            variant="outline"
            className="h-14 flex-1 gap-2 text-lg"
            onClick={() => window.print()}
            data-ocid="kiosk.print_receipt.button"
          >
            <Printer className="h-5 w-5" />
            In phiếu
          </Button>
          <Button
            className="h-14 flex-1 gap-2 text-lg font-bold"
            onClick={onNewOrder}
            data-ocid="kiosk.new_order.button"
          >
            <RotateCcw className="h-5 w-5" />
            Đơn mới ({resetCountdown}s)
          </Button>
        </div>
      </div>
    </div>
  );
}
