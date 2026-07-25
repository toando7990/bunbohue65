import {
  StaffAccessGuard,
  getSavedRestaurantId,
} from "@/components/StaffAccessGuard";
import { useGetPendingCodPayments } from "@/hooks/useBackend";
import { Clock, Package, Truck } from "lucide-react";
import { useEffect, useState } from "react";

function formatVND(amount: bigint | number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(amount));
}

interface CodOrderCardProps {
  orderCode: string;
  orderTotal: bigint;
  shippingFee: bigint;
  status: "pending" | "paid";
}

function CodOrderCard({
  orderCode,
  orderTotal,
  shippingFee,
  status,
}: CodOrderCardProps) {
  const totalCollect = orderTotal + shippingFee;

  return (
    <div
      data-ocid="cod_payment.card"
      className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
    >
      {/* Header: Order code + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8 text-amber-400" />
          <span className="text-3xl font-bold tracking-tight text-white">
            Đơn #{orderCode}
          </span>
        </div>
        {status === "pending" ? (
          <span
            data-ocid="cod_payment.pending_badge"
            className="rounded-full bg-amber-500/20 px-5 py-2 text-lg font-semibold text-amber-300"
          >
            Đang chờ tài xế...
          </span>
        ) : (
          <span
            data-ocid="cod_payment.paid_badge"
            className="rounded-full bg-emerald-500/20 px-5 py-2 text-lg font-semibold text-emerald-300"
          >
            Đã thanh toán ✓
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* Amount breakdown */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xl text-white/70">Tiền đơn hàng:</span>
          <span className="text-2xl font-bold text-white">
            {formatVND(orderTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xl text-white/70">
            <Truck className="h-5 w-5" />
            Phí ship (tài xế thu từ khách):
          </span>
          <span className="text-2xl font-bold text-sky-300">
            {formatVND(shippingFee)}
          </span>
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold text-white/90">
            Tổng tài xế thu từ khách:
          </span>
          <span className="text-3xl font-extrabold text-emerald-400">
            {formatVND(totalCollect)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CodPaymentPage() {
  const restaurantId = getSavedRestaurantId("kioskorder");
  const { data: orders, isLoading } = useGetPendingCodPayments();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <StaffAccessGuard restaurantId={restaurantId} staffRole="kioskorder">
      <div
        data-ocid="cod_payment.page"
        className="flex min-h-screen flex-col bg-slate-950"
        style={{ backgroundColor: "#0f172a" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-8 py-6 backdrop-blur-md">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Chờ tài xế thanh toán
          </h1>
          <div className="flex items-center gap-3 text-xl text-white/60">
            <Clock className="h-6 w-6" />
            <span className="font-mono">{timeStr}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div
              data-ocid="cod_payment.loading_state"
              className="flex h-full items-center justify-center"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-amber-400" />
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8">
              {orders.map((order) => (
                <CodOrderCard
                  key={order.orderCode}
                  orderCode={order.orderCode}
                  orderTotal={order.orderTotal}
                  shippingFee={order.shippingFee}
                  status="pending"
                />
              ))}
            </div>
          ) : (
            <div
              data-ocid="cod_payment.empty_state"
              className="flex h-full flex-col items-center justify-center gap-6 text-white/40"
            >
              <Clock className="h-24 w-24" />
              <p className="text-3xl font-semibold">
                Không có đơn COD đang chờ
              </p>
              <p className="text-xl">
                Màn hình sẽ tự động cập nhật khi có đơn mới
              </p>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-slate-900/60 px-8 py-4 text-center text-lg text-white/40">
          Bunbohue65 — Hệ thống đặt món đa nhà hàng
        </footer>
      </div>
    </StaffAccessGuard>
  );
}
