import { OrderStatus, OrderType } from "@/backend";
import type { OrderPublic } from "@/backend";
import {
  StaffAccessGuard,
  getSavedRestaurantId,
} from "@/components/StaffAccessGuard";
import {
  formatPrice,
  getTodayDateString,
  useActiveOrders,
  useListDeliveryOrders,
  useRestaurant,
  useUpdateOrderStatus,
} from "@/hooks/useBackend";
import { useSecondaryDisplay } from "@/hooks/useSecondaryDisplay";
import { useSearch } from "@tanstack/react-router";
import { ChefHat, Clock, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function formatTime(ts: bigint): string {
  const d = new Date(Number(ts / 1_000_000n));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(ts: bigint): string {
  const ms = Date.now() - Number(ts / 1_000_000n);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Vừa xong";
  if (mins === 1) return "1 phút trước";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}g ${mins % 60}p trước`;
}

// Treat Pending as Preparing visually
// STATUS_LABELS now maps #Pending directly to "Đang chuẩn bị"
// No need for a displayStatus wrapper

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  [OrderStatus.Pending]: {
    label: "Đang chuẩn bị",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  [OrderStatus.Preparing]: {
    label: "Đang chuẩn bị",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  [OrderStatus.Ready]: {
    label: "Sẵn sàng",
    color: "bg-green-100 text-green-800 border-green-300",
  },
  [OrderStatus.Completed]: {
    label: "Đã phục vụ",
    color: "bg-muted text-muted-foreground border-border",
  },
  [OrderStatus.Delivered]: {
    label: "Đã giao",
    color: "bg-muted text-muted-foreground border-border",
  },
};

const BORDER_BY_STATUS: Record<string, string> = {
  [OrderStatus.Pending]: "border-l-blue-400",
  [OrderStatus.Preparing]: "border-l-blue-400",
  [OrderStatus.Ready]: "border-l-green-500",
  [OrderStatus.Completed]: "border-l-border",
  [OrderStatus.Delivered]: "border-l-border",
};

function KitchenOrderCard({
  order,
  restaurantId,
  index,
}: { order: OrderPublic; restaurantId: bigint; index: number }) {
  const updateStatus = useUpdateOrderStatus();
  const isDelivery = order.orderType === OrderType.DeliveryOrder;
  const statusCfg = STATUS_LABELS[order.status];
  const borderColor = BORDER_BY_STATUS[order.status] ?? "border-l-border";
  const orderNum = String(order.id).padStart(4, "0").slice(-4);
  const total = order.items.reduce(
    (s, i) => s + i.price * BigInt(i.quantity),
    0n,
  );

  const handleToReady = () => {
    updateStatus.mutate({
      orderId: order.id,
      status: OrderStatus.Ready,
      restaurantId,
    });
  };

  const handleComplete = () => {
    // Table: Ready → Completed; Delivery: Ready → Delivered
    const next = isDelivery ? OrderStatus.Delivered : OrderStatus.Completed;
    updateStatus.mutate({ orderId: order.id, status: next, restaurantId });
  };

  return (
    <div
      data-ocid={`kitchen.order_card.${index}`}
      className={`rounded-2xl border-l-4 ${borderColor} border border-border bg-card shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-xl text-foreground">
            #{orderNum}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg?.color ?? ""}`}
          >
            {statusCfg?.label ?? order.status}
          </span>
        </div>
        <div className="text-right shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${
              order.isCod
                ? "bg-orange-100 text-orange-800 border-orange-300"
                : isDelivery
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-blue-100 text-blue-800 border-blue-300"
            }`}
          >
            {order.isCod
              ? "🚚 Tài xế COD"
              : isDelivery
                ? "🛵 Giao hàng"
                : "🪑 Tại bàn"}
          </span>
          <p className="text-sm text-muted-foreground mt-1">
            {isDelivery
              ? (order.customerName ?? "—")
              : `Bàn ${order.tableIdentifier}`}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 pb-3 border-t border-border/50 pt-3 space-y-2">
        {order.items.map((item, i) => (
          <div
            key={`${String(item.menuItemId)}-${i}`}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-black text-xl tabular-nums shrink-0 text-primary w-8">
                ×{String(item.quantity)}
              </span>
              <p className="text-base font-semibold text-foreground truncate">
                {item.name}
              </p>
            </div>
            {item.itemNote && (
              <p className="text-sm text-muted-foreground italic shrink-0 max-w-[35%] truncate">
                {item.itemNote}
              </p>
            )}
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-sm text-amber-900 font-medium">
              📝 {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {timeAgo(order.createdAt)} · {formatTime(order.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">
            {formatPrice(total)}
          </span>
          {/* Preparing/Pending → Sẵn sàng */}
          {(order.status === OrderStatus.Preparing ||
            order.status === OrderStatus.Pending) && (
            <button
              type="button"
              onClick={handleToReady}
              disabled={updateStatus.isPending}
              className="h-12 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
              data-ocid={`kitchen.ready_button.${index}`}
            >
              {updateStatus.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              Sẵn sàng ✓
            </button>
          )}
          {order.status === OrderStatus.Ready && !isDelivery && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={updateStatus.isPending}
              className="h-12 px-5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
              data-ocid={`kitchen.served_button.${index}`}
            >
              {updateStatus.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              Đã phục vụ ✓
            </button>
          )}
          {order.status === OrderStatus.Ready && isDelivery && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={updateStatus.isPending}
              className="h-12 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
              data-ocid={`kitchen.deliver_button.${index}`}
            >
              {updateStatus.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              Giao hàng ✓
            </button>
          )}
          {(order.status === OrderStatus.Completed ||
            order.status === OrderStatus.Delivered) && (
            <span className="h-12 px-5 bg-muted text-muted-foreground border border-border rounded-xl font-bold text-sm flex items-center gap-2">
              ✓ Hoàn thành
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryOrderCard({
  order,
  restaurantId,
  index,
}: { order: OrderPublic; restaurantId: bigint; index: number }) {
  const updateStatus = useUpdateOrderStatus();
  const isDelivery = order.orderType === OrderType.DeliveryOrder;
  const orderNum = String(order.id).padStart(4, "0").slice(-4);
  const total = order.items.reduce(
    (s, i) => s + i.price * BigInt(i.quantity),
    0n,
  );

  const handleConfirmHandoff = () => {
    const next = isDelivery ? OrderStatus.Delivered : OrderStatus.Completed;
    updateStatus.mutate({
      orderId: order.id,
      status: next,
      restaurantId,
    });
  };

  // Kiosk orders: compact card (only order number + item count)
  if (!isDelivery) {
    return (
      <div
        data-ocid={`kitchen.delivery.order_card.${index}`}
        className="rounded-2xl border-l-4 border-l-blue-500 border border-blue-900/40 bg-gray-900 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono font-bold text-xl text-white">
              #{orderNum}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-400 border border-blue-600">
              🏪 Quầy
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs sm:text-sm md:text-base text-gray-400">
              {order.items.reduce((s, i) => s + i.quantity, 0n)} món
            </span>
            <button
              type="button"
              onClick={handleConfirmHandoff}
              disabled={updateStatus.isPending}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
              data-ocid={`kitchen.delivery.confirm_button.${index}`}
            >
              {updateStatus.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              Xác nhận giao ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Delivery orders: full detail card
  return (
    <div
      data-ocid={`kitchen.delivery.order_card.${index}`}
      className="rounded-2xl border-l-4 border-l-orange-500 border border-orange-900/40 bg-gray-900 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-xl text-white">
            #{orderNum}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-green-900/40 text-green-400 border-green-600">
            Sẵn sàng giao
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-900/40 text-orange-400 border border-orange-600">
            🛥 Giao hàng
          </span>
          <span className="text-sm text-gray-400">
            {formatTime(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 pb-3 border-t border-gray-800 pt-3 space-y-2">
        {order.items.map((item, i) => (
          <div
            key={`${String(item.menuItemId)}-${i}`}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-black text-xl tabular-nums shrink-0 text-orange-400 w-8">
                ×{String(item.quantity)}
              </span>
              <p className="text-base font-semibold text-white truncate">
                {item.name}
              </p>
            </div>
            {item.itemNote && (
              <p className="text-sm text-gray-400 italic shrink-0 max-w-[35%] truncate">
                {item.itemNote}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Customer info */}
      <div className="px-5 pb-3 pt-2 border-t border-gray-800 space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-gray-400">👤</span>
          <p className="text-gray-200 font-medium">
            {order.customerName ?? "—"}
            {order.customerPhone ? (
              <span className="ml-2 text-gray-400 font-normal">
                {order.customerPhone}
              </span>
            ) : null}
          </p>
        </div>
        {order.deliveryAddress && (
          <div className="flex items-start gap-2 text-sm">
            <span className="shrink-0 text-gray-400 mt-0.5">📍</span>
            <p className="text-gray-200 leading-snug">
              {order.deliveryAddress}
            </p>
          </div>
        )}
        {order.shipperName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-gray-400">🏕️</span>
            <p className="text-orange-300 font-medium">{order.shipperName}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-2 border-t border-gray-800 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-orange-400">
          {formatPrice(total)}
        </span>
        <button
          type="button"
          onClick={handleConfirmHandoff}
          disabled={updateStatus.isPending}
          className="h-12 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
          data-ocid={`kitchen.delivery.confirm_button.${index}`}
        >
          {updateStatus.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : null}
          Xác nhận giao ✓
        </button>
      </div>
    </div>
  );
}

function KitchenContent({ restaurantId }: { restaurantId: bigint }) {
  const { data: restaurant } = useRestaurant(restaurantId);
  const {
    data: tableOrders = [],
    isFetching: fetchingTable,
    refetch: refetchTable,
  } = useActiveOrders(restaurantId, getTodayDateString());
  const {
    data: deliveryOrders = [],
    isFetching: fetchingDelivery,
    refetch: refetchDelivery,
  } = useListDeliveryOrders(restaurantId, getTodayDateString());
  const [lang, setLang] = useState<"vi" | "en">("vi");
  const [activeTab, setActiveTab] = useState<"kitchen" | "delivery">("kitchen");
  const { openWaiterDisplay, isWaiterWindowOpen, hasWaiterToken } =
    useSecondaryDisplay();

  const isFetching = fetchingTable || fetchingDelivery;

  // Kitchen orders: all statuses except PendingApproval
  const kitchenOrders = useMemo(() => {
    const KITCHEN_STATUSES = new Set([
      OrderStatus.Pending,
      OrderStatus.Preparing,
      OrderStatus.Ready,
      OrderStatus.Completed,
      OrderStatus.Delivered,
    ]);
    const combined = [
      ...(tableOrders as OrderPublic[]),
      ...(deliveryOrders as OrderPublic[]),
    ].filter((o) => KITCHEN_STATUSES.has(o.status));
    const statusOrder: Record<string, number> = {
      [OrderStatus.Pending]: 0,
      [OrderStatus.Preparing]: 0,
      [OrderStatus.Ready]: 1,
      [OrderStatus.Completed]: 2,
      [OrderStatus.Delivered]: 2,
    };
    return combined.sort(
      (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3),
    );
  }, [tableOrders, deliveryOrders]);

  // Delivery tab: both Kiosk #Ready and Delivery #Ready orders (sẵn sàng giao)
  const readyHandoffOrders = useMemo(() => {
    const allOrders = [
      ...(tableOrders as OrderPublic[]),
      ...(deliveryOrders as OrderPublic[]),
    ];
    return allOrders
      .filter(
        (o) =>
          o.status === OrderStatus.Ready &&
          (o.orderType === OrderType.DeliveryOrder ||
            o.orderType === OrderType.TableOrder),
      )
      .sort((a, b) => Number(a.id - b.id));
  }, [tableOrders, deliveryOrders]);

  // Track new orders for audio notification
  const seenNewOrderIdsRef = useRef<Set<string>>(new Set());
  const announcedReadyRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const speechUnlockedRef = useRef(false);

  const handleUnlockAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      setAudioUnlocked(true);
    }
    if (!speechUnlockedRef.current && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(utter);
      speechUnlockedRef.current = true;
    }
  };

  // Audio beep for new orders
  useEffect(() => {
    if (!audioCtxRef.current) return;
    for (const order of kitchenOrders) {
      const key = String(order.id);
      if (
        (order.status === OrderStatus.Pending ||
          order.status === OrderStatus.Preparing) &&
        !seenNewOrderIdsRef.current.has(key)
      ) {
        seenNewOrderIdsRef.current.add(key);
        const ctx = audioCtxRef.current!;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    }
  }, [kitchenOrders]);

  // TTS for Ready orders
  useEffect(() => {
    if (!speechUnlockedRef.current) return;
    for (const order of kitchenOrders) {
      const key = String(order.id);
      if (
        order.status === OrderStatus.Ready &&
        !announcedReadyRef.current.has(key)
      ) {
        announcedReadyRef.current.add(key);
        const isDelivery = order.orderType === OrderType.DeliveryOrder;
        const text = isDelivery
          ? `Đơn của ${order.customerName ?? "khách hàng"} đã sẵn sàng`
          : `Đơn số ${String(order.id).padStart(4, "0").slice(-4)} đã sẵn sàng`;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "vi-VN";
        utter.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(
          (v) => v.lang === "vi-VN" || v.lang.startsWith("vi"),
        );
        if (viVoice) utter.voice = viVoice;
        window.speechSynthesis.speak(utter);
      }
    }
  }, [kitchenOrders]);

  const restaurantName =
    restaurant?.brand1Name ?? restaurant?.name ?? "Nhà hàng";

  const readyDeliveryCount = readyHandoffOrders.length;

  return (
    <div
      className="min-h-screen bg-gray-950 text-white relative"
      onClick={handleUnlockAudio}
      onKeyDown={handleUnlockAudio}
    >
      {hasWaiterToken && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openWaiterDisplay();
          }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gray-800/80 px-3 py-2 text-xs font-medium text-gray-300 opacity-60 shadow-lg backdrop-blur-sm transition-all hover:opacity-100 hover:bg-gray-700/90 border border-gray-600/50"
          aria-label="Mở màn hình phục vụ"
          data-ocid="kitchen.open_waiter_display_button"
        >
          <span className="relative flex h-2 w-2">
            {isWaiterWindowOpen ? (
              <span className="block h-2 w-2 rounded-full bg-green-400" />
            ) : (
              <span className="block h-2 w-2 rounded-full bg-gray-500" />
            )}
          </span>
          Màn hình phục vụ
        </button>
      )}
      {!audioUnlocked && (
        <div className="absolute top-4 right-4 z-50 bg-gray-800 text-gray-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer select-none">
          <span>🔇</span>
          <span>Nhấn vào màn hình để bật âm thanh</span>
        </div>
      )}
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">
              {lang === "vi" ? "Bếp" : "Kitchen"} — {restaurantName}
            </h1>
            <p className="text-xs text-gray-400">
              {
                kitchenOrders.filter(
                  (o) =>
                    o.status !== OrderStatus.Completed &&
                    o.status !== OrderStatus.Delivered,
                ).length
              }{" "}
              {lang === "vi" ? "đơn đang xử lý" : "active orders"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isFetching
                ? "bg-amber-900/40 border-amber-700 text-amber-300"
                : "bg-green-900/40 border-green-700 text-green-300"
            }`}
            data-ocid="kitchen.live_indicator"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isFetching ? "bg-amber-400 animate-pulse" : "bg-green-400"}`}
            />
            {isFetching
              ? lang === "vi"
                ? "Đang tải..."
                : "Loading..."
              : "Live"}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refetchTable();
              refetchDelivery();
            }}
            disabled={isFetching}
            className="h-9 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm flex items-center gap-1.5 transition-colors disabled:opacity-60"
            data-ocid="kitchen.refresh_button"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLang(lang === "vi" ? "en" : "vi");
            }}
            className="h-9 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            data-ocid="kitchen.lang_toggle"
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 flex">
        <button
          type="button"
          onClick={() => setActiveTab("kitchen")}
          data-ocid="kitchen.tab.kitchen"
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab === "kitchen"
              ? "text-amber-400 border-b-2 border-amber-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          🍳 {lang === "vi" ? "Bếp" : "Kitchen"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("delivery")}
          data-ocid="kitchen.tab.delivery"
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
            activeTab === "delivery"
              ? "text-amber-400 border-b-2 border-amber-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          🛵 {lang === "vi" ? "Giao hàng cho tài xế" : "Delivery"}
          {readyDeliveryCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {readyDeliveryCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <main className="p-5">
        {activeTab === "kitchen" &&
          (kitchenOrders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-32 gap-4"
              data-ocid="kitchen.empty_state"
            >
              <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <ChefHat className="h-10 w-10 text-gray-500" />
              </div>
              <p className="text-xl font-semibold text-gray-400">
                {lang === "vi" ? "Chưa có đơn nào" : "No active orders"}
              </p>
              <p className="text-sm text-gray-500">
                {lang === "vi"
                  ? "Tự động làm mới mỗi 5 giây"
                  : "Auto-refreshes every 5 seconds"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {kitchenOrders.map((order, idx) => (
                <KitchenOrderCard
                  key={String(order.id)}
                  order={order as OrderPublic}
                  restaurantId={restaurantId}
                  index={idx + 1}
                />
              ))}
            </div>
          ))}

        {activeTab === "delivery" &&
          (readyHandoffOrders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-32 gap-4"
              data-ocid="kitchen.delivery.empty_state"
            >
              <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <span className="text-4xl">🛵</span>
              </div>
              <p className="text-xl font-semibold text-gray-400">
                Không có đơn nào đang chờ giao
              </p>
              <p className="text-sm text-gray-500">
                Hiển thị đơn tại quầy và đơn giao hàng đã sẵn sàng
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              data-ocid="kitchen.delivery.list"
            >
              {readyHandoffOrders.map((order, idx) => (
                <DeliveryOrderCard
                  key={String(order.id)}
                  order={order}
                  restaurantId={restaurantId}
                  index={idx + 1}
                />
              ))}
            </div>
          ))}
      </main>
    </div>
  );
}

export default function KitchenViewPage() {
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const restaurantIdFromUrl = Number(search.restaurantId ?? "0");
  const restaurantId = restaurantIdFromUrl || getSavedRestaurantId("kitchen");

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <p className="text-base font-semibold text-foreground">Bếp</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Không tìm thấy thông tin truy cập. Bạn cần dùng link do quản lý cung
            cấp. Liên hệ quản lý nhà hàng để lấy link truy cập mới.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffAccessGuard restaurantId={restaurantId} staffRole="kitchen">
      <KitchenContent restaurantId={BigInt(restaurantId)} />
    </StaffAccessGuard>
  );
}
