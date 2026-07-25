import {
  EnterpriseDeviceRole,
  EnterprisePermission,
  Variant_Active_Revoked,
  Variant_active_revoked,
} from "@/backend";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useGetMyEnterprisePermissions,
  useListDevices,
  useListEnterpriseDevices,
  usePublicRestaurants,
  useRegisterDevice,
  useRegisterEnterpriseDevice,
  useRevokeDevice,
  useRevokeEnterpriseDevice,
} from "@/hooks/useBackend";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import {
  AlertCircle,
  Building2,
  Check,
  Clock,
  Copy,
  LogIn,
  LogOut,
  Monitor,
  Plus,
  ShieldX,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const OFFICE_ROLES = [
  {
    key: EnterpriseDeviceRole.EnterpriseDelivery,
    label: "Trung tâm điều phối giao hàng",
    borderColor: "border-l-primary",
    headerBg: "bg-primary/5",
    textColor: "text-primary",
  },
  {
    key: EnterpriseDeviceRole.CustomerSupport,
    label: "Giải đáp khách hàng",
    borderColor: "border-l-accent",
    headerBg: "bg-accent/5",
    textColor: "text-accent",
  },
  {
    key: EnterpriseDeviceRole.Accounting,
    label: "Kế toán",
    borderColor: "border-l-muted-foreground",
    headerBg: "bg-muted",
    textColor: "text-muted-foreground",
  },
];

const RESTAURANT_ROLE_CONFIG: Record<
  string,
  {
    label: string;
    order: number;
    borderColor: string;
    headerBg: string;
    textColor: string;
  }
> = {
  Kitchen: {
    label: "Bếp",
    order: 1,
    borderColor: "border-l-destructive",
    headerBg: "bg-destructive/5",
    textColor: "text-destructive",
  },
  Waiter: {
    label: "Phục vụ",
    order: 2,
    borderColor: "border-l-accent",
    headerBg: "bg-accent/5",
    textColor: "text-accent",
  },
  KioskOrder: {
    label: "Quầy đặt món",
    order: 3,
    borderColor: "border-l-chart-4",
    headerBg: "bg-chart-4/10",
    textColor: "text-chart-4",
  },
};

const MAX_DEVICES_PER_ROLE = 3;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Helper: normalize Candid variant object to string key
function getRoleKey(role: unknown): string {
  if (typeof role === "object" && role !== null) {
    const keys = Object.keys(role as Record<string, unknown>);
    if (keys.length > 0) return keys[0];
  }
  return String(role);
}

function StatusBadge({
  status,
}: {
  status: Variant_Active_Revoked | Variant_active_revoked;
}) {
  const isActive =
    status === Variant_Active_Revoked.Active ||
    status === Variant_active_revoked.active;
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
        <Check className="h-3 w-3" />
        Đang hoạt động
      </span>
    );
  }
  return null;
}

