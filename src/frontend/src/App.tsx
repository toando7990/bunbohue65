import { useAuthContext } from "@/contexts/AuthContext";
import AccountingViewPageComponent from "@/pages/AccountingViewPage";
import ActivateDevicePageComponent from "@/pages/ActivateDevicePage";
import AdminPageComponent from "@/pages/AdminPage";
import AdminReservationsPageComponent from "@/pages/AdminReservationsPage";
import AnalyticsPageComponent from "@/pages/AnalyticsPage";
import BannerImagesPageComponent from "@/pages/BannerImagesPage";
import BusinessProfilePageComponent from "@/pages/BusinessProfilePage";
import CodPaymentPageComponent from "@/pages/CodPaymentPage";
import CustomerSupportPageComponent from "@/pages/CustomerSupportPage";
import DashboardPageComponent from "@/pages/DashboardPage";
import DeliveryOrderPageComponent from "@/pages/DeliveryOrderPage";
import DeveloperProfilePageComponent from "@/pages/DeveloperProfilePage";
import DeviceManagementPageComponent from "@/pages/DeviceManagementPage";
import EnterpriseDeliveryPageComponent from "@/pages/EnterpriseDeliveryPage";
import EnterpriseStaffManagementPageComponent from "@/pages/EnterpriseStaffManagementPage";
import HomePageComponent from "@/pages/HomePage";
import KioskOrderPageComponent from "@/pages/KioskOrderPage";
import KitchenViewPageComponent from "@/pages/KitchenViewPage";
import MasterMenuPageComponent from "@/pages/MasterMenuPage";
import MenuPageComponent from "@/pages/MenuPage";
import OrderHistoryPageComponent from "@/pages/OrderHistoryPage";
import OrderPageComponent from "@/pages/OrderPage";
import OrderTrackingPageComponent from "@/pages/OrderTrackingPage";
import OrdersPage from "@/pages/OrdersPage";
import ReservationPageComponent from "@/pages/ReservationPage";
import RestaurantSettingsPageComponent from "@/pages/RestaurantSettingsPage";
import SlideshowImagesPageComponent from "@/pages/SlideshowImagesPage";
import SuggestionConfigPageComponent from "@/pages/SuggestionConfigPage";
import TablesPageComponent from "@/pages/TablesPage";
import WaiterViewPageComponent from "@/pages/WaiterViewPage";
import WorkerPageComponent from "@/pages/WorkerPage";
import {
  Navigate,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

// ─── Root ─────────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute();

// ─── Customer: Home ───────────────────────────────────────────────────────────

function HomePage() {
  return <DeliveryOrderPageComponent />;
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

// ─── Customer: Order ──────────────────────────────────────────────────────────

function OrderPage() {
  return <OrderPageComponent />;
}

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/order",
  component: OrderPage,
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId:
      search.restaurantId != null && String(search.restaurantId).trim() !== ""
        ? String(search.restaurantId)
        : undefined,
    tableId:
      search.tableId != null && String(search.tableId).trim() !== ""
        ? String(search.tableId)
        : undefined,
  }),
});

// ─── Admin: Login redirect ────────────────────────────────────────────────────

function AdminPage() {
  return <AdminPageComponent />;
}

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

// ─── Admin: Dashboard ─────────────────────────────────────────────────────────

function DashboardPage() {
  return <DashboardPageComponent />;
}

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/dashboard",
  component: DashboardPage,
});

// ─── Admin: Menu ──────────────────────────────────────────────────────────────

function MenuPage() {
  return <MenuPageComponent />;
}

const menuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/menu",
  component: MenuPage,
});

// ─── Admin: Tables ────────────────────────────────────────────────────────────

function TablesPage() {
  return <TablesPageComponent />;
}

const tablesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/tables",
  component: TablesPage,
});

// ─── Admin: Orders ────────────────────────────────────────────────────────────

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/orders",
  component: OrdersPage,
});

// ─── Admin: Reservations ───────────────────────────────────────────────────────

const reservationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/reservations",
  component: AdminReservationsPageComponent,
});

// ─── Admin: Analytics ────────────────────────────────────────────────────────

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/analytics",
  component: AnalyticsPageComponent,
});

// ─── Admin: Business Profile ────────────────────────────────────────────────

function BusinessProfilePage() {
  return <BusinessProfilePageComponent />;
}

const businessProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/business-profile",
  component: BusinessProfilePage,
});

// ─── Admin: Banner Images ─────────────────────────────────────────────────────

function BannerImagesPage() {
  return <BannerImagesPageComponent />;
}

const bannerImagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/banner-images",
  component: BannerImagesPage,
});

// ─── Admin: Developer Profile ───────────────────────────────────────────────
// ─── Admin: Slideshow Images ─────────────────────────────────────────────────

function SlideshowImagesPage() {
  return <SlideshowImagesPageComponent />;
}

const slideshowImagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/slideshow-images",
  component: SlideshowImagesPage,
});

// ─── Admin: Suggestion Config ────────────────────────────────────────────────

function SuggestionConfigPage() {
  return <SuggestionConfigPageComponent />;
}

const suggestionConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/suggestion-config",
  component: SuggestionConfigPage,
});

function DeveloperProfilePage() {
  const { role } = useAuthContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (role !== "unknown" && role !== "developer") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [role, navigate]);
  if (role !== "developer") return null;
  return <DeveloperProfilePageComponent />;
}

const developerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/developer-profile",
  component: DeveloperProfilePage,
});

// ─── Admin: Restaurant Settings ──────────────────────────────────────────────

function RestaurantSettingsPage() {
  return <RestaurantSettingsPageComponent />;
}

const restaurantSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/restaurant/$restaurantId/settings",
  component: RestaurantSettingsPage,
});

// ─── Customer: Order History ────────────────────────────────────────────────

const orderHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/order/history",
  component: OrderHistoryPageComponent,
});

// ─── Customer: Reservation ──────────────────────────────────────────────────

const reservationCustomerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reservation",
  component: ReservationPageComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId:
      search.restaurantId != null && String(search.restaurantId).trim() !== ""
        ? String(search.restaurantId)
        : undefined,
  }),
});

// ─── Customer: Delivery Order ─────────────────────────────────────────────────

function DeliveryOrderPage() {
  return <Navigate to="/" replace />;
}

const deliveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/delivery",
  component: DeliveryOrderPage,
});

// ─── Staff: Activate Device ─────────────────────────────────────────────────

function ActivateDevicePage() {
  return <ActivateDevicePageComponent />;
}

const activateDeviceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activate-device",
  component: ActivateDevicePage,
  validateSearch: (search: Record<string, unknown>) => ({
    code:
      search.code != null && String(search.code).trim() !== ""
        ? String(search.code)
        : undefined,
    role:
      search.role != null && String(search.role).trim() !== ""
        ? String(search.role)
        : undefined,
  }),
});

// ─── Staff: Kitchen View ─────────────────────────────────────────────────────

function KitchenViewPage() {
  return <KitchenViewPageComponent />;
}

const kitchenViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kitchen-view",
  component: KitchenViewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId:
      search.restaurantId != null && String(search.restaurantId).trim() !== ""
        ? String(search.restaurantId)
        : undefined,
    token:
      search.token != null && String(search.token).trim() !== ""
        ? String(search.token)
        : undefined,
  }),
});

// ─── Staff: Waiter View ───────────────────────────────────────────────────────

function WaiterViewPage() {
  return <WaiterViewPageComponent />;
}

const waiterViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/waiter-view",
  component: WaiterViewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId:
      search.restaurantId != null && String(search.restaurantId).trim() !== ""
        ? String(search.restaurantId)
        : undefined,
    token:
      search.token != null && String(search.token).trim() !== ""
        ? String(search.token)
        : undefined,
  }),
});

// ─── Staff: Kiosk Order ─────────────────────────────────────────────────────

