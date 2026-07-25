// COD (Cash on Delivery) domain types
// Cash-in-Advance model: driver pays at kiosk, collects from customer on delivery

import Common "./common";
import OrderTypes "./order";

module {
  // ── Order Status Extensions for COD ──────────────────────────────────────────

  // #WaitingDriverPayment added to OrderStatus in types/order.mo
  // This status means: driver assigned, order at kiosk, waiting for driver to scan QR (Tingee)

  // ── COD Order Creation Request ───────────────────────────────────────────────

  public type CodOrderRequest = {
    restaurantId        : Common.RestaurantId;
    items               : [OrderItem];
    deliveryAddress     : Text;
    deliveryLat         : Float;
    deliveryLng         : Float;
    recipientName       : Text;
    recipientPhone      : Text;
    notes               : ?Text;
    // COD-specific: no QR needed at order time, payment deferred to driver at kiosk (Tingee)
  };

  public type OrderItem = {
    menuItemId : Common.MenuItemId;
    name       : Text;
    price      : Nat;
    quantity   : Nat;
  };

  // ── COD Order Response ───────────────────────────────────────────────────────

  public type CodOrderResponse = {
    orderId       : Common.OrderId;
    orderCode     : Text;
    status        : OrderTypes.OrderStatus; // #WaitingDriverPayment
    totalAmount   : Nat;
    message       : Text;
  };

  // ── Dispatch Center Order View ───────────────────────────────────────────────

  public type DispatchCenterOrder = {
    orderId         : Common.OrderId;
    orderCode       : Text;
    restaurantId    : Common.RestaurantId;
    restaurantName  : Text;
    items           : [OrderItem];
    totalAmount     : Nat;
    shippingFee     : ?Nat;
    deliveryAddress : Text;
    recipientName   : Text;
    recipientPhone  : Text;
    status          : OrderTypes.OrderStatus;
    createdAt       : Common.Timestamp;
    notes           : ?Text;
    isCod           : Bool;
  };

  // ── COD Payment Confirmation ─────────────────────────────────────────────────

  public type CodPaymentConfirmation = {
    orderCode       : Text;
    transactionId   : Text;
    driverPrincipal : ?Principal; // optional: track which driver paid
    paidAt          : Common.Timestamp;
  };

  // ── COD Settings (mirrors common.CodSettings for API use) ─────────────────────

  public type CodSettings = Common.CodSettings;
}
