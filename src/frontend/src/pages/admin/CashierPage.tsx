import { AdminLayout } from "@/Layout";
import { OrderStatus, OrderType, PaymentStatus } from "@/backend";
import type { OrderPublic } from "@/backend";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatPrice,
  useClearCompletedOrders,
  useConfirmPaymentByCashier,
  useListDeliveryOrders,
  useOrders,
  useUpdateOrderStatus,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentMethod } from "@/types";
import { useParams } from "@tanstack/react-router";
import { Package, Receipt, Truck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

function calcSubtotal(orders: OrderPublic[]): bigint {
  return orders.reduce(
    (sum, o) =>
      sum + o.items.reduce((s, i) => s + i.price * BigInt(i.quantity), 0n),
    0n,
  );
}

function isUnpaidNotCompleted(o: OrderPublic) {
  return (
    o.paymentStatus === PaymentStatus.Unpaid &&
    o.status !== OrderStatus.Completed
  );
}

function isPaidNotCompleted(o: OrderPublic) {
  return (
    (o.paymentStatus === PaymentStatus.Paid ||
      o.paymentStatus === PaymentStatus.Pending) &&
    o.status !== OrderStatus.Completed
  );
}

function isCompleted(o: OrderPublic) {
  return o.status === OrderStatus.Completed;
}

function GroupHeader({
  label,
  count,
  urgent,
}: {
  label: string;
  count: number;
  urgent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 mb-3 ${
        urgent ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <span
        className={`text-xs font-bold uppercase tracking-widest ${
          urgent
            ? "bg-destructive/10 text-destructive border border-destructive/30 px-2 py-0.5 rounded-full"
            : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`text-xs rounded-full px-2 py-0.5 ${
          urgent
            ? "bg-destructive text-destructive-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function TableOrderCard({
  tableId,
  tableOrders,
  t,
}: {
  tableId: string;
  tableOrders: OrderPublic[];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { language } = useLanguage();
  const subtotal = calcSubtotal(tableOrders);

  // Detect payment method for unpaid orders
  const unpaidOrders = tableOrders.filter(
    (o) => o.paymentStatus === PaymentStatus.Unpaid,
  );
  const allUnpaidHaveSameMethod =
    unpaidOrders.length > 0 &&
    unpaidOrders.every(
      (o) => o.paymentMethod === unpaidOrders[0].paymentMethod,
    );
  const unpaidMethod = allUnpaidHaveSameMethod
    ? unpaidOrders[0]?.paymentMethod
    : undefined;

  const isAutoConfirm = unpaidMethod === "BankTransfer";

  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">
          {t.cashier.tableSubtotal}: {tableId}
        </h3>
        <div className="flex items-center gap-3">
          <span className="font-bold text-primary">
            {formatPrice(subtotal)}
          </span>
        </div>
      </div>

      {/* Auto-confirm status badge for bank transfer */}
      {isAutoConfirm && unpaidOrders.length > 0 && (
        <div
          data-ocid="cashier.auto_confirm_badge"
          className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
        >
          <div className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
          {language === "vi"
            ? "Chờ khách chuyển khoản – tự động xác nhận"
            : "Waiting for bank transfer – auto-confirm"}
        </div>
      )}

      <div className="space-y-1">
        {tableOrders.map((order) =>
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
    </div>
  );
}

function DeliveryOrderCard({
  order,
  t,
  restaurantId,
  onPaymentConfirmed,
}: {
  order: OrderPublic;
  t: ReturnType<typeof useLanguage>["t"];
  restaurantId: bigint;
  onPaymentConfirmed: () => void;
}) {
  const { language } = useLanguage();
  const confirmPayment = useConfirmPaymentByCashier();
  const updateStatus = useUpdateOrderStatus();
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const subtotal = calcSubtotal([order]);

  const isPaid =
    order.paymentStatus === PaymentStatus.Paid ||
    order.paymentStatus === PaymentStatus.Pending;
  const completed = order.status === OrderStatus.Completed;
  const isDelivered = order.status === OrderStatus.Delivered;

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true);
    try {
      await confirmPayment.mutateAsync({ orderId: order.id, restaurantId });
      onPaymentConfirmed();
    } finally {
      setConfirmingPayment(false);
    }
  };

  return (
    <div
      className="border rounded-lg p-4 bg-card shadow-sm space-y-3"
      data-ocid="cashier.delivery_order_card"
    >
      {/* Customer info */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">
            {t.cashier.customerName}:{" "}
          </span>
          <span className="font-medium">{order.customerName ?? "—"}</span>
        </span>
        <span>
          <span className="text-muted-foreground">
            {t.cashier.customerPhone}:{" "}
          </span>
          <span className="font-medium">{order.customerPhone ?? "—"}</span>
        </span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">
          {t.cashier.deliveryAddress}:{" "}
        </span>
        <span className="font-medium">{order.deliveryAddress ?? "—"}</span>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="flex justify-between text-sm text-muted-foreground"
          >
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatPrice(item.price * BigInt(item.quantity))}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-t pt-3">
        <div className="flex justify-between font-bold text-sm">
          <span>{t.common.total}</span>
          <span className="text-primary">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* Payment action */}
      {!isPaid && !completed && !isDelivered && (
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={confirmingPayment}
          className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          data-ocid="cashier.confirm_delivery_payment_button"
        >
          {confirmingPayment ? t.payment.processing : t.payment.confirmPayment}
        </button>
      )}
      {isPaid && !completed && !isDelivered && (
        <button
          type="button"
          onClick={() =>
            updateStatus.mutate({
              orderId: order.id,
              status: OrderStatus.Delivered,
              restaurantId,
            })
          }
          disabled={updateStatus.isPending}
          className="w-full py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
          data-ocid="cashier.deliver_button"
        >
          {language === "vi" ? "Đã giao hàng" : "Delivered"}
        </button>
      )}
      {(completed || isDelivered) && (
        <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-1">
          {t.payment.alreadyPaid}
        </div>
      )}
    </div>
  );
}

function TableOrdersTab({
  restaurantId,
  t,
}: {
  restaurantId: bigint;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { data: allOrders = [], isLoading, refetch } = useOrders(restaurantId);
  const clearCompleted = useClearCompletedOrders();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const orders = useMemo(
    () =>
      (allOrders as OrderPublic[]).filter(
        (o) => o.orderType === OrderType.TableOrder || !o.orderType,
      ),
    [allOrders],
  );

  const unpaidOrders = useMemo(
    () => orders.filter(isUnpaidNotCompleted),
    [orders],
  );
  const paidOrders = useMemo(() => orders.filter(isPaidNotCompleted), [orders]);
  const completedOrders = useMemo(() => orders.filter(isCompleted), [orders]);

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
    () => groupByTable(unpaidOrders),
    [groupByTable, unpaidOrders],
  );
  const paidByTable = useMemo(
    () => groupByTable(paidOrders),
    [groupByTable, paidOrders],
  );
  const completedByTable = useMemo(
    () => groupByTable(completedOrders),
    [groupByTable, completedOrders],
  );

  const grandTotal = useMemo(
    () => calcSubtotal(completedOrders),
    [completedOrders],
  );

  const selectedTableOrders = useMemo(() => {
    if (!selectedTable) return [];
    return (
      unpaidByTable.get(selectedTable) ??
      paidByTable.get(selectedTable) ??
      completedByTable.get(selectedTable) ??
      []
    );
  }, [selectedTable, unpaidByTable, paidByTable, completedByTable]);

  const selectedTableSubtotal = useMemo(
    () => calcSubtotal(selectedTableOrders),
    [selectedTableOrders],
  );

  const handleSettleAll = () => {
    if (confirm(t.cashier.settleConfirm)) {
      clearCompleted.mutate(restaurantId, { onSuccess: () => refetch() });
    }
  };

  // Determine payment method for the selected table's unpaid orders
  const selectedTableUnpaid = selectedTableOrders.filter(
    (o) => o.paymentStatus === PaymentStatus.Unpaid,
  );
  const selectedTableMethod =
    selectedTableUnpaid.length > 0
      ? selectedTableUnpaid[0]?.paymentMethod
      : undefined;
  const isSelectedAutoConfirm = selectedTableMethod === "BankTransfer";

  if (isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t.cashier.refreshing}
      </div>
    );

  const totalCount =
    unpaidByTable.size + paidByTable.size + completedByTable.size;

  if (totalCount === 0)
    return (
      <div
        className="text-center py-16 text-muted-foreground"
        data-ocid="cashier.table_empty_state"
      >
        <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">{t.cashier.noCompletedOrders}</p>
        <p className="text-sm">{t.cashier.noCompletedOrdersDesc}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {completedOrders.length > 0 && (
        <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t.cashier.grandTotal}
          </span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(grandTotal)}
          </span>
        </div>
      )}

      {unpaidByTable.size > 0 && (
        <div>
          <GroupHeader
            label={t.cashier.unpaidGroup}
            count={unpaidByTable.size}
            urgent
          />
          <div className="space-y-3">
            {Array.from(unpaidByTable.entries()).map(
              ([tableId, tableOrders]) => (
                <TableOrderCard
                  key={tableId}
                  tableId={tableId}
                  tableOrders={tableOrders}
                  t={t}
                />
              ),
            )}
          </div>
        </div>
      )}

      {paidByTable.size > 0 && (
        <div>
          <GroupHeader
            label={t.cashier.paidNotServedGroup}
            count={paidByTable.size}
          />
          <div className="space-y-3">
            {Array.from(paidByTable.entries()).map(([tableId, tableOrders]) => (
              <TableOrderCard
                key={tableId}
                tableId={tableId}
                tableOrders={tableOrders}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {completedByTable.size > 0 && (
        <div>
          <GroupHeader
            label={t.cashier.completedGroup}
            count={completedByTable.size}
          />
          <div className="space-y-3">
            {Array.from(completedByTable.entries()).map(
              ([tableId, tableOrders]) => (
                <TableOrderCard
                  key={tableId}
                  tableId={tableId}
                  tableOrders={tableOrders}
                  t={t}
                />
              ),
            )}
          </div>
        </div>
      )}

      {completedOrders.length > 0 && (
        <button
          type="button"
          onClick={handleSettleAll}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          data-ocid="cashier.settle_all_button"
        >
          {t.cashier.settleTable} ({completedByTable.size}{" "}
          {t.cashier.tableCount})
        </button>
      )}

      <Dialog
        open={selectedTable !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTable(null);
        }}
      >
        <DialogContent data-ocid="cashier.payment_dialog">
          <DialogHeader>
            <DialogTitle>
              {t.cashier.tableSubtotal}: {selectedTable}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Total */}
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {t.payment.totalAmount}
              </span>
              <span className="text-xl font-bold text-primary">
                {formatPrice(selectedTableSubtotal)}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-1">
              {selectedTableOrders.map((order) =>
                order.items.map((item, i) => (
                  <div
                    key={`dlg-${String(order.id)}-${i}`}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>
                      {formatPrice(item.price * BigInt(item.quantity))}
                    </span>
                  </div>
                )),
              )}
            </div>

            {/* Auto-confirm badge for bank transfer */}
            {isSelectedAutoConfirm && (
              <div
                data-ocid="cashier.dialog_auto_confirm_badge"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
              >
                <div className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                Chờ khách chuyển khoản – tự động xác nhận
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                disabled={false}
                className="flex-1 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
                data-ocid="cashier.payment_cancel_button"
              >
                Đóng
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryOrdersTab({
  restaurantId,
  t,
}: {
  restaurantId: bigint;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { language } = useLanguage();
  const { data: rawOrders = [], refetch } = useListDeliveryOrders(restaurantId);
  const orders = rawOrders as OrderPublic[];

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.paymentStatus === PaymentStatus.Paid &&
          o.status === OrderStatus.Pending,
      ),
    [orders],
  );
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.Preparing),
    [orders],
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.Ready),
    [orders],
  );
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.Delivered),
    [orders],
  );

  if (orders.length === 0)
    return (
      <div
        className="text-center py-16 text-muted-foreground"
        data-ocid="cashier.delivery_empty_state"
      >
        <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">{t.cashier.noDeliveryOrders}</p>
        <p className="text-sm">{t.cashier.noDeliveryOrdersDesc}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {pendingOrders.length > 0 && (
        <div>
          <GroupHeader
            label={t.cashier.unpaidGroup}
            count={pendingOrders.length}
            urgent
          />
          <div className="space-y-3">
            {pendingOrders.map((order, idx) => (
              <div
                key={String(order.id)}
                data-ocid={`cashier.delivery_pending_item.${idx + 1}`}
              >
                <DeliveryOrderCard
                  order={order}
                  t={t}
                  restaurantId={restaurantId}
                  onPaymentConfirmed={refetch}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {preparingOrders.length > 0 && (
        <div>
          <GroupHeader
            label={t.cashier.paidNotServedGroup}
            count={preparingOrders.length}
          />
          <div className="space-y-3">
            {preparingOrders.map((order, idx) => (
              <div
                key={String(order.id)}
                data-ocid={`cashier.delivery_preparing_item.${idx + 1}`}
              >
                <DeliveryOrderCard
                  order={order}
                  t={t}
                  restaurantId={restaurantId}
                  onPaymentConfirmed={refetch}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {readyOrders.length > 0 && (
        <div>
          <GroupHeader
            label={language === "vi" ? "Sẵn sàng giao" : "Ready to Deliver"}
            count={readyOrders.length}
          />
          <div className="space-y-3">
            {readyOrders.map((order, idx) => (
              <div
                key={String(order.id)}
                data-ocid={`cashier.delivery_ready_item.${idx + 1}`}
              >
                <DeliveryOrderCard
                  order={order}
                  t={t}
                  restaurantId={restaurantId}
                  onPaymentConfirmed={refetch}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {deliveredOrders.length > 0 && (
        <div>
          <GroupHeader
            label={language === "vi" ? "Đã giao hàng" : "Delivered"}
            count={deliveredOrders.length}
          />
          <div className="space-y-3">
            {deliveredOrders.map((order, idx) => (
              <div
                key={String(order.id)}
                data-ocid={`cashier.delivery_delivered_item.${idx + 1}`}
              >
                <DeliveryOrderCard
                  order={order}
                  t={t}
                  restaurantId={restaurantId}
                  onPaymentConfirmed={refetch}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashierPage() {
  const { restaurantId } = useParams({ strict: false });
  const { t } = useLanguage();
  const restaurantIdBig = BigInt(restaurantId ?? "0");

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t.cashier.title}</h1>
            <p className="text-muted-foreground">{t.cashier.subtitle}</p>
          </div>
        </div>

        {/* Two-column layout: Table orders left, Delivery orders right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Table/dine-in orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {t.cashier.tableOrdersTab}
              </h2>
            </div>
            <TableOrdersTab restaurantId={restaurantIdBig} t={t} />
          </div>

          {/* Right column: Delivery orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {t.cashier.deliveryOrdersTab}
              </h2>
            </div>
            <DeliveryOrdersTab restaurantId={restaurantIdBig} t={t} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