function KioskOrderPage() {
  return <KioskOrderPageComponent />;
}

const kioskOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kiosk-order",
  component: KioskOrderPage,
  validateSearch: (search: Record<string, unknown>) => ({
    restaurantId:
      search.restaurantId != null && String(search.restaurantId).trim() !== ""
        ? String(search.restaurantId)
        : undefined,
    token:
      search.token != null && String(search.token).trim() !== ""
        ? String(search.token)
        : undefined,
  }),
});

// ─── Enterprise: Delivery ────────────────────────────────────────────────────

function EnterpriseDeliveryPage() {
  return <EnterpriseDeliveryPageComponent />;
}

const enterpriseDeliveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/enterprise-delivery",
  component: EnterpriseDeliveryPage,
});

function EnterpriseStaffManagementPage() {
  return <EnterpriseStaffManagementPageComponent />;
}

const enterpriseStaffManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/enterprise-staff",
  component: EnterpriseStaffManagementPage,
});

function DeviceManagementPage() {
  return <DeviceManagementPageComponent />;
}

const deviceManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/device-management",
  component: DeviceManagementPage,
});

function CustomerSupportPage() {
  return <CustomerSupportPageComponent />;
}

const customerSupportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customer-support",
  component: CustomerSupportPage,
});

function AccountingViewPage() {
  return <AccountingViewPageComponent />;
}

// ─── Staff: COD Payment ───────────────────────────────────────────────────────

function CodPaymentPage() {
  return <CodPaymentPageComponent />;
}

const codPaymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cod-payment",
  component: CodPaymentPage,
});

// ─── Admin: Accounting View ───────────────────────────────────────────────────

const accountingViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounting-view",
  component: AccountingViewPage,
});

// ─── Admin: Master Menu ──────────────────────────────────────────────────────

function MasterMenuPage() {
  const { isAuthenticated, role } = useAuthContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated && role !== "business_owner" && role !== "developer") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [isAuthenticated, role, navigate]);
  if (!isAuthenticated || (role !== "business_owner" && role !== "developer"))
    return null;
  return <MasterMenuPageComponent />;
}

const masterMenuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/master-menu",
  component: MasterMenuPage,
});

// ─── Admin: Worker ───────────────────────────────────────────────────────────

function WorkerPage() {
  const { isAuthenticated, role } = useAuthContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated && role !== "business_owner" && role !== "developer") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [isAuthenticated, role, navigate]);
  if (!isAuthenticated || (role !== "business_owner" && role !== "developer"))
    return null;
  return <WorkerPageComponent />;
}

const workerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/worker",
  component: WorkerPage,
});

// ─── Customer: Order Tracking (token-gated) ───────────────────────────────────

function OrderTrackingPage() {
  return <OrderTrackingPageComponent />;
}

const orderTrackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/order/tracking",
  component: OrderTrackingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    orderId:
      search.orderId != null && String(search.orderId).trim() !== ""
        ? String(search.orderId)
        : undefined,
  }),
});

// ─── Route tree ───────────────────────────────────────────────────────────────

export const routeTree = rootRoute.addChildren([
  homeRoute,
  orderRoute,
  orderHistoryRoute,
  orderTrackingRoute,
  reservationCustomerRoute,
  deliveryRoute,

  adminRoute,
  dashboardRoute,
  menuRoute,
  tablesRoute,
  ordersRoute,
  businessProfileRoute,
  bannerImagesRoute,
  slideshowImagesRoute,
  suggestionConfigRoute,
  developerProfileRoute,
  restaurantSettingsRoute,
  analyticsRoute,
  reservationsRoute,
  activateDeviceRoute,
  kitchenViewRoute,
  waiterViewRoute,

  kioskOrderRoute,
  enterpriseDeliveryRoute,
  enterpriseStaffManagementRoute,
  deviceManagementRoute,
  customerSupportRoute,
  codPaymentRoute,
  accountingViewRoute,
  masterMenuRoute,
  workerRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return <RouterProvider router={router} />;
}
