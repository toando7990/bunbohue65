import type { DriverInfo } from "@/backend";
import { DynamicQRPanel } from "@/components/DynamicQRPanel";
import type { QrProvider } from "@/components/PaymentMethodSelector";
import {
  type BusinessBankDetails,
  type TingeeConfig,
  formatPrice,
  getTodayDateString,
  useGetBusinessProfileInfo,
  useListDeliveryOrders,
} from "@/hooks/useBackend";
import { type OrderPublic, OrderStatus } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  MapPin,
  Phone,
  Printer,
  Truck,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface DriverWaitingTabProps {
  restaurantId: bigint;
  /** Tingee config (device-scoped). When present together with qrProvider='tingee',
   * each waiting order renders DynamicQRPanel instead of the broken static VietQR. */
  tingeeConfig?: TingeeConfig | null;
  /** Which QR provider to render. Defaults to 'none' (no QR overlay). */
  qrProvider?: QrProvider;
  /** Business bank details — retained for API compatibility (unused by DynamicQRPanel). */
  bankDetails?: BusinessBankDetails | null;
  /** Called when the dynamic QR confirms payment for an order. */
  onPaid?: (orderId: bigint) => void;
}

// Simple notification sound using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error("Failed to play notification sound:", e);
  }
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

/** Resolve driver display info: prefer driverInfo (AhaMove), fallback to shipper fields. */
function getDriverDisplay(order: OrderPublic): {
  name: string;
  phone: string;
  vehiclePlate?: string;
} {
  const di = order.driverInfo as DriverInfo | undefined;
  if (di && (di.name || di.phone || di.vehiclePlate)) {
    return {
      name: di.name || "",
      phone: di.phone || "",
      vehiclePlate: di.vehiclePlate || undefined,
    };
  }
  return {
    name: order.shipperName || "",
    phone: order.shipperPhone || "",
  };
}

