import {
  type EnterpriseDeviceRole,
  type StaffRole,
  createActor,
} from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChefHat,
  ClipboardList,
  Headphones,
  Loader2,
  MonitorCheck,
  MonitorX,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Keys are lowercase to match StaffAccessGuard and localStorage key format
const ROLE_ROUTE_MAP: Record<string, string> = {
  kitchen: "/kitchen-view",
  waiter: "/waiter-view",
  kioskorder: "/kiosk-order",
  "enterprise-delivery": "/enterprise-delivery",
  "customer-support": "/customer-support",
  accounting: "/accounting-view",
};

const ENTERPRISE_ROLES = new Set([
  "enterprise-delivery",
  "customer-support",
  "accounting",
]);

function isEnterpriseRole(role: string): boolean {
  return ENTERPRISE_ROLES.has(role);
}

// Normalize Motoko StaffRole variant (PascalCase) to lowercase string used in localStorage
function normalizeRole(role: unknown): string {
  // Motoko Candid variants may come as objects like { Kitchen: null } or strings like "Kitchen"
  if (typeof role === "object" && role !== null) {
    const key = Object.keys(role as Record<string, unknown>)[0];
    return key ? key.toLowerCase() : "";
  }
  return String(role).toLowerCase();
}

// Labels keyed by lowercase role
const ROLE_LABELS: Record<string, string> = {
  kitchen: "Bếp",
  waiter: "Phục vụ",
  kioskorder: "Quầy đặt món",
  "enterprise-delivery": "Trung tâm điều phối giao hàng",
  "customer-support": "Giải đáp khách hàng",
  accounting: "Kế toán",
};

// ─── Role metadata ───────────────────────────────────────────────────────────
interface RoleMeta {
  label: string;
  icon: React.ReactNode;
  description: string;
}

const KIOSK_ROLES: Record<string, RoleMeta> = {
  kitchen: {
    label: "Bếp",
    icon: <ChefHat className="w-6 h-6" />,
    description: "Nhận và xử lý đơn món",
  },
  waiter: {
    label: "Phục vụ",
    icon: <ClipboardList className="w-6 h-6" />,
    description: "Theo dõi trạng thái đơn hàng",
  },
  kioskorder: {
    label: "Quầy đặt món",
    icon: <ShoppingCart className="w-6 h-6" />,
    description: "Đặt món tại quầy",
  },
};

const ENTERPRISE_ROLE_META: Record<string, RoleMeta> = {
  "enterprise-delivery": {
    label: "Trung tâm điều phối giao hàng",
    icon: <Truck className="w-6 h-6" />,
    description: "Điều phối đơn giao hàng",
  },
  "customer-support": {
    label: "Giải đáp khách hàng",
    icon: <Headphones className="w-6 h-6" />,
    description: "Hỗ trợ khách hàng",
  },
  accounting: {
    label: "Kế toán",
    icon: <Receipt className="w-6 h-6" />,
    description: "Quản lý sổ sách",
  },
};

function deviceTokenKey(restaurantId: number, role: string): string {
  return `deviceToken_${restaurantId}_${role}`;
}

function deviceRestaurantIdKey(role: string): string {
  return `deviceRestaurantId_${role}`;
}

// Build Candid variant object for StaffRole
// Build Candid variant object for StaffRole
function buildStaffRoleVariant(role: string): StaffRole {
  switch (role) {
    case "kitchen":
      return { Kitchen: null } as unknown as StaffRole;
    case "waiter":
      return { Waiter: null } as unknown as StaffRole;
    case "kioskorder":
      return { KioskOrder: null } as unknown as StaffRole;
    default:
      return { Kitchen: null } as unknown as StaffRole;
  }
}

// Build Candid variant object for EnterpriseDeviceRole
// Build Candid variant object for EnterpriseDeviceRole
function buildEnterpriseRoleVariant(role: string): EnterpriseDeviceRole {
  switch (role) {
    case "enterprise-delivery":
      return { EnterpriseDelivery: null } as unknown as EnterpriseDeviceRole;
    case "customer-support":
      return { CustomerSupport: null } as unknown as EnterpriseDeviceRole;
    case "accounting":
      return { Accounting: null } as unknown as EnterpriseDeviceRole;
    default:
      return { EnterpriseDelivery: null } as unknown as EnterpriseDeviceRole;
  }
}

