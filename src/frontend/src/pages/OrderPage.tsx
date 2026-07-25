import { CustomerLayout } from "@/Layout";
import type { MasterMenuCategory, MasterMenuItem } from "@/backend";
import {
  PaymentMethodSelector,
  type QrProvider,
} from "@/components/PaymentMethodSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  cartItemToOrderItem,
  formatPrice,
  useGetBusinessBankDetails,
  useGetBusinessProfileInfo,
  useGetRestaurantOverrides,
  useGetSellerInfo,
  useGetTingeeConfig,
  useListMasterCategories,
  useListMasterMenuItems,
  usePlaceOrder,
  useRestaurant,
} from "@/hooks/useBackend";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/i18n";
import { saveOrderToHistory } from "@/pages/OrderHistoryPage";
import { useSearch } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIdParam(val: unknown): bigint | null {
  if (typeof val === "string" && val.trim() !== "") {
    try {
      return BigInt(val);
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────

interface MenuItemCardProps {
  item: MasterMenuItem;
  onAdd: (item: MasterMenuItem) => void;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  index: number;
  outOfStock?: boolean;
}

function MenuItemCard({
  item,
  onAdd,
  qty,
  onIncrement,
  onDecrement,
  index,
  outOfStock = false,
}: MenuItemCardProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      data-ocid={`order.menu_item.item.${index + 1}`}
      className={`relative flex gap-3 bg-card rounded-xl border border-border shadow-sm overflow-hidden active:scale-[0.98] transition-transform ${
        outOfStock ? "opacity-60" : ""
      }`}
    >
      {/* Out-of-stock overlay badge */}
      {outOfStock && (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            Tạm hết
          </span>
        </div>
      )}

      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-24 h-24 object-cover shrink-0"
        />
      ) : (
        <div className="w-24 h-24 bg-muted shrink-0 flex items-center justify-center text-2xl">
          🍽️
        </div>
      )}

      <div className="flex flex-col justify-between flex-1 py-2 pr-3 min-w-0">
        <div>
          <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-primary">
            {formatPrice(item.price)}
          </span>
          {qty === 0 ? (
            <button
              type="button"
              onClick={() => !outOfStock && onAdd(item)}
              disabled={outOfStock}
              data-ocid={`order.menu_item.add_button.${index + 1}`}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-smooth shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t.order.addToCart}
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDecrement}
                data-ocid={`order.menu_item.decrement_button.${index + 1}`}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-smooth"
                aria-label={t.order.remove}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-5 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => {
                  if (!outOfStock) onIncrement();
                }}
                disabled={outOfStock}
                data-ocid={`order.menu_item.increment_button.${index + 1}`}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-smooth disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t.order.addToCart}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  restaurantId: bigint;
  tableIdentifier: string;
  onRequestPayment: (
    items: Array<{ name: string; quantity: bigint; price: bigint }>,
    total: bigint,
    vatData: {
      vatRequest: boolean;
      vatInfo: {
        taxCode?: string;
        buyerName: string;
        address: string;
        email: string;
        accountNo?: string;
      } | null;
    },
  ) => void;
  cartTotal: () => bigint;
}

