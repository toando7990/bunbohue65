import { EnterprisePermission } from "@/backend";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthContext } from "@/contexts/AuthContext";
import { useGetMyEnterprisePermissions } from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart2,
  Building2,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Code2,
  Copy,
  Cpu,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Settings,
  ShieldOff,
  Users2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── Customer Layout ─────────────────────────────────────────────────────────

interface CustomerLayoutProps {
  children: React.ReactNode;
  restaurantName?: string;
  brand1Name?: string;
  businessName?: string;
  headerTitle?: string;
  headerLeft?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footerExtra?: React.ReactNode;
}

export function CustomerLayout({
  children,
  restaurantName,
  brand1Name,
  // businessName is destructured but unused — kept for API compatibility
  headerTitle,
  headerLeft,
  headerExtra,
  footerExtra,
}: CustomerLayoutProps) {
  // NOTE: document.title is managed by react-helmet-async in page components.
  // This useEffect is removed to avoid overriding Helmet titles.
  // useEffect(() => {
  //   document.title = businessName || "Bunbohue65";
  // }, [businessName]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary flex-1">
            {headerLeft ? (
              headerLeft
            ) : (
              <span className="font-display text-lg italic">
                {headerTitle || brand1Name || restaurantName || "Menu"}
              </span>
            )}
          </div>
          {headerExtra && (
            <div className="flex items-center">{headerExtra}</div>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
      <footer className="bg-muted/40 border-t border-border py-4">
        <div className="max-w-2xl mx-auto px-4 flex flex-col items-center gap-1">
          {footerExtra && (
            <div className="text-center text-xs text-muted-foreground w-full">
              {footerExtra}
            </div>
          )}
          <div className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Admin Layout ─────────────────────────────────────────────────────────────

interface AdminNavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  matchPrefix?: string;
}

function buildAdminNav(
  t: ReturnType<typeof useLanguage>["t"],
  role: import("@/contexts/AuthContext").UserRole,
  language: string,
  myPermissions: import("@/backend").EnterprisePermission[] | undefined,
): AdminNavItem[] {
  const items: AdminNavItem[] = [
    {
      label: t.nav.myRestaurants,
      icon: LayoutDashboard,
      href: "/admin/dashboard",
    },
  ];

  const hasDeviceManagementPermission = myPermissions?.some(
    (p) => p === EnterprisePermission.DeviceManagement,
  );

  if (role === "business_owner") {
    items.push({
      label: "Quản lý nhân viên",
      icon: Users2,
      href: "/enterprise-staff",
    });
  }

  if (role === "business_owner" || hasDeviceManagementPermission) {
    items.push({
      label: "Quản lý thiết bị",
      icon: Monitor,
      href: "/device-management",
    });
  }

  if (role === "business_owner" || role === "developer") {
    items.push({
      label: "Thực đơn tổng",
      icon: ChefHat,
      href: "/admin/master-menu",
    });
    items.push({
      label: "Worker",
      icon: Cpu,
      href: "/admin/worker",
    });
  }

  items.push(
    {
      label: t.businessProfile.mainMenuLabel,
      icon: Building2,
      href: "/admin/business-profile",
    },
    {
      label: language === "vi" ? "Hình ảnh quảng cáo" : "Banner Images",
      icon: Image,
      href: "/admin/banner-images",
    },
    {
      label: language === "vi" ? "Ảnh nền" : "Slideshow Images",
      icon: Image,
      href: "/admin/slideshow-images",
    },
    {
      label: language === "vi" ? "Gợi ý món" : "Suggestions",
      icon: Settings,
      href: "/admin/suggestion-config",
    },
  );
  if (role === "developer") {
    items.push({
      label: t.developerProfile.mainMenuLabel,
      icon: Code2,
      href: "/admin/developer-profile",
    });
  }
  return items;
}

function buildRestaurantNav(
  restaurantId: string,
  t: ReturnType<typeof useLanguage>["t"],
  language: string,
): AdminNavItem[] {
  const base = `/admin/restaurant/${restaurantId}`;
  return [
    {
      label: t.orders.title,
      icon: ClipboardList,
      href: `${base}/orders`,
      matchPrefix: `${base}/orders`,
    },
    {
      label: t.menuEditor.title,
      icon: ChefHat,
      href: `${base}/menu`,
      matchPrefix: `${base}/menu`,
    },
    {
      label: t.tables.title,
      icon: Settings,
      href: `${base}/tables`,
      matchPrefix: `${base}/tables`,
    },
    {
      label: t.restaurantSettings.navLabel,
      icon: Settings,
      href: `${base}/settings`,
      matchPrefix: `${base}/settings`,
    },
    {
      label: t.analytics.title,
      icon: BarChart2,
      href: `${base}/analytics`,
      matchPrefix: `${base}/analytics`,
    },
    {
      label: language === "vi" ? "Đặt bàn" : "Reservations",
      icon: CalendarDays,
      href: `${base}/reservations`,
      matchPrefix: `${base}/reservations`,
    },
  ];
}

interface AdminLayoutProps {
  children: React.ReactNode;
  restaurantId?: string;
  restaurantName?: string;
}

export function AdminLayout({
  children,
  restaurantId,
  restaurantName,
}: AdminLayoutProps) {
  const { role, principalId, isLoading, logout } = useAuthContext();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  useEffect(() => {
    if (role === "unknown" && !isLoading) {
      navigate({ to: "/admin" });
    }
  }, [role, isLoading, navigate]);

  const { data: myPermissions } = useGetMyEnterprisePermissions();

  const navItems = [
    ...buildAdminNav(t, role, language, myPermissions),
    ...(restaurantId ? buildRestaurantNav(restaurantId, t, language) : []),
  ];

  const isActive = (item: AdminNavItem) => {
    if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
    return pathname === item.href;
  };

  const handleCopyPrincipal = async () => {
    if (!principalId) return;
    await navigator.clipboard.writeText(principalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SidebarContent = () => (
    <nav className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <img
          src="/assets/logo-bunbohue65.png"
          alt="Bunbohue65"
          className="h-8 w-auto"
        />
      </div>
      {restaurantName && (
        <>
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {restaurantName}
          </p>
          <Separator className="mb-2" />
        </>
      )}
      {navItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth ${
            isActive(item)
              ? "bg-primary text-primary-foreground font-medium"
              : "text-foreground hover:bg-secondary hover:text-foreground"
          }`}
          data-ocid={`admin.nav.${item.label.toLowerCase().replace(/\s+/g, "_")}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      ))}
      <div className="mt-auto pt-4">
        <Separator className="mb-3" />
        <button
          type="button"
          onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mb-1"
          aria-label="Toggle language"
          data-ocid="admin.language_toggle"
        >
          <span className="text-sm">🌐</span>
          {language === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={logout}
          data-ocid="admin.logout_button"
        >
          <LogOut className="h-4 w-4" />
          {language === "vi" ? "Dăng xuất" : "Sign out"}
        </Button>
      </div>
    </nav>
  );

  // While role is being resolved after login → show spinner (check before unknown guard)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Not authenticated or role still resolving → show spinner while redirect fires
  if (role === "unknown") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Access blocked screen
  if (role === "blocked") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background px-4"
        data-ocid="access_denied.page"
      >
        <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              {t.developerProfile.accessDeniedTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t.developerProfile.accessDeniedMessage}
            </p>
          </div>
          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t.developerProfile.yourPrincipalId}
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <code
                className="flex-1 text-xs text-foreground font-mono break-all text-left"
                data-ocid="access_denied.principal_id"
              >
                {principalId}
              </code>
              <button
                type="button"
                onClick={handleCopyPrincipal}
                className="shrink-0 p-1 rounded hover:bg-background transition-colors"
                aria-label="Copy Principal ID"
                data-ocid="access_denied.copy_button"
              >
                {copied ? (
                  <span className="text-xs text-primary font-medium">
                    {t.developerProfile.copied}
                  </span>
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </div>
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={logout}
            data-ocid="access_denied.logout_button"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t.developerProfile.logout}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex md:hidden m-0 p-0 w-full h-full max-w-none max-h-none bg-transparent border-none"
          aria-modal="true"
          onClose={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          />
          <aside className="relative z-10 w-56 bg-card border-r border-border flex flex-col">
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent />
          </aside>
        </dialog>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
            data-ocid="admin.mobile_menu_button"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/assets/logo-bunbohue65.png"
              alt="Bunbohue65"
              className="h-6 w-auto"
            />
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>

        <footer className="bg-muted/40 border-t border-border py-3 px-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}.
          </p>
        </footer>
      </div>
    </div>
  );
}
