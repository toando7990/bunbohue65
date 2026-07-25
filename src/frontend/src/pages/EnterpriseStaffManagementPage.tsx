import { EnterprisePermission } from "@/backend";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useAddEnterpriseStaff,
  useGrantEnterprisePermission,
  useListEnterpriseStaff,
  useRemoveEnterpriseStaff,
  useRevokeEnterprisePermission,
} from "@/hooks/useBackend";
import { Principal } from "@icp-sdk/core/principal";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

const PERMISSION_CONFIGS = [
  {
    key: EnterprisePermission.EnterpriseDelivery,
    label: "Trung tâm điều phối giao hàng",
  },
  { key: EnterprisePermission.CustomerSupport, label: "Giải đáp khách hàng" },
  { key: EnterprisePermission.Accounting, label: "Kế toán" },
  { key: EnterprisePermission.DeviceManagement, label: "Quản lý thiết bị" },
];

export default function EnterpriseStaffManagementPage() {
  const { role } = useAuthContext();
  const isOwner = role === "business_owner" || role === "developer";

  const { data: staffList, isLoading } = useListEnterpriseStaff();
  const addStaff = useAddEnterpriseStaff();
  const removeStaff = useRemoveEnterpriseStaff();
  const grantPermission = useGrantEnterprisePermission();
  const revokePermission = useRevokeEnterprisePermission();

  const [principalInput, setPrincipalInput] = useState("");
  const [error, setError] = useState("");

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">
            Không có quyền truy cập
          </h1>
          <p className="text-muted-foreground">
            Chỉ chủ sở hữu doanh nghiệp mới có quyền quản lý nhân viên.
          </p>
        </div>
      </div>
    );
  }

  const handleAdd = async () => {
    setError("");
    if (!principalInput.trim()) {
      setError("Vui lòng nhập Principal ID");
      return;
    }
    try {
      const principal = Principal.fromText(principalInput.trim());
      await addStaff.mutateAsync(principal);
      setPrincipalInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thêm nhân viên thất bại");
    }
  };

  const handleTogglePermission = async (
    principalId: Principal,
    permission: EnterprisePermission,
    currentlyHas: boolean,
  ) => {
    if (currentlyHas) {
      await revokePermission.mutateAsync({ principalId, permission });
    } else {
      await grantPermission.mutateAsync({ principalId, permission });
    }
  };

  const handleDelete = async (principalId: Principal) => {
    if (confirm("Bạn có chắc muốn xóa nhân viên này?")) {
      await removeStaff.mutateAsync(principalId);
    }
  };

  const hasPermission = (
    permissions: Array<EnterprisePermission>,
    perm: EnterprisePermission,
  ) => permissions.some((p) => p === perm);

  return (
    <div
      className="min-h-screen bg-background p-6"
      data-ocid="enterprise_staff.page"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          Quản lý nhân viên
        </h1>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label
              htmlFor="staff-principal-id"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Principal ID nhân viên
            </label>
            <input
              id="staff-principal-id"
              type="text"
              value={principalInput}
              onChange={(e) => setPrincipalInput(e.target.value)}
              placeholder="Nhập Principal ID..."
              className="w-full px-3 py-2 border border-input rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              data-ocid="enterprise_staff.input"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={addStaff.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            data-ocid="enterprise_staff.add_button"
          >
            <UserPlus className="h-4 w-4" />
            Thêm nhân viên
          </button>
        </div>

        {error && (
          <p
            className="text-sm text-destructive"
            data-ocid="enterprise_staff.error_state"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Đang tải...
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    Principal ID
                  </th>
                  {PERMISSION_CONFIGS.map((cfg) => (
                    <th
                      key={cfg.key}
                      className="px-4 py-3 text-center font-medium text-foreground"
                    >
                      {cfg.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium text-foreground">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffList && staffList.length > 0 ? (
                  staffList.map((staff, index) => (
                    <tr
                      key={staff.principalId.toText()}
                      className="border-t border-border"
                      data-ocid={`enterprise_staff.item.${index + 1}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-foreground break-all max-w-xs">
                        {staff.principalId.toText()}
                      </td>
                      {PERMISSION_CONFIGS.map((cfg) => {
                        const checked = hasPermission(
                          staff.permissions,
                          cfg.key,
                        );
                        return (
                          <td key={cfg.key} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleTogglePermission(
                                  staff.principalId,
                                  cfg.key,
                                  checked,
                                )
                              }
                              className="h-4 w-4 accent-primary cursor-pointer"
                              data-ocid={`enterprise_staff.checkbox.${index + 1}`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(staff.principalId)}
                          className="text-destructive hover:text-destructive/80"
                          data-ocid={`enterprise_staff.delete_button.${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                      data-ocid="enterprise_staff.empty_state"
                    >
                      Chưa có nhân viên nào được thêm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