function CartDrawer({
  open,
  onClose,
  restaurantId: _restaurantId,
  tableIdentifier: _tableIdentifier,
  onRequestPayment,
  cartTotal,
}: CartDrawerProps) {
  const items = useCart((s) => s.items);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const updateNote = useCart((s) => s.updateNote);
  const removeItem = useCart((s) => s.removeItem);
  const total = useCart((s) => s.total);
  const _clearCart = useCart((s) => s.clearCart);
  const [orderNote, setOrderNote] = useState("");
  const [vatTaxCode, setVatTaxCode] = useState("");
  const [vatBuyerName, setVatBuyerName] = useState("");
  const [vatEmail, setVatEmail] = useState("");
  const [vatBuyerAddress, setVatBuyerAddress] = useState("");
  const [vatBuyerAccountNo, setVatBuyerAccountNo] = useState("");

  const { t } = useLanguage();

  // VAT invoice info now comes from the business's own BusinessProfile
  // (taxCode via getSellerInfo, buyerName/address via getBusinessProfileInfo)
  // — the previous VietQR MST lookup fetch has been removed.
  const { data: sellerInfo } = useGetSellerInfo();
  const { data: businessProfileInfo } = useGetBusinessProfileInfo();
  const businessTaxCode = sellerInfo?.taxCode ?? "";
  const businessName = businessProfileInfo?.businessName ?? "";
  const businessAddress = businessProfileInfo?.address ?? "";

  // Derive VAT lookup state synchronously from BusinessProfile. When the
  // business has a taxCode stored, the lookup "succeeds" and pre-fills the
  // buyer name/address from the business profile. When taxCode is empty/null,
  // there is no result.
  const vatLookupLoading = false;
  const vatLookupSuccess =
    vatTaxCode.trim() !== "" && businessTaxCode.trim() !== "";
  const vatLookupError = "";

  // Auto-populate MST field and buyer info from BusinessProfile. The MST
  // input is pre-filled with the business's taxCode; the buyer name/address
  // mirror the business profile values. This replaces the VietQR fetch.
  useEffect(() => {
    if (businessTaxCode.trim()) {
      setVatTaxCode(businessTaxCode);
    }
  }, [businessTaxCode]);

  useEffect(() => {
    if (vatLookupSuccess) {
      setVatBuyerName(businessName);
      setVatBuyerAddress(businessAddress);
      setVatBuyerAccountNo("");
    } else {
      setVatBuyerName("");
      setVatBuyerAddress("");
      setVatBuyerAccountNo("");
    }
  }, [vatLookupSuccess, businessName, businessAddress]);

  function handlePlaceOrder() {
    if (items.length === 0) return;
    const paymentItems = items.map((i) => ({
      name: i.name,
      quantity: BigInt(i.quantity),
      price: i.price,
    }));
    const taxCode = vatTaxCode.trim();
    onRequestPayment(paymentItems, cartTotal(), {
      vatRequest: true,
      vatInfo: taxCode
        ? {
            taxCode,
            buyerName: vatBuyerName.trim(),
            address: vatBuyerAddress.trim(),
            email: vatEmail.trim(),
            accountNo: vatBuyerAccountNo || undefined,
          }
        : null,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Bottom sheet drawer */}
          <motion.aside
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            aria-label={t.order.cartTitle}
            data-ocid="order.cart.dialog"
            className="fixed left-0 right-0 bottom-0 z-50 max-h-[85vh] bg-card rounded-t-2xl shadow-2xl flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-display text-lg italic text-foreground">
                {t.order.cartTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                data-ocid="order.cart.close_button"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth"
                aria-label={t.common.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {items.length === 0 ? (
                <div
                  data-ocid="order.cart.empty_state"
                  className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                >
                  <ShoppingCart className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    {t.order.cartEmpty}
                  </p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={item.menuItemId.toString()}
                    data-ocid={`order.cart.item.${idx + 1}`}
                    className="flex flex-col gap-2 pb-4 border-b border-border last:border-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.price)} × {item.quantity} ={" "}
                          <span className="text-primary font-semibold">
                            {formatPrice(item.price * BigInt(item.quantity))}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.menuItemId, item.quantity - 1)
                          }
                          data-ocid={`order.cart.decrement_button.${idx + 1}`}
                          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-smooth"
                          aria-label={t.order.remove}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.menuItemId, item.quantity + 1)
                          }
                          data-ocid={`order.cart.increment_button.${idx + 1}`}
                          className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-smooth"
                          aria-label={t.order.addToCart}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.menuItemId)}
                          data-ocid={`order.cart.delete_button.${idx + 1}`}
                          className="ml-1 p-1.5 text-muted-foreground hover:text-destructive transition-smooth"
                          aria-label={t.order.remove}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <Textarea
                      placeholder={t.order.itemNotePlaceholder}
                      value={item.itemNote ?? ""}
                      onChange={(e) =>
                        updateNote(item.menuItemId, e.target.value)
                      }
                      data-ocid={`order.cart.item_note.${idx + 1}`}
                      className="text-xs min-h-0 h-14 resize-none"
                    />
                  </div>
                ))
              )}

              {items.length > 0 && (
                <div className="mt-2">
                  <label
                    htmlFor="order-note"
                    className="text-xs font-medium text-muted-foreground block mb-1"
                  >
                    {t.order.specialInstructions}
                  </label>
                  <Textarea
                    id="order-note"
                    placeholder={t.order.specialInstructionsPlaceholder}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    data-ocid="order.cart.order_note.textarea"
                    className="text-xs min-h-0 h-16 resize-none"
                  />
                </div>
              )}

              {/* VAT Invoice — MST input (optional, for corporate buyers) */}
              {items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Hoá đơn điện tử
                  </p>

                  {/* Tax code row */}
                  <div>
                    <label
                      htmlFor="vat-taxcode"
                      className="text-xs font-medium text-muted-foreground block mb-1"
                    >
                      Mã số thuế (nếu là doanh nghiệp)
                    </label>
                    <div className="relative">
                      <input
                        id="vat-taxcode"
                        type="text"
                        value={vatTaxCode}
                        onChange={(e) => {
                          setVatTaxCode(e.target.value);
                          if (!e.target.value.trim()) {
                            setVatEmail("");
                          }
                        }}
                        placeholder="Nhập MST nếu cần hoá đơn doanh nghiệp"
                        data-ocid="order.cart.vat_tax_code.input"
                        className="w-full px-3 py-2 pr-8 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {vatTaxCode.trim() && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2">
                          {vatLookupLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : vatLookupSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : vatLookupError ? (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          ) : null}
                        </span>
                      )}
                    </div>
                    {vatLookupLoading && vatTaxCode.trim() && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Đang tìm kiếm...
                      </p>
                    )}
                    {vatLookupError && (
                      <p
                        className="text-xs text-destructive mt-1"
                        data-ocid="order.cart.vat_lookup.error_state"
                      >
                        {vatLookupError}
                      </p>
                    )}
                  </div>

                  {/* Company name — shown read-only when MST lookup succeeded */}
                  {vatLookupSuccess && vatBuyerName && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground block mb-1">
                          Tên người mua / công ty
                        </span>
                        <div
                          data-ocid="order.cart.vat_buyer_name_display"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm"
                        >
                          {vatBuyerName}
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="vat-email"
                          className="text-xs font-medium text-muted-foreground block mb-1"
                        >
                          Email nhận hoá đơn (tùy chọn)
                        </label>
                        <input
                          id="vat-email"
                          type="email"
                          value={vatEmail}
                          onChange={(e) => setVatEmail(e.target.value)}
                          placeholder="example@email.com"
                          data-ocid="order.cart.vat_email.input"
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                  )}

                  {!vatTaxCode.trim() && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Để trống nếu là khách cá nhân — hoá đơn vẫn được phát hành
                      cho khách lẻ.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-5 py-4 border-t border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    {t.common.total} (
                    {items.reduce((s, i) => s + i.quantity, 0)} {t.order.items})
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {formatPrice(total())}
                  </span>
                </div>
                <Button
                  type="button"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-12 text-base"
                  onClick={handlePlaceOrder}
                  disabled={
                    vatTaxCode.trim() !== "" &&
                    !vatLookupSuccess &&
                    !vatLookupLoading
                  }
                  data-ocid="order.cart.submit_button"
                >
                  {t.order.placeOrder}
                </Button>
                {vatTaxCode.trim() !== "" &&
                  !vatLookupSuccess &&
                  !vatLookupLoading && (
                    <p className="text-xs text-destructive text-center mt-1">
                      Vui lòng nhập MST hợp lệ để đặt hàng
                    </p>
                  )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Order Confirmation ───────────────────────────────────────────────────────

interface OrderConfirmationProps {
  orderId: bigint;
  tableIdentifier: string;
  restaurantId: bigint;
  orderItems: Array<{ name: string; quantity: bigint; price: bigint }>;
  onCancel: () => void;
  tingeeConfig:
    | {
        clientId: string;
        secretToken: string;
        orderPrefix: string;
      }
    | null
    | undefined;
}

function OrderConfirmation({
  orderId,
  tableIdentifier,
  restaurantId,
  orderItems,
  onCancel,
  tingeeConfig,
}: OrderConfirmationProps) {
  const { t, language } = useLanguage();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: businessBankDetails } = useGetBusinessBankDetails();
  const [paid, setPaid] = useState(false);

  // Derive QR provider from the restaurant's business config — customers
  // cannot choose; the business owner sets autoPaymentConfirmationApp.
  const qrProvider: QrProvider =
    restaurant?.autoPaymentConfirmationApp === "Tingee" ? "tingee" : "none";
  const isTingeeProvider = qrProvider === "tingee";
  const tingeeNotReady = isTingeeProvider && tingeeConfig == null;

  // Print receipt after payment success
  function triggerPrint() {
    const now = new Date();
    const dateStr = now.toLocaleString("vi-VN");
    const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0n);
    const lines = orderItems
      .map(
        (i) =>
          `<tr>
            <td style="padding:2px 6px">${i.name}</td>
            <td style="padding:2px 6px;text-align:center">${i.quantity}</td>
            <td style="padding:2px 6px;text-align:right">${Number(i.price).toLocaleString("vi-VN")}đ</td>
            <td style="padding:2px 6px;text-align:right">${Number(i.price * i.quantity).toLocaleString("vi-VN")}đ</td>
          </tr>`,
      )
      .join("");
    const restaurantName = restaurant?.name ?? "Nhà hàng";
    const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/><title>Hoá đơn #${orderId}</title>
<style>
  body{font-family:sans-serif;font-size:12pt;margin:0;padding:1cm;}
  h1{font-size:14pt;margin-bottom:4px;}
  table{width:100%;border-collapse:collapse;margin-top:8px;}
  th{border-bottom:1px solid #000;padding:2px 6px;text-align:left;font-size:11pt;}
  td{font-size:11pt;}
  .total{font-weight:bold;font-size:13pt;margin-top:8px;text-align:right;}
  .meta{font-size:10pt;color:#555;margin-bottom:4px;}
  @media print{body{margin:0;padding:0.5cm;}}
</style>
</head>
<body>
  <h1>${restaurantName}</h1>
  <p class="meta">Bàn: <strong>${tableIdentifier}</strong> &nbsp;|&nbsp; Đơn #${orderId} &nbsp;|&nbsp; ${dateStr}</p>
  <table>
    <thead><tr><th>Món</th><th style="text-align:center">SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead>
    <tbody>${lines}</tbody>
  </table>
  <p class="total">Tổng cộng: ${Number(total).toLocaleString("vi-VN")}đ</p>
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`;
    const w = window.open("", "_blank", "width=600,height=800");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      data-ocid="order.confirmation.success_state"
      className="flex flex-col items-center gap-5 py-10 text-center max-w-sm mx-auto"
    >
      {/* Order placed header */}
      {!paid && (
        <>
          <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-accent" />
          </div>
          <div>
            <h2 className="font-display text-3xl italic text-foreground mb-2">
              {t.order.orderPlaced}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t.order.orderNumber}
              {orderId.toString()} {t.order.tableLabel.toLowerCase()}{" "}
              <strong className="text-foreground">{tableIdentifier}</strong> —{" "}
              {t.order.orderPlacedDesc}
            </p>
          </div>
        </>
      )}

      {/* Payment section — show spinner while restaurant or bank details load */}
      {restaurant && !paid ? (
        <div className="w-full rounded-xl border border-border bg-card/50 p-4">
          {businessBankDetails === undefined ? (
            <div
              data-ocid="order.payment.loading_state"
              className="flex flex-col items-center gap-3 py-6 w-full"
            >
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {language === "vi"
                  ? "Đang tải thông tin thanh toán..."
                  : "Loading payment info..."}
              </p>
            </div>
          ) : (
            <>
              {/* When business selected Tingee but config is missing, warn the
                  customer instead of silently falling back to VietQR. */}
              {tingeeNotReady ? (
                <div
                  data-ocid="order.payment.tingee_not_ready.error_state"
                  className="flex flex-col items-center gap-3 py-6 text-center w-full"
                >
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
                    ⚠️
                  </div>
                  <p className="text-sm text-destructive font-medium">
                    {language === "vi"
                      ? "Mã QR Tingee chưa sẵn sàng. Vui lòng liên hệ nhân viên để được hỗ trợ thanh toán."
                      : "Tingee QR is not ready. Please contact staff for payment assistance."}
                  </p>
                </div>
              ) : (
                <PaymentMethodSelector
                  orderId={orderId}
                  restaurant={restaurant}
                  businessBankDetails={businessBankDetails ?? undefined}
                  orderItems={orderItems}
                  totalAmount={orderItems.reduce(
                    (s, i) => s + i.price * i.quantity,
                    0n,
                  )}
                  tingeeConfig={tingeeConfig}
                  qrProvider={qrProvider}
                  onSuccess={() => {
                    setPaid(true);
                    triggerPrint();
                  }}
                  onCancel={onCancel}
                />
              )}
            </>
          )}
        </div>
      ) : restaurant && paid ? null : (
        <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            {language === "vi"
              ? "Đang tải thông tin thanh toán..."
              : "Loading payment info..."}
          </p>
        </div>
      )}

      {/* Bottom links */}
      {!paid && (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
            <span className="text-xl">🍳</span>
            <p className="text-sm text-muted-foreground text-left">
              {t.order.orderPlacedDesc}
            </p>
          </div>
          <a
            href={`/order/history?restaurantId=${restaurantId.toString()}&tableId=${tableIdentifier}`}
            data-ocid="order.confirmation.history_link"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-smooth"
          >
            📋 {language === "vi" ? "Lịch sử đặt món" : "Order History"}
          </a>
        </div>
      )}

      {paid && (
        <div className="flex flex-col gap-2 w-full">
          <a
            href={`/order/history?restaurantId=${restaurantId.toString()}&tableId=${tableIdentifier}`}
            data-ocid="order.confirmation.history_link_paid"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-smooth"
          >
            📋 {language === "vi" ? "Lịch sử đặt món" : "Order History"}
          </a>
        </div>
      )}
    </motion.div>
  );
}

// ─── Category Tabs ────────────────────────────────────────────────────────────

interface CategoryTabsProps {
  categories: MasterMenuCategory[];
  active: bigint | null;
  onChange: (id: bigint | null) => void;
}

function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  const { t } = useLanguage();
  const sorted = [...categories].sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 scrollbar-hide"
      data-ocid="order.category.tab"
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-smooth min-h-[36px] ${
          active === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-foreground hover:bg-secondary/70"
        }`}
        data-ocid="order.category.all_tab"
      >
        {t.common.all}
      </button>
      {sorted.map((cat) => (
        <button
          key={cat.id.toString()}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-smooth min-h-[36px] ${
            active?.toString() === cat.id.toString()
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-foreground hover:bg-secondary/70"
          }`}
          data-ocid={`order.category.tab.${cat.id.toString()}`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MenuSkeleton() {
  return (
    <div data-ocid="order.menu.loading_state" className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reordered
          key={`cart-note-${i}`}
          className="flex gap-3 bg-card rounded-xl border border-border overflow-hidden"
        >
          <Skeleton className="w-24 h-24 shrink-0" />
          <div className="flex flex-col gap-2 flex-1 py-3 pr-3 justify-between">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Order Page ──────────────────────────────────────────────────────────

export default function OrderPage() {
  const search = useSearch({ strict: false }) as {
    restaurantId?: string;
    tableId?: string;
  };
  const { t, language } = useLanguage();

  const restaurantId = parseIdParam(search.restaurantId);
  const tableIdentifier = search.tableId ?? "";

  const { data: restaurant, isLoading: loadingRestaurant } =
    useRestaurant(restaurantId);
  const { data: categories = [], isLoading: loadingCategories } =
    useListMasterCategories();
  const { data: allMenuItems = [], isLoading: loadingMenu } =
    useListMasterMenuItems();
  const { data: overrides } = useGetRestaurantOverrides(restaurantId ?? 0n);
  const unavailableSet = new Set<bigint>(overrides ?? []);
  const [activeCategory, setActiveCategory] = useState<bigint | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<bigint | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<
    Array<{ name: string; quantity: bigint; price: bigint }>
  >([]);
  const [showPayment, setShowPayment] = useState(false);
  // Snapshotted total — captured BEFORE cart is cleared so QR always gets amount > 0
  const [pendingPaymentTotal, setPendingPaymentTotal] = useState<bigint>(0n);
  const qrSectionRef = useRef<HTMLDivElement>(null);
  const pendingOrderIdRef = useRef<bigint | null>(null);
  const [pendingPaymentItems, setPendingPaymentItems] = useState<
    Array<{ name: string; quantity: bigint; price: bigint }>
  >([]);
  const [pendingVatData, setPendingVatData] = useState<{
    vatRequest: boolean;
    vatInfo: {
      taxCode?: string;
      buyerName: string;
      address: string;
      email: string;
    } | null;
  }>({ vatRequest: false, vatInfo: null });
  const [createdOrderCode, setCreatedOrderCode] = useState<string | undefined>(
    undefined,
  );

  // Auto-scroll to QR when payment panel opens
  useEffect(() => {
    if (showPayment) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        qrSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    }
  }, [showPayment]);

  const placeOrder = usePlaceOrder();
  const { data: bankDetails } = useGetBusinessBankDetails();
  const { data: tingeeConfig } = useGetTingeeConfig();

  // QR provider comes from the restaurant's business config
  // (autoPaymentConfirmationApp) — not a customer-facing choice.
  const qrProvider: QrProvider =
    restaurant?.autoPaymentConfirmationApp === "Tingee" ? "tingee" : "none";
  const isTingeeProvider = qrProvider === "tingee";
  const tingeeNotReady = isTingeeProvider && tingeeConfig == null;

  const cartItems = useCart((s) => s.items);
  const addItem = useCart((s) => s.addItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const clearCart = useCart((s) => s.clearCart);

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const filteredItems =
    activeCategory === null
      ? allMenuItems.filter((m) => m.isActive)
      : allMenuItems.filter(
          (m) =>
            m.isActive &&
            m.categoryId.toString() === activeCategory?.toString(),
        );

  const { data: bp } = useGetBusinessProfileInfo();
  const businessName = bp?.businessName || "";
  const businessAddress = bp?.address || "";

  const businessFooterExtra =
    businessName || businessAddress ? (
      <div className="text-center text-xs text-muted-foreground">
        <span>{businessName}</span>
        {businessName && businessAddress && <span className="mx-2">·</span>}
        {businessAddress && <span>{businessAddress}</span>}
      </div>
    ) : undefined;

  // Error: restaurantId is required to load the menu
  if (!restaurantId) {
    return (
      <CustomerLayout>
        <div
          data-ocid="order.invalid.error_state"
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <span className="text-4xl">🔗</span>
          <h2 className="font-display text-2xl italic text-foreground">
            {t.common.error}
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            {t.order.noMenu}
          </p>
        </div>
      </CustomerLayout>
    );
  }

  // Order placed confirmation
  if (confirmedOrderId !== null) {
    return (
      <CustomerLayout
        restaurantName={
          loadingRestaurant ? undefined : (restaurant?.name ?? t.nav.menu)
        }
        businessName={businessName || undefined}
        brand1Name={restaurant?.brand1Name ?? undefined}
        footerExtra={businessFooterExtra}
      >
        <OrderConfirmation
          orderId={confirmedOrderId}
          tableIdentifier={tableIdentifier}
          restaurantId={restaurantId}
          orderItems={confirmedItems}
          tingeeConfig={tingeeConfig}
          onCancel={() => {
            setConfirmedOrderId(null);
            setConfirmedItems([]);
            clearCart();
          }}
        />
      </CustomerLayout>
    );
  }

  const isLoading = loadingRestaurant || loadingCategories || loadingMenu;

  return (
    <CustomerLayout
      restaurantName={
        loadingRestaurant ? undefined : (restaurant?.name ?? t.nav.menu)
      }
      businessName={businessName || undefined}
      brand1Name={restaurant?.brand1Name ?? undefined}
      footerExtra={businessFooterExtra}
    >
      <div data-ocid="order.page" className="flex flex-col pb-24">
        {/* Sticky header with logo + brand name + table badge */}
        <div className="sticky top-0 z-20 bg-card border-b border-border flex items-center gap-3 px-4 py-3 shadow-sm">
          <span className="font-semibold text-sm truncate flex-1 text-foreground">
            {restaurant?.brand1Name || restaurant?.name}
          </span>
          {tableIdentifier && (
            <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full px-3 py-1 flex-shrink-0">
              {tableIdentifier}
            </span>
          )}
        </div>

        {/* Sticky category tabs below header */}
        {!loadingCategories && categories.length > 0 && (
          <div className="sticky top-[57px] z-10 bg-background border-b border-border/50 px-3">
            <CategoryTabs
              categories={categories}
              active={activeCategory}
              onChange={setActiveCategory}
            />
          </div>
        )}

        {/* Menu items */}
        <div className="px-3 pt-4">
          {isLoading ? (
            <MenuSkeleton />
          ) : filteredItems.length === 0 ? (
            <div
              data-ocid="order.menu.empty_state"
              className="flex flex-col items-center justify-center gap-3 py-20 text-center"
            >
              <span className="text-4xl">🍽️</span>
              <p className="text-muted-foreground text-sm">
                {activeCategory !== null ? t.order.noItems : t.order.noMenu}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredItems.map((item, idx) => {
                const qty =
                  cartItems.find(
                    (c) => c.menuItemId.toString() === item.id.toString(),
                  )?.quantity ?? 0;
                return (
                  <MenuItemCard
                    key={item.id.toString()}
                    item={item}
                    onAdd={(i) =>
                      addItem({
                        menuItemId: i.id,
                        name: i.name,
                        price: i.price,
                        unit: i.unit,
                      })
                    }
                    qty={qty}
                    onIncrement={() => updateQuantity(item.id, qty + 1)}
                    onDecrement={() => updateQuantity(item.id, qty - 1)}
                    index={idx}
                    outOfStock={unavailableSet.has(item.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating cart bar at bottom */}
      {cartCount > 0 && !cartOpen && !showPayment && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none"
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            data-ocid="order.cart.open_modal_button"
            className="pointer-events-auto w-full flex items-center justify-between bg-primary text-primary-foreground font-semibold px-5 py-4 rounded-2xl shadow-lg hover:bg-primary/90 transition-smooth active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <span className="bg-primary-foreground/25 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                {cartCount}
              </span>
              <span className="text-sm">{t.nav.cart}</span>
            </div>
            <span className="text-sm font-bold">
              {formatPrice(useCart.getState().total())}
            </span>
          </button>
        </motion.div>
      )}

      {/* Cart drawer */}
      {tableIdentifier ? (
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          restaurantId={restaurantId}
          tableIdentifier={tableIdentifier}
          onRequestPayment={(items, _total, vatData) => {
            // Snapshot total directly from Zustand store at click time
            // BEFORE any state updates that might reset the cart
            const snapshotTotal = useCart.getState().total();
            setPendingPaymentTotal(snapshotTotal);
            setPendingPaymentItems(items);
            setPendingVatData(vatData);
            setShowPayment(true);
            setCartOpen(false);
          }}
          cartTotal={useCart.getState().total}
        />
      ) : null}

      {/* Pre-order payment panel */}
      {showPayment && restaurant && (
        <div ref={qrSectionRef}>
          {tingeeNotReady ? (
            <div
              data-ocid="order.payment.tingee_not_ready.error_state"
              className="flex flex-col items-center gap-3 py-6 text-center w-full"
            >
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <p className="text-sm text-destructive font-medium">
                {language === "vi"
                  ? "Mã QR Tingee chưa sẵn sàng. Vui lòng liên hệ nhân viên để được hỗ trợ thanh toán."
                  : "Tingee QR is not ready. Please contact staff for payment assistance."}
              </p>
            </div>
          ) : (
            <PaymentMethodSelector
              restaurant={restaurant}
              orderItems={pendingPaymentItems}
              totalAmount={pendingPaymentTotal}
              businessBankDetails={bankDetails ?? undefined}
              tingeeConfig={tingeeConfig}
              qrProvider={qrProvider}
              onCreateOrder={async () => {
                const result = await placeOrder.mutateAsync({
                  restaurantId: restaurantId!,
                  tableIdentifier,
                  items: cartItems.map(cartItemToOrderItem),
                  notes: undefined,
                  vatRequest: pendingVatData.vatRequest,
                  vatInfo: pendingVatData.vatInfo,
                });
                const newOrderId = result.orderId;
                const code = result.orderCode ?? undefined;
                pendingOrderIdRef.current = newOrderId;
                setCreatedOrderCode(code);
                return newOrderId;
              }}
              orderCode={createdOrderCode}
              onSuccess={() => {
                setConfirmedOrderId(pendingOrderIdRef.current);
                setConfirmedItems(pendingPaymentItems);
                setShowPayment(false);
                setCreatedOrderCode(undefined);
              }}
              onCancel={() => {
                setShowPayment(false);
                setPendingPaymentItems([]);
                setCreatedOrderCode(undefined);
                clearCart();
              }}
            />
          )}
        </div>
      )}

      {!tableIdentifier && cartOpen ? (
        <button
          type="button"
          data-ocid="order.cart.no_table_error_state"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm cursor-default"
          onClick={() => setCartOpen(false)}
          aria-label="Close"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-xs mx-4 text-center shadow-xl">
            <span className="text-4xl block mb-3">⚠️</span>
            <p className="text-sm text-muted-foreground">
              {language === "vi"
                ? "Vui lòng quét mã QR tại bàn để đặt món."
                : "Please scan the QR code at your table to place an order."}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCartOpen(false);
              }}
              className="mt-4 text-xs text-primary font-medium hover:underline"
            >
              {t.common.close ?? "Close"}
            </button>
          </div>
        </button>
      ) : null}
    </CustomerLayout>
  );
}
