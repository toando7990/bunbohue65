import { AdminLayout } from "@/Layout";
import { OrderType } from "@/backend";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  useActiveOrders,
  useClearCompletedOrders,
  useListDeliveryOrders,
  useOrders,
  useUpdateOrderStatus,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@/types";
import type { OrderPublic, RestaurantId } from "@/types";
import { getRouteApi } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  Maximize2,
  Minimize2,
  Package,
  Phone,
  RefreshCw,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const routeApi = getRouteApi("/admin/restaurant/$restaurantId/orders");

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  [OrderStatus.Pending]: {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    card: "border-l-amber-400 bg-amber-50",
    cardDark: "border-l-amber-400",
    dot: "bg-amber-400",
    next: OrderStatus.Preparing,
  },
  [OrderStatus.Preparing]: {
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    card: "border-l-blue-400 bg-blue-50",
    cardDark: "border-l-blue-400",
    dot: "bg-blue-400",
    next: OrderStatus.Ready,
  },
  [OrderStatus.Ready]: {
    badge: "bg-green-100 text-green-800 border-green-300",
    card: "border-l-green-500 bg-green-50",
    cardDark: "border-l-green-500",
    dot: "bg-green-500",
    next: OrderStatus.Completed,
  },
  [OrderStatus.Completed]: {
    badge: "bg-muted text-muted-foreground border-border",
    card: "border-l-muted-foreground/30 bg-muted/30",
    cardDark: "border-l-muted-foreground/30",
    dot: "bg-muted-foreground/40",
    next: null,
  },
} as const;

