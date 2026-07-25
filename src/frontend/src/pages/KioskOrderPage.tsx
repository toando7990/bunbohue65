import type { MasterMenuItem } from "@/backend";
import type { QrProvider } from "@/components/PaymentMethodSelector";
import {
  StaffAccessGuard,
  getSavedRestaurantId,
} from "@/components/StaffAccessGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cartItemToOrderItem,
  formatPrice,
  useGetBusinessBankDetails,
  useGetInvoiceInfo,
  useGetOrderForTracking,
  useGetRestaurantOverrides,
  useGetTingeeConfigForDevice,
  useListMasterCategories,
  useListMasterMenuItems,
  usePlaceOrder,
  useRestaurant,
} from "@/hooks/useBackend";
import { useCart } from "@/hooks/useCart";
import { useSecondaryDisplay } from "@/hooks/useSecondaryDisplay";
import DriverWaitingTab from "@/pages/kiosk-order/components/DriverWaitingTab";
import KioskConfirmedScreen from "@/pages/kiosk-order/components/KioskConfirmedScreen";
import IdleScreen from "@/pages/kiosk-order/components/KioskIdleScreen";
import KioskPaymentScreen from "@/pages/kiosk-order/components/KioskPaymentScreen";
import SlideshowBackground from "@/pages/kiosk-order/components/KioskSlideshowBackground";
import {
  ROLE,
  getKioskRestaurantId,
  isPaidOrComplete,
} from "@/pages/kiosk-order/utils/kioskUtils";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Screen = "ordering" | "payment" | "confirmed" | "driverWaiting";

const IDLE_TIMEOUT_MS = 30_000;
const _SLIDE_INTERVAL_MS = 15_000;
const SWIPE_THRESHOLD = 50;
const _UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80",
];