export default function DriverWaitingTab({
  restaurantId,
  tingeeConfig,
  qrProvider = "none",
  onPaid,
}: DriverWaitingTabProps) {
  const {
    data: orders,
    isLoading,
    refetch,
  } = useListDeliveryOrders(restaurantId, getTodayDateString());
  const businessProfileInfo = useGetBusinessProfileInfo();
  const hasVA = !!businessProfileInfo.data?.tingeeVA?.trim();
  const [previousOrderIds, setPreviousOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const useTingee = qrProvider === "tingee" && tingeeConfig != null;

  // Only COD orders that have successfully booked an AhaMove driver appear here.
  // Per backend: #WaitingDriverPayment is only set AFTER bookDriverForCodOrder /
  // confirmAhamoveBooking sets ahamoveOrderId, so this status already implies a
  // driver was booked. #WaitingDriver (COD created but NOT yet booked) MUST be
  // excluded — those orders have not booked a driver yet.
  const waitingOrders = (orders || []).filter(
    (order: OrderPublic) =>
      order.isCod === true && order.status === OrderStatus.WaitingDriverPayment,
  );

  // Auto-refresh every 10 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refetch();
    }, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refetch]);

  // Track order changes and play sound when orders are paid
  useEffect(() => {
    const currentIds = new Set(
      waitingOrders.map((o: OrderPublic) => o.id.toString()),
    );
    const previousIds = previousOrderIds;

    // If an order disappeared from waiting list, it was paid
    if (previousIds.size > 0) {
      const paidOrderIds = [...previousIds].filter((id) => !currentIds.has(id));
      if (paidOrderIds.length > 0 && soundEnabled) {
        playNotificationSound();
      }
    }

    setPreviousOrderIds(currentIds);
  }, [waitingOrders, soundEnabled, previousOrderIds]);

  const handlePrint = useCallback((orderId: string) => {
    setPrintOrderId(orderId);
    setTimeout(() => {
      window.print();
      setPrintOrderId(null);
    }, 300);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  const closePayOverlay = useCallback(() => {
    setPayOrderId(null);
  }, []);

  // Resolve the order currently shown in the payment overlay
  const payOrder =
    payOrderId != null
      ? waitingOrders.find((o: OrderPublic) => o.id.toString() === payOrderId)
      : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#FFF8E1]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF9800]" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#FFF8E1] p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-[#FF9800]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Đơn chờ tài xế</h2>
            <p className="text-sm text-gray-600">
              {waitingOrders.length} đơn đang chờ thanh toán
            </p>
          </div>
        </div>
        <button
          onClick={toggleSound}
          className="p-2 rounded-full hover:bg-[#FF9800]/10 transition-colors"
          title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          data-ocid="driver.toggle_sound.button"
        >
          {soundEnabled ? (
            <Volume2 className="w-6 h-6 text-[#FF9800]" />
          ) : (
            <VolumeX className="w-6 h-6 text-gray-400" />
          )}
        </button>
      </div>

      {/* Orders Grid */}
      {waitingOrders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-96 text-gray-500"
          data-ocid="driver.empty_state"
        >
          <Truck className="w-16 h-16 mb-4 text-gray-300" />
          <p className="text-xl font-medium">Không có đơn hàng chờ tài xế</p>
          <p className="text-sm mt-2">
            Đơn hàng COD sẽ hiển thị ở đây khi tài xế đến thanh toán
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {waitingOrders.map((order: OrderPublic, index: number) => {
              const total = (order.subtotal || 0n) + (order.shippingFee || 0n);
              const driver = getDriverDisplay(order);
              const driverName =
                driver.name || order.shipperName || "Chưa có tài xế";
              const driverPhone = driver.phone || order.shipperPhone || "";
              return (
                <motion.div
                  key={order.id.toString()}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                  className="bg-white rounded-xl border-2 border-[#FF9800] p-4 shadow-lg flex flex-col"
                  data-ocid={`driver.order.card.item.${index + 1}`}
                >
                  {/* Phần 1: Thông tin tài xế (tiêu đề chính) */}
                  <div className="flex-1 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FF9800]/10">
                        <User className="w-5 h-5 text-[#FF9800]" />
                      </div>
                      <span className="text-lg font-bold text-gray-800 truncate">
                        {driverName}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 pl-11">
                      {driverPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{maskPhone(driverPhone)}</span>
                        </div>
                      )}
                      {driver.vehiclePlate && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-700">
                            {driver.vehiclePlate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phần 2: Mã đơn + số tiền (1 dòng gọn) */}
                  <div className="flex items-center justify-between gap-2 py-2 px-3 mb-3 bg-gray-50 rounded-lg text-sm">
                    <span className="font-bold text-red-500 truncate">
                      {order.orderCode || ""}
                    </span>
                    <span className="font-bold text-green-600 whitespace-nowrap">
                      {formatPrice(total)}
                    </span>
                  </div>

                  {/* Phần 3: Nút Thanh toán + In bill (1 dòng nút) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPayOrderId(order.id.toString())}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF9800] text-white rounded-lg hover:bg-[#F57C00] transition-colors font-medium"
                      data-ocid={`driver.pay_button.item.${index + 1}`}
                    >
                      Thanh toán
                    </button>
                    <button
                      onClick={() => handlePrint(order.id.toString())}
                      className="flex items-center justify-center px-3 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      title="In bill"
                      data-ocid={`driver.print_button.item.${index + 1}`}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Payment overlay — DynamicQRPanel variant='kiosk' (QR lớn ~60% màn hình) */}
      <AnimatePresence>
        {payOrder && useTingee ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            data-ocid="driver.pay_overlay.dialog"
            onClick={closePayOverlay}
          >
            {/* Nút Hủy nhỏ ở góc trên phải, không nổi bật */}
            <button
              onClick={closePayOverlay}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 text-white/70 hover:bg-white/30 hover:text-white transition-colors"
              title="Hủy"
              aria-label="Hủy"
              data-ocid="driver.pay_overlay.cancel_button"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              {hasVA ? (
                <DynamicQRPanel
                  variant="kiosk"
                  orderId={payOrder.id}
                  onPaid={() => {
                    setPayOrderId(null);
                    if (onPaid) onPaid(payOrder.id);
                  }}
                  onCancel={closePayOverlay}
                />
              ) : (
                <div
                  className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-xl px-5 py-4 max-w-sm text-destructive"
                  data-ocid="driver.pay_overlay.missing_va.error_state"
                >
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <p className="text-sm font-medium">
                    Cần nhập VA trong BusinessProfile
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Hidden print area for thermal receipt */}
      {printOrderId && (
        <div className="kiosk-print-area">
          {(() => {
            const order = waitingOrders.find(
              (o: OrderPublic) => o.id.toString() === printOrderId,
            );
            if (!order) return null;
            const total = (order.subtotal || 0n) + (order.shippingFee || 0n);
            return (
              <div className="thermal-receipt">
                <div className="receipt-header">
                  <h1>BÚN BÒ HUẾ 65</h1>
                  <p>69 Đường Láng, Đống Đa, Hà Nội</p>
                  <p>Hotline: 0914.658.365</p>
                  <div className="receipt-divider" />
                </div>

                <div className="receipt-info">
                  <p>
                    <strong>Mã đơn:</strong> {order.orderCode || ""}
                  </p>
                  <p>
                    <strong>Ngày:</strong> {new Date().toLocaleString("vi-VN")}
                  </p>
                  <p>
                    <strong>Khách:</strong> {order.customerName || "Khách hàng"}
                  </p>
                  <p>
                    <strong>SĐT:</strong> {order.customerPhone || ""}
                  </p>
                  <p>
                    <strong>Địa chỉ:</strong>{" "}
                    {order.deliveryAddress || "Không có địa chỉ"}
                  </p>
                  <div className="receipt-divider" />
                </div>

                <div className="receipt-items">
                  <div className="receipt-item header">
                    <span className="item-name">Tên món</span>
                    <span className="item-qty">SL</span>
                    <span className="item-price">Giá</span>
                  </div>
                  {(order.items || []).map((item: any) => (
                    <div
                      className="receipt-item"
                      key={item.id || item.menuItemId || item.name}
                    >
                      <span className="item-name">
                        {item.name || item.menuItemName || "Món"}
                      </span>
                      <span className="item-qty">
                        {item.quantity?.toString() || "1"}
                      </span>
                      <span className="item-price">
                        {formatPrice(item.price || 0n)}
                      </span>
                    </div>
                  ))}
                  <div className="receipt-divider" />
                </div>

                <div className="receipt-totals">
                  <div className="total-row">
                    <span>Tiền hàng:</span>
                    <span>{formatPrice(order.subtotal || 0n)}</span>
                  </div>
                  <div className="total-row">
                    <span>Phí ship:</span>
                    <span>{formatPrice(order.shippingFee || 0n)}</span>
                  </div>
                  <div className="total-row grand">
                    <span>TỔNG THANH TOÁN:</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <div className="receipt-divider" />
                </div>

                <div className="receipt-driver">
                  <p>
                    <strong>Tài xế:</strong>{" "}
                    {order.shipperName || "Chưa có tài xế"}
                  </p>
                  <p>
                    <strong>SĐT tài xế:</strong> {order.shipperPhone || "---"}
                  </p>
                  <div className="receipt-divider" />
                </div>

                <div className="receipt-cod-note">
                  <p className="cod-highlight">
                    COD - TÀI XẾ THU KHI GIAO HÀNG
                  </p>
                  <p className="cod-total">Số tiền thu: {formatPrice(total)}</p>
                  <p className="cod-thanks">Cảm ơn quý khách!</p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Print styles for thermal receipt */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .kiosk-print-area,
          .kiosk-print-area * {
            visibility: visible !important;
          }
          .kiosk-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .thermal-receipt {
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            width: 58mm !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
          }
          .receipt-header {
            text-align: center !important;
            margin-bottom: 8px !important;
          }
          .receipt-header h1 {
            font-size: 14px !important;
            font-weight: bold !important;
            margin: 0 0 4px 0 !important;
          }
          .receipt-header p {
            font-size: 10px !important;
            margin: 2px 0 !important;
          }
          .receipt-divider {
            border-top: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
          .receipt-info {
            text-align: left !important;
          }
          .receipt-info p {
            margin: 2px 0 !important;
            font-size: 11px !important;
          }
          .receipt-items {
            text-align: left !important;
          }
          .receipt-item {
            display: flex !important;
            justify-content: space-between !important;
            margin: 2px 0 !important;
            font-size: 11px !important;
          }
          .receipt-item.header {
            font-weight: bold !important;
            border-bottom: 1px solid #000 !important;
            padding-bottom: 2px !important;
            margin-bottom: 4px !important;
          }
          .item-name {
            flex: 1 !important;
            text-align: left !important;
          }
          .item-qty {
            width: 24px !important;
            text-align: center !important;
          }
          .item-price {
            width: 70px !important;
            text-align: right !important;
          }
          .receipt-totals {
            text-align: left !important;
          }
          .total-row {
            display: flex !important;
            justify-content: space-between !important;
            margin: 2px 0 !important;
            font-size: 11px !important;
          }
          .total-row.grand {
            font-weight: bold !important;
            font-size: 12px !important;
            margin-top: 4px !important;
          }
          .receipt-driver {
            text-align: left !important;
            font-size: 11px !important;
          }
          .receipt-driver p {
            margin: 2px 0 !important;
          }
          .receipt-cod-note {
            text-align: center !important;
            margin-top: 8px !important;
          }
          .cod-highlight {
            font-weight: bold !important;
            font-size: 12px !important;
            margin: 4px 0 !important;
          }
          .cod-total {
            font-size: 12px !important;
            font-weight: bold !important;
            margin: 4px 0 !important;
          }
          .cod-thanks {
            font-size: 11px !important;
            margin-top: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
