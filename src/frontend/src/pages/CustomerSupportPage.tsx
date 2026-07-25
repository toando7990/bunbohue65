import { EnterprisePermission } from "@/backend";
import { EnterpriseDevicePinGuard } from "@/components/EnterpriseDevicePinGuard";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { useGetMyEnterprisePermissions } from "@/hooks/useBackend";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Check, Copy, Headphones, LogIn, LogOut, ShieldX } from "lucide-react";
import { useState } from "react";

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
                data-ocid="customer_support.copy_principal_button"
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
          data-ocid="customer_support.logout_button"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

export default function CustomerSupportPage() {
  const { role, principalId } = useAuthContext();
  const { isAuthenticated, login } = useInternetIdentity();
  const { data: myPermissions } = useGetMyEnterprisePermissions();

  const isOwner = role === "business_owner" || role === "developer";
  const hasPermission = myPermissions?.some(
    (p) => p === EnterprisePermission.CustomerSupport,
  );
  const canAccess = isOwner || hasPermission;

  if (!isAuthenticated || !principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-md space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Headphones className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Giải đáp khách hàng</h1>
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để tiếp tục
            </p>
          </div>
          <Button
            className="w-full gap-2"
            onClick={login}
            data-ocid="customer_support.login_button"
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

  return (
    <EnterpriseDevicePinGuard requiredRole="customer-support">
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="text-center space-y-6"
          data-ocid="customer_support.page"
        >
          <Headphones className="mx-auto h-20 w-20 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Giải đáp khách hàng
          </h1>
          <p className="text-lg text-muted-foreground">
            Tính năng đang được phát triển
          </p>
        </div>
      </div>
    </EnterpriseDevicePinGuard>
  );
}
