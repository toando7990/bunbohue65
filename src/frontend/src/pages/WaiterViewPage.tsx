import { OrderStatus, OrderType } from "@/backend";
import type { OrderPublic } from "@/backend";
import {
  StaffAccessGuard,
  getSavedRestaurantId,
} from "@/components/StaffAccessGuard";
import {
  getTodayDateString,
  useActiveOrders,
  useListDeliveryOrders,
  useRestaurant,
} from "@/hooks/useBackend";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

function OrderCard({
  orderNum,
  variant,
}: {
  orderNum: string;
  variant: "ready" | "preparing";
}) {
  const bgClass =
    variant === "ready"
      ? "bg-green-600 border-green-400"
      : "bg-amber-600 border-amber-400";

  return (
    <div
      className={`flex items-center justify-center rounded-3xl ${bgClass} border-4 shadow-2xl aspect-[4/3]`}
    >
      <span className="text-7xl lg:text-8xl xl:text-9xl font-black text-white leading-none tracking-tight">
        {orderNum}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <p className="text-3xl lg:text-4xl font-bold text-white/30">{message}</p>
    </div>
  );
}

function ColumnHeader({
  icon,
  label,
  bgColor,
}: {
  icon: string;
  label: string;
  bgColor: string;
}) {
  return (
    <div
      className={`${bgColor} py-5 lg:py-7 px-4 text-center border-b-4 border-white/30 shadow-lg`}
    >
      <h2 className="text-3xl lg:text-4xl xl:text-5xl font-black text-white tracking-wider">
        {icon} {label}
      </h2>
    </div>
  );
}

function OrdersGrid({
  orderNums,
  variant,
}: {
  orderNums: string[];
  variant: "ready" | "preparing";
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 p-5 lg:p-8">
      {orderNums.map((num, idx) => (
        <div key={num} data-ocid={`waiter_view.${variant}_item.${idx + 1}`}>
          <OrderCard orderNum={num} variant={variant} />
        </div>
      ))}
    </div>
  );
}

function WaiterContent({ restaurantId }: { restaurantId: bigint }) {
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: tableOrders = [] } = useActiveOrders(
    restaurantId,
    getTodayDateString(),
  );
  const { data: deliveryOrders = [] } = useListDeliveryOrders(
    restaurantId,
    getTodayDateString(),
  );

  // Lock body scroll for display board mode
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  // Auto-fullscreen when opened as popup (secondary display)
  useEffect(() => {
    if (window.opener !== null) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPopup = window.opener !== null;

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const { readyDineInOrders, readyCodOrders, preparingOrders } = useMemo(() => {
    const table = (tableOrders as OrderPublic[]).filter(
      (o) =>
        (o.orderType === OrderType.TableOrder || !o.orderType) &&
        (o.status === OrderStatus.Ready || o.status === OrderStatus.Preparing),
    );
    const delivery = (deliveryOrders as OrderPublic[]).filter(
      (o) =>
        o.status === OrderStatus.Ready || o.status === OrderStatus.Preparing,
    );
    const all = [...table, ...delivery];

    const readyDineIn = all
      .filter((o) => o.status === OrderStatus.Ready && !o.isCod)
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((o) => String(o.id).padStart(4, "0").slice(-4));

    const readyCod = all
      .filter((o) => o.status === OrderStatus.Ready && o.isCod)
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((o) => String(o.id).padStart(4, "0").slice(-4));

    const preparing = all
      .filter(
        (o) =>
          o.status === OrderStatus.Preparing ||
          o.status === OrderStatus.Pending,
      )
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((o) => String(o.id).padStart(4, "0").slice(-4));

    return {
      readyDineInOrders: readyDineIn,
      readyCodOrders: readyCod,
      preparingOrders: preparing,
    };
  }, [tableOrders, deliveryOrders]);

  const restaurantName =
    restaurant?.brand1Name ?? restaurant?.name ?? "Nhà hàng";

  return (
    <div className="h-screen w-screen bg-[#0f172a] flex flex-col overflow-hidden">
      {/* Fullscreen toggle — only shown when opened as popup */}
      {isPopup && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="fixed top-2 right-2 z-50 rounded-lg bg-white/10 px-2 py-1 text-base text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          data-ocid="waiter_view.fullscreen_toggle.button"
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>
      )}
      {/* Header */}
      <header className="flex-none py-3 lg:py-4 text-center border-b border-white/10">
        <p className="text-sm lg:text-lg text-white/50 font-medium tracking-[0.2em] uppercase">
          {restaurantName}
        </p>
      </header>

      {/* Main content: three columns */}
      <main className="flex-1 flex min-h-0">
        {/* Left column: Ready — Dine-in / Kiosk */}
        <section className="flex-1 flex flex-col min-w-0 border-r-2 border-white/10">
          <ColumnHeader
            icon="✅"
            label="SẴN SÀNG — TẠI QUẦY"
            bgColor="bg-[#16a34a]"
          />
          <div className="flex-1 overflow-y-auto min-h-0">
            {readyDineInOrders.length === 0 ? (
              <EmptyState message="Chưa có đơn sẵn sàng" />
            ) : (
              <OrdersGrid orderNums={readyDineInOrders} variant="ready" />
            )}
          </div>
        </section>

        {/* Middle column: Ready — COD */}
        <section className="flex-1 flex flex-col min-w-0 border-r-2 border-white/10">
          <ColumnHeader
            icon="🚚"
            label="SẴN SÀNG — TÀI XẾ NHẬN"
            bgColor="bg-[#ea580c]"
          />
          <div className="flex-1 overflow-y-auto min-h-0">
            {readyCodOrders.length === 0 ? (
              <EmptyState message="Chưa có đơn COD sẵn sàng" />
            ) : (
              <OrdersGrid orderNums={readyCodOrders} variant="ready" />
            )}
          </div>
        </section>

        {/* Right column: Preparing */}
        <section className="flex-1 flex flex-col min-w-0">
          <ColumnHeader
            icon="⏳"
            label="ĐANG CHUẨN BỊ"
            bgColor="bg-[#d97706]"
          />
          <div className="flex-1 overflow-y-auto min-h-0">
            {preparingOrders.length === 0 ? (
              <EmptyState message="Chưa có đơn đang chuẩn bị" />
            ) : (
              <OrdersGrid orderNums={preparingOrders} variant="preparing" />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function WaiterViewPage() {
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const restaurantIdFromUrl = Number(search.restaurantId ?? "0");
  const restaurantId = restaurantIdFromUrl || getSavedRestaurantId("waiter");

  if (!restaurantId) {
    return (
      <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white/5 rounded-2xl border border-white/10 p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <p className="text-base font-semibold text-white">Thông báo</p>
          <p className="text-sm text-white/60 leading-relaxed">
            Không tìm thấy thông tin truy cập. Bạn cần dùng link do quản lý cung
            cấp. Liên hệ quản lý nhà hàng để lấy link truy cập mới.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffAccessGuard restaurantId={restaurantId} staffRole="waiter">
      <WaiterContent restaurantId={BigInt(restaurantId)} />
    </StaffAccessGuard>
  );
}
