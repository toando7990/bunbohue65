import { OrderStatus, OrderType, PaymentStatus, createActor } from "@/backend";
import type { OrderPublic } from "@/backend";
import {
  StaffAccessGuard,
  getSavedRestaurantId,
} from "@/components/StaffAccessGuard";
import {
  formatPrice,
  useClearCompletedOrders,
  useGetInvoiceInfo,
  useOrders,
  useReissueBkavInvoice,
  useReissueInvoice,
  useRestaurant,
} from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useSearch } from "@tanstack/react-router";
import {
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function calcSubtotal(orders: OrderPublic[]): bigint {
  return orders.reduce(
    (sum, o) =>
      sum + o.items.reduce((s, i) => s + i.price * BigInt(i.quantity), 0n),
    0n,
  );
}

function isUnpaid(o: OrderPublic) {
  return (
    o.paymentStatus === PaymentStatus.Unpaid &&
    o.status !== OrderStatus.Completed
  );
}
function isPaid(o: OrderPublic) {
  return (
    (o.paymentStatus === PaymentStatus.Paid ||
      o.paymentStatus === PaymentStatus.Pending) &&
    o.status !== OrderStatus.Completed
  );
}
function isCompleted(o: OrderPublic) {
  return o.status === OrderStatus.Completed;
}

function StatusBadge({ method }: { method?: string }) {
  if (method === "BankTransfer") {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Chờ chuyển khoản
      </span>
    );
  }
  return null;
}

function useInvoiceProvider() {
  const { actor } = useActor(createActor);
  const [provider, setProvider] = useState<"BKAV" | null>(null);

  useEffect(() => {
    if (!actor) return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).getInvoiceProvider();
        if (result === "BKAV") setProvider("BKAV");
        else setProvider("BKAV");
      } catch {
        setProvider("BKAV");
      }
    })();
  }, [actor]);

  return provider;
}

function InvoiceProviderBadge({ provider }: { provider: "BKAV" | null }) {
  if (!provider) return null;
  const displayProvider = "BKAV";
  const badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${badgeClass}`}
    >
      {displayProvider}
    </span>
  );
}

function InvoiceSection({ order }: { order: OrderPublic }) {
  const { data: invoice } = useGetInvoiceInfo(order.id);
  const _reissue = useReissueInvoice();

  const reissueBkav = useReissueBkavInvoice();
  const invoiceProvider = useInvoiceProvider();

  const isPaidOrder =
    order.paymentStatus === PaymentStatus.Paid ||
    order.status === OrderStatus.Preparing ||
    order.status === OrderStatus.Ready ||
    order.status === OrderStatus.Completed;

  if (!isPaidOrder) return null;

  const hasTaxCode = Boolean(order.vatInfo?.taxCode);

  const status = invoice?.invoiceStatus ?? "NotRequested";

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Hóa đơn VAT
        </span>
        <InvoiceProviderBadge provider={invoiceProvider} />
      </div>
      <div className="mb-2">
        {hasTaxCode ? (
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Khách doanh nghiệp: {order.vatInfo!.buyerName} (MST:{" "}
            {order.vatInfo!.taxCode})
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Bán cho người tiêu dùng
          </p>
        )}
      </div>

      {status === "NotRequested" && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-xs font-medium">
          Không yêu cầu HĐ
        </span>
      )}

      {status === "Pending" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-medium">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang phát hành hóa đơn...
        </span>
      )}

      {status === "Issued" && (
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-medium">
            ✅ Đã phát hành HĐ
          </span>
          {invoice?.invoiceNo && (
            <p className="text-xs text-muted-foreground">
              Số HĐ: {invoice.invoiceNo}
              {invoice.invoiceDate ? ` — ${invoice.invoiceDate}` : ""}
            </p>
          )}
          {invoice?.invoicePdfUrl && (
            <button
              type="button"
              onClick={() => window.open(invoice.invoicePdfUrl, "_blank")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              data-ocid="cashier_view.download_invoice_button"
            >
              <FileText className="h-3.5 w-3.5" />
              Tải hóa đơn PDF
            </button>
          )}
        </div>
      )}

      {status === "Error" && (
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
            ❌ Lỗi phát hành HĐ
          </span>
          <button
            type="button"
            disabled={reissueBkav.isPending}
            onClick={() => {
              const mutation = reissueBkav;
              mutation.mutate(order.id, {
                onSuccess: () => {
                  toast.success("Đã phát hành lại hóa đơn thành công");
                },
                onError: (err) => {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Phát hành lại thất bại",
                  );
                },
              });
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            data-ocid="cashier_view.reissue_invoice_button"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${reissueBkav.isPending ? "animate-spin" : ""}`}
            />
            {reissueBkav.isPending ? "Đang xử lý..." : "Phát hành lại"}
          </button>
        </div>
      )}
    </div>
  );
}