function formatTime(ts: bigint): string {
  const d = new Date(Number(ts / 1_000_000n));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(ts: bigint, language: "vi" | "en"): string {
  const ms = Date.now() - Number(ts / 1_000_000n);
  const mins = Math.floor(ms / 60_000);
  if (language === "vi") {
    if (mins < 1) return "Vừa xong";
    if (mins === 1) return "1 phút trước";
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}g ${mins % 60}p trước`;
  }
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: OrderPublic;
  restaurantId: RestaurantId;
  kitchenMode: boolean;
  index: number;
  showTypeBadge?: boolean;
}

function OrderCard({
  order,
  restaurantId,
  kitchenMode,
  index,
  showTypeBadge,
}: OrderCardProps) {
  const updateStatus = useUpdateOrderStatus();
  const { t, language } = useLanguage();
  const cfg = STATUS_CONFIG[order.status];
  const orderNum = String(order.id).padStart(4, "0").slice(-4);
  const isPending = order.status === OrderStatus.Pending;
  const isReady = order.status === OrderStatus.Ready;
  const isDelivery = order.orderType === OrderType.DeliveryOrder;

  const statusLabels = {
    [OrderStatus.Pending]: t.orders.statusPending,
    [OrderStatus.Preparing]: t.orders.statusPreparing,
    [OrderStatus.Ready]: t.orders.statusReady,
    [OrderStatus.Completed]: t.orders.statusCompleted,
  };

  const nextLabels = {
    [OrderStatus.Pending]: t.orders.markPreparing,
    [OrderStatus.Preparing]: t.orders.markReady,
    [OrderStatus.Ready]: t.orders.markCompleted,
    [OrderStatus.Completed]: "",
  };

  const handleAdvance = () => {
    if (!cfg.next) return;
    updateStatus.mutate({
      orderId: order.id,
      status: cfg.next,
      restaurantId,
    });
  };

  return (
    <div
      data-ocid={`orders.item.${index}`}
      className={`rounded-xl border-l-4 border border-border shadow-sm transition-all duration-200 ${
        kitchenMode ? `${cfg.cardDark} bg-card` : cfg.card
      } ${isPending ? "ring-1 ring-amber-300" : ""} ${
        isReady ? "ring-2 ring-green-400 shadow-green-100" : ""
      }`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3">
          <span
            className={`font-mono font-bold ${
              kitchenMode ? "text-2xl" : "text-lg"
            } text-foreground`}
          >
            #{orderNum}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
              cfg.badge
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {statusLabels[order.status]}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            {showTypeBadge && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${
                  isDelivery
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : "bg-green-100 text-green-800 border-green-300"
                }`}
              >
                {isDelivery ? (
                  <Truck className="h-2.5 w-2.5" />
                ) : (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                )}
                {isDelivery
                  ? language === "vi"
                    ? "Giao hàng"
                    : "Delivery"
                  : language === "vi"
                    ? "Tại bàn"
                    : "Dine-in"}
              </span>
            )}
            <p
              className={`font-semibold text-foreground ${
                kitchenMode ? "text-2xl" : "text-base"
              }`}
            >
              {isDelivery
                ? order.customerName || (language === "vi" ? "Khách" : "Guest")
                : `${t.orders.table} ${order.tableIdentifier}`}
            </p>
          </div>
          {order.vatInfo?.taxCode &&
          (Array.isArray(order.vatInfo.taxCode)
            ? order.vatInfo.taxCode.length > 0
            : order.vatInfo.taxCode) ? (
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">
              MST:{" "}
              {Array.isArray(order.vatInfo.taxCode)
                ? order.vatInfo.taxCode[0]
                : order.vatInfo.taxCode}{" "}
              — {order.vatInfo.buyerName}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Bán cho người tiêu dùng
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {timeAgo(order.createdAt, language)} · {formatTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-1.5">
        {order.items.map((item, i) => (
          <div
            key={`${String(item.menuItemId)}-${i}`}
            className="flex items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2 min-w-0">
              <span
                className={`font-bold tabular-nums shrink-0 text-primary ${
                  kitchenMode ? "text-xl w-8" : "text-base w-6"
                }`}
              >
                ×{String(item.quantity)}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-medium text-foreground leading-snug ${
                    kitchenMode ? "text-lg" : "text-sm"
                  }`}
                >
                  {item.name}
                </p>
                {item.itemNote && (
                  <p
                    className={`text-muted-foreground italic ${
                      kitchenMode ? "text-base" : "text-xs"
                    }`}
                  >
                    {item.itemNote}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`text-muted-foreground tabular-nums shrink-0 ${
                kitchenMode ? "text-base" : "text-xs"
              }`}
            >
              {formatPrice(item.price * item.quantity)}
            </span>
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 rounded-md bg-amber-100 border border-amber-200 px-3 py-2">
            <p
              className={`text-amber-900 font-medium ${
                kitchenMode ? "text-base" : "text-xs"
              }`}
            >
              📝 {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Action */}
      {cfg.next && (
        <div className="px-4 pb-4 pt-2">
          <Button
            type="button"
            data-ocid={`orders.advance_button.${index}`}
            onClick={handleAdvance}
            disabled={updateStatus.isPending}
            className={`w-full font-semibold transition-smooth ${
              isReady
                ? "bg-green-600 hover:bg-green-700 text-white border-green-700"
                : isPending
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                  : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
            } ${kitchenMode ? "h-12 text-base" : "h-9 text-sm"}`}
          >
            {updateStatus.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : isReady ? (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            ) : (
              <ChefHat className="h-4 w-4 mr-2" />
            )}
            {nextLabels[order.status]}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyActiveOrders({ kitchenMode }: { kitchenMode: boolean }) {
  const { t } = useLanguage();
  return (
    <div
      data-ocid="orders.active.empty_state"
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
        <Truck className="h-8 w-8 text-accent" />
      </div>
      <div>
        <p
          className={`font-semibold text-foreground ${
            kitchenMode ? "text-2xl" : "text-lg"
          }`}
        >
          {t.orders.noActiveOrders}
        </p>
        <p
          className={`text-muted-foreground mt-1 ${
            kitchenMode ? "text-base" : "text-sm"
          }`}
        >
          {t.orders.autoRefresh}
        </p>
      </div>
    </div>
  );
}

// ─── Waiter Tab ──────────────────────────────────────────────────────────────

interface WaiterTabProps {
  readyOrders: OrderPublic[];
  restaurantId: RestaurantId;
  t: ReturnType<typeof useLanguage>["t"];
  language: "vi" | "en";
}

function WaiterTab({ readyOrders, restaurantId, t, language }: WaiterTabProps) {
  const updateStatus = useUpdateOrderStatus();

  function getTimeUrgency(ts: bigint): { color: string; label: string } {
    const mins = Math.floor((Date.now() - Number(ts / 1_000_000n)) / 60_000);
    if (mins < 5)
      return {
        color: "text-green-700 bg-green-100 border-green-300",
        label:
          mins < 1
            ? language === "vi"
              ? "Vừa xong"
              : "Just now"
            : `${mins}${language === "vi" ? " phút" : " min"}`,
      };
    if (mins < 10)
      return {
        color: "text-amber-700 bg-amber-100 border-amber-300",
        label: `${mins}${language === "vi" ? " phút" : " min"}`,
      };
    return {
      color: "text-red-700 bg-red-100 border-red-300",
      label: `${mins}${language === "vi" ? " phút" : " min"}`,
    };
  }

  // Group by table
  const byTable = readyOrders.reduce<Record<string, OrderPublic[]>>(
    (acc, o) => {
      const key = o.tableIdentifier;
      if (!acc[key]) acc[key] = [];
      acc[key].push(o);
      return acc;
    },
    {},
  );

  if (readyOrders.length === 0) {
    return (
      <div
        data-ocid="orders.waiter.empty_state"
        className="flex flex-col items-center justify-center gap-4 py-20 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-lg">
            {t.orders.noReadyOrders}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {t.orders.autoRefresh}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(byTable).map(([tableId, orders]) => (
        <div
          key={tableId}
          data-ocid={`orders.waiter.table.${tableId}`}
          className="rounded-xl border border-green-200 bg-green-50/50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-green-100/60 border-b border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <span className="font-semibold text-green-800">
                {t.orders.table} {tableId}
              </span>
              <span className="text-xs text-green-700 bg-green-200 px-2 py-0.5 rounded-full">
                {orders.length} {language === "vi" ? "đơn" : "order"}s
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {orders.map((order, i) => {
              const orderNum = String(order.id).padStart(4, "0").slice(-4);
              const urgency = getTimeUrgency(order.createdAt);
              const isPaid = order.paymentStatus === PaymentStatus.Paid;
              const orderTotal = order.items.reduce(
                (s, it) => s + it.price * it.quantity,
                0n,
              );
              return (
                <div
                  key={String(order.id)}
                  data-ocid={`orders.waiter.item.${i + 1}`}
                  className="bg-card rounded-lg border border-border px-4 py-3 space-y-2"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-bold text-foreground">
                        #{orderNum}
                      </p>
                      {/* Payment badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${
                          isPaid
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-red-100 text-red-800 border-red-300"
                        }`}
                      >
                        <CreditCard className="h-2.5 w-2.5" />
                        {isPaid
                          ? language === "vi"
                            ? "Đã TT"
                            : "Paid"
                          : language === "vi"
                            ? "Chưa TT"
                            : "Unpaid"}
                      </span>
                      {/* Urgency time badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${urgency.color}`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {urgency.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground shrink-0">
                      {formatPrice(orderTotal)}
                    </span>
                  </div>
                  {/* MST / Bán cho người tiêu dùng */}
                  {order.vatInfo?.taxCode?.[0] ? (
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">
                      MST: {order.vatInfo.taxCode[0]} —{" "}
                      {order.vatInfo.buyerName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bán cho người tiêu dùng
                    </p>
                  )}
                  {/* Items list */}
                  <div className="space-y-0.5 pl-1">
                    {order.items.map((it, j) => (
                      <div
                        key={`${String(it.menuItemId)}-${j}`}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span className="font-medium">
                          {it.quantity}× {it.name}
                          {it.itemNote ? (
                            <span className="italic text-muted-foreground/70">
                              {" "}
                              — {it.itemNote}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">
                          {formatPrice(it.price * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Deliver button */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      updateStatus.mutate({
                        orderId: order.id,
                        status: OrderStatus.Completed,
                        restaurantId,
                      })
                    }
                    disabled={updateStatus.isPending}
                    data-ocid={`orders.waiter.deliver_button.${i + 1}`}
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5 mt-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.orders.markDelivered}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Cashier Tab ─────────────────────────────────────────────────────────────

interface CashierTabProps {
  allOrders: OrderPublic[];
  onClear: () => void;
  clearPending: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  language: "vi" | "en";
}

function CashierTab({
  allOrders,
  onClear,
  clearPending,
  t,
  language,
}: CashierTabProps) {
  // Only dine-in table orders with status Completed (served) or Paid
  const tableOrders = allOrders.filter(
    (o) =>
      (o.orderType === OrderType.TableOrder ||
        (o.orderType as string) === undefined) &&
      o.status === OrderStatus.Completed,
  );

  // Sort: unpaid first, then paid; within each group sort by createdAt desc
  const sortedOrders = [...tableOrders].sort((a, b) => {
    const aUnpaid = a.paymentStatus === PaymentStatus.Unpaid ? 0 : 1;
    const bUnpaid = b.paymentStatus === PaymentStatus.Unpaid ? 0 : 1;
    if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
    return Number(b.createdAt - a.createdAt);
  });

  const completedOrders = tableOrders.filter(
    (o) =>
      o.paymentStatus === PaymentStatus.Paid &&
      o.status === OrderStatus.Completed,
  );

  const paymentMethodLabel = (method?: string) => {
    if (!method) return null;
    const labels: Record<string, string> = {
      BankTransfer: language === "vi" ? "Chuyển khoản QR" : "QR Transfer",
    };
    return labels[method] ?? null;
  };

  const calcTotal = (order: OrderPublic) =>
    order.items.reduce((s, it) => s + it.price * it.quantity, 0n);

  if (tableOrders.length === 0) {
    return (
      <div
        data-ocid="orders.cashier.empty_state"
        className="flex flex-col items-center justify-center gap-4 py-20 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground text-sm">
          {language === "vi"
            ? "Không có đơn nào cần thanh toán"
            : "No orders pending payment"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Clear completed button */}
      {completedOrders.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onClear}
            disabled={clearPending}
            data-ocid="orders.cashier.clear_button"
            className="gap-1.5 h-7 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            {clearPending ? t.common.loading : t.orders.clearCompleted}
          </Button>
        </div>
      )}

      {/* Flat list sorted: unpaid first */}
      {sortedOrders.map((order, i) => {
        const isUnpaid = order.paymentStatus === PaymentStatus.Unpaid;
        const isCompleted =
          order.paymentStatus === PaymentStatus.Paid &&
          order.status === OrderStatus.Completed;
        const orderNum = String(order.id).padStart(4, "0").slice(-4);
        const total = calcTotal(order);

        return (
          <div
            key={String(order.id)}
            data-ocid={`orders.cashier.item.${i + 1}`}
            className={`rounded-xl border-2 overflow-hidden ${
              isUnpaid
                ? "border-red-400 bg-red-50"
                : isCompleted
                  ? "border-green-200 bg-green-50/60"
                  : "border-amber-300 bg-amber-50"
            }`}
          >
            {/* Card header */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 border-b ${
                isUnpaid
                  ? "bg-red-100 border-red-300"
                  : isCompleted
                    ? "bg-green-100/60 border-green-200"
                    : "bg-amber-100 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-mono font-bold ${
                    isUnpaid
                      ? "text-red-900"
                      : isCompleted
                        ? "text-green-900"
                        : "text-amber-900"
                  }`}
                >
                  #{orderNum}
                </span>
                {isUnpaid && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {language === "vi" ? "CHƯA TT" : "UNPAID"}
                  </span>
                )}
                {!isUnpaid && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isCompleted
                        ? "bg-green-200 text-green-800 border border-green-300"
                        : "bg-amber-200 text-amber-800 border border-amber-300"
                    }`}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {language === "vi" ? "Đã TT" : "Paid"}
                  </span>
                )}
                <span
                  className={`text-xs font-medium ${
                    isUnpaid
                      ? "text-red-700"
                      : isCompleted
                        ? "text-green-700"
                        : "text-amber-700"
                  }`}
                >
                  {t.orders.table} {order.tableIdentifier}
                </span>
                {/* MST / Bán cho người tiêu dùng */}
                {order.vatInfo?.taxCode?.[0] ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium">
                    MST: {order.vatInfo.taxCode[0]}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Bán cho người tiêu dùng
                  </span>
                )}
                {order.paymentMethod === "BankTransfer" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-200 text-green-800 border border-green-300 text-xs font-bold">
                    Auto-Tingee
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {order.paymentMethod && (
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      isUnpaid ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    <CreditCard className="h-3 w-3" />
                    {paymentMethodLabel(order.paymentMethod)}
                  </span>
                )}
                <span
                  className={`font-bold ${
                    isUnpaid
                      ? "text-red-900"
                      : isCompleted
                        ? "text-green-900"
                        : "text-amber-900"
                  }`}
                >
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="px-4 py-3 space-y-1">
              {order.items.map((it, j) => (
                <div
                  key={`${String(it.menuItemId)}-${j}`}
                  className="flex justify-between text-sm"
                >
                  <span
                    className={`${
                      isUnpaid
                        ? "text-red-900"
                        : isCompleted
                          ? "text-green-900"
                          : "text-amber-900"
                    }`}
                  >
                    {it.quantity}× {it.name}
                  </span>
                  <span
                    className={`tabular-nums ${
                      isUnpaid
                        ? "text-red-700"
                        : isCompleted
                          ? "text-green-700"
                          : "text-amber-700"
                    }`}
                  >
                    {formatPrice(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Unpaid orders awaiting bank transfer auto-confirmation */}
            {isUnpaid && (
              <div className="px-4 pb-3">
                <div
                  data-ocid={`orders.cashier.awaiting_payment.${i + 1}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  {language === "vi"
                    ? "Chờ khách chuyển khoản QR – tự động xác nhận"
                    : "Waiting for QR bank transfer – auto-confirm"}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliveryOrdersManagementTab({
  restaurantId,
  language,
}: {
  restaurantId: RestaurantId;
  language: "vi" | "en";
}) {
  const updateStatus = useUpdateOrderStatus();
  const deliveryQuery = useListDeliveryOrders(restaurantId);
  const allOrders = deliveryQuery.data ?? [];
  const [copyToastId, setCopyToastId] = useState<string | null>(null);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);

  // Sort: undelivered (status != Completed) first, then delivered
  const sortedOrders = [...allOrders].sort((a, b) => {
    const aDelivered = a.status === OrderStatus.Completed ? 1 : 0;
    const bDelivered = b.status === OrderStatus.Completed ? 1 : 0;
    if (aDelivered !== bDelivered) return aDelivered - bDelivered;
    return Number(a.createdAt - b.createdAt);
  });

  async function handleCopyAddress(address: string, orderId: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopyToastId(orderId);
      setTimeout(() => setCopyToastId(null), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  if (sortedOrders.length === 0) {
    return (
      <div
        data-ocid="orders.delivery.empty_state"
        className="flex flex-col items-center justify-center gap-4 py-20 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
          <Package className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground text-sm">
          {language === "vi"
            ? "Chưa có đơn giao hàng"
            : "No delivery orders yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QR Modal */}
      {expandedQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setExpandedQr(null)}
          onKeyDown={(e) => e.key === "Escape" && setExpandedQr(null)}
          tabIndex={-1}
          data-ocid="orders.delivery.qr_modal"
        >
          <div
            className="bg-card rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between w-full">
              <p className="font-semibold text-foreground text-sm">
                {language === "vi" ? "Mã QR địa chỉ" : "Address QR Code"}
              </p>
              <button
                type="button"
                onClick={() => setExpandedQr(null)}
                data-ocid="orders.delivery.qr_modal.close_button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={expandedQr}
              alt="QR Code"
              className="w-48 h-48 rounded-lg"
            />
            <p className="text-xs text-muted-foreground text-center break-all">
              {expandedQr
                .replace(
                  /^https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=\d+x\d+&data=/,
                  "",
                )
                .split("?q=")
                .pop()
                ?.replace(/%20/g, " ")
                .replace(/%2C/g, ",") ?? ""}
            </p>
          </div>
        </div>
      )}

      {sortedOrders.map((order, i) => {
        const isDelivered = order.status === OrderStatus.Completed;
        const orderNum = String(order.id).padStart(4, "0").slice(-4);
        const orderTotal = order.items.reduce(
          (s, it) => s + it.price * it.quantity,
          0n,
        );

        // Build QR code URL for customer address
        const qrAddress = order.deliveryAddress ?? "";
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(qrAddress)}`;
        const qrSrc = qrAddress
          ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(mapsUrl)}`
          : null;
        const qrExpanded = qrAddress
          ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mapsUrl)}`
          : null;

        return (
          <div
            key={String(order.id)}
            data-ocid={`orders.delivery.item.${i + 1}`}
            className={`rounded-xl border overflow-hidden transition-all duration-200 ${
              isDelivered
                ? "border-border bg-muted/30 opacity-60"
                : "border-orange-300 bg-orange-50"
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 border-b ${
                isDelivered
                  ? "bg-muted/50 border-border"
                  : "bg-orange-100 border-orange-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">
                  #{orderNum}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${
                    isDelivered
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-orange-100 text-orange-800 border-orange-300"
                  }`}
                >
                  {isDelivered ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : (
                    <Truck className="h-2.5 w-2.5" />
                  )}
                  {isDelivered
                    ? language === "vi"
                      ? "Đã giao"
                      : "Delivered"
                    : language === "vi"
                      ? "Chờ giao"
                      : "Pending delivery"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {timeAgo(order.createdAt, language)}
                </span>
                <span className="font-bold text-foreground">
                  {formatPrice(orderTotal)}
                </span>
              </div>
            </div>

            {/* Customer info + QR + actions */}
            <div className="px-4 pt-3 pb-2 border-b border-border/50">
              <div className="flex items-start gap-3">
                {/* Info block */}
                <div className="flex-1 min-w-0 space-y-1">
                  {order.customerName && (
                    <p className="text-xs text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {order.customerName}
                      </span>
                    </p>
                  )}
                  {/* MST / Bán cho người tiêu dùng */}
                  {order.vatInfo?.taxCode?.[0] ? (
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">
                      MST: {order.vatInfo.taxCode[0]} —{" "}
                      {order.vatInfo.buyerName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bán cho người tiêu dùng
                    </p>
                  )}
                  {order.customerPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${order.customerPhone}`}
                        data-ocid={`orders.delivery.call_button.${i + 1}`}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        aria-label={
                          language === "vi" ? "Gọi khách" : "Call customer"
                        }
                      >
                        {order.customerPhone}
                      </a>
                    </div>
                  )}
                  {order.deliveryAddress && (
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground break-words">
                        {order.deliveryAddress}
                      </p>
                    </div>
                  )}
                  {/* Copy address button */}
                  {order.deliveryAddress && (
                    <button
                      type="button"
                      data-ocid={`orders.delivery.copy_address.${i + 1}`}
                      onClick={() =>
                        handleCopyAddress(
                          order.deliveryAddress ?? "",
                          String(order.id),
                        )
                      }
                      className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2 py-1 hover:bg-secondary/50 transition-colors mt-1"
                    >
                      <Copy className="h-3 w-3" />
                      {copyToastId === String(order.id)
                        ? language === "vi"
                          ? "Đã copy!"
                          : "Copied!"
                        : language === "vi"
                          ? "Copy địa chỉ"
                          : "Copy address"}
                    </button>
                  )}
                </div>

                {/* QR code */}
                {qrSrc && (
                  <button
                    type="button"
                    data-ocid={`orders.delivery.qr_button.${i + 1}`}
                    onClick={() => setExpandedQr(qrExpanded)}
                    className="shrink-0 rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors"
                    title={
                      language === "vi" ? "Phóng to mã QR" : "Expand QR code"
                    }
                  >
                    <img src={qrSrc} alt="QR" className="w-16 h-16 block" />
                  </button>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="px-4 py-3 space-y-1">
              {order.items.map((it, j) => (
                <div
                  key={`${String(it.menuItemId)}-${j}`}
                  className="flex justify-between text-sm"
                >
                  <span className="text-foreground">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPrice(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="px-4 pb-4">
              {isDelivered ? (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    {language === "vi" ? "Đã giao" : "Delivered"}
                  </span>
                </div>
              ) : order.status === OrderStatus.Ready ? (
                <Button
                  type="button"
                  data-ocid={`orders.delivery.mark_delivered.${i + 1}`}
                  onClick={() =>
                    updateStatus.mutate({
                      orderId: order.id,
                      status: OrderStatus.Completed,
                      restaurantId,
                    })
                  }
                  disabled={updateStatus.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold gap-2"
                >
                  {updateStatus.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  {language === "vi" ? "Giao hàng" : "Deliver"}
                </Button>
              ) : (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground border border-border text-xs font-medium">
                    {order.status === OrderStatus.Pending
                      ? language === "vi"
                        ? "Chờ xử lý"
                        : "Pending"
                      : language === "vi"
                        ? "Đang chuẩn bị"
                        : "Preparing"}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Orders Page ──────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { restaurantId: restaurantIdStr } = routeApi.useParams();
  const restaurantId = BigInt(restaurantIdStr);
  const { t, language } = useLanguage();

  const [tab, setTab] = useState<"kitchen" | "waiter" | "cashier" | "delivery">(
    "kitchen",
  );
  const [kitchenMode, setKitchenMode] = useState(false);

  const activeQuery = useActiveOrders(restaurantId);
  const allQuery = useOrders(restaurantId);
  const deliveryActiveQuery = useListDeliveryOrders(restaurantId);
  const clearCompleted = useClearCompletedOrders();

  const activeOrders = activeQuery.data ?? [];
  const allOrders = allQuery.data ?? [];

  // Active dine-in orders (from activeOrders)
  const dineInActiveOrders = activeOrders.filter(
    (o) =>
      o.orderType === OrderType.TableOrder ||
      (o.orderType as string) === undefined,
  );

  // Active delivery orders (from dedicated delivery query, only non-completed)
  const deliveryActiveOrders = (deliveryActiveQuery.data ?? []).filter(
    (o) => o.status !== OrderStatus.Completed,
  );

  // Combined for kitchen — only Pending and Preparing (Ready orders have moved to Waiter/Delivery tab)
  const allKitchenOrders = [...dineInActiveOrders, ...deliveryActiveOrders];

  const pendingOrders = allKitchenOrders.filter(
    (o) => o.status === OrderStatus.Pending,
  );
  const preparingOrders = allKitchenOrders.filter(
    (o) => o.status === OrderStatus.Preparing,
  );
  const readyOrders = allKitchenOrders.filter(
    (o) => o.status === OrderStatus.Ready,
  );

  // Kitchen flat list: only Pending + Preparing, sorted by createdAt asc, TableOrder before DeliveryOrder at same time
  const kitchenOrders = [
    ...allKitchenOrders.filter(
      (o) =>
        o.status === OrderStatus.Pending || o.status === OrderStatus.Preparing,
    ),
  ].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return Number(a.createdAt - b.createdAt);
    // Same time: TableOrder before DeliveryOrder
    const aIsTable = a.orderType === OrderType.TableOrder ? 0 : 1;
    const bIsTable = b.orderType === OrderType.TableOrder ? 0 : 1;
    return aIsTable - bIsTable;
  });

  // For waiter tab — dine-in orders with Ready status.
  // NOTE: useActiveOrders (listActiveOrdersByRestaurant) only returns Pending/Preparing,
  // so Ready orders must be sourced from allOrders (listOrdersByRestaurant) which
  // includes all statuses for TableOrder and paid DeliveryOrders.
  const dineInReadyOrders = allOrders.filter(
    (o) =>
      (o.orderType === OrderType.TableOrder ||
        (o.orderType as string) === undefined) &&
      o.status === OrderStatus.Ready,
  );

  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching || deliveryActiveQuery.isFetching;

  const handleRefresh = () => {
    activeQuery.refetch();
    allQuery.refetch();
    deliveryActiveQuery.refetch();
  };

  const handleClearCompleted = () => {
    clearCompleted.mutate(restaurantId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && kitchenMode) setKitchenMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kitchenMode]);

  const statsData = [
    {
      label: t.orders.statusPending,
      count: pendingOrders.length,
      dot: "bg-amber-400",
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      ocid: "orders.pending_count",
    },
    {
      label: t.orders.statusPreparing,
      count: preparingOrders.length,
      dot: "bg-blue-500",
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      ocid: "orders.preparing_count",
    },
    {
      label: t.orders.statusReady,
      count: readyOrders.length,
      dot: "bg-green-500",
      bg: "bg-green-50 border-green-200",
      text: "text-green-800",
      ocid: "orders.ready_count",
    },
  ];

  const pageContent = (
    <div
      data-ocid="orders.page"
      className={kitchenMode ? "min-h-screen bg-background flex flex-col" : ""}
    >
      {/* ── Header bar ── */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 mb-6 ${
          kitchenMode ? "px-6 pt-6" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          {kitchenMode && (
            <div className="flex items-center gap-2 mr-2">
              <ChefHat className="h-7 w-7 text-primary" />
              <span className="font-display text-2xl italic text-primary">
                Kitchen View
              </span>
            </div>
          )}
          {!kitchenMode && (
            <h2
              data-ocid="orders.heading"
              className="font-display text-2xl text-foreground"
            >
              {t.orders.title}
            </h2>
          )}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 border border-green-200 text-xs font-medium text-green-700">
            <span
              className={`w-1.5 h-1.5 rounded-full bg-green-500 ${
                isFetching ? "animate-pulse" : ""
              }`}
            />
            {isFetching ? t.common.loading : "Live"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            data-ocid="orders.refresh_button"
            className="gap-2"
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {t.common.refresh}
          </Button>
          <Button
            type="button"
            variant={kitchenMode ? "default" : "outline"}
            size="sm"
            onClick={() => setKitchenMode(!kitchenMode)}
            data-ocid="orders.kitchen_mode_toggle"
            className="gap-2"
          >
            {kitchenMode ? (
              <>
                <Minimize2 className="h-4 w-4" />
                {language === "vi" ? "Thoát bếp" : "Exit Kitchen"}
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                {language === "vi" ? "Chế độ bếp" : "Kitchen Mode"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div
        className={`grid grid-cols-3 gap-3 mb-6 ${kitchenMode ? "px-6" : ""}`}
      >
        {statsData.map((s) => (
          <div
            key={s.label}
            data-ocid={s.ocid}
            className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${s.bg}`}
          >
            <span className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} />
            <div>
              <p
                className={`font-bold tabular-nums ${
                  kitchenMode ? "text-3xl" : "text-2xl"
                } ${s.text}`}
              >
                {s.count}
              </p>
              <p
                className={`text-muted-foreground ${
                  kitchenMode ? "text-sm" : "text-xs"
                }`}
              >
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div
        className={`flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit ${
          kitchenMode ? "mx-6" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setTab("kitchen")}
          data-ocid="orders.kitchen_tab"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
            tab === "kitchen"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.orders.kitchenTab}
          {kitchenOrders.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
              {kitchenOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("waiter")}
          data-ocid="orders.waiter_tab"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
            tab === "waiter"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.orders.waiterTab}
          {dineInReadyOrders.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-green-600 text-white text-xs">
              {dineInReadyOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("cashier")}
          data-ocid="orders.cashier_tab"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
            tab === "cashier"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.orders.cashierTab}
          {allOrders.filter(
            (o) =>
              (o.orderType === OrderType.TableOrder ||
                (o.orderType as string) === undefined) &&
              o.status === OrderStatus.Completed &&
              o.paymentStatus === PaymentStatus.Unpaid,
          ).length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">
              {
                allOrders.filter(
                  (o) =>
                    (o.orderType === OrderType.TableOrder ||
                      (o.orderType as string) === undefined) &&
                    o.status === OrderStatus.Completed &&
                    o.paymentStatus === PaymentStatus.Unpaid,
                ).length
              }
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("delivery")}
          data-ocid="orders.delivery_tab"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
            tab === "delivery"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.orders.deliveryOrdersTab}
        </button>
      </div>

      {/* ── Content ── */}
      <div className={kitchenMode ? "flex-1 px-6 pb-6" : ""}>
        {tab === "kitchen" && (
          <div>
            {isLoading ? (
              <div
                data-ocid="orders.loading_state"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="rounded-xl border border-border bg-card h-48 animate-pulse"
                  />
                ))}
              </div>
            ) : kitchenOrders.length === 0 ? (
              <EmptyActiveOrders kitchenMode={kitchenMode} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {kitchenOrders.map((order, i) => (
                  <OrderCard
                    key={String(order.id)}
                    order={order}
                    restaurantId={restaurantId}
                    kitchenMode={kitchenMode}
                    index={i + 1}
                    showTypeBadge
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "waiter" && (
          <WaiterTab
            readyOrders={dineInReadyOrders}
            restaurantId={restaurantId}
            t={t}
            language={language}
          />
        )}

        {tab === "cashier" && (
          <CashierTab
            allOrders={allOrders}
            onClear={handleClearCompleted}
            clearPending={clearCompleted.isPending}
            t={t}
            language={language}
          />
        )}

        {tab === "delivery" && (
          <DeliveryOrdersManagementTab
            restaurantId={restaurantId}
            language={language}
          />
        )}
      </div>
    </div>
  );

  if (kitchenMode) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-auto bg-background"
        data-ocid="orders.kitchen_mode_overlay"
      >
        {pageContent}
      </div>
    );
  }

  return (
    <AdminLayout restaurantId={restaurantIdStr}>{pageContent}</AdminLayout>
  );
}