function ActivationCodeBox({
  code,
  remainingSeconds,
}: {
  code: string;
  remainingSeconds: number;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpiringSoon = remainingSeconds < 120;

  return (
    <div className="mt-2 bg-muted/50 border border-dashed border-border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Mã kích hoạt
        </span>
        <span
          className={`text-xs font-medium flex items-center gap-1 ${isExpiringSoon ? "text-destructive" : "text-muted-foreground"}`}
        >
          <Clock className="h-3 w-3" />
          Hết hạn sau {formatCountdown(remainingSeconds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center text-xl font-bold font-mono text-primary tracking-[0.2em] bg-background border border-input rounded-md py-2">
          {code}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-2 rounded-md hover:bg-background border border-border transition-colors"
          title="Sao chép mã kích hoạt"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
      {isExpiringSoon && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Mã sắp hết hạn, vui lòng kích hoạt ngay
        </p>
      )}
    </div>
  );
}

function AccessDenied({ principalId }: { principalId: string | null }) {
  const { logout } = useAuthContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (principalId) {
      await navigator.clipboard.writeText(principalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center shadow-md space-y-5">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
          <p className="text-sm text-muted-foreground">
            Bạn chưa được cấp quyền vào trang này. Gửi Principal ID của bạn cho
            quản trị viên để được cấp quyền truy cập.
          </p>
        </div>
        {principalId && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Principal ID của bạn:
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border">
              <code className="text-xs font-mono flex-1 break-all text-left">
                {principalId}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded-md hover:bg-background transition-colors"
                title="Sao chép"
                data-ocid="device_management.copy_principal_button"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-500 font-medium">Đã sao chép!</p>
            )}
          </div>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => logout()}
          data-ocid="device_management.logout_button"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

function OfficeRoleSection({
  roleConfig,
  devices,
  pendingActivations,
  onRevoke,
  onRegister,
  isRegistering,
}: {
  roleConfig: (typeof OFFICE_ROLES)[number];
  devices: Array<{
    deviceId: string;
    deviceName: string;
    status: Variant_Active_Revoked;
  }>;
  pendingActivations: Record<string, { code: string; expiresAt: number }>;
  onRevoke: (deviceId: string) => void;
  onRegister: (role: EnterpriseDeviceRole, deviceName: string) => void;
  isRegistering: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  const activeCount = devices.filter(
    (d) => d.status === Variant_Active_Revoked.Active,
  ).length;
  const isFull = activeCount >= MAX_DEVICES_PER_ROLE;

  const handleRegister = () => {
    if (!deviceName.trim()) return;
    onRegister(roleConfig.key, deviceName.trim());
    setDeviceName("");
    setShowForm(false);
  };

  return (
    <div
      className={`bg-card border border-border rounded-lg overflow-hidden border-l-4 ${roleConfig.borderColor}`}
    >
      <div
        className={`px-4 py-3 ${roleConfig.headerBg} border-b border-border flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <h2 className={`text-sm font-semibold ${roleConfig.textColor}`}>
            {roleConfig.label}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {activeCount}/{MAX_DEVICES_PER_ROLE} thiết bị
        </span>
      </div>

      <div className="divide-y divide-border">
        {devices.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Chưa có thiết bị nào.
            </p>
          </div>
        )}

        {devices.map((device, idx) => {
          const pending = pendingActivations[device.deviceId];
          const now = Date.now();
          const remainingSeconds = pending
            ? Math.max(0, Math.ceil((pending.expiresAt - now) / 1000))
            : 0;

          return (
            <div
              key={device.deviceId}
              className="px-4 py-3 space-y-2"
              data-ocid={`device_management.device.${roleConfig.key}.item.${idx + 1}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {device.deviceName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {device.deviceId}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={device.status} />
                  {device.status === Variant_Active_Revoked.Active && (
                    <button
                      type="button"
                      onClick={() => onRevoke(device.deviceId)}
                      className="text-destructive hover:text-destructive/80 flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-destructive/5 transition-colors"
                      data-ocid={`device_management.revoke_button.${roleConfig.key}.${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Thu hồi
                    </button>
                  )}
                </div>
              </div>

              {pending && remainingSeconds > 0 && pending.code && (
                <ActivationCodeBox
                  code={pending.code}
                  remainingSeconds={remainingSeconds}
                />
              )}
            </div>
          );
        })}

        {/* Orphan activation codes — device created but refetch still in-flight */}
        {Object.entries(pendingActivations)
          .filter(([deviceId, pending]) => {
            const remaining = Math.max(
              0,
              Math.ceil((pending.expiresAt - Date.now()) / 1000),
            );
            // Only show as orphan if the device is NOT in the full devices list at all
            // (not just the filtered active ones passed to this section)
            return (
              !devices.some((d) => d.deviceId === deviceId) && remaining > 0
            );
          })
          .map(([deviceId, pending]) => {
            const remainingSeconds = Math.max(
              0,
              Math.ceil((pending.expiresAt - Date.now()) / 1000),
            );
            return (
              <div
                key={deviceId}
                className="px-4 py-3 space-y-1 border-t border-dashed border-primary/40 bg-primary/5"
              >
                <p className="text-xs text-muted-foreground">
                  Thiết bị mới — Mã kích hoạt:
                </p>
                <ActivationCodeBox
                  code={pending.code}
                  remainingSeconds={remainingSeconds}
                />
              </div>
            );
          })}
      </div>

      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={isFull}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-colors"
            data-ocid={`device_management.add_button.${roleConfig.key}`}
          >
            <Plus className="h-4 w-4" />
            {isFull
              ? `Đã đạt giới hạn ${MAX_DEVICES_PER_ROLE} thiết bị`
              : "Thêm thiết bị"}
          </button>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="office-device-name-input"
              className="block text-xs font-medium text-foreground"
            >
              Tên thiết bị
            </label>
            <div className="flex items-center gap-2">
              <input
                id="office-device-name-input"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="VĐ: Laptop kế toán 1"
                className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRegister();
                }}
                data-ocid={`device_management.device_name_input.${roleConfig.key}`}
              />
              <button
                type="button"
                onClick={handleRegister}
                disabled={isRegistering || !deviceName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm transition-colors"
                data-ocid={`device_management.confirm_button.${roleConfig.key}`}
              >
                {isRegistering ? "Đang xử lý..." : "Tạo mã kích hoạt"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setDeviceName("");
                }}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantRoleSection({
  roleKey,
  devices,
  pendingActivations,
  onRevoke,
  onRegister,
  isRegistering,
}: {
  roleKey: string;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    status: Variant_active_revoked;
  }>;
  pendingActivations: Record<string, { code: string; expiresAt: number }>;
  onRevoke: (deviceId: string) => void;
  onRegister: (role: string, deviceName: string) => void;
  isRegistering: boolean;
}) {
  const config = RESTAURANT_ROLE_CONFIG[roleKey];
  const [showForm, setShowForm] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  const handleRegister = () => {
    if (!deviceName.trim()) return;
    onRegister(roleKey, deviceName.trim());
    setDeviceName("");
    setShowForm(false);
  };

  return (
    <div
      className={`bg-card border border-border rounded-lg overflow-hidden border-l-4 ${config?.borderColor || "border-l-muted-foreground"}`}
    >
      <div
        className={`px-4 py-3 ${config?.headerBg || "bg-muted"} border-b border-border flex items-center justify-between`}
      >
        <h3
          className={`text-sm font-semibold ${config?.textColor || "text-muted-foreground"}`}
        >
          {config?.label || roleKey}
        </h3>
        <span className="text-xs text-muted-foreground">
          {devices.length} thiết bị
        </span>
      </div>

      <div className="divide-y divide-border">
        {devices.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">Chưa có thiết bị.</p>
          </div>
        )}

        {devices.map((device, idx) => {
          const pending = pendingActivations[device.deviceId];
          const now = Date.now();
          const remainingSeconds = pending
            ? Math.max(0, Math.ceil((pending.expiresAt - now) / 1000))
            : 0;

          return (
            <div
              key={device.deviceId}
              className="px-4 py-3 space-y-2"
              data-ocid={`device_management.restaurant_device.${roleKey}.item.${idx + 1}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {device.deviceName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {device.deviceId}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={device.status} />
                  {device.status === Variant_active_revoked.active && (
                    <button
                      type="button"
                      onClick={() => onRevoke(device.deviceId)}
                      className="text-destructive hover:text-destructive/80 flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-destructive/5 transition-colors"
                      data-ocid={`device_management.restaurant_revoke_button.${roleKey}.${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Thu hồi
                    </button>
                  )}
                </div>
              </div>

              {pending && remainingSeconds > 0 && pending.code && (
                <ActivationCodeBox
                  code={pending.code}
                  remainingSeconds={remainingSeconds}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm transition-colors"
            data-ocid={`device_management.restaurant_add_button.${roleKey}`}
          >
            <Plus className="h-4 w-4" />
            Thêm thiết bị
          </button>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="restaurant-device-name-input"
              className="block text-xs font-medium text-foreground"
            >
              Tên thiết bị
            </label>
            <div className="flex items-center gap-2">
              <input
                id="restaurant-device-name-input"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="VD: Máy bếp 1"
                className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRegister();
                }}
                data-ocid={`device_management.restaurant_device_name_input.${roleKey}`}
              />
              <button
                type="button"
                onClick={handleRegister}
                disabled={isRegistering || !deviceName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm transition-colors"
                data-ocid={`device_management.restaurant_confirm_button.${roleKey}`}
              >
                {isRegistering ? "Đang xử lý..." : "Tạo mã kích hoạt"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setDeviceName("");
                }}
                className="px-3 py-2 border border-border rounded-md hover:bg-muted text-sm transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantDeviceSection({
  restaurantId,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const { data: restaurantDevices, isLoading: devicesLoading } = useListDevices(
    BigInt(restaurantId),
  );
  const revokeDeviceMut = useRevokeDevice();
  const registerDeviceMut = useRegisterDevice();

  const [pendingActivations, setPendingActivations] = useState<
    Record<string, { code: string; expiresAt: number }>
  >({});

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingActivations((prev) => {
        const now = Date.now();
        const next: Record<string, { code: string; expiresAt: number }> = {};
        for (const [key, val] of Object.entries(prev)) {
          if (val.expiresAt > now) {
            next[key] = val;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRevoke = async (deviceId: string) => {
    if (confirm("Bạn có chắc muốn thu hồi thiết bị này?")) {
      try {
        await revokeDeviceMut.mutateAsync({
          restaurantId: BigInt(restaurantId),
          deviceId,
        });
        toast.success("Đã thu hồi thiết bị thành công.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Không thể thu hồi thiết bị.",
        );
      }
    }
  };

  const handleRegister = async (role: string, deviceName: string) => {
    // BUG 1 FIX: explicit Candid variant mapping — { [role]: null } is invalid
    const roleVariant = (() => {
      if (role === "Kitchen") return { Kitchen: null };
      if (role === "Waiter") return { Waiter: null };
      if (role === "KioskOrder") return { KioskOrder: null };
      return { Kitchen: null };
    })();
    try {
      const result = await registerDeviceMut.mutateAsync({
        restaurantId: BigInt(restaurantId),
        deviceName,
        role: roleVariant as unknown as import("@/backend").StaffRole,
      });
      // BUG 2 FIX: always call setPendingActivations so ActivationCodeBox renders
      if (result?.activationCode && result.deviceId) {
        setPendingActivations((prev) => ({
          ...prev,
          [result.deviceId]: {
            code: result.activationCode,
            expiresAt: Date.now() + 10 * 60 * 1000,
          },
        }));
        toast.success(`Mã kích hoạt đã tạo: ${result.activationCode}`);
      } else {
        toast.error(
          "Không thể tạo mã kích hoạt. Thiết bị có thể đã có vai trò hoặc đã đạt giới hạn.",
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Đăng ký thiết bị thất bại.",
      );
    }
  };

  const groupedDevices = useMemo(() => {
    if (!restaurantDevices) return {};
    const groups: Record<string, typeof restaurantDevices> = {};
    for (const device of restaurantDevices) {
      // CHANGE 2: Only show active or pending devices, hide revoked
      const statusKey =
        typeof device.status === "object" && device.status !== null
          ? Object.keys(
              device.status as Record<string, unknown>,
            )[0]?.toLowerCase()
          : String(device.status).toLowerCase();
      if (statusKey === "revoked") continue;
      const roleKey = getRoleKey(device.role);
      if (!groups[roleKey]) groups[roleKey] = [];
      groups[roleKey].push(device);
    }
    return groups;
  }, [restaurantDevices]);

  // Collect all device IDs currently in the list (for the orphan-pending check)
  // Must be defined BEFORE any early returns to satisfy React hooks rules.
  const allKnownDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    if (restaurantDevices) {
      for (const d of restaurantDevices) {
        // Only track non-revoked device IDs for orphan logic
        const statusKey =
          typeof d.status === "object" && d.status !== null
            ? Object.keys(d.status as Record<string, unknown>)[0]?.toLowerCase()
            : String(d.status).toLowerCase();
        if (statusKey !== "revoked") ids.add(d.deviceId);
      }
    }
    return ids;
  }, [restaurantDevices]);

  if (devicesLoading) {
    return (
      <p className="text-sm text-muted-foreground py-4">Đang tải thiết bị...</p>
    );
  }

  if (!restaurantDevices || restaurantDevices.length === 0) {
    return (
      <div className="py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Chưa có thiết bị nào tại nhà hàng này.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(RESTAURANT_ROLE_CONFIG).map(([roleKey]) => (
            <RestaurantRoleSection
              key={roleKey}
              roleKey={roleKey}
              devices={[]}
              pendingActivations={pendingActivations}
              onRevoke={handleRevoke}
              onRegister={handleRegister}
              isRegistering={registerDeviceMut.isPending}
            />
          ))}
        </div>
      </div>
    );
  }

  // Orphan pending activations: code created but device not yet in the list
  const orphanPending = Object.entries(pendingActivations).filter(
    ([deviceId, pending]) => {
      const remaining = Math.max(
        0,
        Math.ceil((pending.expiresAt - Date.now()) / 1000),
      );
      return !allKnownDeviceIds.has(deviceId) && remaining > 0;
    },
  );

  return (
    <div className="py-4 space-y-3">
      {/* Orphan activation codes — device created but refetch still in-flight */}
      {orphanPending.length > 0 && (
        <div className="space-y-2">
          {orphanPending.map(([deviceId, pending]) => {
            const remainingSeconds = Math.max(
              0,
              Math.ceil((pending.expiresAt - Date.now()) / 1000),
            );
            return (
              <div
                key={deviceId}
                className="p-3 border border-dashed border-primary/50 rounded-lg bg-primary/5"
              >
                <p className="text-xs text-muted-foreground mb-2">
                  Thiết bị mới — Mã kích hoạt đang chờ:
                </p>
                <ActivationCodeBox
                  code={pending.code}
                  remainingSeconds={remainingSeconds}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.keys(RESTAURANT_ROLE_CONFIG).map((roleKey) => (
          <RestaurantRoleSection
            key={roleKey}
            roleKey={roleKey}
            devices={groupedDevices[roleKey] || []}
            pendingActivations={pendingActivations}
            onRevoke={handleRevoke}
            onRegister={handleRegister}
            isRegistering={registerDeviceMut.isPending}
          />
        ))}
      </div>
    </div>
  );
}

export default function DeviceManagementPage() {
  const { role, principalId } = useAuthContext();
  const { isAuthenticated, login } = useInternetIdentity();
  const isOwner = role === "business_owner" || role === "developer";
  const { data: myPermissions } = useGetMyEnterprisePermissions();
  const hasDeviceManagementPermission = myPermissions?.some(
    (p) => p === EnterprisePermission.DeviceManagement,
  );
  const canAccess = isOwner || hasDeviceManagementPermission;

  const { data: devices, isLoading } = useListEnterpriseDevices();
  const registerDevice = useRegisterEnterpriseDevice();
  const revokeDevice = useRevokeEnterpriseDevice();

  const [activeTab, setActiveTab] = useState<"office" | "restaurant">("office");

  const [pendingActivations, setPendingActivations] = useState<
    Record<string, { code: string; expiresAt: number }>
  >({});

  const { data: restaurants, isLoading: restaurantsLoading } =
    usePublicRestaurants();

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(() => {
    return localStorage.getItem("deviceMgmt_selectedRestaurantId") ?? null;
  });

  const handleSelectRestaurant = (rid: string) => {
    setSelectedRestaurantId(rid);
    localStorage.setItem("deviceMgmt_selectedRestaurantId", rid);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingActivations((prev) => {
        const now = Date.now();
        const next: Record<string, { code: string; expiresAt: number }> = {};
        for (const [key, val] of Object.entries(prev)) {
          if (val.expiresAt > now) {
            next[key] = val;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated || !principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-md space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Quản lý thiết bị</h1>
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để tiếp tục
            </p>
          </div>
          <Button
            className="w-full gap-2"
            onClick={login}
            data-ocid="device_management.login_button"
          >
            <LogIn className="h-4 w-4" />
            Đăng nhập để tiếp tục
          </Button>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied principalId={principalId} />;
  }

  const getDevicesForRole = (roleKey: EnterpriseDeviceRole) => {
    const targetKey = getRoleKey(roleKey);
    return (
      devices?.filter((d) => {
        if (getRoleKey(d.role) !== targetKey) return false;
        // CHANGE 2: Only show active or pending, hide revoked
        const statusKey =
          typeof d.status === "object" && d.status !== null
            ? Object.keys(d.status as Record<string, unknown>)[0]?.toLowerCase()
            : String(d.status).toLowerCase();
        return statusKey !== "revoked";
      }) ?? []
    );
  };

  // Filter pending activations to only include those belonging to a specific role
  const getPendingActivationsForRole = (roleKey: EnterpriseDeviceRole) => {
    const targetKey = getRoleKey(roleKey);
    const filtered: Record<string, { code: string; expiresAt: number }> = {};
    for (const [deviceId, pending] of Object.entries(pendingActivations)) {
      const device = devices?.find((d) => d.deviceId === deviceId);
      if (device && getRoleKey(device.role) === targetKey) {
        filtered[deviceId] = pending;
      }
    }
    return filtered;
  };

  const handleRegisterEnterprise = async (
    role: EnterpriseDeviceRole,
    deviceName: string,
  ) => {
    try {
      const result = await registerDevice.mutateAsync({
        role,
        deviceName,
      });
      if (result?.activationCode && result?.deviceId) {
        setPendingActivations((prev) => ({
          ...prev,
          [result.deviceId]: {
            code: result.activationCode,
            expiresAt: Date.now() + 600000,
          },
        }));
        toast.success(`Mã kích hoạt đã tạo: ${result.activationCode}`);
      } else {
        toast.error("Không thể tạo mã kích hoạt. Vui lòng thử lại.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Đăng ký thiết bị thất bại");
    }
  };

  const handleRevokeEnterprise = async (deviceId: string) => {
    if (confirm("Bạn có chắc muốn thu hồi thiết bị này?")) {
      try {
        await revokeDevice.mutateAsync(deviceId);
        toast.success("Đã thu hồi thiết bị thành công.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Không thể thu hồi thiết bị.",
        );
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-background p-6"
      data-ocid="device_management.page"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Quản lý thiết bị</h1>

        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("office")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "office"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="device_management.office_tab"
          >
            <Building2 className="inline h-4 w-4 mr-1" />
            Thiết bị tại văn phòng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("restaurant")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "restaurant"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid="device_management.restaurant_tab"
          >
            <Store className="inline h-4 w-4 mr-1" />
            Thiết bị tại nhà hàng
          </button>
        </div>

        {activeTab === "office" && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Đang tải...
              </div>
            ) : (
              OFFICE_ROLES.map((roleConfig) => (
                <OfficeRoleSection
                  key={roleConfig.key}
                  roleConfig={roleConfig}
                  devices={getDevicesForRole(roleConfig.key)}
                  pendingActivations={getPendingActivationsForRole(
                    roleConfig.key,
                  )}
                  onRevoke={handleRevokeEnterprise}
                  onRegister={handleRegisterEnterprise}
                  isRegistering={registerDevice.isPending}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "restaurant" && (
          <div className="space-y-4">
            {/* Restaurant selector dropdown */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground shrink-0" />
                <select
                  className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedRestaurantId ?? ""}
                  onChange={(e) => handleSelectRestaurant(e.target.value)}
                  disabled={restaurantsLoading}
                  data-ocid="device_management.restaurant_select"
                >
                  <option value="" disabled>
                    {restaurantsLoading ? "Đang tải..." : "-- Chọn nhà hàng --"}
                  </option>
                  {restaurants?.map((r) => (
                    <option key={String(r.id)} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Device section for selected restaurant */}
            {selectedRestaurantId ? (
              (() => {
                const selected = restaurants?.find(
                  (r) => String(r.id) === selectedRestaurantId,
                );
                if (!selected) return null;
                return (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <RestaurantDeviceSection
                      restaurantId={selectedRestaurantId}
                      restaurantName={selected.name}
                    />
                  </div>
                );
              })()
            ) : (
              <div
                className="bg-card border border-border rounded-lg p-10 text-center"
                data-ocid="device_management.restaurant_empty_state"
              >
                <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Chọn nhà hàng để xem thiết bị
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
