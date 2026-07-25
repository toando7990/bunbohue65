// COD (Cash on Delivery) domain logic library
// Cash-in-Advance model: driver pays at kiosk, collects from customer on delivery
import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import CommonTypes "../types/common";
import OrderTypes "../types/order";
import CodTypes "../types/cod";
import PaymentTypes "../types/payment";
import OrderLib "./orders";
import BusinessProfileLib "./business-profile";

module {
  // ── State ──────────────────────────────────────────────────────────────────────

  public type State = {
    // Inherits orders Map from main actor — no separate storage needed
  };

  // ── Order Creation ───────────────────────────────────────────────────────────

  /// Creates a COD delivery order.
  /// - Skips Sepay QR generation
  /// - Sets status = #WaitingDriver (awaiting dispatch center to assign/book a driver)
  /// - Sets paymentStatus = #WaitingDriverPayment (driver pays at kiosk before pickup)
  /// - Validates COD is enabled and order total is within limit
  public func createCodOrder(
    orders        : Map.Map<OrderLib.OrderId, OrderLib.Order>,
    orderState    : { var nextOrderId : OrderLib.OrderId },
    bpState       : BusinessProfileLib.State,
    request       : CodTypes.CodOrderRequest,
  ) : async CodTypes.CodOrderResponse {
    let totalAmount = calculateOrderTotal(request.items);
    if (not isCodAllowed(bpState, totalAmount)) {
      return {
        orderId = 0;
        orderCode = "";
        status = #Cancelled;
        totalAmount = 0;
        message = "COD không được phép hoặc vượt quá giới hạn";
      };
    };

    let id = orderState.nextOrderId;
    orderState.nextOrderId += 1;
    let orderCode = OrderLib.generateOrderCode("", id);

    let order : OrderTypes.Order = {
      id;
      restaurantId = request.restaurantId;
      tableIdentifier = "";
      orderType = #DeliveryOrder;
      deliveryAddress = ?request.deliveryAddress;
      deliveryLat     = ?request.deliveryLat;
      deliveryLng     = ?request.deliveryLng;
      customerName = ?request.recipientName;
      customerPhone = ?request.recipientPhone;
      items = request.items.map(
        func(item : CodTypes.OrderItem) : OrderTypes.OrderItem {
          {
            menuItemId = item.menuItemId;
            name = item.name;
            price = item.price;
            quantity = item.quantity;
            itemNote = null;
            unit = null;
          }
        }
      );
      var status = #WaitingDriver;
      notes = request.notes;
      createdAt = Time.now();
      paymentInfo = {
        var paymentStatus = #WaitingDriverPayment;
        var paymentMethod = ?(#Cod : PaymentTypes.PaymentMethod);
        var stripePaymentIntentId = null;
        var paidAt = null;
      };
      var paymentConfirmedAt = null;
      var shipperName       = null;
      var shipperPhone      = null;
      var shipperOrderId    = null;
      var shippingFee       = null;
      var shippingProvider  = null;
      var shippingStatus    = null;
      var vatRequest        = false;
      var vatInfo           = null;
      var invoiceNo         = null;
      var invoiceDate       = null;
      var invoicePdfUrl     = null;
      var invoiceStatus     = #NotRequested;
      var invoiceError      = null;
      var maCQT             = null;
      var maTraCuu          = null;
      var transactionCode   = null;
      var orderCode         = ?orderCode;
      var sepayTransactionId = null;
      var sepayTransferAmount = null;
      var ahamoveOrderId    = null;
      var driverInfo        = null;
      var shippingTransferStatus = #notStarted;
      var subtotal          = ?totalAmount;
      var findingDriverSince = null;
      var dispatchNote      = null;
      var isCod             = true;
    };
    orders.add(id, order);
    {
      orderId = id;
      orderCode = orderCode;
      status = #WaitingDriver;
      totalAmount = totalAmount;
      message = "Đơn hàng COD đã được tạo — chờ tổng đài đặt tài xế";
    };
  };

  /// Validates whether COD is allowed for the given order total.
  /// Returns true if COD is enabled and total <= codLimit.
  public func isCodAllowed(
    bpState     : BusinessProfileLib.State,
    foodTotal  : Nat,
  ) : Bool {
    switch (BusinessProfileLib.getCodSettings(bpState)) {
      case null false;
      case (?settings) {
        settings.isCodAllowed and foodTotal <= settings.codLimit;
      };
    };
  };

  /// Calculates the order total from items.
  public func calculateOrderTotal(items : [CodTypes.OrderItem]) : Nat {
    var total : Nat = 0;
    for (item in items.vals()) {
      total += item.price * item.quantity;
    };
    total;
  };

  // ── Dispatch Center Queries ────────────────────────────────────────────────────

  /// Returns all orders in #WaitingDriverPayment status (both COD and non-COD).
  /// Used by dispatch center staff to assign drivers.
  public func getDispatchCenterOrders(
    orders : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  ) : [CodTypes.DispatchCenterOrder] {
    orders.values()
      .filter(func(o : OrderTypes.Order) : Bool {
        o.status == #WaitingDriver or o.status == #WaitingDriverPayment;
      })
      .map(
        func(o : OrderTypes.Order) : CodTypes.DispatchCenterOrder {
          var totalAmount : Nat = 0;
          for (item in o.items.vals()) {
            totalAmount += item.price * item.quantity;
          };
          {
            orderId = o.id;
            orderCode = switch (o.orderCode) { case (?c) c; case null ""; };
            restaurantId = o.restaurantId;
            restaurantName = "";
            items = o.items.map(
              func(item : OrderTypes.OrderItem) : CodTypes.OrderItem {
                {
                  menuItemId = item.menuItemId;
                  name = item.name;
                  price = item.price;
                  quantity = item.quantity;
                }
              }
            );
            totalAmount = totalAmount;
            shippingFee = o.shippingFee;
            deliveryAddress = switch (o.deliveryAddress) { case (?a) a; case null ""; };
            recipientName = switch (o.customerName) { case (?n) n; case null ""; };
            recipientPhone = switch (o.customerPhone) { case (?p) p; case null ""; };
            status = o.status;
            createdAt = o.createdAt;
            notes = o.notes;
            isCod = o.isCod;
          };
        }
      )
      .toArray();
  };

  /// Returns only COD orders in #WaitingDriverPayment status.
  public func getCodDispatchOrders(
    orders : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  ) : [CodTypes.DispatchCenterOrder] {
    orders.values()
      .filter(func(o : OrderTypes.Order) : Bool {
        o.isCod and (o.status == #WaitingDriver or o.status == #WaitingDriverPayment);
      })
      .map(
        func(o : OrderTypes.Order) : CodTypes.DispatchCenterOrder {
          var totalAmount : Nat = 0;
          for (item in o.items.vals()) {
            totalAmount += item.price * item.quantity;
          };
          {
            orderId = o.id;
            orderCode = switch (o.orderCode) { case (?c) c; case null ""; };
            restaurantId = o.restaurantId;
            restaurantName = "";
            items = o.items.map(
              func(item : OrderTypes.OrderItem) : CodTypes.OrderItem {
                {
                  menuItemId = item.menuItemId;
                  name = item.name;
                  price = item.price;
                  quantity = item.quantity;
                }
              }
            );
            totalAmount = totalAmount;
            shippingFee = o.shippingFee;
            deliveryAddress = switch (o.deliveryAddress) { case (?a) a; case null ""; };
            recipientName = switch (o.customerName) { case (?n) n; case null ""; };
            recipientPhone = switch (o.customerPhone) { case (?p) p; case null ""; };
            status = o.status;
            createdAt = o.createdAt;
            notes = o.notes;
            isCod = o.isCod;
          };
        }
      )
      .toArray();
  };

  // ── Driver Payment Transition ──────────────────────────────────────────────────

  /// Transitions a COD order from #WaitingDriverPayment to #Preparing.
  /// Called by Tingee webhook when driver scans QR and pays at kiosk.
  /// Also triggers AhaMove booking (driver is physically present).
  public func confirmDriverPayment(
    order           : OrderLib.Order,
    confirmation    : CodTypes.CodPaymentConfirmation,
  ) : () {
    if (order.status == #WaitingDriverPayment) {
      order.status := #Preparing;
      order.paymentInfo.paymentStatus := #Paid;
      order.paymentInfo.paidAt := ?confirmation.paidAt;
      order.paymentConfirmedAt := ?confirmation.paidAt;
    };
  };

  /// Assigns a driver to a COD order and transitions to #WaitingDriverPayment.
  /// Called by dispatch center when driver accepts the delivery.
  /// Assigns a driver to a COD order and transitions to #WaitingDriverPayment.
  /// Called by dispatch center when driver accepts the delivery.
  public func assignDriverToCodOrder(
    order           : OrderLib.Order,
    _driverPrincipal : Principal,
  ) : () {
    if (order.status == #WaitingDriver) {
      order.status := #WaitingDriverPayment;
    };
  };

  // ── Book Driver for COD ──────────────────────────────────────────────────────

  /// Books an AhaMove driver for a COD order.
  /// Accepts orders only in #WaitingDriver status.
  /// After booking, order transitions to #WaitingDriverPayment — driver pays at kiosk before pickup.
  /// Called by dispatch center staff when they want to book a driver.
  public func bookDriverForCodOrder(
    order           : OrderLib.Order,
    bookShipper     : (Text) -> async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text },
  ) : async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text } {
    if (order.status != #WaitingDriver) {
      return #err("Order is not in WaitingDriver status");
    };
    let result = await bookShipper((order.id).toText());
    switch (result) {
      case (#ok(data)) {
        order.ahamoveOrderId := ?data.ahamoveOrderId;
        order.shippingFee := ?data.fare;
        order.status := #WaitingDriverPayment;
        #ok(data);
      };
      case (#err(msg)) { #err(msg) };
    };
  };

  // ── Confirm AhaMove Booking (frontend-obtained result) ──────────────────────────

  /// Persists an AhaMove booking result that the frontend already obtained from the VPS proxy.
  /// Does NOT call AhaMove or any HTTP outcall — only persists the result.
  /// Guards order.status == #WaitingDriver ONLY (same guard as bookDriverForCodOrder).
  /// On success transitions order.status := #WaitingDriverPayment.
  public func confirmAhamoveBooking(
    order           : OrderLib.Order,
    ahamoveOrderId  : Text,
    fare            : Nat,
    status          : Text,
  ) : { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text } {
    if (order.status != #WaitingDriver) {
      return #err("Order is not in WaitingDriver status");
    };
    order.ahamoveOrderId := ?ahamoveOrderId;
    order.shippingFee := ?fare;
    order.shippingStatus := ?#SearchingShipper;
    order.shippingTransferStatus := #notRequired;
    order.shippingProvider := ?"ahamove";
    order.status := #WaitingDriverPayment;
    #ok({ ahamoveOrderId; status; fare });
  };

  // ── Verify Order For Booking (VPS worker pre-check) ─────────────────────────────

  /// Read-only verification used by the VPS worker before calling AhaMove.
  /// Returns { valid; status; restaurantId } where valid is true only if the order
  /// exists AND order.status == #WaitingDriver.
  public func verifyOrderForBooking(
    orders  : Map.Map<OrderLib.OrderId, OrderLib.Order>,
    orderId : OrderLib.OrderId,
  ) : { valid : Bool; status : Text; restaurantId : ?Text } {
    switch (orders.get(orderId)) {
      case null { { valid = false; status = "not_found"; restaurantId = null } };
      case (?order) {
        let valid = order.status == #WaitingDriver;
        {
          valid;
          status = statusToText(order.status);
          restaurantId = ?(order.restaurantId).toText();
        };
      };
    };
  };

  private func statusToText(s : OrderTypes.OrderStatus) : Text {
    switch (s) {
      case (#WaitingDriver) "WaitingDriver";
      case (#WaitingDriverPayment) "WaitingDriverPayment";
      case (#Preparing) "Preparing";
      case (#Ready) "Ready";
      case (#Delivering) "Delivering";
      case (#Completed) "Completed";
      case (#Cancelled) "Cancelled";
      case (_) "Other";
    };
  };

  // ── COD Settings ───────────────────────────────────────────────────────────────

  /// Returns current COD settings from business profile.
  public func getCodSettings(bpState : BusinessProfileLib.State) : ?CodTypes.CodSettings {
    BusinessProfileLib.getCodSettings(bpState);
  };

  /// Updates COD settings. Owner-only.
  public func setCodSettings(
    bpState    : BusinessProfileLib.State,
    settings   : CodTypes.CodSettings,
  ) : () {
    BusinessProfileLib.setCodSettings(bpState, ?settings);
  };
}
