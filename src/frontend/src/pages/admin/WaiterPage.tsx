import { AdminLayout } from "@/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActiveOrders,
  useListDeliveryOrders,
  useUpdateOrderStatus,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { OrderStatus } from "@/types";
import type { OrderPublic, RestaurantId } from "@/types";
import { getRouteApi } from "@tanstack/react-router";
import { CheckCircle2, Clock, RefreshCw, Truck } from "lucide-react";

const routeApi = getRouteApi("/admin/restaurant/$restaurantId/orders");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

interface WaiterOrderCardProps {
  order: OrderPublic;
  restaurantId: RestaurantId;
  index: number;
}

function WaiterOrderCard({ order, restaurantId, index }: WaiterOrderCardProps) {
  const updateStatus = useUpdateOrderStatus();
  const { language } = useLanguage();

  const handleDeliver = () => {
    updateStatus.mutate({
      orderId: order.id,
      status: OrderStatus.Completed,
      restaurantId,
    });
  };

  const orderNum = String(order.id).padStart(4, "0").slice(-4);

  return (
    <div
      data-ocid={`waiter.order_card.${index}`}
      className="rounded-xl border-l-4 border-l-green-500 border border-border bg-card shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-foreground">
            #{orderNum}
          </span>
          <Badge className="bg-green-100 text-green-800 border-green-300 border text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
            {language === "vi" ? "Sẵn sàng" : "Ready"}
          </Badge>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-lg text-foreground">
            {language === "vi" ? "Bàn" : "Table"} {order.tableIdentifier}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt, language)} · {formatTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-1.5">
        {order.items.map((item, i) => (
          <div
            key={`${String(item.menuItemId)}-${i}`}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-base tabular-nums shrink-0 text-primary w-6">
                ×{String(item.quantity)}
              </span>
              <p className="text-sm font-medium text-foreground truncate">
                {item.name}
              </p>
            </div>
            {item.itemNote && (
              <p className="text-xs text-muted-foreground italic shrink-0 max-w-[40%] truncate">
                {item.itemNote}
              </p>
            )}
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-900 font-medium">
              📝 {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="px-4 pb-4 pt-2">
        <Button
          type="button"
          data-ocid={`waiter.deliver_button.${index}`}
          onClick={handleDeliver}
          disabled={updateStatus.isPending}
          className="w-full h-11 font-semibold bg-green-600 hover:bg-green-700 text-white border-green-700 gap-2"
        >
          {updateStatus.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {language === "vi" ? "Đã mang ra" : "Delivered"}
        </Button>
      </div>
    </div>
  );
}

// ─── Delivery Ready Card ────────────────────────────────────────────────────

interface DeliveryReadyCardProps {
  order: OrderPublic;
  restaurantId: RestaurantId;
  index: number;
  language: "vi" | "en";
}

function DeliveryReadyCard({
  order,
  restaurantId,
  index,
  language,
}: DeliveryReadyCardProps) {
  const updateStatus = useUpdateOrderStatus();
  const orderNum = String(order.id).padStart(4, "0").slice(-4);

  return (
    <div
      data-ocid={`waiter.delivery_card.${index}`}
      className="rounded-xl border-l-4 border-l-primary border border-border bg-card shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-foreground">
            #{orderNum}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
            <Truck className="h-3 w-3" />
            {language === "vi" ? "Giao hàng" : "Delivery"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(order.createdAt, language)}
        </p>
      </div>
      {(order.customerName || order.customerPhone) && (
        <div className="px-4 pb-2 text-xs text-muted-foreground space-y-0.5">
          {order.customerName && (
            <p className="font-medium text-foreground">{order.customerName}</p>
          )}
          {order.customerPhone && <p>{order.customerPhone}</p>}
          {order.deliveryAddress && (
            <p className="truncate">{order.deliveryAddress}</p>
          )}
        </div>
      )}
      <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-1.5">
        {order.items.map((item, i) => (
          <div
            key={`${String(item.menuItemId)}-${i}`}
            className="flex items-center gap-2"
          >
            <span className="font-bold text-base tabular-nums shrink-0 text-primary w-6">
              ×{String(item.quantity)}
            </span>
            <p className="text-sm font-medium text-foreground truncate">
              {item.name}
            </p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4 pt-2">
        <Button
          type="button"
          data-ocid={`waiter.delivery_deliver_button.${index}`}
          onClick={() =>
            updateStatus.mutate({
              orderId: order.id,
              status: OrderStatus.Completed,
              restaurantId,
            })
          }
          disabled={updateStatus.isPending}
          className="w-full h-11 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          {updateStatus.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {language === "vi" ? "Đã giao" : "Delivered"}
        </Button>
      </div>
    </div>
  );
}

// ─── Grouped by Table ─────────────────────────────────────────────────────────

interface TableGroupProps {
  tableIdentifier: string;
  orders: OrderPublic[];
  restaurantId: RestaurantId;
  globalIndex: number;
}

function TableGroup({
  tableIdentifier,
  orders,
  restaurantId,
  globalIndex,
}: TableGroupProps) {
  const { language } = useLanguage();
  return (
    <div
      data-ocid={`waiter.table_group.${tableIdentifier}`}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-xs">
            {tableIdentifier}
          </span>
        </div>
        <h3 className="font-semibold text-foreground text-sm">
          {language === "vi" ? "Bàn" : "Table"} {tableIdentifier}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {orders.length} {language === "vi" ? "đơn" : "order"}
          {orders.length !== 1 && language === "en" ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {orders.map((order, i) => (
          <WaiterOrderCard
            key={String(order.id)}
            order={order}
            restaurantId={restaurantId}
            index={globalIndex + i + 1}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { language } = useLanguage();
  return (
    <div
      data-ocid="waiter.empty_state"
      className="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
        <Truck className="h-8 w-8 text-green-400" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-lg">
          {language === "vi"
            ? "Không có đơn nào sẵn sàng"
            : "No orders ready for delivery"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "vi"
            ? "Các đơn sẵn sàng sẽ hiện ở đây. Tự động làm mới mỗi 10 giây."
            : "Ready orders will appear here. Auto-refreshes every 10 seconds."}
        </p>
      </div>
    </div>
  );
}

// ─── Waiter Page ──────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const { restaurantId: restaurantIdStr } = routeApi.useParams();
  const restaurantId = BigInt(restaurantIdStr);
  const { language } = useLanguage();

  const { data, isLoading, isFetching, refetch } =
    useActiveOrders(restaurantId);

  const readyOrders = (data ?? []).filter(
    (o) =>
      o.status === OrderStatus.Ready &&
      (!(o as OrderPublic & { orderType?: string }).orderType ||
        (o as OrderPublic & { orderType?: string }).orderType === "TableOrder"),
  );

  const deliveryQuery = useListDeliveryOrders(restaurantId);
  const readyDeliveries = (deliveryQuery.data ?? []).filter(
    (o) => o.status === OrderStatus.Ready,
  );

  // Group by table
  const byTable = readyOrders.reduce<Record<string, OrderPublic[]>>(
    (acc, order) => {
      const key = order.tableIdentifier;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    },
    {},
  );

  const tableEntries = Object.entries(byTable).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  let runningIndex = 0;

  return (
    <AdminLayout restaurantId={restaurantIdStr}>
      <div data-ocid="waiter.page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              {language === "vi" ? "Chạy bàn" : "Delivery"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "vi"
                ? "Các đơn sẵn sàng để mang ra cho khách"
                : "Orders ready to be served to guests"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 border border-green-200 text-xs font-medium text-green-700"
              data-ocid="waiter.live_indicator"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full bg-green-500 ${
                  isFetching ? "animate-pulse" : ""
                }`}
              />
              {isFetching
                ? language === "vi"
                  ? "Đang tải..."
                  : "Loading..."
                : "Live"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-ocid="waiter.refresh_button"
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              {language === "vi" ? "Làm mới" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        {!isLoading && readyOrders.length > 0 && (
          <div
            data-ocid="waiter.summary_bar"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3"
          >
            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="font-bold text-2xl text-green-800 tabular-nums">
                {readyOrders.length}
              </p>
              <p className="text-xs text-green-700">
                {language === "vi"
                  ? `đơn cần mang ra — ${tableEntries.length} bàn`
                  : `order${readyOrders.length !== 1 ? "s" : ""} to deliver — ${
                      tableEntries.length
                    } table${tableEntries.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div
            data-ocid="waiter.loading_state"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-44 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && readyOrders.length === 0 && <EmptyState />}

        {/* Grouped dine-in orders */}
        {!isLoading && tableEntries.length > 0 && (
          <div className="space-y-8">
            {tableEntries.map(([table, orders]) => {
              const startIndex = runningIndex;
              runningIndex += orders.length;
              return (
                <TableGroup
                  key={table}
                  tableIdentifier={table}
                  orders={orders}
                  restaurantId={restaurantId}
                  globalIndex={startIndex}
                />
              );
            })}
          </div>
        )}

        {/* Ready delivery orders */}
        {!isLoading && readyDeliveries.length > 0 && (
          <div data-ocid="waiter.delivery_section">
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="h-px flex-1 bg-border" />
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 px-2">
                <Truck className="h-4 w-4 text-primary" />
                {language === "vi"
                  ? "Đơn giao hàng sẵn sàng"
                  : "Ready Deliveries"}
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                  {readyDeliveries.length}
                </span>
              </h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {readyDeliveries.map((order, i) => (
                <DeliveryReadyCard
                  key={String(order.id)}
                  order={order}
                  restaurantId={restaurantId}
                  index={i + 1}
                  language={language}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
