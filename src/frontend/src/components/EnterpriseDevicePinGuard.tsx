import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { Loader2, MonitorX, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

export type EnterpriseRoleKey =
  | "enterprise-delivery"
  | "customer-support"
  | "accounting";

const ROLE_LABELS: Record<EnterpriseRoleKey, string> = {
  "enterprise-delivery": "Trung tâm điều phối giao hàng",
  "customer-support": "Giải đáp khách hàng",
  accounting: "Kế toán",
};

type GuardState =
  | { status: "loading" }
  | { status: "no_token" }
  | { status: "token_invalid" }
  | { status: "role_mismatch"; foundRole: string }
  | { status: "ok" };

interface Props {
  requiredRole: EnterpriseRoleKey;
  children: ReactNode;
}

export function EnterpriseDevicePinGuard({ requiredRole, children }: Props) {
  const { actor, isFetching } = useActor(createActor);
  const [guardState, setGuardState] = useState<GuardState>({
    status: "loading",
  });

  const runCheck = useCallback(async () => {
    if (!actor || isFetching) return;

    // Read enterprise device credentials from localStorage
    let token: string | null = null;
    let storedRole: string | null = null;
    try {
      token = localStorage.getItem("ent_device_token");
      storedRole = localStorage.getItem("ent_device_role");
    } catch {
      /* ignore */
    }

    if (!token) {
      setGuardState({ status: "no_token" });
      return;
    }

    try {
      const result = await actor.verifyEnterpriseDeviceToken(token);
      if (result === null) {
        // Token invalid or revoked — clear stale credentials
        try {
          localStorage.removeItem("ent_device_token");
          localStorage.removeItem("ent_device_role");
          localStorage.removeItem("ent_device_id");
        } catch {
          /* ignore */
        }
        setGuardState({ status: "token_invalid" });
        return;
      }
      // result is the EnterpriseDeviceRole enum value e.g. "EnterpriseDelivery"
      const returnedRole = (() => {
        const r = String(result).toLowerCase();
        if (r === "enterprisedelivery") return "enterprise-delivery";
        if (r === "customersupport") return "customer-support";
        if (r === "accounting") return "accounting";
        return r;
      })();
      // Also normalise storedRole just in case it was written differently
      const normStored = storedRole?.toLowerCase() ?? "";
      const effectiveRole = returnedRole || normStored;

      if (effectiveRole !== requiredRole) {
        setGuardState({ status: "role_mismatch", foundRole: effectiveRole });
        return;
      }
      setGuardState({ status: "ok" });
    } catch {
      setGuardState({ status: "token_invalid" });
    }
  }, [actor, isFetching, requiredRole]);

  useEffect(() => {
    if (!actor || isFetching) return;
    void runCheck();
  }, [actor, isFetching, runCheck]);

  if (guardState.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Đang xác minh quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  if (guardState.status !== "ok") {
    const roleLabel = ROLE_LABELS[requiredRole];
    const message = (() => {
      if (guardState.status === "no_token")
        return "Thiết bị chưa được kích hoạt. Liên hệ quản lý để lấy mã kích hoạt.";
      if (guardState.status === "token_invalid")
        return "Token không hợp lệ hoặc đã bị thu hồi. Vui lòng liên hệ quản lý để cấp quyền mới.";
      if (guardState.status === "role_mismatch")
        return `Thiết bị được cấp quyền "${ROLE_LABELS[guardState.foundRole as EnterpriseRoleKey] ?? guardState.foundRole}" nhưng trang này yêu cầu "${roleLabel}".`;
      return "Không có quyền truy cập.";
    })();

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {roleLabel}
            </h2>
            <p className="text-sm text-destructive font-medium">{message}</p>
          </div>
          {guardState.status === "no_token" && (
            <a
              href={`/activate-device?role=${requiredRole}`}
              className="block w-full h-12 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-colors flex items-center justify-center"
              data-ocid="enterprise_guard.activate_device_link"
            >
              Kích hoạt thiết bị
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setGuardState({ status: "loading" });
              setTimeout(() => void runCheck(), 300);
            }}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            data-ocid="enterprise_guard.retry_button"
          >
            <MonitorX className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
