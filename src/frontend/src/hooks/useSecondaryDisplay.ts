import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook quản lý việc mở trang /waiter-view trên màn hình phụ.
 * Chỉ mở khi thiết bị đã được kích hoạt vai trò Phục vụ (waiter token tồn tại).
 */
export function useSecondaryDisplay() {
  const [isWaiterWindowOpen, setIsWaiterWindowOpen] = useState(false);
  const [hasWaiterToken, setHasWaiterToken] = useState(false);
  const waiterWindowRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kiểm tra token Phục vụ trong localStorage
  const checkWaiterToken = useCallback((): boolean => {
    try {
      const restaurantId = localStorage.getItem("deviceRestaurantId");
      if (!restaurantId) {
        // Thử tìm qua các role-specific keys
        const kitchenRid = localStorage.getItem("deviceRestaurantId_kitchen");
        const kioskRid = localStorage.getItem("deviceRestaurantId_kioskorder");
        const rid = kitchenRid ?? kioskRid;
        if (!rid) return false;
        const token = localStorage.getItem(`deviceToken_${rid}_waiter`);
        return !!token;
      }
      const token = localStorage.getItem(`deviceToken_${restaurantId}_waiter`);
      return !!token;
    } catch {
      return false;
    }
  }, []);

  // Lấy restaurantId để truyền qua URL
  const getRestaurantId = useCallback((): string | null => {
    try {
      const directRid = localStorage.getItem("deviceRestaurantId");
      if (directRid) return directRid;
      const kitchenRid = localStorage.getItem("deviceRestaurantId_kitchen");
      const kioskRid = localStorage.getItem("deviceRestaurantId_kioskorder");
      return kitchenRid ?? kioskRid ?? null;
    } catch {
      return null;
    }
  }, []);

  // Kiểm tra cửa sổ phụ có còn mở không
  const checkWindowStatus = useCallback(() => {
    if (waiterWindowRef.current) {
      if (waiterWindowRef.current.closed) {
        waiterWindowRef.current = null;
        setIsWaiterWindowOpen(false);
      } else {
        setIsWaiterWindowOpen(true);
      }
    }
  }, []);

  // Thử đặt cửa sổ vào màn hình thứ 2 dùng Window Placement API
  const tryPlaceOnSecondScreen = useCallback(
    async (win: Window): Promise<void> => {
      try {
        // Kiểm tra Window Placement API có được hỗ trợ không
        if (!("getScreenDetails" in window)) return;

        const permissionStatus = await navigator.permissions.query({
          name: "window-management" as PermissionName,
        });

        if (
          permissionStatus.state === "denied" ||
          permissionStatus.state === "prompt"
        ) {
          // Hỏi xin quyền — đây là user gesture context (được gọi từ sau login)
          const screenDetails = await (
            window as unknown as {
              getScreenDetails: () => Promise<{
                screens: Array<{
                  availLeft: number;
                  availTop: number;
                  availWidth: number;
                  availHeight: number;
                  isPrimary: boolean;
                }>;
              }>;
            }
          ).getScreenDetails();

          const secondScreen = screenDetails.screens.find((s) => !s.isPrimary);
          if (secondScreen) {
            win.moveTo(secondScreen.availLeft, secondScreen.availTop);
            win.resizeTo(secondScreen.availWidth, secondScreen.availHeight);
          }
        } else if (permissionStatus.state === "granted") {
          const screenDetails = await (
            window as unknown as {
              getScreenDetails: () => Promise<{
                screens: Array<{
                  availLeft: number;
                  availTop: number;
                  availWidth: number;
                  availHeight: number;
                  isPrimary: boolean;
                }>;
              }>;
            }
          ).getScreenDetails();

          const secondScreen = screenDetails.screens.find((s) => !s.isPrimary);
          if (secondScreen) {
            win.moveTo(secondScreen.availLeft, secondScreen.availTop);
            win.resizeTo(secondScreen.availWidth, secondScreen.availHeight);
          }
        }
      } catch {
        // Fallback: không làm gì, cửa sổ vẫn mở bình thường
      }
    },
    [],
  );

  // Mở cửa sổ màn hình phụ
  const openWaiterDisplay = useCallback(async () => {
    // Nếu cửa sổ đã mở và chưa bị đóng → focus lại
    if (waiterWindowRef.current && !waiterWindowRef.current.closed) {
      waiterWindowRef.current.focus();
      setIsWaiterWindowOpen(true);
      return;
    }

    if (!checkWaiterToken()) {
      return;
    }

    const rid = getRestaurantId();
    const url = rid ? `/waiter-view?restaurantId=${rid}` : "/waiter-view";

    const win = window.open(
      url,
      "waiter-display",
      "noopener,width=1280,height=800",
    );

    if (!win) {
      // Popup bị chặn bởi trình duyệt
      return;
    }

    waiterWindowRef.current = win;
    setIsWaiterWindowOpen(true);

    // Thử đặt vào màn hình thứ 2
    await tryPlaceOnSecondScreen(win);
  }, [checkWaiterToken, getRestaurantId, tryPlaceOnSecondScreen]);

  // Kiểm tra token khi mount
  useEffect(() => {
    setHasWaiterToken(checkWaiterToken());
  }, [checkWaiterToken]);

  // Tự động mở một lần khi mount (cần user gesture đã xảy ra — hành động đăng nhập)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const hasToken = checkWaiterToken();
    setHasWaiterToken(hasToken);
    if (hasToken) {
      // Delay nhỏ để đảm bảo trang đã render xong
      const timeout = setTimeout(() => {
        openWaiterDisplay();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kiểm tra trạng thái cửa sổ định kỳ (mỗi 3 giây)
  useEffect(() => {
    checkIntervalRef.current = setInterval(checkWindowStatus, 3000);
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkWindowStatus]);

  return {
    openWaiterDisplay,
    isWaiterWindowOpen,
    hasWaiterToken,
  };
}

/**
 * Mở trang /cod-payment trên màn hình phụ.
 * Chỉ mở khi thiết bị đã được kích hoạt vai trò Quầy đặt món (kioskorder token tồn tại).
 */
export function openCodPaymentDisplay(): void {
  if (typeof window === "undefined") return;

  const restaurantId = localStorage.getItem("deviceRestaurantId_kioskorder");
  if (!restaurantId) return;

  const token = localStorage.getItem(`deviceToken_${restaurantId}_kioskorder`);
  if (!token) return;

  const url = `${window.location.origin}/cod-payment?restaurantId=${restaurantId}`;

  window.open(url, "cod-payment-display", "noopener,width=1280,height=800");
}
