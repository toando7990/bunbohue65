import { CustomerLayout } from "@/Layout";
import { JsonLd } from "@/components/JsonLd";
import { OrderTrackingProgressBar } from "@/components/OrderTrackingProgressBar";
import {
  PaymentMethodSelector,
  type QrProvider,
} from "@/components/PaymentMethodSelector";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cartItemToOrderItem,
  formatPrice,
  getTodayDateString,
  useEstimateShippingFee,
  useGetBusinessBankDetails,
  useGetBusinessProfileInfo,
  useGetCodSettings,
  useGetInvoiceInfo,
  useGetSellerInfo,
  useGetTingeeConfig,
  useListDeliveryOrders,
  useListMasterCategories,
  useListMasterMenuItems,
  usePlaceDeliveryOrder,
  usePublicRestaurants,
} from "@/hooks/useBackend";
import { useCart } from "@/hooks/useCart";
import { useLanguage } from "@/i18n";
import { OrderStatus } from "@/types";
import type {
  MenuCategory,
  MenuItem,
  OrderItem,
  RestaurantPublic,
} from "@/types";
import {
  isPlacedOnThisDevice,
  savePlacedOrder,
} from "@/utils/placedOrdersStore";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Printer,
  RefreshCw,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

const INPUT_CLS =
  "px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

// ─── Category Tabs ────────────────────────────────────────────────────────────

interface CatTabsProps {
  categories: MenuCategory[];
  active: bigint | null;
  onChange: (id: bigint | null) => void;
}