function TableCard({
  tableId,
  orders,
}: { tableId: string; orders: OrderPublic[] }) {
  const subtotal = calcSubtotal(orders);
  const unpaidOrders = orders.filter(
    (o) => o.paymentStatus === PaymentStatus.Unpaid,
  );
  const method = unpaidOrders[0]?.paymentMethod;

  return (
    <div className="border rounded-xl p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base">Bàn {tableId}</h3>
        <span className="font-bold text-primary">{formatPrice(subtotal)}</span>
      </div>
      {unpaidOrders.length > 0 && method && (
        <div className="mb-2">
          <StatusBadge method={method} />
        </div>
      )}
      <div className="space-y-1">
        {orders.map((order) =>
          order.items.map((item, i) => (
            <div
              key={`${String(order.id)}-${i}`}
              className="flex justify-between text-sm text-muted-foreground"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatPrice(item.price * BigInt(item.quantity))}</span>
            </div>
          )),
        )}
      </div>
      {orders.map((order) => (
        <InvoiceSection key={`inv-${String(order.id)}`} order={order} />
      ))}
    </div>
  );
}

function CashierContent({ restaurantId }: { restaurantId: bigint }) {
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: allOrders = [], isFetching, refetch } = useOrders(restaurantId);
  const clearCompleted = useClearCompletedOrders();

  const tableOrders = useMemo(
    () =>
      (allOrders as OrderPublic[]).filter(
        (o) => o.orderType === OrderType.TableOrder || !o.orderType,
      ),
    [allOrders],
  );

  const groupByTable = useCallback((list: OrderPublic[]) => {
    const map = new Map<string, OrderPublic[]>();
    for (const o of list) {
      const key = String(o.tableIdentifier);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, []);

  const unpaidByTable = useMemo(
    () => groupByTable(tableOrders.filter(isUnpaid)),
    [groupByTable, tableOrders],
  );
  const paidByTable = useMemo(
    () => groupByTable(tableOrders.filter(isPaid)),
    [groupByTable, tableOrders],
  );
  const completedByTable = useMemo(
    () => groupByTable(tableOrders.filter(isCompleted)),
    [groupByTable, tableOrders],
  );

  const grandTotal = useMemo(
    () => calcSubtotal(tableOrders.filter(isCompleted)),
    [tableOrders],
  );

  const restaurantName =
    restaurant?.brand1Name ?? restaurant?.name ?? "Nhà hàng";
  const total = unpaidByTable.size + paidByTable.size + completedByTable.size;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Thu ngân — {restaurantName}</h1>
            <p className="text-xs text-muted-foreground">
              {unpaidByTable.size > 0
                ? `${unpaidByTable.size} bàn chưa thanh toán`
                : "Tất cả đã thanh toán"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isFetching
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isFetching ? "bg-amber-400 animate-pulse" : "bg-green-500"}`}
            />
            {isFetching ? "Đang tải..." : "Live"}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-sm flex items-center gap-1.5 transition-colors"
            data-ocid="cashier_view.refresh_button"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      <main className="p-5 max-w-4xl mx-auto space-y-6">
        {/* Grand total */}
        {grandTotal > 0n && (
          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-5 py-3">
            <span className="text-sm text-muted-foreground">
              Tổng thu hôm nay
            </span>
            <span className="text-2xl font-bold text-primary">
              {formatPrice(grandTotal)}
            </span>
          </div>
        )}

        {total === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-32 gap-4"
            data-ocid="cashier_view.empty_state"
          >
            <Receipt className="w-16 h-16 text-muted-foreground/30" />
            <p className="text-xl font-semibold text-muted-foreground">
              Chưa có đơn nào
            </p>
          </div>
        ) : (
          <>
            {unpaidByTable.size > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-destructive mb-3">
                  Chưa thanh toán ({unpaidByTable.size})
                </p>
                <div className="space-y-3">
                  {Array.from(unpaidByTable.entries()).map(
                    ([tableId, orders]) => (
                      <TableCard
                        key={tableId}
                        tableId={tableId}
                        orders={orders}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            {paidByTable.size > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Đã thanh toán – chưa hoàn tất ({paidByTable.size})
                </p>
                <div className="space-y-3">
                  {Array.from(paidByTable.entries()).map(
                    ([tableId, orders]) => (
                      <TableCard
                        key={tableId}
                        tableId={tableId}
                        orders={orders}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            {completedByTable.size > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Đã hoàn tất ({completedByTable.size})
                </p>
                <div className="space-y-3">
                  {Array.from(completedByTable.entries()).map(
                    ([tableId, orders]) => (
                      <TableCard
                        key={tableId}
                        tableId={tableId}
                        orders={orders}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            {completedByTable.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Xác nhận quyết toán tất cả đơn đã hoàn tất?")) {
                    clearCompleted.mutate(restaurantId, {
                      onSuccess: () => refetch(),
                    });
                  }
                }}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                data-ocid="cashier_view.settle_all_button"
              >
                Quyết toán ({completedByTable.size} bàn)
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function CashierViewPage() {
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const restaurantIdFromUrl = Number(search.restaurantId ?? "0");
  const restaurantId = restaurantIdFromUrl || getSavedRestaurantId("cashier");

  if (!restaurantId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <p className="text-base font-semibold text-foreground">Thu ngân</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Không tìm thấy thông tin truy cập. Bạn cần dùng link do quản lý cung
            cấp. Liên hệ quản lý nhà hàng để lấy link truy cập mới.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffAccessGuard restaurantId={restaurantId} staffRole="cashier">
      <CashierContent restaurantId={BigInt(restaurantId)} />
    </StaffAccessGuard>
  );
}