export default function ActivateDevicePage() {
  const { actor, isFetching } = useActor(createActor);
  const navigate = useNavigate();
  const search = useSearch({ from: "/activate-device" });

  const [step, setStep] = useState<"role" | "code">("role");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    deviceName: string;
    role: string;
    restaurantId: number | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmitRef = useRef(false);
  const codeRef = useRef(code);
  codeRef.current = code;

  // Parse URL params on mount
  useEffect(() => {
    const urlRole =
      search && typeof search === "object" && "role" in search
        ? String(search.role).toLowerCase()
        : "";
    const urlCode =
      search && typeof search === "object" && "code" in search
        ? String(search.code)
        : "";

    if (urlRole) {
      setSelectedRole(urlRole);
      setStep("code");
      if (urlCode && urlCode.length === 6 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        setCode(urlCode.toUpperCase());
        setTimeout(() => {
          void handleActivate(urlCode.toUpperCase(), urlRole);
        }, 0);
      }
    }
  }, [search]);

  const handleActivate = useCallback(
    async (submitCode?: string, submitRole?: string) => {
      const activationCode = (submitCode ?? codeRef.current)
        .trim()
        .toUpperCase();
      const role = submitRole ?? selectedRole;

      if (!role) {
        setError("Vui lòng chọn vai trò trước.");
        return;
      }
      if (activationCode.length !== 6) {
        setError("Mã kích hoạt phải có đúng 6 ký tự.");
        return;
      }
      if (!actor || isFetching) {
        setError("Đang kết nối đến hệ thống, vui lòng chờ...");
        return;
      }
      setIsSubmitting(true);
      setError(null);

      const isEnterprise = isEnterpriseRole(role);

      try {
        // ── Enterprise activation path ──────────────────────────────────────
        if (isEnterprise) {
          const result = await actor.activateEnterpriseDevice(
            activationCode,
            buildEnterpriseRoleVariant(role),
          );
          if (result.__kind__ === "err") {
            const errMsg = (() => {
              const e = result.err;
              if (e.includes("expired") || e.includes("Expired"))
                return "Mã kích hoạt đã hết hạn. Vui lòng tạo mã mới.";
              if (e.includes("used") || e.includes("Used"))
                return "Mã kích hoạt đã được sử dụng. Vui lòng tạo mã mới.";
              if (e.includes("Maximum") || e.includes("maximum"))
                return "Đã đạt giới hạn 3 thiết bị cho vai trò này.";
              if (e.includes("roleMismatch") || e.includes("vai trò"))
                return "Mã kích hoạt này được dùng cho vai trò khác. Vui lòng chọn đúng vai trò.";
              return "Mã kích hoạt không hợp lệ hoặc đã hết hạn. Liên hệ quản lý để lấy mã mới.";
            })();
            setError(errMsg);
            setIsSubmitting(false);
            return;
          }
          const { deviceToken, role: returnedRole, deviceId } = result.ok;
          const roleStr = returnedRole.toLowerCase().replace(/_/g, "-");
          const normRole = (() => {
            const r = returnedRole.toLowerCase();
            if (r === "enterprisedelivery") return "enterprise-delivery";
            if (r === "customersupport") return "customer-support";
            if (r === "accounting") return "accounting";
            return roleStr;
          })();
          try {
            localStorage.setItem("ent_device_token", deviceToken);
            localStorage.setItem("ent_device_role", normRole);
            localStorage.setItem("ent_device_id", deviceId);
          } catch {
            /* ignore */
          }
          setSuccess({
            deviceName: `Thiết bị ${deviceId.slice(0, 8)}`,
            role: normRole,
            restaurantId: null,
          });
          setIsSubmitting(false);
          setTimeout(() => {
            const route = ROLE_ROUTE_MAP[normRole];
            if (route) navigate({ to: route });
          }, 2000);
          return;
        }

        // ── Kiosk / restaurant activation path ──────────────────────────────
        const result = await actor.activateDevice(
          activationCode,
          buildStaffRoleVariant(role),
        );
        if (result.__kind__ === "err") {
          const errVariant = result.err;
          let errMsg =
            "Mã kích hoạt không hợp lệ hoặc đã hết hạn. Liên hệ quản lý nhà hàng để lấy mã mới.";
          if (errVariant && typeof errVariant === "object") {
            if (errVariant.__kind__ === "expired") {
              errMsg = "Mã kích hoạt đã hết hạn. Vui lòng tạo mã mới.";
            } else if (errVariant.__kind__ === "alreadyUsed") {
              errMsg = "Mã kích hoạt đã được sử dụng. Vui lòng tạo mã mới.";
            } else if (errVariant.__kind__ === "deviceAlreadyHasRole") {
              errMsg =
                "Thiết bị này đã có vai trò, cần thu hồi trước khi kích hoạt vai trò mới.";
            } else if (errVariant.__kind__ === "notFound") {
              errMsg = "Mã kích hoạt không hợp lệ hoặc đã hết hạn.";
            } else if (errVariant.__kind__ === "roleMismatch") {
              errMsg =
                errVariant.roleMismatch ??
                "Mã kích hoạt này được dùng cho vai trò khác. Vui lòng chọn đúng vai trò.";
            } else if (errVariant.__kind__ === "internal") {
              errMsg = "Lỗi hệ thống. Vui lòng thử lại.";
            }
          }
          setError(errMsg);
          setIsSubmitting(false);
          return;
        }
        const {
          deviceToken,
          role: returnedRole,
          restaurantId,
          deviceName,
        } = result.ok as {
          deviceToken: string;
          role: unknown;
          restaurantId: unknown;
          deviceName: string;
        };
        const roleStr = normalizeRole(returnedRole);

        if (isEnterpriseRole(roleStr)) {
          try {
            localStorage.setItem("ent_device_token", deviceToken);
            localStorage.setItem("ent_device_role", roleStr);
          } catch {
            /* ignore */
          }
          setSuccess({
            deviceName: `Mã kích hoạt ${activationCode}`,
            role: roleStr,
            restaurantId: null,
          });
        } else {
          const rid = String(restaurantId);
          const ridNum = Number(rid);
          try {
            localStorage.setItem(deviceTokenKey(ridNum, roleStr), deviceToken);
            localStorage.setItem(deviceRestaurantIdKey(roleStr), rid);
          } catch {
            /* ignore */
          }
          setSuccess({
            deviceName: deviceName,
            role: roleStr,
            restaurantId: ridNum,
          });
        }
        setIsSubmitting(false);
        setTimeout(() => {
          const route = ROLE_ROUTE_MAP[roleStr];
          if (route) navigate({ to: route });
        }, 2000);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Lỗi hệ thống. Vui lòng thử lại.",
        );
        setIsSubmitting(false);
      }
    },
    [actor, isFetching, navigate, selectedRole],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setCode(val);
    setError(null);
  };

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    setStep("code");
    setError(null);
  };

  const handleBackToRoles = () => {
    setStep("role");
    setSelectedRole(null);
    setCode("");
    setError(null);
  };

  const roleMeta = isEnterpriseRole(selectedRole ?? "")
    ? ENTERPRISE_ROLE_META
    : KIOSK_ROLES;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border shadow-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <MonitorCheck className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">
            Kích hoạt Thiết bị
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "role"
              ? "Chọn vai trò cho thiết bị này"
              : "Nhập mã kích hoạt do quản lý cung cấp"}
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-100 border border-green-300 flex items-center justify-center">
              <MonitorCheck className="w-7 h-7 text-green-700" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                Kích hoạt thành công!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {success.deviceName} —{" "}
                {ROLE_LABELS[success.role] ?? success.role}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Tự động chuyển trang sau 2 giây...
              </p>
            </div>
          </div>
        ) : step === "role" ? (
          <div className="space-y-4">
            {/* Section: Tại nhà hàng */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
                Tại nhà hàng
              </p>
              {Object.entries(KIOSK_ROLES).map(([roleKey, meta]) => (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectRole(roleKey)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-accent hover:border-accent transition-colors text-left"
                  data-ocid={`activate_device.role.${roleKey}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {meta.label}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {meta.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {/* Section: Tại văn phòng */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
                Tại văn phòng
              </p>
              {Object.entries(ENTERPRISE_ROLE_META).map(([roleKey, meta]) => (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectRole(roleKey)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-accent hover:border-accent transition-colors text-left"
                  data-ocid={`activate_device.role.${roleKey}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {meta.label}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {meta.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedRole && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={handleBackToRoles}
                  className="text-primary hover:underline"
                  data-ocid="activate_device.back_button"
                >
                  ← Quay lại
                </button>
                <span className="mx-1">|</span>
                <span>
                  Vai trò:{" "}
                  <strong className="text-foreground">
                    {roleMeta[selectedRole]?.label ?? selectedRole}
                  </strong>
                </span>
              </div>
            )}

            <div>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                maxLength={6}
                value={code}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleActivate();
                }}
                placeholder="XXXXXX"
                className="w-full h-14 text-center text-2xl font-bold tracking-[0.3em] uppercase bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/40"
                data-ocid="activate_device.input"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Mã gồm 6 ký tự chữ và số
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-left">
                <MonitorX className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={isSubmitting || code.length !== 6}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-ocid="activate_device.submit_button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang kích hoạt...
                </>
              ) : (
                "Kích hoạt"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