function CatTabs({ categories, active, onChange }: CatTabsProps) {
  const { t } = useLanguage();
  const sorted = [...categories].sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  return (
    <div className="flex gap-2" data-ocid="delivery.category.tab">
      {/* Left column: "Tất cả" button — fixed */}
      <div className="w-[90px] shrink-0">
        <button
          type="button"
          onClick={() => onChange(null)}
          data-ocid="delivery.category.all_tab"
          className={`w-full min-h-[36px] py-2 px-3 rounded-full text-xs font-medium transition-colors ${
            active === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/70"
          }`}
        >
          {t.common.all}
        </button>
      </div>
      {/* Right column: other categories, max 2 per row, max 2 rows */}
      <div
        className="flex-1 grid grid-cols-2 gap-1.5"
        style={{ maxHeight: "92px", overflow: "hidden" }}
      >
        {sorted.slice(0, 4).map((cat) => (
          <button
            key={cat.id.toString()}
            type="button"
            onClick={() => onChange(cat.id)}
            data-ocid={`delivery.category.tab.${cat.id.toString()}`}
            className={`min-h-[36px] py-1.5 px-2 rounded-full text-xs font-medium transition-colors truncate ${
              active?.toString() === cat.id.toString()
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────

interface MenuItemRowProps {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  index: number;
}

function MenuItemCard({
  item,
  qty,
  onAdd,
  onIncrement,
  onDecrement,
  index,
}: MenuItemRowProps) {
  const { t } = useLanguage();
  return (
    <div
      data-ocid={`delivery.menu_item.item.${index + 1}`}
      className="flex flex-col bg-card rounded-xl border border-border overflow-hidden"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center text-3xl">
          🍽️
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-2">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {item.name}
        </p>
        <p className="text-xs text-primary font-medium">
          {formatPrice(item.price)}
        </p>
        {qty === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            data-ocid={`delivery.menu_item.add_button.${index + 1}`}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium min-h-[36px] px-2 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-0.5"
          >
            <Plus className="w-3 h-3" /> {t.order.addToCart}
          </button>
        ) : (
          <div className="flex items-center justify-between mt-0.5">
            <button
              type="button"
              onClick={onDecrement}
              data-ocid={`delivery.menu_item.decrement_button.${index + 1}`}
              className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              aria-label={t.order.remove}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-semibold">{qty}</span>
            <button
              type="button"
              onClick={onIncrement}
              data-ocid={`delivery.menu_item.increment_button.${index + 1}`}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              aria-label={t.order.addToCart}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Memoized wrapper to stabilize MenuItemCard handlers ─────────────────────
// Each wrapper reads ONLY its own item quantity from the store —
// so it only re-renders when ITS quantity changes, not when any cart item changes.

const DeliveryMenuItemCardWrapper = memo(function DeliveryMenuItemCardWrapper({
  item,
  index,
  onAdd,
  updateQuantity,
}: {
  item: MenuItem;
  index: number;
  onAdd: (item: MenuItem) => void;
  updateQuantity: (id: bigint, qty: number) => void;
}) {
  // Stable per-item selector: only re-renders when THIS item's quantity changes
  const qty = useCart(
    (s) =>
      s.items.find((c) => c.menuItemId.toString() === item.id.toString())
        ?.quantity ?? 0,
  );
  const handleAdd = useCallback(() => onAdd(item), [onAdd, item]);
  const handleIncrement = useCallback(
    () => updateQuantity(item.id, qty + 1),
    [updateQuantity, item.id, qty],
  );
  const handleDecrement = useCallback(
    () => updateQuantity(item.id, qty - 1),
    [updateQuantity, item.id, qty],
  );
  return (
    <MenuItemCard
      item={item}
      qty={qty}
      onAdd={handleAdd}
      onIncrement={handleIncrement}
      onDecrement={handleDecrement}
      index={index}
    />
  );
});

// ─── Menu Section ─────────────────────────────────────────────────────────────

function MenuSection() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<bigint | null>(null);
  const { data: categories = [], isLoading: loadingCats } =
    useListMasterCategories();
  const { data: allItems = [], isLoading: loadingItems } =
    useListMasterMenuItems();

  // Use stable item count selector — avoids re-rendering ALL cards when any cart item changes.
  // Individual cards read their own quantity via per-item selector inside DeliveryMenuItemCardWrapper.
  const cartItemCount = useCart((s) => s.items.length);
  void cartItemCount; // used only to trigger re-render when items are added/removed from cart

  const handleAdd = useCallback(
    (item: MenuItem) =>
      useCart
        .getState()
        .addItem({ menuItemId: item.id, name: item.name, price: item.price }),
    [], // stable — reads state imperatively at call time, no Zustand selector dependency
  );

  const updateQuantity = useCallback(
    (menuItemId: bigint, quantity: number) =>
      useCart.getState().updateQuantity(menuItemId, quantity),
    [], // stable
  );

  const filtered = useMemo(() => {
    if (activeCategory === null) return allItems.filter((m) => m.isActive);
    return allItems.filter(
      (m) =>
        m.isActive && m.categoryId.toString() === activeCategory.toString(),
    );
  }, [allItems, activeCategory]);

  const isLoading = loadingCats || loadingItems;

  return (
    <div className="flex flex-col gap-3" data-ocid="delivery.menu.panel">
      {!loadingCats && categories.length > 0 && (
        <CatTabs
          categories={categories as any}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      )}

      {isLoading ? (
        <div
          data-ocid="delivery.menu.loading_state"
          className="grid grid-cols-2 gap-3"
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col bg-card rounded-xl border border-border overflow-hidden"
            >
              <Skeleton className="w-full aspect-square" />
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-ocid="delivery.menu.empty_state"
          className="flex flex-col items-center gap-3 py-12 text-center"
        >
          <span className="text-4xl">🍽️</span>
          <p className="text-muted-foreground text-sm">
            {activeCategory !== null ? t.order.noItems : t.order.noMenu}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item, idx) => (
            <DeliveryMenuItemCardWrapper
              key={item.id.toString()}
              item={item as any}
              index={idx}
              onAdd={handleAdd}
              updateQuantity={updateQuantity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cart Summary ─────────────────────────────────────────────────────────────

interface VatInfo {
  name: string;
  taxCode: string;
  address: string;
  email: string;
  accountNo: string;
}

/**
 * PaymentMethodSelector wrapper that shows QR immediately (pre-order mode).
 * The order is only created when payment is confirmed via onCreateOrder callback.
 */
function PlaceAndPaySelector({
  restaurant,
  address,
  customerName,
  customerPhone,
  note,
  cartItems,
  onValidate,
  vatInfo,
  taxLookupSuccess,
  taxLookupLoading,
  onSuccess,
  onOrderPlaced,
  onClose,
  shippingFee,
  invoiceEnabled,
  customerLat,
  customerLng,
  addressOutOfRange,
  addressFormatInvalid,
  shouldUseCod,
}: {
  restaurant: RestaurantPublic;
  address: string;
  customerName: string;
  customerPhone: string;
  note?: string;
  cartItems: ReturnType<typeof useCart.getState>["items"];
  onValidate: () => boolean;
  vatInfo: VatInfo;
  taxLookupSuccess: boolean;
  taxLookupLoading: boolean;
  onOrderPlaced?: () => void;
  onClose: () => void;
  shippingFee?: bigint;
  invoiceEnabled: boolean;
  customerLat: number | null;
  customerLng: number | null;
  addressOutOfRange: boolean;
  addressFormatInvalid?: boolean;
  shouldUseCod: boolean;
  onSuccess: (
    orderId: bigint,
    itemsSnapshot: ReturnType<typeof useCart.getState>["items"],
    totalSnapshot: bigint,
  ) => void;
}) {
  const { t } = useLanguage();
  const clearCart = useCart((s) => s.clearCart);
  const placeDelivery = usePlaceDeliveryOrder();
  const { data: businessBankDetails } = useGetBusinessBankDetails();
  const { data: tingeeConfig } = useGetTingeeConfig();
  // Derive QR provider from the restaurant's business config — customers
  // cannot choose; the business owner sets autoPaymentConfirmationApp.
  const qrProvider: QrProvider =
    restaurant?.autoPaymentConfirmationApp === "Tingee" ? "tingee" : "none";
  const isTingeeProvider = qrProvider === "tingee";
  const tingeeNotReady = isTingeeProvider && tingeeConfig == null;
  const [orderItemsSnapshot] = useState(() => [...cartItems]);
  const [totalSnapshot] = useState(() =>
    cartItems.reduce((s, i) => s + i.price * BigInt(i.quantity), 0n),
  );
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const createdOrderIdRef = useRef<bigint | null>(null);
  const createdOrderCodeRef = useRef<string | undefined>(undefined);

  const orderItemsForPayment = orderItemsSnapshot.map(
    (ci) =>
      ({
        menuItemId: ci.menuItemId,
        name: ci.name,
        price: ci.price,
        quantity: BigInt(ci.quantity),
        itemNote: ci.itemNote,
      }) as OrderItem,
  );

  // onCreateOrder: called by PaymentMethodSelector right before generating QR
  async function handleCreateOrder(): Promise<bigint> {
    setPlaceError(null);
    const cartSnapshot = orderItemsSnapshot;
    const result = await placeDelivery.mutateAsync({
      restaurantId: restaurant.id,
      items: cartSnapshot.map(cartItemToOrderItem),
      notes: note ?? "",
      deliveryAddress: address,
      customerName,
      customerPhone,
      isCod: shouldUseCod,
      vatRequest: invoiceEnabled,
      vatInfo:
        invoiceEnabled && vatInfo.taxCode.trim()
          ? {
              taxCode: vatInfo.taxCode.trim(),
              buyerName: vatInfo.name,
              address: vatInfo.address,
              email: vatInfo.email,
              accountNo: vatInfo.accountNo || undefined,
            }
          : null,
      shippingFee,
      deliveryLat: customerLat,
      deliveryLng: customerLng,
    });
    if (result.__kind__ !== "ok") {
      setPlaceError(t.delivery.placeOrderFailed);
      throw new Error(t.delivery.placeOrderFailed);
    }
    const orderId = result.ok.orderId;
    if (orderId === null || orderId === undefined) {
      setPlaceError(t.delivery.placeOrderFailed);
      throw new Error(t.delivery.placeOrderFailed);
    }
    // Record this order as placed on the current device so the in-page
    // tracking progress bar only shows orders placed on THIS device.
    // Frontend-only — never sent to the backend.
    savePlacedOrder(orderId);
    clearCart();
    onOrderPlaced?.();
    createdOrderIdRef.current = orderId;
    createdOrderCodeRef.current = result.ok.orderCode ?? undefined;
    // Auto-save customer info and VAT info to localStorage
    try {
      const deviceId = localStorage.getItem("tableorder_device_id") ?? "";
      localStorage.setItem(
        `delivery_customer_${deviceId}`,
        JSON.stringify({ name: customerName, phone: customerPhone, address }),
      );
      if (vatInfo.name.trim() || vatInfo.email.trim()) {
        localStorage.setItem(
          `delivery_vat_${deviceId}`,
          JSON.stringify({
            buyerName: vatInfo.name,
            email: vatInfo.email,
          }),
        );
      }
    } catch {
      // ignore
    }
    return orderId;
  }

  // Compute MST-blocked state: block when invoice enabled AND (taxCode empty OR lookup not succeeded)
  const taxMstBlocked =
    invoiceEnabled &&
    (vatInfo.taxCode.trim() === "" || (!taxLookupSuccess && !taxLookupLoading));

  // Show Đặt hàng button first; clicking it validates & shows QR panel
  if (!showing) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            if (onValidate()) setShowing(true);
          }}
          disabled={
            !customerName.trim() ||
            !customerPhone.trim() ||
            !address.trim() ||
            taxMstBlocked ||
            addressOutOfRange ||
            (addressFormatInvalid ?? false)
          }
          data-ocid="delivery.place_order.submit_button"
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Đặt hàng
        </button>
        {taxMstBlocked && (
          <p className="text-xs text-destructive text-center mt-1">
            {vatInfo.taxCode.trim() === ""
              ? "Vui lòng nhập mã số thuế để tiếp tục"
              : "Vui lòng nhập MST hợp lệ để đặt hàng"}
          </p>
        )}
        {!taxMstBlocked &&
          (!customerName.trim() ||
            !customerPhone.trim() ||
            !address.trim()) && (
            <p className="text-xs text-destructive text-center mt-1">
              Vui lòng nhập đầy đủ thông tin khách hàng
            </p>
          )}
        {(placeDelivery.isError || placeError) && (
          <p
            data-ocid="delivery.place_order.error_state"
            className="text-xs text-destructive text-center"
          >
            {placeError ?? t.common.error}
          </p>
        )}
      </div>
    );
  }

  // Show spinner while businessBankDetails are loading.
  // When the business selected Tingee, also wait for the tingeeConfig query
  // to settle (it returns null when not configured, not undefined) so we can
  // distinguish "still loading" from "not configured".
  if (
    businessBankDetails === undefined ||
    (isTingeeProvider && tingeeConfig === undefined)
  ) {
    return (
      <div
        data-ocid="order.payment.loading_state"
        className="flex flex-col items-center gap-3 py-6 w-full"
      >
        <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          Đang tải thông tin thanh toán...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      {shouldUseCod ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">
            Thanh toán khi nhận hàng (COD)
          </p>
          <p className="text-green-600 text-sm">
            Tài xế sẽ thanh toán tại quầy khi đến nhận hàng
          </p>
          <button
            type="button"
            onClick={handleCreateOrder}
            data-ocid="delivery.cod.place_order_button"
            className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Đặt hàng
          </button>
        </div>
      ) : tingeeNotReady ? (
        <div
          data-ocid="delivery.payment.tingee_not_ready.error_state"
          className="flex flex-col items-center gap-3 py-6 text-center w-full bg-destructive/5 border border-destructive/30 rounded-lg p-4"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <p className="text-sm text-destructive font-medium">
            QR Tingee chưa sẵn sàng. Vui lòng liên hệ nhà hàng hoặc thử lại sau.
          </p>
        </div>
      ) : (
        <PaymentMethodSelector
          restaurant={restaurant}
          orderItems={orderItemsForPayment}
          totalAmount={totalSnapshot}
          businessBankDetails={businessBankDetails ?? undefined}
          onCreateOrder={handleCreateOrder}
          orderCode={createdOrderCodeRef.current}
          qrProvider={qrProvider}
          tingeeConfig={tingeeConfig}
          onSuccess={() => {
            onSuccess(
              createdOrderIdRef.current ?? 0n,
              orderItemsSnapshot,
              totalSnapshot,
            );
          }}
          onCancel={() => {
            clearCart();
            setShowing(false);
            setPlaceError(null);
            onClose();
          }}
        />
      )}
      {(placeDelivery.isError || placeError) && (
        <p
          data-ocid="delivery.place_order.error_state"
          className="text-xs text-destructive text-center"
        >
          {placeError ?? t.common.error}
        </p>
      )}
    </div>
  );
}

// ─── Delivery Cart Drawer ──────────────────────────────────────────────────

interface DeliveryCartDrawerProps {
  open: boolean;
  onClose: () => void;
  restaurant: RestaurantPublic;
  restaurants: RestaurantPublic[];
  onRestaurantChange: (r: RestaurantPublic) => void;
  address: string;
  customerName: string;
  customerPhone: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  errors: { name: boolean; phone: boolean; locationName: boolean };
  onBlur: (field: "name" | "phone" | "locationName") => void;
  note?: string;
  onValidate: () => boolean;
  onDone: (
    orderId: bigint,
    itemsSnapshot: ReturnType<typeof useCart.getState>["items"],
    totalSnapshot: bigint,
  ) => void;
}

function DeliveryCartDrawer({
  open,
  onClose,
  restaurant,
  restaurants,
  onRestaurantChange,
  address,
  customerName,
  customerPhone,
  onNameChange,
  onPhoneChange,
  onAddressChange,
  errors,
  onBlur,
  note,
  onValidate,
  onDone,
}: DeliveryCartDrawerProps) {
  const { t } = useLanguage();
  const cartItems = useCart((s) => s.items);
  const total = useCart((s) => s.total);
  const [cartRestaurant, setCartRestaurant] = useState<RestaurantPublic | null>(
    restaurant,
  );
  const [showRestaurantList, setShowRestaurantList] = useState(false);
  useEffect(() => {
    if (restaurant && !cartRestaurant) {
      setCartRestaurant(restaurant);
    }
  }, [restaurant, cartRestaurant]);
  const [paid, setPaid] = useState(false);
  const [paidOrderId, setPaidOrderId] = useState<bigint | null>(null);
  const [_orderPlaced, setOrderPlaced] = useState(false);
  const [shippingFee, setShippingFee] = useState<bigint>(0n);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isFallbackFee, setIsFallbackFee] = useState(false);
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [addressOutOfRange, setAddressOutOfRange] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [shippingFeeError, setShippingFeeError] = useState<string | null>(null);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const estimateShipping = useEstimateShippingFee();
  const { data: codSettingsData } = useGetCodSettings();
  const isCodAllowed = codSettingsData?.isCodAllowed ?? false;
  const codLimit = Number(codSettingsData?.codLimit || 0);
  const totalItems = cartItems.reduce(
    (s, i) => s + i.price * BigInt(i.quantity),
    0n,
  );
  const shouldUseCod = isCodAllowed && totalItems <= codLimit;
  const [_isCod, _setIsCod] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when restaurant, address, or coordinates change
  useEffect(() => {
    if (!cartRestaurant || !address || address.split(",").length < 4) return;
    if (addressOutOfRange) return;
    estimateShipping
      .mutateAsync({
        restaurantId: cartRestaurant.id.toString(),
        dropoffAddress: address,
        dropoffLat: customerLat ?? undefined,
        dropoffLng: customerLng ?? undefined,
      })
      .then((result) => {
        setShippingFee(BigInt(result?.shippingFee ?? 0));
        setDistanceKm(result?.distanceKm ?? null);
        setIsFallbackFee(result?.isFallback ?? false);
        setShippingFeeError(null);
      })
      .catch((err: unknown) => {
        setShippingFee(BigInt(0));
        const msg = err instanceof Error ? err.message : String(err);
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes("not authorized") || lowerMsg.includes("401")) {
          setShippingFeeError(
            "AhaMove: Không được phép — vui lòng kiểm tra lại API Key trong Hồ sơ doanh nghiệp",
          );
        } else if (lowerMsg.includes("not configured")) {
          setShippingFeeError(
            "Nhà hàng chưa cấu hình đầy đủ thông tin giao hàng",
          );
        } else if (lowerMsg.includes("restaurant address")) {
          setShippingFeeError("Địa chỉ nhà hàng chưa được cài đặt");
        } else if (
          lowerMsg.includes("timeout") ||
          lowerMsg.includes("network")
        ) {
          setShippingFeeError(
            "Không thể kết nối đến dịch vụ vận chuyển — vui lòng thử lại sau vài giây",
          );
        } else {
          setShippingFeeError(
            `Không thể tính phí vận chuyển — ${msg || "vui lòng thử lại"}`,
          );
        }
      });
  }, [
    cartRestaurant?.id,
    address,
    customerLat,
    customerLng,
    addressOutOfRange,
  ]);
  const [invoiceEnabled, setInvoiceEnabled] = useState(false);
  const [vatInfo, setVatInfo] = useState<VatInfo>({
    name: "",
    taxCode: "",
    address: "",
    email: "",
    accountNo: "",
  });
  const setVat = useCallback(
    <K extends keyof VatInfo>(k: K, v: string) =>
      setVatInfo((prev) => ({ ...prev, [k]: v })),
    [],
  );
  const shippingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Load saved VAT info from localStorage on mount
  useEffect(() => {
    try {
      const deviceId = localStorage.getItem("tableorder_device_id") ?? "";
      const raw = localStorage.getItem(`delivery_vat_${deviceId}`);
      if (raw) {
        const saved = JSON.parse(raw) as {
          buyerName?: string;
          email?: string;
        };
        setVatInfo((prev) => ({
          ...prev,
          name: saved.buyerName ?? prev.name,
          email: saved.email ?? prev.email,
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  // NOTE: Do NOT auto-fill VAT address from delivery address — khách lẻ must have empty address

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
  const taxLookupLoading = false;
  const taxLookupSuccess =
    vatInfo.taxCode.trim() !== "" && businessTaxCode.trim() !== "";
  const taxLookupError: string | null = null;

  // Auto-populate MST field from the business's taxCode. This replaces the
  // VietQR fetch — the MST input is pre-filled with the business's taxCode.
  useEffect(() => {
    if (businessTaxCode.trim()) {
      setVat("taxCode", businessTaxCode);
    }
  }, [businessTaxCode, setVat]);

  // Mirror businessName/businessAddress into vat fields when lookup succeeds.
  useEffect(() => {
    if (taxLookupSuccess) {
      setVatInfo((prev) => ({
        ...prev,
        name: businessName,
        address: businessAddress,
        accountNo: "",
      }));
    } else {
      setVatInfo((prev) => ({
        ...prev,
        name: "",
        address: "",
        accountNo: "",
      }));
    }
  }, [taxLookupSuccess, businessName, businessAddress]);

  function handleRemove(menuItemId: bigint) {
    useCart.getState().removeItem(menuItemId);
  }
  function handleUpdateQty(menuItemId: bigint, qty: number) {
    useCart.getState().updateQuantity(menuItemId, qty);
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

          {/* Bottom sheet */}
          <motion.aside
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            aria-label={t.order.cartTitle}
            data-ocid="delivery.cart.dialog"
            className="fixed left-0 right-0 bottom-0 z-50 max-h-[90vh] bg-card rounded-t-2xl shadow-2xl flex flex-col"
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
                data-ocid="delivery.cart.close_button"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label={t.common.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Restaurant selection */}
              <div
                className="bg-background border border-border rounded-xl p-3 flex flex-col gap-2"
                data-ocid="delivery.cart.restaurant.panel"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    Chọn nhà hàng
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRestaurantList((s) => !s)}
                    data-ocid="delivery.cart.restaurant.toggle_button"
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    {showRestaurantList ? "Thu gọn" : "Thay đổi"}
                  </button>
                </div>
                {cartRestaurant ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {cartRestaurant.name}
                    </span>
                    {cartRestaurant?.address ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {cartRestaurant.address}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        Nhà hàng chưa cấu hình địa chỉ
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-destructive">
                    Vui lòng chọn nhà hàng
                  </p>
                )}
                {showRestaurantList && (
                  <div className="flex flex-col gap-1 mt-1">
                    {restaurants.map((r) => (
                      <button
                        key={r.id.toString()}
                        type="button"
                        onClick={() => {
                          setCartRestaurant(r);
                          onRestaurantChange(r);
                          setShowRestaurantList(false);
                        }}
                        data-ocid={`delivery.cart.restaurant.item.${r.id.toString()}`}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          cartRestaurant?.id.toString() === r.id.toString()
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-secondary"
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {cartItems.length === 0 && !paid ? (
                <div
                  data-ocid="delivery.cart.empty_state"
                  className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                >
                  <ShoppingCart className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    {t.order.cartEmpty}
                  </p>
                </div>
              ) : paid && paidOrderId !== null ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  data-ocid="delivery.cart.success_state"
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="font-display text-xl italic text-foreground">
                    {t.delivery.orderPlaced}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t.delivery.orderPlacedDesc}
                  </p>
                  {address.trim() && (
                    <div className="w-full bg-muted/30 border border-border rounded-xl p-3 text-left">
                      <p className="text-xs text-muted-foreground">
                        {t.delivery.deliveryingTo}
                      </p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {address}
                      </p>
                      {customerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {customerName} · {customerPhone}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <>
                  {!cartRestaurant && (
                    <div
                      data-ocid="delivery.cart.restaurant.warning"
                      className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
                    >
                      <p className="text-sm text-destructive font-medium">
                        Vui lòng chọn nhà hàng để tiếp tục
                      </p>
                    </div>
                  )}

                  {cartRestaurant && (
                    <>
                      {/* Customer info */}
                      <div
                        className="bg-background border border-border rounded-xl p-3 flex flex-col gap-2"
                        data-ocid="delivery.customer_info.panel"
                      >
                        <p className="text-xs font-semibold text-foreground">
                          Thông tin khách hàng
                        </p>
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <label
                              htmlFor="cart-name"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              {t.delivery.customerName}{" "}
                              <span className="text-destructive">*</span>
                            </label>
                            <input
                              id="cart-name"
                              type="text"
                              value={customerName}
                              onChange={(e) => onNameChange(e.target.value)}
                              onBlur={() => onBlur("name")}
                              placeholder={t.delivery.customerNamePlaceholder}
                              data-ocid="delivery.cart.name_input"
                              className={`${INPUT_CLS} w-full ${errors.name ? "border-destructive" : ""}`}
                            />
                            {errors.name && (
                              <p
                                data-ocid="delivery.cart.name.field_error"
                                className="text-[10px] text-destructive"
                              >
                                {t.delivery.nameRequired}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <label
                              htmlFor="cart-phone"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              {t.delivery.customerPhone}{" "}
                              <span className="text-destructive">*</span>
                            </label>
                            <input
                              id="cart-phone"
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => onPhoneChange(e.target.value)}
                              onBlur={() => onBlur("phone")}
                              placeholder={t.delivery.customerPhonePlaceholder}
                              data-ocid="delivery.cart.phone_input"
                              className={`${INPUT_CLS} w-full ${errors.phone ? "border-destructive" : ""}`}
                            />
                            {errors.phone && (
                              <p
                                data-ocid="delivery.cart.phone.field_error"
                                className="text-[10px] text-destructive"
                              >
                                {t.delivery.phoneRequired}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label
                            htmlFor="cart-address"
                            className="text-xs font-medium text-muted-foreground"
                          >
                            {t.delivery.locationName}{" "}
                            <span className="text-destructive">*</span>
                          </label>
                          <input
                            id="cart-address"
                            type="text"
                            value={address}
                            onChange={(e) => {
                              const newAddress = e.target.value;
                              onAddressChange(newAddress);
                              setGeocodeStatus("loading");
                              setAddressOutOfRange(false);
                              setCustomerLat(null);
                              setCustomerLng(null);
                              setIsFallbackFee(false);
                              if (shippingDebounceRef.current)
                                clearTimeout(shippingDebounceRef.current);
                              if (newAddress.length > 10) {
                                setIsEstimatingShipping(true);
                                shippingDebounceRef.current = setTimeout(
                                  async () => {
                                    const activeRestaurant =
                                      cartRestaurant ?? restaurant;
                                    setShippingFeeError(null);
                                    // Step 1: Geocode first
                                    let resolvedLat: number | null = null;
                                    let resolvedLng: number | null = null;
                                    try {
                                      const geoRes = await fetch(
                                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}&limit=1`,
                                      );
                                      const geoData =
                                        (await geoRes.json()) as Array<{
                                          lat: string;
                                          lon: string;
                                        }>;
                                      if (geoData.length > 0) {
                                        resolvedLat = Number.parseFloat(
                                          geoData[0].lat,
                                        );
                                        resolvedLng = Number.parseFloat(
                                          geoData[0].lon,
                                        );
                                        setCustomerLat(resolvedLat);
                                        setCustomerLng(resolvedLng);
                                        const restLat =
                                          activeRestaurant?.coordinateLatitude;
                                        const restLng =
                                          activeRestaurant?.coordinateLongitude;
                                        const radius =
                                          activeRestaurant?.deliveryRadiusKm;
                                        if (
                                          restLat != null &&
                                          restLng != null &&
                                          radius != null &&
                                          Number(radius) > 0
                                        ) {
                                          const R = 6371;
                                          const dLat =
                                            ((resolvedLat - Number(restLat)) *
                                              Math.PI) /
                                            180;
                                          const dLon =
                                            ((resolvedLng - Number(restLng)) *
                                              Math.PI) /
                                            180;
                                          const a =
                                            Math.sin(dLat / 2) ** 2 +
                                            Math.cos(
                                              (Number(restLat) * Math.PI) / 180,
                                            ) *
                                              Math.cos(
                                                (resolvedLat * Math.PI) / 180,
                                              ) *
                                              Math.sin(dLon / 2) ** 2;
                                          const dist =
                                            R *
                                            2 *
                                            Math.atan2(
                                              Math.sqrt(a),
                                              Math.sqrt(1 - a),
                                            );
                                          if (dist > Number(radius)) {
                                            setAddressOutOfRange(true);
                                            setGeocodeStatus("failed");
                                            setIsEstimatingShipping(false);
                                            return; // do not estimate if out of range
                                          }
                                        }
                                        setAddressOutOfRange(false);
                                        setGeocodeStatus("success");
                                      } else {
                                        setCustomerLat(null);
                                        setCustomerLng(null);
                                        setAddressOutOfRange(false);
                                        setGeocodeStatus("failed");
                                        // geocode failed — still try to estimate with text only
                                      }
                                    } catch {
                                      setCustomerLat(null);
                                      setCustomerLng(null);
                                      setAddressOutOfRange(false);
                                      setGeocodeStatus("failed");
                                    }
                                    setIsEstimatingShipping(false);
                                  },
                                  600,
                                );
                              } else {
                                setIsEstimatingShipping(false);
                                setGeocodeStatus("idle");
                              }
                            }}
                            onBlur={() => onBlur("locationName")}
                            placeholder="Số nhà, đường/phố, phường/xã, tỉnh/thành phố"
                            data-ocid="delivery.cart.address_input"
                            className={`${INPUT_CLS} w-full ${errors.locationName ? "border-destructive" : ""}`}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Ví dụ: 65, Đường Láng, Đống Đa, Hà Nội
                          </p>
                          {errors.locationName && (
                            <p
                              data-ocid="delivery.cart.address.field_error"
                              className="text-[10px] text-destructive"
                            >
                              {t.delivery.addressRequired}
                            </p>
                          )}
                          {geocodeStatus === "loading" && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Đang kiểm tra địa chỉ...
                            </p>
                          )}
                          {geocodeStatus === "failed" && !addressOutOfRange && (
                            <p className="text-xs text-yellow-500 mt-1">
                              Không thể xác minh địa chỉ
                            </p>
                          )}
                          {geocodeStatus === "success" &&
                            !addressOutOfRange && (
                              <>
                                <p className="text-xs text-green-600 mt-1">
                                  Địa chỉ hợp lệ
                                </p>
                                {address.split(",").length < 4 && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Vui lòng nhập đủ 4 phần: Số nhà, Đường/Phố,
                                    Phường/Xã, Tỉnh/Thành phố
                                  </p>
                                )}
                              </>
                            )}
                          {addressOutOfRange && (
                            <p className="text-xs text-red-600 mt-1">
                              Địa chỉ nằm ngoài khu vực giao hàng (giới hạn{" "}
                              {Number(cartRestaurant?.deliveryRadiusKm)} km)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* VAT / MST section — with toggle */}
                      <div
                        className="bg-background border border-border rounded-xl p-3 flex flex-col gap-2"
                        data-ocid="delivery.vat.panel"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">
                            Hoá đơn có mã số thuế
                          </p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={invoiceEnabled}
                            data-ocid="delivery.vat.toggle"
                            onClick={() => {
                              setInvoiceEnabled((v) => !v);
                              if (invoiceEnabled) {
                                setVatInfo({
                                  name: "",
                                  taxCode: "",
                                  address: "",
                                  email: "",
                                  accountNo: "",
                                });
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${invoiceEnabled ? "bg-primary" : "bg-muted"}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${
                                invoiceEnabled
                                  ? "translate-x-4"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        {!invoiceEnabled && (
                          <p className="text-[10px] text-muted-foreground">
                            Tắt → phát hành hoá đơn cho khách lẻ
                          </p>
                        )}
                        {invoiceEnabled && (
                          <div className="flex flex-col gap-0.5">
                            <label
                              htmlFor="cart-taxcode"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Mã số thuế doanh nghiệp
                            </label>
                            <div className="relative">
                              <input
                                id="cart-taxcode"
                                type="text"
                                value={vatInfo.taxCode}
                                onChange={(e) =>
                                  setVat("taxCode", e.target.value)
                                }
                                placeholder="Nhập MST để tra cứu tự động"
                                data-ocid="delivery.vat.taxcode_input"
                                className={`${INPUT_CLS} w-full pr-8`}
                              />
                              {vatInfo.taxCode.trim() && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                                  {taxLookupLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                  ) : taxLookupSuccess ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  ) : taxLookupError ? (
                                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                                  ) : null}
                                </span>
                              )}
                            </div>
                            {invoiceEnabled &&
                              vatInfo.taxCode.trim() === "" && (
                                <p
                                  data-ocid="delivery.vat.taxcode.empty_warning"
                                  className="text-[10px] text-amber-600"
                                >
                                  Vui lòng nhập mã số thuế để tiếp tục
                                </p>
                              )}
                            {taxLookupLoading && vatInfo.taxCode.trim() && (
                              <p className="text-[10px] text-muted-foreground">
                                Đang tìm kiếm...
                              </p>
                            )}
                            {taxLookupError && (
                              <p
                                data-ocid="delivery.vat.lookup.error_state"
                                className="text-[10px] text-destructive"
                              >
                                {taxLookupError}
                              </p>
                            )}
                            {taxLookupSuccess && vatInfo.name && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-2 pt-2 border-t border-border"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Tên người mua / công ty
                                  </span>
                                  <div
                                    data-ocid="delivery.vat.name_display"
                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-sm select-all"
                                  >
                                    {vatInfo.name}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <label
                                    htmlFor="cart-vatemail"
                                    className="text-xs font-medium text-muted-foreground"
                                  >
                                    Email nhận hoá đơn{" "}
                                    <span className="text-muted-foreground/60 font-normal">
                                      (tuỳ chọn)
                                    </span>
                                  </label>
                                  <input
                                    id="cart-vatemail"
                                    type="email"
                                    value={vatInfo.email}
                                    onChange={(e) =>
                                      setVat("email", e.target.value)
                                    }
                                    placeholder="email@example.com"
                                    data-ocid="delivery.vat.email_input"
                                    className={`${INPUT_CLS} w-full`}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cart items */}
                      {cartItems.map((item, idx) => (
                        <div
                          key={item.menuItemId.toString()}
                          data-ocid={`delivery.cart.item.${idx + 1}`}
                          className="flex items-center justify-between gap-3 pb-4 border-b border-border last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleRemove(item.menuItemId)}
                              data-ocid={`delivery.cart.delete_button.${idx + 1}`}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              aria-label={t.order.remove}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPrice(item.price)} × {item.quantity} ={" "}
                                <span className="text-primary font-semibold">
                                  {formatPrice(
                                    item.price * BigInt(item.quantity),
                                  )}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQty(
                                  item.menuItemId,
                                  item.quantity - 1,
                                )
                              }
                              data-ocid={`delivery.cart.decrement_button.${idx + 1}`}
                              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                              aria-label="-"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-semibold w-5 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQty(
                                  item.menuItemId,
                                  item.quantity + 1,
                                )
                              }
                              data-ocid={`delivery.cart.increment_button.${idx + 1}`}
                              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                              aria-label="+"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer with total + Đặt hàng */}
            {cartItems.length > 0 && !paid && (
              <div className="px-5 py-4 border-t border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {t.common.total} (
                    {cartItems.reduce((s, i) => s + i.quantity, 0)}{" "}
                    {t.order.items})
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {formatPrice(total())}
                  </span>
                </div>
                {address.trim() && (
                  <div className="mb-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tiền hàng</span>
                      <span>
                        {formatPrice(
                          cartItems.reduce(
                            (s, i) => s + i.price * BigInt(i.quantity),
                            0n,
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-muted-foreground">
                        <div>
                          <span>Phí vận chuyển</span>
                          {!isCodAllowed && (
                            <p className="text-xs text-muted-foreground">
                              (Tài xế thu khi giao hàng)
                            </p>
                          )}
                        </div>
                        <span className="flex items-center gap-1">
                          {isEstimatingShipping ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Đang tính...
                            </>
                          ) : isFallbackFee ? (
                            <span className="text-yellow-600">
                              ~{formatPrice(shippingFee)} (ước tính)
                            </span>
                          ) : (
                            <>
                              {formatPrice(shippingFee)}
                              {distanceKm !== null && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (~{distanceKm.toFixed(1)}km)
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                      {(shippingFeeError || isFallbackFee) && (
                        <button
                          type="button"
                          className="text-xs text-blue-600 underline cursor-pointer flex items-center gap-1 mt-1"
                          onClick={() => {
                            if (!cartRestaurant || !address) return;
                            setIsEstimatingShipping(true);
                            setShippingFeeError(null);
                            estimateShipping
                              .mutateAsync({
                                restaurantId: cartRestaurant.id.toString(),
                                dropoffAddress: address,
                                dropoffLat: customerLat ?? undefined,
                                dropoffLng: customerLng ?? undefined,
                              })
                              .then((result) => {
                                setShippingFee(
                                  BigInt(result?.shippingFee ?? 0),
                                );
                                setDistanceKm(result?.distanceKm ?? null);
                                setIsFallbackFee(result?.isFallback ?? false);
                                setShippingFeeError(null);
                              })
                              .catch((err: unknown) => {
                                const msg =
                                  err instanceof Error
                                    ? err.message
                                    : String(err);
                                setShippingFeeError(
                                  `Không thể tính phí vận chuyển — ${msg || "vui lòng thử lại"}`,
                                );
                              })
                              .finally(() => setIsEstimatingShipping(false));
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Tính lại
                        </button>
                      )}
                      {shippingFeeError && (
                        <p className="text-xs text-red-500">
                          {shippingFeeError}
                        </p>
                      )}
                      {isFallbackFee && !shippingFeeError && (
                        <p className="text-xs text-yellow-600">
                          Đang dùng phí ước tính — nhấn Tính lại để cập nhật
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
                      <div>
                        <span>
                          {isCodAllowed
                            ? "Tổng tiền thanh toán"
                            : "Tổng thanh toán online"}
                        </span>
                        {isCodAllowed && (
                          <span className="text-xs text-muted-foreground block">
                            (Tài xế thu khi giao hàng)
                          </span>
                        )}
                      </div>
                      <span>
                        {formatPrice(
                          isCodAllowed
                            ? cartItems.reduce(
                                (s, i) => s + i.price * BigInt(i.quantity),
                                0n,
                              ) + shippingFee
                            : cartItems.reduce(
                                (s, i) => s + i.price * BigInt(i.quantity),
                                0n,
                              ),
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {!cartRestaurant && (
                  <p className="text-xs text-destructive text-center mb-2">
                    Vui lòng chọn nhà hàng để đặt hàng
                  </p>
                )}
                <PlaceAndPaySelector
                  restaurant={cartRestaurant ?? restaurant}
                  address={address}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  note={note}
                  cartItems={cartItems}
                  vatInfo={vatInfo}
                  taxLookupSuccess={taxLookupSuccess}
                  taxLookupLoading={taxLookupLoading}
                  shippingFee={shippingFee}
                  invoiceEnabled={invoiceEnabled}
                  customerLat={customerLat}
                  customerLng={customerLng}
                  addressOutOfRange={addressOutOfRange}
                  addressFormatInvalid={
                    address.length > 0 && address.split(",").length < 4
                  }
                  shouldUseCod={shouldUseCod}
                  onValidate={() => {
                    if (!cartRestaurant) return false;
                    const valid = onValidate();
                    if (!valid) onClose();
                    return valid;
                  }}
                  onOrderPlaced={() => setOrderPlaced(true)}
                  onClose={onClose}
                  onSuccess={(orderId, itemsSnapshot, totalSnapshot) => {
                    setPaid(true);
                    setPaidOrderId(orderId);
                    onDone(orderId, itemsSnapshot, totalSnapshot);
                  }}
                />
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Business Fixed Footer ───────────────────────────────────────────────────

interface BusinessFixedFooterProps {
  businessName?: string | null;
  address?: string | null;
  taxCode?: string | null;
  phone?: string | null;
  domain?: string | null;
}

function BusinessFixedFooter({
  businessName,
  address,
  taxCode,
  phone,
  domain,
}: BusinessFixedFooterProps) {
  if (!businessName && !address && !taxCode && !phone && !domain) return null;
  const line3Parts: string[] = [];
  if (taxCode) line3Parts.push(`MST: ${taxCode}`);
  if (phone) line3Parts.push(phone);
  if (domain) line3Parts.push(domain);
  line3Parts.push("\u00a9 2026.");
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3 flex flex-col items-center justify-center gap-0.5"
      data-ocid="delivery.business_footer.panel"
    >
      {businessName && (
        <p className="text-xs sm:text-sm font-bold uppercase text-foreground truncate text-center px-2">
          {businessName}
        </p>
      )}
      {address && (
        <p className="text-xs text-muted-foreground truncate text-center">
          {address}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground truncate text-center">
        {line3Parts.join(" / ")}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveryOrderPage() {
  const { t } = useLanguage();

  // ── Schema data for JSON-LD (dynamic from real API)
  const { data: masterItems } = useListMasterMenuItems();
  const { data: masterCategories } = useListMasterCategories();
  const { data: restaurants = [] } = usePublicRestaurants();

  const jsonLdSchemas = useMemo(() => {
    const schemas: object[] = [];

    const menuItemsList = masterItems ?? [];
    const menuCategoriesList = masterCategories ?? [];

    const menuSections = menuCategoriesList.map((cat) => ({
      "@type": "MenuSection",
      name: cat.name,
      hasMenuItem: menuItemsList
        .filter(
          (item) =>
            item.categoryId.toString() === cat.id.toString() && item.isActive,
        )
        .map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description || undefined,
          image: item.imageUrl || undefined,
          offers: {
            "@type": "Offer",
            price: String(Number(item.price)),
            priceCurrency: "VND",
          },
        })),
    }));

    const firstRestaurant = restaurants?.[0];

    const restaurantSchema: object = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "@id": "https://www.bunbohue65.vn/#restaurant",
      name: "Bún Bò Huế 65",
      url: "https://www.bunbohue65.vn/",
      telephone: "+84-914-658-365",
      servesCuisine: ["Bún bò Huế", "Món Huế", "Ẩm thực Việt"],
      priceRange: "$",
      currenciesAccepted: "VND",
      paymentAccepted: "Cash, QR Code",
      image: "https://www.bunbohue65.vn/logo.png",
      logo: "https://www.bunbohue65.vn/logo.png",
      address: {
        "@type": "PostalAddress",
        streetAddress: firstRestaurant?.address ?? "69 Đường Láng",
        addressLocality: "Hà Nội",
        addressRegion: "Hà Nội",
        addressCountry: "VN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "21.027",
        longitude: "105.834",
      },
      openingHours: ["Mo-Su 06:00-22:00"],
      hasMenu: {
        "@type": "Menu",
        name: "Thực đơn Bún Bò Huế 65",
        url: "https://www.bunbohue65.vn/",
        hasMenuSection: menuSections.length > 0 ? menuSections : undefined,
      },
      potentialAction: {
        "@type": "OrderAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://www.bunbohue65.vn/",
          inLanguage: "vi",
          actionPlatform: [
            "http://schema.org/DesktopWebPlatform",
            "http://schema.org/MobileWebPlatform",
          ],
        },
        deliveryMethod: [
          "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
        ],
      },
    };
    schemas.push(restaurantSchema);

    const breadcrumbSchema: object = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Trang chủ",
          item: "https://www.bunbohue65.vn/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Đặt món từ xa",
          item: "https://www.bunbohue65.vn/",
        },
      ],
    };
    schemas.push(breadcrumbSchema);

    return schemas;
  }, [masterItems, masterCategories, restaurants]);

  // Address step state — start as 'skipped' to bypass address entry screen
  const [_addressStep, _setAddressStep] = useState<
    "pending" | "done" | "skipped"
  >("skipped");

  const [locationName, setLocationName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantPublic | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<bigint | null>(null);
  // Finding-driver countdown
  const [findingDriverMode, setFindingDriverMode] = useState<
    "finding" | "dispatched" | "found" | null
  >(null);
  const [findingDriverSecsLeft, setFindingDriverSecsLeft] = useState(30);
  const findingDriverTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const { data: invoiceInfo } = useGetInvoiceInfo(completedOrderId);
  // Only fetch today's (UTC+7, Asia/Ho_Chi_Minh) delivery orders so the
  // progress bar never surfaces orders from previous days.
  const deliveryOrdersQuery = useListDeliveryOrders(
    selectedRestaurant?.id ?? null,
    getTodayDateString(),
  );

  // The progress bar shows ONLY ONE current order at a time: the most recent
  // order placed today (UTC+7) whose status is not yet #Delivered and not
  // Cancelled. A just-placed order (completedOrderId) is preferred only while
  // it is not yet Delivered; once it becomes Delivered it yields to the next
  // qualifying order, which the 5s refetch will surface automatically.
  const trackedOrder = useMemo(() => {
    const orders = deliveryOrdersQuery.data;
    if (!orders || orders.length === 0) return null;
    // Qualifying orders: today's orders not yet Delivered, not Cancelled,
    // AND placed on THIS device (so the progress bar only tracks orders the
    // current device actually placed — never other devices' orders).
    const qualifying = orders.filter(
      (o) =>
        o.status !== OrderStatus.Delivered &&
        o.status !== OrderStatus.Cancelled &&
        isPlacedOnThisDevice(o.id),
    );
    // A just-placed order is preferred only while it is still qualifying
    // (not yet Delivered / Cancelled / placed on this device).
    if (completedOrderId != null) {
      const justPlaced = qualifying.find((o) => o.id === completedOrderId);
      if (justPlaced) return justPlaced;
    }
    if (qualifying.length === 0) return null;
    // Pick the most recent by createdAt (descending); fall back to id.
    return qualifying.sort((a, b) => {
      const ta = a.createdAt ? Number(a.createdAt) : 0;
      const tb = b.createdAt ? Number(b.createdAt) : 0;
      if (tb !== ta) return tb - ta;
      return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
    })[0];
  }, [deliveryOrdersQuery.data, completedOrderId]);

  useEffect(() => {
    if (completedOrderId == null) return;
    const order = deliveryOrdersQuery.data?.find(
      (o) => o.id === completedOrderId,
    );
    if (order) {
      // If driver accepted during finding window, mark as found
      if (
        findingDriverMode === "finding" &&
        (order.status === OrderStatus.Pending ||
          order.status === OrderStatus.Preparing ||
          order.status === OrderStatus.Ready)
      ) {
        if (order.shipperName || order.shippingStatus) {
          clearInterval(findingDriverTimerRef.current!);
          findingDriverTimerRef.current = null;
          setFindingDriverMode("found");
        }
      }
    }
  }, [deliveryOrdersQuery.data, completedOrderId, findingDriverMode]);
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    locationName: false,
  });
  // Auto-select first restaurant on mount
  useEffect(() => {
    if (restaurants.length > 0 && !selectedRestaurant) {
      setSelectedRestaurant(restaurants[0]);
    }
  }, [restaurants, selectedRestaurant]);

  // Derive business name and address from first restaurant
  const businessName =
    restaurants[0]?.businessName || restaurants[0]?.name || "";
  const businessAddress = restaurants[0]?.address || "";

  // Load saved recipient info from localStorage (per-device, not shared)
  useEffect(() => {
    try {
      const deviceId = localStorage.getItem("tableorder_device_id") ?? "";
      const raw = localStorage.getItem(`delivery_customer_${deviceId}`);
      if (raw) {
        const saved = JSON.parse(raw) as {
          name?: string;
          phone?: string;
          address?: string;
        };
        if (saved.name) setCustomerName(saved.name);
        if (saved.phone) setCustomerPhone(saved.phone);
        if (saved.address)
          setLocationName((prev) => prev || saved.address || "");
      }
    } catch {
      // ignore
    }
  }, []);

  const _clearCart = useCart((s) => s.clearCart);
  const cartItems = useCart((s) => s.items);

  const errors = {
    name: touched.name && !customerName.trim(),
    phone: touched.phone && !customerPhone.trim(),
    locationName: touched.locationName && !locationName.trim(),
  };

  function handleBlur(field: "name" | "phone" | "locationName") {
    setTouched((p) => ({ ...p, [field]: true }));
  }

  function validate(): boolean {
    setTouched({ name: true, phone: true, locationName: true });
    return !!(
      customerName.trim() &&
      customerPhone.trim() &&
      locationName.trim()
    );
  }

  function handleSelectRestaurant(r: RestaurantPublic) {
    setSelectedRestaurant(r);
  }

  function handleOrderDone(
    orderId: bigint,
    _itemsSnapshot: ReturnType<typeof useCart.getState>["items"],
    _totalSnapshot: bigint,
  ) {
    _clearCart();
    setCompletedOrderId(orderId);
    setFindingDriverMode("finding");
    setFindingDriverSecsLeft(30);
    // Clear any existing timer
    if (findingDriverTimerRef.current)
      clearInterval(findingDriverTimerRef.current);
    // Start 30-second countdown
    findingDriverTimerRef.current = setInterval(() => {
      setFindingDriverSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(findingDriverTimerRef.current!);
          findingDriverTimerRef.current = null;
          setFindingDriverMode((mode) =>
            mode === "finding" ? "dispatched" : mode,
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const { data: sellerInfo } = useGetSellerInfo();
  const businessDomain = restaurants[0]?.domain ?? null;

  function handlePrintQR() {
    const qrUrl = "https://www.bunbohue65.vn/delivery";
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}`;
    const qrPerRow = 3;
    const rows = 5;
    const total = qrPerRow * rows;
    const qrItems = Array.from({ length: total })
      .map(
        () =>
          `<div class="qr-item">
            <img src="${qrImgUrl}" alt="QR" />
            <p class="url">${qrUrl}</p>
          </div>`,
      )
      .join("");
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>In mã QR - Đặt món</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: sans-serif; background: white; }
  .page {
    width: 21cm;
    min-height: 29.7cm;
    padding: 1cm;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5cm;
    align-content: start;
  }
  .qr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 0.5px dashed #ccc;
    padding: 0.25cm;
    page-break-inside: avoid;
  }
  .qr-item img {
    width: 5cm;
    height: 5cm;
    display: block;
  }
  .qr-item .url {
    font-size: 7pt;
    color: #444;
    text-align: center;
    margin-top: 0.15cm;
    word-break: break-all;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">${qrItems}</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const _printQRButton = (
    <button
      type="button"
      onClick={handlePrintQR}
      data-ocid="delivery.print_qr.button"
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      <Printer className="w-3.5 h-3.5" />
      In mã QR
    </button>
  );

  return (
    <CustomerLayout
      businessName={businessName || undefined}
      brand1Name={restaurants[0]?.brand1Name ?? undefined}
      headerTitle={undefined}
      headerLeft={
        <div className="flex items-center gap-2">
          {restaurants[0]?.brandLogo && (
            <img
              src={restaurants[0].brandLogo}
              alt="Logo thương hiệu"
              className="h-8 w-auto object-contain"
            />
          )}
          <div className="flex flex-col">
            <span className="font-bold text-[0.91875rem] leading-snug whitespace-nowrap text-primary">
              Thực đơn Bún Bò Huế 65
            </span>
            <span className="text-sm font-medium italic text-green-600 font-serif tracking-wide">
              Chúc quý khách ngon miệng!
            </span>
          </div>
        </div>
      }
    >
      <Helmet>
        <title>Bún Bò Huế 65 - Đặt món giao hàng tận nơi</title>
        <meta
          name="description"
          content="Bún Bò Huế 65 - Đặt món online, giao hàng tận nơi. Menu đa dạng: bún bò, cơm, đồ uống. Đặt hàng ngay!"
        />
        <link rel="canonical" href="https://www.bunbohue65.vn/" />
        <meta property="og:url" content="https://www.bunbohue65.vn/" />
        <meta
          property="og:title"
          content="Bún Bò Huế 65 - Đặt món giao hàng tận nơi"
        />
        <meta
          property="og:description"
          content="Bún Bò Huế 65 - Đặt món online, giao hàng tận nơi. Menu đa dạng: bún bò, cơm, đồ uống. Đặt hàng ngay!"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:image"
          content="https://www.bunbohue65.vn/og-image.jpg"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Bún Bò Huế 65 - Đặt món giao hàng tận nơi"
        />
        <meta
          name="twitter:description"
          content="Bún Bò Huế 65 - Đặt món online, giao hàng tận nơi. Menu đa dạng: bún bò, cơm, đồ uống. Đặt hàng ngay!"
        />
        <meta
          name="twitter:image"
          content="https://www.bunbohue65.vn/og-image.jpg"
        />
      </Helmet>
      {jsonLdSchemas.length > 0 && <JsonLd schema={jsonLdSchemas} />}
      <div data-ocid="delivery.page" className="flex flex-col gap-0 pb-10">
        {completedOrderId !== null && findingDriverMode === "finding" ? (
          <motion.div
            key="finding-driver"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 py-12 text-center px-4"
            data-ocid="delivery.finding_driver_state"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Đang tìm tài xế giao hàng...
            </h2>
            <p className="text-muted-foreground text-sm">
              Hệ thống đang liên hệ tài xế gần nhất
            </p>
            <div className="w-20 h-20 rounded-full border-4 border-primary/30 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {findingDriverSecsLeft}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">giây</p>
          </motion.div>
        ) : completedOrderId !== null && findingDriverMode === "dispatched" ? (
          <motion.div
            key="dispatch-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 py-10 text-center px-4"
            data-ocid="delivery.dispatch_center_state"
          >
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <Navigation className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Trung tâm điều phối giao hàng
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Chưa tìm được tài xế tự động. Nhân viên điều phối sẽ liên hệ và
              sắp xếp tài xế cho bạn sớm nhất.
            </p>
            <div className="w-full max-w-xs rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 text-left">
              <p className="font-semibold mb-1">📞 Liên hệ hỗ trợ</p>
              <p>
                Nhà hàng sẽ gọi lại trong vòng 5 phút để xác nhận và sắp xếp
                giao hàng.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFindingDriverMode("found");
              }}
              className="text-sm text-primary underline"
              data-ocid="delivery.dispatch_center.continue_button"
            >
              Xem trạng thái đơn hàng
            </button>
          </motion.div>
        ) : completedOrderId !== null ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 py-10 text-center px-4"
            data-ocid="delivery.complete_state"
          >
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-display text-2xl italic text-foreground">
              {t.delivery.orderPlaced}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t.delivery.orderPlacedDesc}
            </p>

            {/* New 2-position order tracking progress bar */}
            {trackedOrder &&
              (() => {
                const restaurant = restaurants.find(
                  (r) => r.id === trackedOrder.restaurantId,
                );
                return (
                  <OrderTrackingProgressBar
                    orderId={trackedOrder.id}
                    restaurantName={restaurant?.name ?? "Nhà hàng"}
                    deliveryAddress={
                      typeof trackedOrder.deliveryAddress === "string"
                        ? trackedOrder.deliveryAddress
                        : "Địa chỉ nhận hàng"
                    }
                    restaurantLat={restaurant?.coordinateLatitude}
                    restaurantLng={restaurant?.coordinateLongitude}
                  />
                );
              })()}

            {/* Invoice status row */}
            {invoiceInfo && invoiceInfo.invoiceStatus !== "NotRequested" && (
              <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border bg-card">
                {invoiceInfo.invoiceStatus === "Pending" && (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin text-muted-foreground"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="Đang xử lý"
                      role="img"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                      />
                    </svg>
                    <span className="text-muted-foreground">
                      Đang phát hành hóa đơn...
                    </span>
                  </>
                )}
                {invoiceInfo.invoiceStatus === "Issued" && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 font-medium">
                      Hóa đơn đã phát hành ✓
                    </span>
                  </>
                )}
                {invoiceInfo.invoiceStatus === "Error" && (
                  <>
                    <span className="text-red-500">⚠</span>
                    <span className="text-red-600">Lỗi phát hành hóa đơn</span>
                  </>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* New 2-position order tracking progress bar */}
            <section data-ocid="delivery.banner.section">
              {trackedOrder &&
                (() => {
                  const restaurant = restaurants.find(
                    (r) => r.id === trackedOrder.restaurantId,
                  );
                  return (
                    <OrderTrackingProgressBar
                      orderId={trackedOrder.id}
                      restaurantName={restaurant?.name ?? "Nhà hàng"}
                      deliveryAddress={
                        typeof trackedOrder.deliveryAddress === "string"
                          ? trackedOrder.deliveryAddress
                          : "Địa chỉ nhận hàng"
                      }
                      restaurantLat={restaurant?.coordinateLatitude}
                      restaurantLng={restaurant?.coordinateLongitude}
                    />
                  );
                })()}
            </section>

            {/* ① Menu */}
            <section data-ocid="delivery.menu.section">
              <MenuSection />
            </section>
          </div>
        )}
      </div>
      {/* Floating cart bar */}
      {cartItems.length > 0 && completedOrderId === null && (
        <button
          type="button"
          onClick={() => setCartDrawerOpen(true)}
          data-ocid="delivery.cart.fab_button"
          aria-label="Xem giỏ hàng"
          className="fixed bottom-4 left-4 right-4 z-40 bg-primary text-primary-foreground rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xl transition-all hover:bg-primary/90"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <span className="font-semibold text-sm">
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} món
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">
              {formatPrice(useCart.getState().total())}
            </span>
            <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full font-medium">
              Đặt hàng
            </span>
          </div>
        </button>
      )}

      {/* Cart Drawer */}
      {selectedRestaurant && (
        <DeliveryCartDrawer
          open={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
          restaurant={selectedRestaurant}
          restaurants={restaurants}
          onRestaurantChange={handleSelectRestaurant}
          address={locationName}
          customerName={customerName}
          customerPhone={customerPhone}
          onNameChange={setCustomerName}
          onPhoneChange={setCustomerPhone}
          onAddressChange={setLocationName}
          errors={errors}
          onBlur={handleBlur}
          note={orderNote}
          onValidate={validate}
          onDone={(orderId, itemsSnapshot, totalSnapshot) => {
            setCartDrawerOpen(false);
            handleOrderDone(orderId, itemsSnapshot, totalSnapshot);
          }}
        />
      )}

      {/* Fixed business footer — always visible at screen bottom */}
      <BusinessFixedFooter
        businessName={businessName || null}
        address={businessAddress || null}
        taxCode={sellerInfo?.taxCode}
        phone={sellerInfo?.phone}
        domain={businessDomain}
      />
    </CustomerLayout>
  );
}
