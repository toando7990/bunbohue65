import { AdminLayout } from "@/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelReservation,
  useConfirmReservation,
  useListReservationsByRestaurant,
  useUpdateReservationStatus,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { ReservationStatus } from "@/types";
import type { ReservationPublic, RestaurantId } from "@/types";
import { getRouteApi } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const routeApi = getRouteApi("/admin/restaurant/$restaurantId/reservations");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: bigint, language: "vi" | "en"): string {
  const m = Number(minutes);
  if (m < 60) return language === "vi" ? `${m} phút` : `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return language === "vi" ? `${h} giờ` : `${h}h`;
  return language === "vi" ? `${h}g ${rem}p` : `${h}h ${rem}m`;
}

type FilterStatus = "all" | "Pending" | "Confirmed" | "Arrived" | "Cancelled";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  language,
}: {
  status: ReservationStatus;
  language: "vi" | "en";
}) {
  const map: Record<
    ReservationStatus,
    { label: string; labelEn: string; cls: string }
  > = {
    [ReservationStatus.Pending]: {
      label: "Chờ xác nhận",
      labelEn: "Pending",
      cls: "bg-yellow-100 text-yellow-800 border-yellow-300",
    },
    [ReservationStatus.Confirmed]: {
      label: "Đã xác nhận",
      labelEn: "Confirmed",
      cls: "bg-blue-100 text-blue-800 border-blue-300",
    },
    [ReservationStatus.Arrived]: {
      label: "Đã đến",
      labelEn: "Arrived",
      cls: "bg-green-100 text-green-800 border-green-300",
    },
    [ReservationStatus.Cancelled]: {
      label: "Đã hủy",
      labelEn: "Cancelled",
      cls: "bg-muted text-muted-foreground border-border",
    },
  };
  const config = map[status];
  return (
    <Badge
      variant="outline"
      className={`text-xs font-semibold border ${config.cls}`}
    >
      {language === "vi" ? config.label : config.labelEn}
    </Badge>
  );
}

// ─── Reservation Card ─────────────────────────────────────────────────────────

interface ReservationCardProps {
  reservation: ReservationPublic;
  restaurantId: RestaurantId;
  index: number;
}

function ReservationCard({
  reservation,
  restaurantId,
  index,
}: ReservationCardProps) {
  const { language } = useLanguage();
  const confirmMutation = useConfirmReservation();
  const cancelMutation = useCancelReservation();
  const updateStatusMutation = useUpdateReservationStatus();

  const isPending = reservation.status === ReservationStatus.Pending;
  const isConfirmed = reservation.status === ReservationStatus.Confirmed;
  const isCancelled = reservation.status === ReservationStatus.Cancelled;
  const isArrived = reservation.status === ReservationStatus.Arrived;
  const isActive = isPending || isConfirmed;

  const borderColor = {
    [ReservationStatus.Pending]: "border-l-yellow-400",
    [ReservationStatus.Confirmed]: "border-l-blue-500",
    [ReservationStatus.Arrived]: "border-l-green-500",
    [ReservationStatus.Cancelled]: "border-l-muted-foreground/30",
  }[reservation.status];

  return (
    <div
      data-ocid={`reservations.card.${index}`}
      className={`rounded-xl border-l-4 ${borderColor} border border-border bg-card shadow-sm p-4 space-y-3 ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      {/* Header: name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">
            {reservation.customerName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <PhoneCall className="h-3 w-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {reservation.customerPhone}
            </p>
          </div>
        </div>
        <StatusBadge status={reservation.status} language={language} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>{reservation.date}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {reservation.timeSlot} ·{" "}
            {formatDuration(BigInt(reservation.durationMinutes ?? 0), language)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>
            {String(reservation.partySize)}{" "}
            {language === "vi" ? "người" : "guests"}
          </span>
        </div>
      </div>

      {/* Notes */}
      {reservation.notes && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 italic">
          📝 {reservation.notes}
        </p>
      )}

      {/* Actions */}
      {!isCancelled && !isArrived && (
        <div className="flex flex-wrap gap-2 pt-1">
          {isPending && (
            <Button
              type="button"
              size="sm"
              data-ocid={`reservations.confirm_button.${index}`}
              onClick={() =>
                confirmMutation.mutate({ id: reservation.id, restaurantId })
              }
              disabled={confirmMutation.isPending}
              className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {confirmMutation.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {language === "vi" ? "Xác nhận" : "Confirm"}
            </Button>
          )}
          {isConfirmed && (
            <Button
              type="button"
              size="sm"
              data-ocid={`reservations.arrived_button.${index}`}
              onClick={() =>
                updateStatusMutation.mutate({
                  id: reservation.id,
                  status: ReservationStatus.Arrived,
                  restaurantId,
                })
              }
              disabled={updateStatusMutation.isPending}
              className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              {updateStatusMutation.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <UserCheck className="h-3 w-3" />
              )}
              {language === "vi" ? "Đã đến" : "Mark Arrived"}
            </Button>
          )}
          {isActive && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-ocid={`reservations.cancel_button.${index}`}
              onClick={() =>
                cancelMutation.mutate({ id: reservation.id, restaurantId })
              }
              disabled={cancelMutation.isPending}
              className="flex-1 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
            >
              {cancelMutation.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {language === "vi" ? "Hủy" : "Cancel"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: {
  value: FilterStatus;
  labelVi: string;
  labelEn: string;
}[] = [
  { value: "all", labelVi: "Tất cả", labelEn: "All" },
  { value: "Pending", labelVi: "Chờ xác nhận", labelEn: "Pending" },
  { value: "Confirmed", labelVi: "Đã xác nhận", labelEn: "Confirmed" },
  { value: "Arrived", labelVi: "Đã đến", labelEn: "Arrived" },
  { value: "Cancelled", labelVi: "Đã hủy", labelEn: "Cancelled" },
];

function filterReservations(
  list: ReservationPublic[],
  filter: FilterStatus,
): ReservationPublic[] {
  if (filter === "all") return list;
  return list.filter((r) => {
    if (filter === "Pending") return r.status === ReservationStatus.Pending;
    if (filter === "Confirmed") return r.status === ReservationStatus.Confirmed;
    if (filter === "Arrived") return r.status === ReservationStatus.Arrived;
    if (filter === "Cancelled") return r.status === ReservationStatus.Cancelled;
    return true;
  });
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  filter,
  language,
}: { filter: FilterStatus; language: "vi" | "en" }) {
  const isAll = filter === "all";
  return (
    <div
      data-ocid="reservations.empty_state"
      className="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <CalendarX className="h-8 w-8 text-primary/60" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-lg">
          {language === "vi"
            ? isAll
              ? "Chưa có đặt bàn nào"
              : "Không có đặt bàn"
            : isAll
              ? "No reservations yet"
              : "No reservations"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "vi"
            ? isAll
              ? "Các đặt bàn mới sẽ hiện ở đây."
              : "Không có đặt bàn với trạng thái này."
            : isAll
              ? "New reservations will appear here."
              : "No reservations with this status."}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminReservationsPage() {
  const { restaurantId: restaurantIdStr } = routeApi.useParams();
  const restaurantId = BigInt(restaurantIdStr);
  const { language } = useLanguage();
  const [filter, setFilter] = useState<FilterStatus>("all");

  const { data, isLoading, isFetching, refetch } =
    useListReservationsByRestaurant(restaurantId);

  const reservations = data ?? [];
  const sorted = [...reservations].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.timeSlot.localeCompare(a.timeSlot);
  });

  const filtered = filterReservations(sorted, filter);

  const countsByStatus = {
    all: reservations.length,
    Pending: reservations.filter((r) => r.status === ReservationStatus.Pending)
      .length,
    Confirmed: reservations.filter(
      (r) => r.status === ReservationStatus.Confirmed,
    ).length,
    Arrived: reservations.filter((r) => r.status === ReservationStatus.Arrived)
      .length,
    Cancelled: reservations.filter(
      (r) => r.status === ReservationStatus.Cancelled,
    ).length,
  };

  return (
    <AdminLayout restaurantId={restaurantIdStr}>
      <div data-ocid="reservations.page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl text-foreground flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              {language === "vi" ? "Đặt bàn" : "Reservations"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === "vi"
                ? "Quản lý đặt bàn trước của khách hàng"
                : "Manage advance table reservations"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
              data-ocid="reservations.live_indicator"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full bg-primary ${
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
              data-ocid="reservations.refresh_button"
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              {language === "vi" ? "Làm mới" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          data-ocid="reservations.filter.tab"
          className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              data-ocid={`reservations.filter.${opt.value}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                filter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {language === "vi" ? opt.labelVi : opt.labelEn}
              <span
                className={`text-xs px-1 rounded ${
                  filter === opt.value
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {countsByStatus[opt.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div
            data-ocid="reservations.loading_state"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-52 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <EmptyState filter={filter} language={language} />
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((reservation, i) => (
              <ReservationCard
                key={String(reservation.id)}
                reservation={reservation}
                restaurantId={restaurantId}
                index={i + 1}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
