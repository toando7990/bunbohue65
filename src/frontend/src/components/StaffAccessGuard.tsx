import { createActor } from "@/backend";
import { useRestaurant } from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

export type StaffRoleKey =
  | "kitchen"
  | "waiter"
  | "kioskorder"
  | "cashier"
  | "enterprise-delivery"
  | "customer-support"
  | "accounting";

const ROLE_LABELS: Record<StaffRoleKey, string> = {
  kitchen: "Bếp",
  waiter: "Phục vụ",
  kioskorder: "Quầy đặt món",
  cashier: "Thu ngân",
  "enterprise-delivery": "Điều phối giao hàng",
  "customer-support": "Hỗ trợ khách hàng",
  accounting: "Kế toán",
};

function deviceTokenKey(restaurantId: number, role: string): string {
  return `deviceToken_${restaurantId}_${role}`;
}

function deviceRestaurantIdKey(role: string): string {
  // role is always lowercase (StaffRoleKey), matching how ActivateDevicePage saves it
  return `deviceRestaurantId_${role}`;
}

export function getSavedRestaurantId(role: StaffRoleKey): number {
  try {
    const deviceVal = localStorage.getItem(deviceRestaurantIdKey(role));
    if (deviceVal) return Number(deviceVal);
    return 0;
  } catch {
    return 0;
  }
}

type GuardState =
  | { status: "loading" }
  | { status: "no_token" }
  | { status: "token_invalid" }
  | { status: "ok" };

function ErrorScreen({
  state,
  role,
  restaurantName,
  onRetry,
}: {
  state: Exclude<GuardState, { status: "ok" } | { status: "loading" }>;
  role: StaffRoleKey;
  restaurantName?: string;
  onRetry: () => void;
}) {
  const messages: Record<string, string> = {
    no_token:
      "Không tìm thấy thông tin truy cập. Bạn cần dùng link do quản lý cung cấp. Liên hệ quản lý nhà hàng để lấy link truy cập mới.",
    token_invalid:
      "Token không hợp lệ hoặc đã bị thu hồi. Vui lòng liên hệ quản lý để cấp quyền mới.",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <span className="text-3xl">🔒</span>
        </div>
        {restaurantName && (
          <p className="text-sm text-muted-foreground font-medium">
            {restaurantName}
          </p>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            {ROLE_LABELS[role]}
          </h2>
          <p className="text-sm text-destructive font-medium">
            {messages[state.status] ?? "Không có quyền truy cập."}
          </p>
        </div>
        {state.status === "no_token" && (
          <a
            href="/activate-device"
            className="block w-full h-12 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-colors flex items-center justify-center"
            data-ocid="staff_guard.activate_device_link"
          >
            Kích hoạt thiết bị
          </a>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          data-ocid="staff_guard.retry_button"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}

interface StaffAccessGuardProps {
  restaurantId: number;
  staffRole: StaffRoleKey;
  children: ReactNode;
}

export function StaffAccessGuard({
  restaurantId,
  staffRole: role,
  children,
}: StaffAccessGuardProps) {
  const { actor, isFetching } = useActor(createActor);
  const { data: restaurant, isLoading: restaurantLoading } = useRestaurant(
    BigInt(restaurantId),
  );

  const [guardState, setGuardState] = useState<GuardState>({
    status: "loading",
  });
  const [deviceMode, setDeviceMode] = useState(false);

  // Token resolution: only deviceToken from localStorage
  const resolveToken = useCallback((): {
    type: "device";
    token: string;
    restaurantId: number;
  } | null => {
    if (typeof window === "undefined") return null;

    try {
      const deviceRidStr = localStorage.getItem(deviceRestaurantIdKey(role));
      if (deviceRidStr) {
        const deviceRid = Number(deviceRidStr);
        const dKey = deviceTokenKey(deviceRid, role);
        const deviceToken = localStorage.getItem(dKey);
        if (deviceToken) {
          return {
            type: "device",
            token: deviceToken,
            restaurantId: deviceRid,
          };
        }
      }
    } catch {
      /* ignore */
    }

    return null;
  }, [role]);

  const runCheck = useCallback(async () => {
    if (restaurantLoading) return;
    if (!actor || isFetching) return;

    const resolved = resolveToken();
    if (!resolved) {
      setGuardState({ status: "no_token" });
      setDeviceMode(false);
      return;
    }

    try {
      const result = await actor.verifyDeviceToken(resolved.token);
      if (result.__kind__ === "ok") {
        setDeviceMode(true);
        setGuardState({ status: "ok" });
      } else {
        try {
          localStorage.removeItem(deviceTokenKey(resolved.restaurantId, role));
          localStorage.removeItem(deviceRestaurantIdKey(role));
        } catch {
          /* ignore */
        }
        setDeviceMode(false);
        setGuardState({ status: "token_invalid" });
      }
    } catch {
      setDeviceMode(false);
      setGuardState({ status: "token_invalid" });
    }
  }, [actor, isFetching, restaurantLoading, resolveToken, role]);

  useEffect(() => {
    if (!actor || isFetching) return;
    runCheck();
  }, [actor, isFetching, runCheck]);

  if (guardState.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">
            Đang xác minh quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  if (guardState.status !== "ok") {
    return (
      <ErrorScreen
        state={guardState}
        role={role}
        restaurantName={restaurant?.name}
        onRetry={() => {
          setGuardState({ status: "loading" });
          setTimeout(() => runCheck(), 300);
        }}
      />
    );
  }

  return (
    <>
      {deviceMode && (
        <div className="fixed top-3 left-3 z-40">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
            Thiết bị tại nhà hàng
          </span>
        </div>
      )}
      {children}
    </>
  );
}