function KioskContent({ restaurantId }: { restaurantId: bigint }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>("ordering");
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [activeCategory, setActiveCategory] = useState<bigint | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [orderCode, setOrderCode] = useState<string | undefined>(undefined);
  const [resetCountdown, setResetCountdown] = useState(30);
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState(false);
  // New state for redesign
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  const isNarrow = typeof window !== "undefined" && window.innerWidth < 1024;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (!restaurantId) {
      navigate({
        to: "/activate-device",
        search: { code: undefined, role: undefined },
      });
    }
  }, []);

  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: categories, isLoading: categoriesLoading } =
    useListMasterCategories();
  const { data: menuItems, isLoading: menuItemsLoading } =
    useListMasterMenuItems();
  const { data: overrides } = useGetRestaurantOverrides(restaurantId);

  const disabledItemIds = useMemo(() => new Set(overrides ?? []), [overrides]);
  const { data: bankDetails } = useGetBusinessBankDetails();
  const { data: tingeeConfig } = useGetTingeeConfigForDevice();
  const placeOrder = usePlaceOrder();

  // Derive QR provider from the restaurant's business config — kiosk users
  // cannot choose; the business owner sets autoPaymentConfirmationApp.
  const qrProvider: QrProvider =
    restaurant?.autoPaymentConfirmationApp === "Tingee" ? "tingee" : "none";
  const isTingeeProvider = qrProvider === "tingee";
  const tingeeNotReady = isTingeeProvider && tingeeConfig == null;

  const {
    items: cartItems,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    total,
  } = useCart();

  const { data: paymentStatusData } = useGetOrderForTracking(
    orderId ?? undefined,
    3000,
  );

  const { data: invoiceInfo } = useGetInvoiceInfo(
    screen === "confirmed" && orderId !== null ? orderId : null,
  );

  // Filtered items by active category
  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (activeCategory === null) return menuItems;
    return menuItems.filter((i) => i.categoryId === activeCategory);
  }, [menuItems, activeCategory]);

  // Suggestion add-ons: all items in "Gọi thêm" category (no slice, no activeCategory dep)
  const suggestionAddOns = useMemo(() => {
    if (!menuItems || !categories) return [];
    const addOnCategory = categories.find((c) => c.name === "Gọi thêm");
    return addOnCategory
      ? menuItems.filter((i) => i.categoryId === addOnCategory.id)
      : [];
  }, [menuItems, categories]);

  // Suggestion drinks: all items in "Đồ uống" category (no slice, no activeCategory dep)
  const suggestionDrinks = useMemo(() => {
    if (!menuItems || !categories) return [];
    const drinkCategory = categories.find((c) => c.name === "Đồ uống");
    return drinkCategory
      ? menuItems.filter((i) => i.categoryId === drinkCategory.id)
      : [];
  }, [menuItems, categories]);

  // Cart quantities map
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems)
      map.set(item.menuItemId.toString(), item.quantity);
    return map;
  }, [cartItems]);

  const currentItem = filteredItems[currentItemIdx] ?? null;
  const currentItemQty = currentItem
    ? (cartQuantities.get(currentItem.id.toString()) ?? 0)
    : 0;
  const isCurrentDisabled = currentItem
    ? disabledItemIds.has(currentItem.id)
    : false;

  const prevCategoryRef = useRef(activeCategory);
  useEffect(() => {
    if (prevCategoryRef.current !== activeCategory) {
      prevCategoryRef.current = activeCategory;
      setCurrentItemIdx(0);
    }
  }, [activeCategory]);

  // ─── Suggestion grid scroll state ──────────────────────────────────────────
  const addonsGridRef = useRef<HTMLDivElement>(null);
  const drinksGridRef = useRef<HTMLDivElement>(null);
  const [canScrollAddonsUp, setCanScrollAddonsUp] = useState(false);
  const [canScrollAddonsDown, setCanScrollAddonsDown] = useState(false);
  const [canScrollDrinksUp, setCanScrollDrinksUp] = useState(false);
  const [canScrollDrinksDown, setCanScrollDrinksDown] = useState(false);

  const recomputeScrollBooleans = useCallback(() => {
    const compute = (
      el: HTMLDivElement | null,
      setUp: (v: boolean) => void,
      setDown: (v: boolean) => void,
    ) => {
      if (!el) {
        setUp(false);
        setDown(false);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      setUp(scrollTop > 1);
      setDown(scrollTop < maxScroll - 1);
    };
    compute(
      addonsGridRef.current,
      setCanScrollAddonsUp,
      setCanScrollAddonsDown,
    );
    compute(
      drinksGridRef.current,
      setCanScrollDrinksUp,
      setCanScrollDrinksDown,
    );
  }, []);

  const scrollGridByRows = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>, direction: "up" | "down") => {
      const el = ref.current;
      if (!el) return;
      const firstChild = el.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(getComputedStyle(el).rowGap) || 0;
      const rowHeight = firstChild ? firstChild.offsetHeight + gap : 0;
      if (rowHeight <= 0) return;
      const delta = direction === "up" ? -rowHeight : rowHeight;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const next = Math.max(0, Math.min(maxScroll, el.scrollTop + delta));
      el.scrollTo({ top: next, behavior: "smooth" });
    },
    [],
  );

  // Attach scroll listeners to each grid
  useEffect(() => {
    const addons = addonsGridRef.current;
    const drinks = drinksGridRef.current;
    const onAddonsScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = addons ?? {
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 0,
      };
      const maxScroll = scrollHeight - clientHeight;
      setCanScrollAddonsUp(scrollTop > 1);
      setCanScrollAddonsDown(scrollTop < maxScroll - 1);
    };
    const onDrinksScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = drinks ?? {
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 0,
      };
      const maxScroll = scrollHeight - clientHeight;
      setCanScrollDrinksUp(scrollTop > 1);
      setCanScrollDrinksDown(scrollTop < maxScroll - 1);
    };
    addons?.addEventListener("scroll", onAddonsScroll, { passive: true });
    drinks?.addEventListener("scroll", onDrinksScroll, { passive: true });
    return () => {
      addons?.removeEventListener("scroll", onAddonsScroll);
      drinks?.removeEventListener("scroll", onDrinksScroll);
    };
  }, []);

  // Recompute on window resize
  useEffect(() => {
    const handler = () => recomputeScrollBooleans();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [recomputeScrollBooleans]);

  // Recompute when suggestion arrays change
  useEffect(() => {
    // Reference the arrays so the effect re-runs when they change.
    void suggestionAddOns;
    void suggestionDrinks;
    // Defer to next frame so layout reflects new children
    const id = requestAnimationFrame(() => recomputeScrollBooleans());
    return () => cancelAnimationFrame(id);
  }, [suggestionAddOns, suggestionDrinks, recomputeScrollBooleans]);

  // Clamp index when items change
  useEffect(() => {
    if (filteredItems.length > 0 && currentItemIdx >= filteredItems.length) {
      setCurrentItemIdx(filteredItems.length - 1);
    }
  }, [filteredItems, currentItemIdx]);

  // Idle timer management
  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (screen === "ordering") {
      idleTimerRef.current = setTimeout(() => setIsIdle(true), IDLE_TIMEOUT_MS);
    }
  }, [screen]);

  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  const handleIdleInteract = useCallback(() => {
    setActiveCategory(null);
    setCurrentItemIdx(0);
    resetIdle();
  }, [resetIdle]);

  const goToDriverWaiting = useCallback(() => {
    setPreviousScreen(screen);
    setScreen("driverWaiting");
  }, [screen]);

  const goBackFromDriverWaiting = useCallback(() => {
    setScreen(previousScreen ?? "ordering");
    setPreviousScreen(null);
  }, [previousScreen]);

  // When a COD driver pays via Tingee QR in the DriverWaitingTab, invalidate
  // the delivery orders query so the paid order leaves the waiting list and
  // the auto-refresh / sound-on-leave behavior picks up the change promptly.
  const handleDriverPaid = useCallback(
    (_orderId: bigint) => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    },
    [queryClient],
  );

  const { openWaiterDisplay, isWaiterWindowOpen, hasWaiterToken } =
    useSecondaryDisplay();
  const waiterButton = hasWaiterToken ? (
    <button
      type="button"
      onClick={openWaiterDisplay}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-green-700/80 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-green-700"
      title="Mở màn hình phục vụ"
      data-ocid="kiosk.open_waiter_display.button"
    >
      <span
        className={`h-2 w-2 rounded-full ${isWaiterWindowOpen ? "bg-green-300" : "bg-gray-300"}`}
      />
      Màn hình phục vụ
    </button>
  ) : null;

  useEffect(() => {
    if (screen !== "payment" || !paymentStatusData) return;
    if (isPaidOrComplete(paymentStatusData)) {
      setScreen("confirmed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatusData, screen]);

  // Auto-reset countdown on confirmed screen
  useEffect(() => {
    if (screen !== "confirmed") {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      return;
    }
    setResetCountdown(30);
    resetTimerRef.current = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const copyQrImage = async (qrUrl: string) => {
    setCopySuccess(false);
    setCopyError(false);
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  function handleReset() {
    clearCart();
    setTableNumber("");
    setOrderId(null);
    setShowCart(false);
    setActiveCategory(null);
    setCurrentItemIdx(0);
    setScreen("ordering");
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    resetIdle();
  }

  function handleAddToCart(item: MasterMenuItem) {
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      quantity: 1,
    });
    toast.success(`Đã thêm ${item.name}`, { duration: 1200 });
    resetIdle();
  }

  async function handlePlaceOrder() {
    if (!restaurantId || cartItems.length === 0) return;
    const tableId = tableNumber.trim() || "KIOSK";
    try {
      const result = await placeOrder.mutateAsync({
        restaurantId,
        tableIdentifier: tableId,
        items: cartItems.map(cartItemToOrderItem),
        notes: "Đặt tại quầy - Kiosk",
      });
      if (
        result &&
        typeof (result as { orderId?: bigint }).orderId === "bigint"
      ) {
        const rid = (result as { orderId: bigint }).orderId;
        setOrderId(rid);
        setOrderCode(result.orderCode ?? undefined);
        setScreen("payment");
      } else if (typeof result === "bigint") {
        setOrderId(result);
        setScreen("payment");
      } else {
        toast.error("Không nhận được mã đơn hàng");
      }
    } catch {
      toast.error("Đặt hàng thất bại, vui lòng thử lại");
    }
  }

  const qrUrl = useMemo(() => {
    // VietQR removed — Tingee dynamic QR is the only QR source.
    return "";
  }, []);

  // ─── Print CSS for thermal receipt ────────────────────────────────────────
  const printStyles = `
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; padding: 0; background: #fff !important; }
      body > *,
      #root > *,
      #root > * > * {
        display: none !important;
      }
      .kiosk-print-area {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 24px 16px !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        text-align: center !important;
      }
      .kiosk-print-area * {
        color: #000000 !important;
        background: transparent !important;
        box-shadow: none !important;
        border-color: #000 !important;
        -webkit-print-color-adjust: exact;
      }
      .kiosk-print-area .print-restaurant-name {
        font-size: 18pt !important;
        font-weight: bold !important;
        margin-bottom: 8pt !important;
      }
      .kiosk-print-area .print-order-label {
        font-size: 12pt !important;
        margin-bottom: 4pt !important;
      }
      .kiosk-print-area .print-order-number {
        font-size: 72pt !important;
        font-weight: 900 !important;
        line-height: 1.1 !important;
        margin-bottom: 8pt !important;
      }
      .kiosk-print-area .print-instruction {
        font-size: 12pt !important;
        margin-bottom: 6pt !important;
      }
      .kiosk-print-area .print-datetime {
        font-size: 10pt !important;
        color: #444 !important;
      }
      .kiosk-print-area .print-hide {
        display: none !important;
      }
    }
  `;

  // ─── Tablet-only guard ───────────────────────────────────────────────────────
  if (isNarrow) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center"
        data-ocid="kiosk.mobile_block.page"
      >
        <div className="mb-6 rounded-full bg-muted p-6">
          <UtensilsCrossed className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-foreground">
          Vui lòng dùng thiết bị tablet (15-32 inch)
        </h1>
        <p className="max-w-sm text-base text-muted-foreground">
          Màn hình đặt món tại quầy chỉ dành cho tablet và màn hình lớn
        </p>
      </div>
    );
  }

  // ─── Ordering Screen ──────────────────────────────────────────────────────
  if (screen === "ordering") {
    const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
    const cartTotal = total();

    // Category bar data
    const categoryTabs: { id: bigint | null; name: string }[] = [
      { id: null, name: "Tất cả" },
      ...(categories ?? [])
        .filter((c) => c.name !== "Gọi thêm" && c.name !== "Đồ uống")
        .map((c) => ({ id: c.id, name: c.name })),
    ];
    const categoryIcons: Record<string, string> = {
      "Món chính": "🍜",
      "Gọi thêm": "🥢",
      "Đồ uống": "🧋",
      "Tất cả": "🍽️",
    };
    const minPriceForCategory = (categoryId: bigint | null): string => {
      if (!menuItems) return "";
      const items =
        categoryId === null
          ? menuItems
          : menuItems.filter((i) => i.categoryId === categoryId);
      if (!items.length) return "";
      const min = items.reduce(
        (m, i) => (i.price < m ? i.price : m),
        items[0].price,
      );
      return formatPrice(min);
    };

    // Swipe handlers
    const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartTime.current = Date.now();
      resetIdle();
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dt = Date.now() - touchStartTime.current;
      const velocity = Math.abs(dx) / dt;
      if (Math.abs(dx) >= SWIPE_THRESHOLD || velocity > 0.3) {
        if (dx < 0) {
          setCurrentItemIdx(
            (prev) => (prev + 1) % Math.max(filteredItems.length, 1),
          );
        } else {
          setCurrentItemIdx((prev) =>
            prev <= 0 ? Math.max(filteredItems.length - 1, 0) : prev - 1,
          );
        }
      }
      touchStartX.current = null;
    };

    return (
      <div
        className="relative flex h-screen flex-col overflow-hidden"
        onClick={resetIdle}
        onKeyDown={resetIdle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-ocid="kiosk.ordering.page"
      >
        {/* Slideshow background */}
        <SlideshowBackground paused={isIdle} />

        {/* Idle screen overlay */}
        {isIdle && <IdleScreen onInteract={handleIdleInteract} />}

        {/* Staff header bar */}
        <div className="relative z-50 flex h-[48px] min-h-[48px] items-center justify-end gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              goToDriverWaiting();
              resetIdle();
            }}
            data-ocid="kiosk.driver_waiting.button"
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
            style={{ background: "#F97316" }}
          >
            <Truck className="h-5 w-5" />
            <span>Chờ tài xế</span>
          </button>
        </div>

        {/* Category top bar (10% height) */}
        <div
          className="relative z-10 flex h-[10vh] min-h-[52px] max-h-[76px] items-center gap-2 overflow-x-auto px-4"
          style={{ scrollbarWidth: "none" }}
          data-ocid="kiosk.category_bar"
        >
          {categoriesLoading
            ? ["s1", "s2", "s3"].map((k) => (
                <Skeleton key={k} className="h-9 w-28 shrink-0 rounded-full" />
              ))
            : categoryTabs.map((tab) => {
                const isActive = tab.id === activeCategory;
                const icon = categoryIcons[tab.name] ?? "📋";
                const price = minPriceForCategory(tab.id);
                return (
                  <button
                    key={tab.id?.toString() ?? "all"}
                    type="button"
                    onClick={() => {
                      setActiveCategory(tab.id);
                      setCurrentItemIdx(0);
                      resetIdle();
                    }}
                    data-ocid={`kiosk.category.${tab.name}.tab`}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${isActive ? "text-white shadow-lg" : "bg-black/30 text-white/80 hover:bg-black/50"}`}
                    style={isActive ? { background: "#DC2626" } : undefined}
                  >
                    <span>{icon}</span>
                    <span>{tab.name}</span>
                    {price && (
                      <span
                        className={`text-xs ${isActive ? "text-white/80" : "text-white/60"}`}
                      >
                        từ {price}
                      </span>
                    )}
                  </button>
                );
              })}
        </div>

        {/* Main content area: main card (30%) + suggestion carousel (70%) */}
        <div
          className="relative z-10 flex min-h-0 flex-1 items-stretch justify-center gap-10 overflow-hidden px-16 py-3"
          data-ocid="kiosk.menu.section"
        >
          {menuItemsLoading ? (
            <div className="flex w-full items-center gap-10">
              <div style={{ width: "30%" }}>
                <Skeleton
                  className="w-full rounded-3xl"
                  style={{ aspectRatio: "4/3" }}
                />
                <Skeleton className="mt-3 h-16 w-full rounded-2xl" />
              </div>
              <div className="flex flex-1 gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-44 flex-1 rounded-2xl" />
                ))}
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 text-center"
              data-ocid="kiosk.menu.empty_state"
            >
              <UtensilsCrossed className="h-16 w-16 text-white/40" />
              <p className="text-xl font-semibold text-white/70">
                Không có món trong danh mục này
              </p>
            </div>
          ) : (
            <>
              {/* ── Main card: 30% width, frosted glass, centered ── */}
              <div
                className="relative flex items-center"
                style={{ width: "30%", flexShrink: 0 }}
                data-ocid="kiosk.main_card.section"
              >
                {/* Left arrow */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentItemIdx((prev) =>
                      prev <= 0 ? filteredItems.length - 1 : prev - 1,
                    );
                    resetIdle();
                  }}
                  aria-label="Món trước"
                  data-ocid="kiosk.main_card.prev_button"
                  className="absolute -left-12 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/60"
                  style={{ flexShrink: 0 }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                {/* Card */}
                <div
                  className="relative flex w-full flex-col overflow-hidden rounded-3xl"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1.5px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                  }}
                  data-ocid="kiosk.main_card"
                >
                  {/* Item image */}
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: "4/3" }}
                  >
                    {currentItem?.imageUrl ? (
                      <img
                        src={currentItem.imageUrl}
                        alt={currentItem.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black/20">
                        <UtensilsCrossed className="h-16 w-16 text-white/40" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)",
                      }}
                    />
                    {isCurrentDisabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded-full bg-destructive px-4 py-1.5 text-sm font-bold text-white">
                          Tạm hết
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info + +/- buttons row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1 pr-2">
                      <h2 className="truncate text-xl font-bold text-white">
                        {currentItem?.name ?? "—"}
                      </h2>
                      <p
                        className="mt-0.5 text-lg font-bold"
                        style={{ color: "#FF6B6B" }}
                      >
                        {currentItem ? formatPrice(currentItem.price) : ""}
                      </p>
                    </div>
                    {/* +/- buttons vertical stack */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentItem) handleAddToCart(currentItem);
                        }}
                        disabled={isCurrentDisabled || !currentItem}
                        aria-label="Thêm"
                        data-ocid="kiosk.main_card.add_button"
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: "#DC2626" }}
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                      {currentItemQty > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (currentItem)
                              updateQuantity(
                                currentItem.id,
                                currentItemQty - 1,
                              );
                          }}
                          aria-label="Giảm"
                          data-ocid="kiosk.main_card.remove_button"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white shadow backdrop-blur-sm transition-all active:scale-95"
                        >
                          <Minus className="h-6 w-6" />
                        </button>
                      )}
                      {currentItemQty > 0 && (
                        <div
                          className="flex h-8 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: "#DC2626" }}
                        >
                          {currentItemQty}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right arrow */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentItemIdx(
                      (prev) => (prev + 1) % filteredItems.length,
                    );
                    resetIdle();
                  }}
                  aria-label="Món tiếp theo"
                  data-ocid="kiosk.main_card.next_button"
                  className="absolute -right-12 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/60"
                  style={{ flexShrink: 0 }}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>

              {/* ── Suggestion grid: 2 zones (addOns left 3 cols, drinks right 2 cols), no scroll ── */}
              {(suggestionAddOns.length > 0 || suggestionDrinks.length > 0) && (
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col"
                  data-ocid="kiosk.suggestion.section"
                >
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                    Có thể bạn muốn thêm
                  </p>
                  <div
                    className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5"
                    data-ocid="kiosk.suggestion_carousel"
                  >
                    {/* Left zone: add-ons (3 cols) */}
                    {suggestionAddOns.length > 0 && (
                      <div
                        className="relative flex h-full min-h-0 flex-col lg:col-span-3"
                        data-ocid="kiosk.suggestion.addons.zone"
                      >
                        <button
                          type="button"
                          onClick={() => scrollGridByRows(addonsGridRef, "up")}
                          disabled={!canScrollAddonsUp}
                          aria-label="Cuộn lên"
                          data-ocid="kiosk.suggestion.addons.scroll_up.button"
                          className="absolute left-1/2 top-1 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowUp className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            scrollGridByRows(addonsGridRef, "down")
                          }
                          disabled={!canScrollAddonsDown}
                          aria-label="Cuộn xuống"
                          data-ocid="kiosk.suggestion.addons.scroll_down.button"
                          className="absolute bottom-1 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowDown className="h-5 w-5" />
                        </button>
                        <div
                          ref={addonsGridRef}
                          onScroll={() => {
                            const el = addonsGridRef.current;
                            if (!el) return;
                            const maxScroll = el.scrollHeight - el.clientHeight;
                            setCanScrollAddonsUp(el.scrollTop > 1);
                            setCanScrollAddonsDown(
                              el.scrollTop < maxScroll - 1,
                            );
                          }}
                          className="no-scrollbar grid h-full min-h-0 grid-cols-2 gap-3 lg:grid-cols-3"
                          style={{
                            gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                            gridAutoRows: "0px",
                            overflowY: "auto",
                            overflow: "hidden",
                            scrollSnapType: "y proximity",
                          }}
                          data-ocid="kiosk.suggestion.addons.grid"
                        >
                          {suggestionAddOns.map((item, idx) => {
                            const disabled = disabledItemIds.has(item.id);
                            const qty =
                              cartQuantities.get(item.id.toString()) ?? 0;
                            return (
                              <div
                                key={item.id.toString()}
                                data-ocid={`kiosk.suggestion.item.${idx + 1}`}
                                className="flex flex-col relative rounded-2xl transition-transform active:scale-95"
                                style={{
                                  background: "rgba(255,255,255,0.15)",
                                  backdropFilter: "blur(12px)",
                                  WebkitBackdropFilter: "blur(12px)",
                                  border: "1px solid rgba(255,255,255,0.25)",
                                  scrollSnapAlign: "start",
                                }}
                              >
                                <div
                                  className="relative"
                                  style={{ aspectRatio: "4/3" }}
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-black/20">
                                      <UtensilsCrossed className="h-8 w-8 text-white/30" />
                                    </div>
                                  )}
                                  {disabled && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                      <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                                        Hết
                                      </span>
                                    </div>
                                  )}
                                  {qty > 0 && (
                                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                                      {qty}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col justify-between px-2.5 py-2">
                                  <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
                                    {item.name}
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between gap-1">
                                    <span
                                      className="text-xs font-bold"
                                      style={{ color: "#FF6B6B" }}
                                    >
                                      {formatPrice(item.price)}
                                    </span>
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-10">
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(item)}
                                    disabled={disabled}
                                    aria-label={`Thêm ${item.name}`}
                                    data-ocid={`kiosk.suggestion.add.${idx + 1}.button`}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow transition-all active:scale-95 disabled:opacity-40"
                                    style={{ background: "#DC2626" }}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  {qty > 0 && (
                                    <div
                                      className="flex h-6 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                                      style={{ background: "#DC2626" }}
                                    >
                                      {qty}
                                    </div>
                                  )}
                                  {qty > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(item.id, qty - 1)
                                      }
                                      aria-label={`Giảm ${item.name}`}
                                      data-ocid={`kiosk.suggestion.remove.${idx + 1}.button`}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow backdrop-blur-sm transition-all active:scale-95"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Right zone: drinks (2 cols) */}
                    {suggestionDrinks.length > 0 && (
                      <div
                        className="relative flex h-full min-h-0 flex-col lg:col-span-2"
                        data-ocid="kiosk.suggestion.drinks.zone"
                      >
                        <button
                          type="button"
                          onClick={() => scrollGridByRows(drinksGridRef, "up")}
                          disabled={!canScrollDrinksUp}
                          aria-label="Cuộn lên"
                          data-ocid="kiosk.suggestion.drinks.scroll_up.button"
                          className="absolute left-1/2 top-1 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowUp className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            scrollGridByRows(drinksGridRef, "down")
                          }
                          disabled={!canScrollDrinksDown}
                          aria-label="Cuộn xuống"
                          data-ocid="kiosk.suggestion.drinks.scroll_down.button"
                          className="absolute bottom-1 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowDown className="h-5 w-5" />
                        </button>
                        <div
                          ref={drinksGridRef}
                          onScroll={() => {
                            const el = drinksGridRef.current;
                            if (!el) return;
                            const maxScroll = el.scrollHeight - el.clientHeight;
                            setCanScrollDrinksUp(el.scrollTop > 1);
                            setCanScrollDrinksDown(
                              el.scrollTop < maxScroll - 1,
                            );
                          }}
                          className="no-scrollbar grid h-full min-h-0 grid-cols-2 gap-3"
                          style={{
                            gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                            gridAutoRows: "0px",
                            overflowY: "auto",
                            overflow: "hidden",
                            scrollSnapType: "y proximity",
                          }}
                          data-ocid="kiosk.suggestion.drinks.grid"
                        >
                          {suggestionDrinks.map((item, idx) => {
                            const disabled = disabledItemIds.has(item.id);
                            const qty =
                              cartQuantities.get(item.id.toString()) ?? 0;
                            return (
                              <div
                                key={item.id.toString()}
                                data-ocid={`kiosk.suggestion.item.${idx + 1}`}
                                className="flex flex-col relative rounded-2xl transition-transform active:scale-95"
                                style={{
                                  background: "rgba(255,255,255,0.15)",
                                  backdropFilter: "blur(12px)",
                                  WebkitBackdropFilter: "blur(12px)",
                                  border: "1px solid rgba(255,255,255,0.25)",
                                  scrollSnapAlign: "start",
                                }}
                              >
                                <div
                                  className="relative"
                                  style={{ aspectRatio: "4/3" }}
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-black/20">
                                      <UtensilsCrossed className="h-8 w-8 text-white/30" />
                                    </div>
                                  )}
                                  {disabled && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                      <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                                        Hết
                                      </span>
                                    </div>
                                  )}
                                  {qty > 0 && (
                                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                                      {qty}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col justify-between px-2.5 py-2">
                                  <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
                                    {item.name}
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between gap-1">
                                    <span
                                      className="text-xs font-bold"
                                      style={{ color: "#FF6B6B" }}
                                    >
                                      {formatPrice(item.price)}
                                    </span>
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-10">
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(item)}
                                    disabled={disabled}
                                    aria-label={`Thêm ${item.name}`}
                                    data-ocid={`kiosk.suggestion.add.${idx + 1}.button`}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow transition-all active:scale-95 disabled:opacity-40"
                                    style={{ background: "#DC2626" }}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  {qty > 0 && (
                                    <div
                                      className="flex h-6 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                                      style={{ background: "#DC2626" }}
                                    >
                                      {qty}
                                    </div>
                                  )}
                                  {qty > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(item.id, qty - 1)
                                      }
                                      aria-label={`Giảm ${item.name}`}
                                      data-ocid={`kiosk.suggestion.remove.${idx + 1}.button`}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow backdrop-blur-sm transition-all active:scale-95"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Item dot navigation */}
        {filteredItems.length > 1 && (
          <div className="relative z-10 flex justify-center gap-1.5 pb-1">
            {filteredItems.slice(0, 20).map((_, idx) => (
              <button
                type="button"
                // biome-ignore lint/suspicious/noArrayIndexKey: pagination dots
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentItemIdx ? "w-6" : "w-2 bg-white/30"
                }`}
                style={
                  idx === currentItemIdx ? { background: "#DC2626" } : undefined
                }
                onClick={() => {
                  setCurrentItemIdx(idx);
                  resetIdle();
                }}
                aria-label={`Món ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Fixed footer: cart bar — hidden when cart empty */}
        {cartCount > 0 && (
          <div
            className="relative z-20 flex h-[10vh] min-h-[52px] max-h-[76px] items-center justify-between gap-4 px-8"
            style={{
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
            data-ocid="kiosk.cart_bar"
          >
            <button
              type="button"
              className="flex items-center gap-3"
              onClick={() => {
                setShowCart(true);
                resetIdle();
              }}
              data-ocid="kiosk.open_cart.button"
            >
              <div className="relative">
                <ShoppingCart className="h-7 w-7 text-white" />
                <span
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: "#DC2626" }}
                >
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs text-white/70">{cartCount} món đã chọn</p>
                <p className="text-lg font-bold text-white">
                  {formatPrice(cartTotal)}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-xl px-8 py-2.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#DC2626" }}
                onClick={() => {
                  setShowCart(true);
                  resetIdle();
                }}
                data-ocid="kiosk.confirm_order.button"
              >
                Xác nhận đặt món
              </button>
            </div>
          </div>
        )}

        {waiterButton}

        {/* Cart sheet */}
        {showCart && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="flex h-full w-full max-w-md flex-col bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-2xl font-bold text-foreground">Giỏ hàng</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setShowCart(false)}
                  data-ocid="kiosk.close_cart.close_button"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cartItems.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                    data-ocid="kiosk.cart.empty_state"
                  >
                    <ShoppingCart className="mb-4 h-16 w-16" />
                    <p className="text-lg">Giỏ hàng trống</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cartItems.map((item, idx) => (
                      <div
                        key={item.menuItemId.toString()}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                        data-ocid={`kiosk.cart.item.${idx + 1}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-foreground truncate">
                            {item.name}
                          </p>
                          <p className="text-sm text-primary">
                            {formatPrice(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() =>
                              updateQuantity(item.menuItemId, item.quantity - 1)
                            }
                            data-ocid={`kiosk.decrease_qty.${item.menuItemId}.button`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center text-lg font-bold">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() =>
                              updateQuantity(item.menuItemId, item.quantity + 1)
                            }
                            data-ocid={`kiosk.increase_qty.${item.menuItemId}.button`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            onClick={() => removeItem(item.menuItemId)}
                            data-ocid={`kiosk.remove_item.${item.menuItemId}.button`}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border px-5 py-4">
                <div className="mb-4">
                  <label
                    htmlFor="kiosk-table-note"
                    className="mb-2 block text-base font-medium text-foreground"
                  >
                    Số bàn / Ghi chú
                  </label>
                  <Input
                    id="kiosk-table-note"
                    placeholder="Nhập số bàn (không bắt buộc)"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="h-14 text-lg"
                    data-ocid="kiosk.table_number.input"
                  />
                </div>
                <div className="mb-4 flex items-center justify-between text-xl font-bold">
                  <span className="text-foreground">Tổng cộng</span>
                  <span className="text-primary">{formatPrice(total())}</span>
                </div>
                <Button
                  className="h-16 w-full text-xl font-bold"
                  disabled={cartItems.length === 0 || placeOrder.isPending}
                  onClick={handlePlaceOrder}
                  data-ocid="kiosk.place_order.submit_button"
                >
                  {placeOrder.isPending ? (
                    <Clock className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Receipt className="mr-2 h-6 w-6" />
                  )}
                  {placeOrder.isPending ? "Đang xử lý..." : "Đặt hàng"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Payment Screen ─────────────────────────────────────────────────────────
  if (screen === "payment" && orderId) {
    const totalAmount = Number(total());
    const canShowQr = Boolean(
      bankDetails?.accountNumber &&
        bankDetails?.bankName &&
        bankDetails?.accountHolderName &&
        totalAmount > 0,
    );
    const currentOrderCode = orderCode ?? "";

    // When business selected Tingee but config is missing, warn the customer
    // instead of silently falling back to VietQR (mirrors OrderPage pattern).
    if (tingeeNotReady) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center bg-background p-6"
          data-ocid="kiosk.payment.tingee_not_ready.error_state"
        >
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-3xl">
              ⚠️
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              QR Tingee chưa sẵn sàng
            </h2>
            <p className="mb-6 text-base text-muted-foreground">
              Vui lòng liên hệ quản lý để được hỗ trợ thanh toán.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-14 flex-1 text-lg"
                onClick={() => {
                  setScreen("ordering");
                  setShowCart(true);
                }}
                data-ocid="kiosk.back_to_cart.button"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Quay lại
              </Button>
              <Button
                variant="destructive"
                className="h-14 flex-1 text-lg"
                onClick={handleReset}
                data-ocid="kiosk.cancel_order.button"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Hủy & Đặt mới
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <KioskPaymentScreen
        orderId={orderId}
        orderCode={currentOrderCode}
        totalAmount={totalAmount}
        qrUrl={qrUrl}
        canShowQr={canShowQr}
        bankDetails={bankDetails}
        tingeeConfig={tingeeConfig}
        qrProvider={qrProvider}
        copySuccess={copySuccess}
        copyError={copyError}
        onCopyQr={copyQrImage}
        onBack={() => {
          setScreen("ordering");
          setShowCart(true);
        }}
        onReset={handleReset}
      />
    );
  }

  // ─── Confirmed Screen ───────────────────────────────────────────────────────
  if (screen === "confirmed" && orderId) {
    return (
      <KioskConfirmedScreen
        orderId={orderId}
        restaurantName={restaurant?.name}
        invoiceInfo={invoiceInfo}
        resetCountdown={resetCountdown}
        printStyles={printStyles}
        onNewOrder={handleReset}
      />
    );
  }

  // ─── Driver Waiting Screen ──────────────────────────────────────────────────
  if (screen === "driverWaiting") {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden">
        {/* Header with back button */}
        <div
          className="relative z-10 flex h-[10vh] min-h-[52px] max-h-[76px] items-center justify-between px-6"
          style={{
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <button
            type="button"
            onClick={goBackFromDriverWaiting}
            className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
            data-ocid="kiosk.driver_waiting.back_button"
          >
            <ArrowLeft className="h-5 w-5" />
            Quay lại đặt món
          </button>
          <h2 className="text-lg font-bold text-white">
            Chờ tài xế thanh toán
          </h2>
          <div className="w-24" />
        </div>
        <div className="flex-1 overflow-hidden">
          <DriverWaitingTab
            restaurantId={restaurantId}
            tingeeConfig={tingeeConfig}
            qrProvider={qrProvider}
            bankDetails={bankDetails}
            onPaid={handleDriverPaid}
          />
        </div>
      </div>
    );
  }

  return null;
}

export default function KioskOrderPage() {
  const restaurantId =
    getKioskRestaurantId() ?? BigInt(getSavedRestaurantId("kioskorder") || 0);

  if (!restaurantId || restaurantId === 0n) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <p className="text-base font-semibold text-foreground">
            Quầy đặt món
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Không tìm thấy thông tin trục cầp. Liên hệ quản lý để lấy mã kích
            hoạt.
          </p>
          <a
            href="/activate-device"
            className="block w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center"
          >
            Kích hoạt thiết bị
          </a>
        </div>
      </div>
    );
  }

  return (
    <StaffAccessGuard
      restaurantId={Number(restaurantId)}
      staffRole="kioskorder"
    >
      <KioskContent restaurantId={restaurantId} />
    </StaffAccessGuard>
  );
}
