import { CustomerLayout } from "@/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { useSearch } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList, Clock, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderHistoryItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: bigint;
  itemNote?: string;
}

export interface OrderHistoryEntry {
  orderId: string;
  timestamp: number;
  restaurantId: string;
  tableId: string;
  items: OrderHistoryItem[];
  total: bigint;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORDER_HISTORY_KEY = "orderHistory";

export function loadOrderHistory(): OrderHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      orderId: string;
      timestamp: number;
      restaurantId: string;
      tableId: string;
      items: Array<{
        menuItemId: string;
        name: string;
        quantity: number;
        price: string;
        itemNote?: string;
      }>;
      total: string;
      status: string;
    }>;
    // Deserialize bigint from string
    return parsed.map((entry) => ({
      ...entry,
      total: BigInt(entry.total),
      items: entry.items.map((i) => ({
        ...i,
        price: BigInt(i.price),
      })),
    }));
  } catch {
    return [];
  }
}

export function saveOrderToHistory(entry: OrderHistoryEntry): void {
  try {
    const existing = loadOrderHistory();
    const serialized = [...existing, entry].map((e) => ({
      ...e,
      total: e.total.toString(),
      items: e.items.map((i) => ({
        ...i,
        price: i.price.toString(),
      })),
    }));
    sessionStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(serialized));
  } catch {
    // sessionStorage might be unavailable
  }
}

function formatTimestamp(ts: number, language: string): string {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function getStatusColor(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Pending":
      return "outline";
    case "Preparing":
      return "secondary";
    case "Ready":
      return "default";
    case "Completed":
      return "default";
    case "Cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusLabel(
  status: string,
  t: ReturnType<typeof useLanguage>["t"],
): string {
  switch (status) {
    case "Pending":
      return t.orders.statusPending;
    case "Preparing":
      return t.orders.statusPreparing;
    case "Ready":
      return t.orders.statusReady;
    case "Completed":
      return t.orders.statusCompleted;
    case "Cancelled":
      return t.orders.statusCancelled;
    default:
      return status;
  }
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  entry: OrderHistoryEntry;
  index: number;
}

function OrderCard({ entry, index }: OrderCardProps) {
  const { t, language } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      data-ocid={`history.order.item.${index + 1}`}
      className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm text-foreground">
            {t.order.orderNumber}
            {entry.orderId}
          </span>
        </div>
        <Badge variant={getStatusColor(entry.status)} className="text-xs">
          {getStatusLabel(entry.status, t)}
        </Badge>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatTimestamp(entry.timestamp, language)}
        </div>
        <div className="text-xs text-muted-foreground">
          {t.order.tableLabel}{" "}
          <span className="font-semibold text-foreground">{entry.tableId}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {entry.items.map((item, i) => (
          <div
            key={`${entry.orderId}-item-${i}`}
            className="flex items-start justify-between gap-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="text-foreground font-medium">{item.name}</span>
              {item.itemNote && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">
                  {item.itemNote}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-muted-foreground">
                ×{item.quantity}
              </span>
              <span className="ml-2 text-sm font-medium text-foreground">
                {formatPrice(item.price * BigInt(item.quantity))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
        <span className="text-sm text-muted-foreground">{t.common.total}</span>
        <span className="text-base font-bold text-primary">
          {formatPrice(entry.total)}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Order History Page ───────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const { t } = useLanguage();
  const search = useSearch({ strict: false }) as {
    restaurantId?: string;
    tableId?: string;
  };

  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadOrderHistory());
  }, []);

  // Build back-to-menu URL preserving params
  const backHref =
    search.restaurantId && search.tableId
      ? `/order?restaurantId=${search.restaurantId}&tableId=${search.tableId}`
      : "/order";

  return (
    <CustomerLayout>
      <div data-ocid="history.page" className="flex flex-col gap-5">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <a
            href={backHref}
            data-ocid="history.back_button"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth"
            aria-label={t.common.back}
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="font-display text-2xl italic text-foreground">
              {t.history.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.history.subtitle}
            </p>
          </div>
        </div>

        {/* Order list */}
        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-ocid="history.empty_state"
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-foreground font-medium">
                {t.history.noOrders}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {t.history.noOrdersDesc}
              </p>
            </div>
            <Button
              variant="outline"
              asChild
              data-ocid="history.go_to_menu_button"
            >
              <a href={backHref}>{t.history.backToMenu}</a>
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              {history.length} {t.history.ordersCount}
            </p>
            {history.map((entry, idx) => (
              <OrderCard key={entry.orderId} entry={entry} index={idx} />
            ))}
            <div className="pt-2 pb-4">
              <Button
                variant="outline"
                className="w-full"
                asChild
                data-ocid="history.back_to_menu_button"
              >
                <a href={backHref}>{t.history.backToMenu}</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
