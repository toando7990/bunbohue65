import { EnterprisePermission, OrderStatus } from "@/backend";
import type {
  OrderPublic,
  RestaurantPublic,
  ShipperBookingResult,
} from "@/backend";
import { EnterpriseDevicePinGuard } from "@/components/EnterpriseDevicePinGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  formatPrice,
  getTodayDateString,
  useApproveDeliveryOrder,
  useBookAhamoveDirect,
  useBookShipper,
  useGetBusinessProfileInfo,
  useGetMyEnterprisePermissions,
  useGetMyRestaurantFilter,
  useIsEnterpriseDeliveryStaff,
  useListDeliveryOrdersEnterprise,
  usePublicRestaurants,
  useRejectDeliveryOrder,
  useSaveMyRestaurantFilter,
  useUpdateOrderStatus,
} from "@/hooks/useBackend";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import {
  Check,
  Clock,
  Copy,
  Filter,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  ShieldX,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── QR Image ─────────────────────────────────────────────────────────────────

function QrImage({ data, size = 200 }: { data: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  return (
    <img
      src={src}
      alt="QR mã địa chỉ"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function statusLabel(status: OrderStatus): string {
  const map: Partial<Record<OrderStatus, string>> = {
    [OrderStatus.Pending]: "Chờ xử lý",
    [OrderStatus.Preparing]: "Đang chuẩn bị",
    [OrderStatus.Ready]: "Sẵn sàng",
    [OrderStatus.Delivered]: "Đã giao",
    [OrderStatus.Completed]: "Hoàn thành",
    [OrderStatus.PendingApproval]: "Chờ duyệt",
    [OrderStatus.FindingDriver]: "Đang tìm tài xế",
    [OrderStatus.DispatchCenter]: "Trung tâm điều phối",
    [OrderStatus.WaitingDriver]: "Chờ tài xế",
    [OrderStatus.WaitingDriverPayment]: "Chờ tài xế thanh toán",
    [OrderStatus.PaymentPending]: "Chờ thanh toán",
    [OrderStatus.Cancelled]: "Đã hủy",
  };
  return map[status] ?? status;
}

function statusClass(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending:
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case OrderStatus.Preparing:
      return "bg-orange-100 text-orange-800 border-orange-300";
    case OrderStatus.Ready:
      return "bg-green-100 text-green-800 border-green-300";
    case OrderStatus.Delivered:
    case OrderStatus.Completed:
      return "bg-muted text-muted-foreground border-border";
    case OrderStatus.FindingDriver:
      return "bg-amber-100 text-amber-800 border-amber-300";
    case OrderStatus.DispatchCenter:
      return "bg-red-100 text-red-800 border-red-300";
    case OrderStatus.WaitingDriverPayment:
      return "bg-amber-100 text-amber-800 border-amber-300";
    case OrderStatus.WaitingDriver:
      return "bg-amber-100 text-amber-800 border-amber-300";
    case OrderStatus.PaymentPending:
      return "bg-amber-100 text-amber-800 border-amber-300";
    case OrderStatus.Cancelled:
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function EnterpriseOrderCard({
  order,
  restaurantName,
  index,
}: {
  order: OrderPublic;
  restaurantName: string;
  index: number;
}) {
  const updateStatus = useUpdateOrderStatus();
  const bookDriver = useBookAhamoveDirect();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    if (bookDriver.isSuccess) {
      const ahamoveOrderId = bookDriver.data?.ahamoveOrderId;
      toast.success("Đã đặt tài xế AhaMove thành công", {
        description: ahamoveOrderId
          ? `Mã đơn AhaMove: ${ahamoveOrderId}`
          : "Đơn sẽ chuyển sang trạng thái đang tìm tài xế.",
      });
    }
  }, [bookDriver.isSuccess, bookDriver.data]);

  useEffect(() => {
    if (bookDriver.isError) {
      const msg =
        bookDriver.error instanceof Error
          ? bookDriver.error.message
          : "Không thể đặt tài xế. Vui lòng thử lại.";
      toast.error("Đặt tài xế thất bại", { description: msg });
    }
  }, [bookDriver.isError, bookDriver.error]);

  const orderNum = String(order.id).padStart(4, "0").slice(-4);
  const total = order.items.reduce(
    (s, i) => s + i.price * BigInt(i.quantity),
    0n,
  );
  const address = order.deliveryAddress ?? "";
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  const isDelivered =
    order.status === OrderStatus.Delivered ||
    order.status === OrderStatus.Completed;
  const canDeliver = order.status === OrderStatus.Ready;
  const isWaitingDriver = order.status === OrderStatus.WaitingDriver;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDeliver = async () => {
    await updateStatus.mutateAsync({
      orderId: order.id,
      status: OrderStatus.Delivered,
      restaurantId: order.restaurantId,
    });
    setDelivered(true);
    setTimeout(() => setDelivered(false), 3000);
  };

  return (
    <div
      data-ocid={`enterprise_delivery.order_card.${index}`}
      className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-opacity ${
        isDelivered ? "opacity-60" : ""
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3 flex items-center justify-between border-b border-border/50 ${
          isDelivered
            ? "bg-muted/30"
            : canDeliver
              ? "bg-green-50 dark:bg-green-950/20"
              : "bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-lg">#{orderNum}</span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusClass(
              order.status,
            )}`}
          >
            {statusLabel(order.status)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {restaurantName}
          </span>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          {timeAgo(order.createdAt)} · {formatTime(order.createdAt)}
        </span>
      </div>

      {/* Customer info */}
      <div className="px-5 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-base">
              {order.customerName ?? "—"}
            </p>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                data-ocid={`enterprise_delivery.call_button.${index}`}
              >
                <Phone className="h-3.5 w-3.5" />
                {order.customerPhone}
              </a>
            )}
          </div>
          <span className="text-base font-bold text-primary">
            {formatPrice(total)}
          </span>
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-foreground flex-1 min-w-0 break-words">
              {address}
            </p>
          </div>
        )}

        {/* Address actions */}
        {address && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors"
              data-ocid={`enterprise_delivery.qr_button.${index}`}
            >
              <MapPin className="h-4 w-4" />
              Mã QR địa chỉ
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors ${
                copied
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-border bg-background hover:bg-muted"
              }`}
              data-ocid={`enterprise_delivery.copy_address_button.${index}`}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Đã copy" : "Copy địa chỉ"}
            </button>
          </div>
        )}

        {/* Items */}
        <div className="space-y-1 pt-1">
          {order.items.map((item) => (
            <div
              key={`${String(item.menuItemId)}-${item.name}`}
              className="flex justify-between text-sm text-muted-foreground"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatPrice(item.price * BigInt(item.quantity))}</span>
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-900 font-medium">
              📝 {order.notes}
            </p>
          </div>
        )}
        {order.shipperName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="h-3 w-3 shrink-0" />
            <span>
              {order.shipperName}
              {order.shipperPhone ? ` · ${order.shipperPhone}` : ""}
            </span>
          </div>
        )}

        {/* Book driver for COD WaitingDriver orders */}
        {isWaitingDriver && (
          <button
            type="button"
            onClick={() => bookDriver.mutate(order.id)}
            disabled={bookDriver.isPending}
            className="w-full h-10 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
            data-ocid={`enterprise_delivery.book_driver_button.${index}`}
          >
            {bookDriver.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            Đặt tài xế AhaMove
          </button>
        )}
      </div>

      {/* Action */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={handleDeliver}
          disabled={!canDeliver || updateStatus.isPending}
          className={`w-full h-12 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
            delivered
              ? "bg-green-600 text-white"
              : canDeliver
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
          data-ocid={`enterprise_delivery.deliver_button.${index}`}
        >
          {updateStatus.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : delivered ? (
            <Check className="h-4 w-4" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
          {delivered
            ? "Đã xác nhận giao!"
            : isDelivered
              ? "Đã giao hàng"
              : "Giao hàng"}
        </button>
      </div>

      {/* QR Modal */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent data-ocid={`enterprise_delivery.qr_dialog.${index}`}>
          <DialogHeader>
            <DialogTitle>Mã QR địa chỉ giao hàng</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <QrImage data={mapsUrl} size={220} />
            <p className="text-sm text-center text-muted-foreground break-words max-w-xs">
              {address}
            </p>
            <p className="text-xs text-muted-foreground">
              Quét để mở Google Maps chỉ đường
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Restaurant Filter Panel ──────────────────────────────────────────────────

function RestaurantFilterPanel({
  open,
  onClose,
  restaurants,
  selectedIds,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  restaurants: RestaurantPublic[];
  selectedIds: Set<string>;
  onSave: (ids: bigint[] | null) => void;
  isSaving: boolean;
}) {
  const [local, setLocal] = useState<Set<string>>(selectedIds);
  const [allSelected, setAllSelected] = useState(selectedIds.size === 0);
  const businessProfileInfo = useGetBusinessProfileInfo();
  const businessProfileData = businessProfileInfo.data;

  useEffect(() => {
    setLocal(selectedIds);
    setAllSelected(selectedIds.size === 0);
  }, [selectedIds]);

  const toggle = (id: string) => {
    setAllSelected(false);
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setAllSelected(true);
    setLocal(new Set());
  };

  const handleSave = () => {
    if (allSelected || local.size === 0) {
      onSave(null); // null = all restaurants
    } else {
      onSave(
        restaurants.filter((r) => local.has(String(r.id))).map((r) => r.id),
      );
    }
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        data-ocid="enterprise_delivery.filter_panel"
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-base">Chọn nhà hàng theo dõi</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
            data-ocid="enterprise_delivery.filter_close_button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
          <label
            htmlFor="filter-all"
            className="flex items-center gap-3 cursor-pointer"
          >
            <Checkbox
              id="filter-all"
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              data-ocid="enterprise_delivery.filter_all_checkbox"
            />
            <span className="text-sm font-medium">Tất cả nhà hàng</span>
          </label>
          {restaurants.map((r) => (
            <label
              key={String(r.id)}
              htmlFor={`filter-r-${r.id}`}
              className="flex items-center gap-3 cursor-pointer"
            >
              <Checkbox
                id={`filter-r-${r.id}`}
                checked={!allSelected && local.has(String(r.id))}
                onCheckedChange={() => toggle(String(r.id))}
                data-ocid={`enterprise_delivery.filter_restaurant_checkbox.${r.id}`}
              />
              <span className="text-sm">
                {r.brand1Name ?? businessProfileData?.businessName ?? r.name}
              </span>
            </label>
          ))}
        </div>
        <div className="p-5 border-t border-border flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            data-ocid="enterprise_delivery.filter_cancel_button"
          >
            Hủy
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving}
            data-ocid="enterprise_delivery.filter_save_button"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Lưu lựa chọn"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main enterprise interface ─────────────────────────────────────────────────

function EnterpriseDeliveryContent() {
  const [showFilter, setShowFilter] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{
    orderId: bigint;
    restaurantId: bigint;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bookingStates, setBookingStates] = useState<
    Record<
      string,
      {
        loading: boolean;
        result: ShipperBookingResult | null;
        error: string | null;
      }
    >
  >({});
  const saveFilter = useSaveMyRestaurantFilter();
  const approveDelivery = useApproveDeliveryOrder();
  const rejectDelivery = useRejectDeliveryOrder();
  const bookShipperMutation = useBookShipper();
  const { data: filterResult } = useGetMyRestaurantFilter();
  const { data: allRestaurants = [] } = usePublicRestaurants();
  const { logout } = useAuthContext();
  const businessProfileInfo = useGetBusinessProfileInfo();
  const businessProfileData = businessProfileInfo.data;

  const businessName =
    businessProfileData?.businessName ||
    (allRestaurants as RestaurantPublic[])[0]?.brand1Name ||
    "Trung tâm giao hàng";

  const savedFilterIds: Set<string> = useMemo(() => {
    if (!filterResult || filterResult.__kind__ !== "ok") return new Set();
    if (!filterResult.ok) return new Set(); // null = all
    return new Set(filterResult.ok.map((id) => String(id)));
  }, [filterResult]);

  const {
    data: ordersResult,
    isFetching,
    refetch,
  } = useListDeliveryOrdersEnterprise(getTodayDateString());

  const orders: OrderPublic[] = useMemo(() => {
    if (!ordersResult || ordersResult.__kind__ !== "ok") return [];
    return ordersResult.ok;
  }, [ordersResult]);

  // Filter by selected restaurants
  const filteredOrders = useMemo(() => {
    if (savedFilterIds.size === 0) return orders;
    return orders.filter((o) => savedFilterIds.has(String(o.restaurantId)));
  }, [orders, savedFilterIds]);

  // Sort: PendingApproval first, then undelivered (Ready > Preparing > Pending), then delivered
  const sortedOrders = useMemo(() => {
    const priority: Partial<Record<OrderStatus, number>> = {
      [OrderStatus.PendingApproval]: 0,
      [OrderStatus.FindingDriver]: 1,
      [OrderStatus.DispatchCenter]: 2,
      [OrderStatus.WaitingDriverPayment]: 1.5,
      [OrderStatus.WaitingDriver]: 2,
      [OrderStatus.Ready]: 3,
      [OrderStatus.Preparing]: 4,
      [OrderStatus.Pending]: 5,
      [OrderStatus.Delivered]: 6,
      [OrderStatus.Completed]: 7,
    };
    return [...filteredOrders].sort((a, b) => {
      const pd = (priority[a.status] ?? 6) - (priority[b.status] ?? 6);
      if (pd !== 0) return pd;
      return Number(b.createdAt - a.createdAt);
    });
  }, [filteredOrders]);

  const restaurantMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRestaurants) {
      m.set(String(r.id), r.brand1Name ?? r.businessName ?? r.name);
    }
    return m;
  }, [allRestaurants]);

  const pendingApprovalOrders = useMemo(
    () => sortedOrders.filter((o) => o.status === OrderStatus.PendingApproval),
    [sortedOrders],
  );

  const regularOrders = useMemo(
    () => sortedOrders.filter((o) => o.status !== OrderStatus.PendingApproval),
    [sortedOrders],
  );

  const undeliveredCount = regularOrders.filter(
    (o) =>
      o.status !== OrderStatus.Delivered &&
      o.status !== OrderStatus.Completed &&
      o.status !== OrderStatus.WaitingDriverPayment &&
      o.status !== OrderStatus.WaitingDriver,
  ).length;

  const handleSaveFilter = async (ids: bigint[] | null) => {
    await saveFilter.mutateAsync(ids ?? []);
    setShowFilter(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-5 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{businessName}</h1>
            <p className="text-xs text-muted-foreground">
              {undeliveredCount} chưa giao · {regularOrders.length} tổng
              {pendingApprovalOrders.length > 0 && (
                <span className="ml-1 text-red-600 font-semibold">
                  · {pendingApprovalOrders.length} chờ duyệt
                </span>
              )}
              {savedFilterIds.size > 0 && ` · ${savedFilterIds.size} nhà hàng`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilter(true)}
            className="h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-sm flex items-center gap-1.5 transition-colors"
            data-ocid="enterprise_delivery.filter_button"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Chọn nhà hàng theo dõi</span>
          </button>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isFetching
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
            data-ocid="enterprise_delivery.live_indicator"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFetching ? "bg-amber-400 animate-pulse" : "bg-green-500"
              }`}
            />
            {isFetching ? "Đang tải..." : "Live"}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            data-ocid="enterprise_delivery.refresh_button"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted text-sm transition-colors"
            data-ocid="enterprise_delivery.logout_button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Order list */}
      <main className="p-5 max-w-full">
        {sortedOrders.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-32 gap-4"
            data-ocid="enterprise_delivery.empty_state"
          >
            <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center">
              <Truck className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-xl font-semibold text-muted-foreground">
              Không có đơn giao hàng nào từ nhà hàng được cấu hình điều phối tại
              trung tâm
            </p>
            <p className="text-sm text-muted-foreground">
              Tự động làm mới mỗi 10 giây
            </p>
          </div>
        ) : (
          <>
            {/* Pending Approval Section */}
            {pendingApprovalOrders.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-bold text-red-600">Chờ duyệt</h2>
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {pendingApprovalOrders.length}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {pendingApprovalOrders.map((order, idx) => (
                    <div
                      key={String(order.id)}
                      data-ocid={`enterprise_delivery.pending_card.${idx + 1}`}
                      className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {order.customerName ?? "Khách hàng"}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                            {restaurantMap.get(String(order.restaurantId)) ??
                              "Nhà hàng"}
                          </span>
                          {order.customerPhone && (
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="flex items-center gap-1 text-blue-600 text-sm mt-1"
                              data-ocid={`enterprise_delivery.pending_call.${idx + 1}`}
                            >
                              <Phone className="h-3 w-3" />
                              {order.customerPhone}
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(
                            Number(order.createdAt / 1_000_000n),
                          ).toLocaleTimeString("vi-VN")}
                        </span>
                      </div>
                      {order.deliveryAddress && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border/50 mb-2">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground flex-1 min-w-0 break-words">
                            {order.deliveryAddress}
                          </p>
                        </div>
                      )}
                      {order.deliveryAddress && (
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              order.deliveryAddress ?? "",
                            )
                          }
                          className="flex items-center gap-1 text-xs text-blue-500 mb-2 hover:underline"
                          data-ocid={`enterprise_delivery.pending_copy.${idx + 1}`}
                        >
                          <Copy className="h-3 w-3" />
                          Copy địa chỉ
                        </button>
                      )}
                      <div className="text-sm text-foreground mb-2 border-t border-amber-200 pt-2">
                        {order.items.map((item) => (
                          <div key={`${String(item.menuItemId)}-${item.name}`}>
                            {item.name} x{item.quantity} —{" "}
                            {formatPrice(item.price)}
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <p className="text-xs text-muted-foreground mb-2">
                          📝 {order.notes}
                        </p>
                      )}
                      {order.shipperName && (
                        <div className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                          <span>🛵</span>
                          <span>
                            Shipper: {order.shipperName}
                            {order.shipperPhone
                              ? ` · ${order.shipperPhone}`
                              : ""}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const bs = bookingStates[String(order.id)];
                        return (
                          <div className="mt-2">
                            {!bs?.result && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setBookingStates((prev) => ({
                                    ...prev,
                                    [String(order.id)]: {
                                      loading: true,
                                      result: null,
                                      error: null,
                                    },
                                  }));
                                  try {
                                    const result =
                                      await bookShipperMutation.mutateAsync({
                                        orderId: order.id,
                                        restaurantId: order.restaurantId,
                                      });
                                    setBookingStates((prev) => ({
                                      ...prev,
                                      [String(order.id)]: {
                                        loading: false,
                                        result,
                                        error: null,
                                      },
                                    }));
                                  } catch (e: unknown) {
                                    const msg =
                                      e instanceof Error
                                        ? e.message
                                        : "Không tìm được shipper. Vui lòng book thủ công.";
                                    setBookingStates((prev) => ({
                                      ...prev,
                                      [String(order.id)]: {
                                        loading: false,
                                        result: null,
                                        error: msg,
                                      },
                                    }));
                                  }
                                }}
                                disabled={bs?.loading}
                                className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                data-ocid={`enterprise_delivery.pending_book_shipper.${idx + 1}`}
                              >
                                {bs?.loading ? "Đang đặt..." : "🛵 Đặt shipper"}
                              </button>
                            )}
                            {bs?.result && (
                              <div className="text-sm text-green-600">
                                <div className="font-medium">
                                  ✓ Đã đặt shipper ({bs.result.provider})
                                  {bs.result.shippingFee
                                    ? ` · ${Number(bs.result.shippingFee).toLocaleString("vi-VN")}đ`
                                    : ""}
                                </div>
                                {bs.result.shipperName && (
                                  <div className="mt-0.5">
                                    Shipper: {bs.result.shipperName}
                                    {bs.result.shipperPhone ? (
                                      <>
                                        {" "}
                                        ·{" "}
                                        <a
                                          href={`tel:${bs.result.shipperPhone}`}
                                          className="text-blue-600 underline"
                                        >
                                          {bs.result.shipperPhone}
                                        </a>
                                      </>
                                    ) : (
                                      ""
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {bs?.error && (
                              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm font-medium text-orange-800">
                                  Không tìm được shipper tự động
                                </p>
                                <p className="text-xs text-orange-600 mt-0.5">
                                  Vui lòng book thủ công qua app shipper.
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBookingStates((prev) => ({
                                      ...prev,
                                      [String(order.id)]: {
                                        loading: false,
                                        result: null,
                                        error: null,
                                      },
                                    }))
                                  }
                                  className="text-xs text-orange-500 underline mt-1"
                                >
                                  Thử lại
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            approveDelivery.mutate({
                              orderId: order.id,
                              restaurantId: order.restaurantId,
                            })
                          }
                          disabled={approveDelivery.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                          data-ocid={`enterprise_delivery.pending_approve.${idx + 1}`}
                        >
                          Gửi vào bếp
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectDialog({
                              orderId: order.id,
                              restaurantId: order.restaurantId,
                            });
                            setRejectReason("");
                          }}
                          className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 py-2 rounded-lg font-medium text-sm"
                          data-ocid={`enterprise_delivery.pending_reject.${idx + 1}`}
                        >
                          Hủy đơn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular delivery orders grid */}
            {regularOrders.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "1rem",
                }}
              >
                {regularOrders.map((order, idx) => (
                  <EnterpriseOrderCard
                    key={String(order.id)}
                    order={order}
                    restaurantName={
                      restaurantMap.get(String(order.restaurantId)) ??
                      "Nhà hàng"
                    }
                    index={idx + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
            data-ocid="enterprise_delivery.reject_dialog"
          >
            <h3 className="font-bold text-lg mb-2">Hủy đơn hàng</h3>
            <p className="text-muted-foreground text-sm mb-3">
              Nhập lý do hủy đơn (nếu có):
            </p>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-input rounded-lg p-2 text-sm mb-4 bg-background"
              placeholder="Lý do hủy..."
              data-ocid="enterprise_delivery.reject_reason_input"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejectDialog(null)}
                className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-muted"
                data-ocid="enterprise_delivery.reject_cancel_button"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectDelivery.mutate({
                    orderId: rejectDialog.orderId,
                    restaurantId: rejectDialog.restaurantId,
                    _reason: rejectReason,
                  });
                  setRejectDialog(null);
                }}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 font-medium"
                data-ocid="enterprise_delivery.reject_confirm_button"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <RestaurantFilterPanel
        open={showFilter}
        onClose={() => setShowFilter(false)}
        restaurants={allRestaurants as RestaurantPublic[]}
        selectedIds={savedFilterIds}
        onSave={handleSaveFilter}
        isSaving={saveFilter.isPending}
      />

      <footer className="mt-8 pb-6 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()}.
        </p>
      </footer>
    </div>
  );
}

// ─── Access gate screens ───────────────────────────────────────────────────────

function LoginPrompt() {
  const { login } = useAuthContext();
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-6"
      data-ocid="enterprise_delivery.login_prompt"
    >
      <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Truck className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Trung tâm giao hàng</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng đăng nhập để tiếp tục
          </p>
        </div>
        <Button
          className="w-full gap-2"
          onClick={login}
          data-ocid="enterprise_delivery.login_button"
        >
          <LogIn className="h-4 w-4" />
          Đăng nhập để tiếp tục
        </Button>
      </div>
    </div>
  );
}

function AccessDenied({ principalId }: { principalId: string | null }) {
  const { logout } = useAuthContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (principalId) {
      await navigator.clipboard.writeText(principalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-6"
      data-ocid="enterprise_delivery.access_denied"
    >
      <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center shadow-md space-y-5">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
          <p className="text-sm text-muted-foreground">
            Bạn chưa được cấp quyền vào trang này. Gửi Principal ID của bạn cho
            quản trị viên để được cấp quyền truy cập.
          </p>
        </div>
        {principalId && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Principal ID của bạn:
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border">
              <code className="text-xs font-mono flex-1 break-all text-left">
                {principalId}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded-md hover:bg-background transition-colors"
                title="Sao chép"
                data-ocid="enterprise_delivery.copy_principal_button"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-500 font-medium">Đã sao chép!</p>
            )}
          </div>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => logout()}
          data-ocid="enterprise_delivery.logout_button"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EnterpriseDeliveryPage() {
  const { role, principalId } = useAuthContext();
  const { isAuthenticated } = useInternetIdentity();
  const { data: myPermissions } = useGetMyEnterprisePermissions();

  const isOwner = role === "business_owner" || role === "developer";
  const hasPermission = myPermissions?.some(
    (p) => p === EnterprisePermission.EnterpriseDelivery,
  );
  const canAccess = isOwner || hasPermission;

  // Not logged in
  if (!isAuthenticated || !principalId) {
    return <LoginPrompt />;
  }

  // Not authorized
  if (!canAccess) {
    return <AccessDenied principalId={principalId} />;
  }

  return (
    <EnterpriseDevicePinGuard requiredRole="enterprise-delivery">
      <EnterpriseDeliveryContent />
    </EnterpriseDevicePinGuard>
  );
}
