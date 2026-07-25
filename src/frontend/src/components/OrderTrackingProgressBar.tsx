import { Bike, Building2, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { OrderStatus, ShippingStatus } from "../backend";
import { useGetOrderForTracking } from "../hooks/useBackend";

interface OrderTrackingProgressBarProps {
  orderId: bigint;
  restaurantName: string;
  deliveryAddress: string;
  /** Tọa độ nhà hàng (tùy chọn) — dùng để tính vị trí marker theo haversine. */
  restaurantLat?: number;
  restaurantLng?: number;
}

/**
 * Ánh xạ orderStatus (nguồn sự thật chính) sang text trạng thái tiếng Việt.
 * Dòng trạng thái LUÔN dùng orderStatus cho mọi trường hợp.
 */
const ORDER_STATUS_MESSAGES: Record<OrderStatus, string> = {
  [OrderStatus.WaitingDriver]: "Chờ tài xế",
  [OrderStatus.WaitingDriverPayment]: "Chờ tài xế thanh toán",
  [OrderStatus.Preparing]: "Đang chuẩn bị",
  [OrderStatus.Delivered]: "Đã giao",
  [OrderStatus.FindingDriver]: "Đang tìm tài xế",
  [OrderStatus.Ready]: "Sẵn sàng",
  [OrderStatus.DispatchCenter]: "Trung tâm điều phối",
  [OrderStatus.Pending]: "Đang xử lý",
  [OrderStatus.PendingApproval]: "Đang chờ duyệt",
  [OrderStatus.PaymentPending]: "Chờ thanh toán",
  [OrderStatus.Cancelled]: "Đã hủy",
  [OrderStatus.Completed]: "Hoàn tất",
};

/**
 * Vị trí marker mặc định theo shippingStatus khi không có tọa độ tài xế.
 * 10 = nhà hàng, 90 = địa chỉ giao.
 */
const SHIPPING_STATUS_POSITION: Record<ShippingStatus, number> = {
  [ShippingStatus.SearchingShipper]: 10,
  [ShippingStatus.ShipperAccepted]: 25,
  [ShippingStatus.PickedUp]: 50,
  [ShippingStatus.Delivering]: 75,
  [ShippingStatus.DeliveryFailed]: 50,
};

/** Các shippingStatus cho phép hiển thị marker khi có tọa độ tài xế. */
const MARKER_VISIBLE_STATUSES: ReadonlySet<ShippingStatus> = new Set([
  ShippingStatus.ShipperAccepted,
  ShippingStatus.PickedUp,
  ShippingStatus.Delivering,
]);

/** Bán kính Trái Đất (km) cho công thức haversine. */
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Khoảng cách haversine giữa 2 tọa độ (km).
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function OrderTrackingProgressBar({
  orderId,
  restaurantName,
  deliveryAddress,
  restaurantLat,
  restaurantLng,
}: OrderTrackingProgressBarProps) {
  const { data: trackingData } = useGetOrderForTracking(orderId);
  const [driverPosition, setDriverPosition] = useState(10);
  const [markerVisible, setMarkerVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Đang tìm tài xế");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!trackingData) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    const {
      orderStatus,
      shippingStatus,
      driverInfo,
      deliveryLat,
      deliveryLng,
    } = trackingData;

    // Phần 2: orderStatus là nguồn sự thật chính cho dòng trạng thái.
    setStatusMessage(
      ORDER_STATUS_MESSAGES[orderStatus as OrderStatus] ?? "Đang xử lý",
    );

    const status = shippingStatus ?? ShippingStatus.SearchingShipper;

    // Phần 3: hiển thị marker khi có tọa độ tài xế VÀ shippingStatus thuộc
    // ShipperAccepted/PickedUp/Delivering. Ẩn khi Delivered hoặc không có lat/lng.
    const hasDriverCoords = driverInfo?.lat != null && driverInfo?.lng != null;
    const hasEndpointCoords =
      restaurantLat != null &&
      restaurantLng != null &&
      deliveryLat != null &&
      deliveryLng != null;

    if (
      hasDriverCoords &&
      MARKER_VISIBLE_STATUSES.has(status as ShippingStatus) &&
      hasEndpointCoords
    ) {
      // Tính vị trí marker theo khoảng cách haversine.
      // Tổng quãng đường = nhà hàng → tài xế → địa chỉ giao.
      // % tiến trình = (khoảng cách đã đi) / (tổng quãng đường) * 80 + 10
      // (10..90 để marker nằm trong khoảng giữa 2 đầu mút trên thanh).
      const driverToRestaurant = haversineKm(
        driverInfo!.lat!,
        driverInfo!.lng!,
        restaurantLat!,
        restaurantLng!,
      );
      const driverToDelivery = haversineKm(
        driverInfo!.lat!,
        driverInfo!.lng!,
        deliveryLat!,
        deliveryLng!,
      );
      const restaurantToDelivery = haversineKm(
        restaurantLat!,
        restaurantLng!,
        deliveryLat!,
        deliveryLng!,
      );
      const totalDistance = driverToRestaurant + driverToDelivery;
      const progress =
        totalDistance <= 0
          ? 0
          : (restaurantToDelivery - driverToDelivery) / totalDistance;
      const clamped = Math.max(0, Math.min(1, progress));
      setDriverPosition(10 + clamped * 80);
      setMarkerVisible(true);
    } else if (
      hasDriverCoords &&
      MARKER_VISIBLE_STATUSES.has(status as ShippingStatus)
    ) {
      // Có tọa độ tài xế nhưng không có tọa độ đầu mút → fallback theo switch.
      setDriverPosition(
        SHIPPING_STATUS_POSITION[status as ShippingStatus] ?? 10,
      );
      setMarkerVisible(true);
    } else if (orderStatus === OrderStatus.Delivered || !hasDriverCoords) {
      // Đã giao hoặc không có tọa độ tài xế → ẩn marker hoàn toàn.
      setMarkerVisible(false);
    } else {
      // Các trạng thái khác (SearchingShipper, DeliveryFailed) → fallback theo switch.
      setDriverPosition(
        SHIPPING_STATUS_POSITION[status as ShippingStatus] ?? 10,
      );
      setMarkerVisible(true);
    }
  }, [trackingData, restaurantLat, restaurantLng]);

  return (
    <div className="w-full bg-card border border-border rounded-xl p-4">
      {/* Two-position layout: Restaurant and Delivery Address */}
      <div className="relative flex items-center justify-between mb-6">
        {/* Connector line */}
        <div className="absolute top-5 left-8 right-8 h-1 bg-muted rounded-full" />

        {/* Restaurant position */}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-[10px] font-semibold text-foreground text-center max-w-[80px] leading-tight">
            {restaurantName}
          </span>
        </div>

        {/* Driver indicator — chỉ render khi markerVisible */}
        {markerVisible && (
          <div
            className="absolute top-3 z-20 transition-all duration-700 ease-out"
            style={{
              left: `${driverPosition}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-accent border-2 border-background shadow-md flex items-center justify-center animate-bounce-subtle">
                <Bike className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          </div>
        )}

        {/* Delivery address position */}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-secondary border-2 border-border flex items-center justify-center shadow-sm">
            <Home className="w-5 h-5 text-secondary-foreground" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground text-center max-w-[80px] leading-tight">
            {deliveryAddress}
          </span>
        </div>
      </div>

      {/* Status message below — chỉ text trạng thái thuần, không có thông tin phụ */}
      <div className="text-center">
        {loadFailed ? (
          <div
            data-ocid="order_tracking.error_state"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            Không tải được trạng thái đơn
          </div>
        ) : (
          <p className="text-sm font-semibold text-foreground">
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
}
