// OrderManager — domain logic for order management
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import CommonTypes "../types/common";
import OrderTypes "../types/order";
import PaymentTypes "../types/payment";
import ShipperTypes "../types/shipper";
import RestaurantTypes "../types/restaurant";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Runtime "mo:core/Runtime";
import Debug "mo:core/Debug";

module {
  // Generate a short QR payment code: "DH" + 6 random hex bytes (14 chars total)
  // Returns true if the given nanosecond timestamp falls within today in UTC+7 (Vietnam timezone).
  // Both ts (order timestamp) and Time.now() are in UTC.
  // We convert both to UTC+7 before comparing.
  // UTC+7 offset = 7 * 3600 * 1_000_000_000 nanoseconds.
  public func isToday(ts : Int) : Bool {
    let offsetNs : Int = 7 * 3600 * 1_000_000_000;
    let dayNs    : Int = 86_400_000_000_000;
    let nowUtc7  : Int = Time.now() + offsetNs;
    let tsUtc7   : Int = ts + offsetNs;
    let startOfDayUtc7 : Int = (nowUtc7 / dayNs) * dayNs;
    tsUtc7 >= startOfDayUtc7 and tsUtc7 < startOfDayUtc7 + dayNs;
  };

  // Check if a timestamp falls within a specific date string "YYYY-MM-DD" in UTC+7
  public func isDateInDay(ts : Int, dateStr : Text) : Bool {
    if (dateStr.size() != 10) return false;
    let offsetNs : Int = 7 * 3600 * 1_000_000_000;
    let dayNs    : Int = 86_400_000_000_000;
    // Parse YYYY-MM-DD to year, month, day
    let year = parseInt(substring(dateStr, 0, 4));
    let month = parseInt(substring(dateStr, 5, 2));
    let day = parseInt(substring(dateStr, 8, 2));
    if (year == 0 or month == 0 or day == 0) return false;
    // Calculate start of that day in UTC+7
    let daysSince1970 = daysFromCivil(year, month, day);
    // daysSince1970 * dayNs is 00:00 UTC of that date = 07:00 UTC+7.
    // To get 00:00 UTC+7 (start of calendar day in Vietnam), subtract the offset.
    let startOfDayUtc7 : Int = daysSince1970 * dayNs - offsetNs;
    let tsUtc7 : Int = ts + offsetNs;
    tsUtc7 >= startOfDayUtc7 and tsUtc7 < startOfDayUtc7 + dayNs;
  };

  func substring(t : Text, start : Nat, len : Nat) : Text {
    var result = "";
    var _i = start;
    let end = start + len;
    let chars = t.chars();
    var pos = 0;
    while (pos < end) {
      switch (chars.next()) {
        case (?c) {
          if (pos >= _i) { result #= Text.fromChar(c) };
          pos += 1;
        };
        case null { return result };
      };
    };
    result;
  };

  func parseInt(t : Text) : Int {
    switch (Int.fromText(t)) { case (?n) n; case null 0; };
  };

  // Calculate days from 1970-01-01 to given date (good for 1970-2099)
  func daysFromCivil(y : Int, m : Int, d : Int) : Int {
    var year = y;
    var month = m;
    if (month <= 2) { year -= 1; month += 12; };
    let era = year / 400;
    let yoe = year - era * 400;
    let doy = (153 * (month + (if (month > 2) -3 else 9)) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468;
  };

  // Original isToday function - kept for backward compatibility
  // FIXED: convert ts to UTC+7 before comparing
  public func isTodayOriginal(ts : Int) : Bool {
    let offsetNs : Int = 7 * 3600 * 1_000_000_000;
    let dayNs    : Int = 86_400_000_000_000;
    let nowUtc7  : Int = Time.now() + offsetNs;
    let tsUtc7   : Int = ts + offsetNs;
    let startOfDayUtc7 : Int = (nowUtc7 / dayNs) * dayNs;
    tsUtc7 >= startOfDayUtc7 and tsUtc7 < startOfDayUtc7 + dayNs;
  };

  /// Generate an order code.
  /// If prefix is non-empty: "<PREFIX>" + zero-padded 6-digit orderId, e.g. "BBH000001".
  /// If prefix is empty: "DH" + 12 hex chars derived from timestamp (legacy behavior).
  public func generateOrderCode(prefix : Text, orderId : Nat) : Text {
    if (prefix.size() > 0) {
      // Prefix mode: pad orderId to 6 digits
      var n = orderId;
      var digits = "";
      var i = 0;
      while (i < 6) {
        digits := Text.fromChar(Char.fromNat32(Nat32.fromNat(48 + n % 10))) # digits;
        n := n / 10;
        i += 1;
      };
      prefix # digits
    } else {
      // Legacy timestamp-based code
      let hex = "0123456789abcdef";
      let hexChars = hex.toArray();
      let ts : Int = Time.now();
      var n : Nat = if (ts < 0) 0 else ts.toNat();
      var result = "DH";
      var j = 0;
      while (j < 12) {
        let nibble = n % 16;
        result := result # Text.fromChar(hexChars[nibble]);
        n := n / 16 + (if (j % 3 == 0) 0xabcdef else 0x123456);
        j += 1;
      };
      result
    };
  };


  public type OrderId = CommonTypes.OrderId;
  public type RestaurantId = CommonTypes.RestaurantId;
  public type OrderItem = OrderTypes.OrderItem;
  public type OrderStatus = OrderTypes.OrderStatus;
  public type Order = OrderTypes.Order;
  public type OrderTrackingPublic = OrderTypes.OrderTrackingPublic;

  /// Build the public tracking view from an internal Order.
  /// Only includes fields needed for the customer-facing tracking progress bar:
  /// order status, shipper info, driver location, invoice info, and payment status.
  /// Sensitive fields (customerPhone, customerName, deliveryAddress) are NOT included.
  public func toTrackingPublic(o : Order) : OrderTrackingPublic {
    {
      orderId            = o.id;
      status             = o.status;
      orderType          = o.orderType;
      deliveryLat        = o.deliveryLat;
      deliveryLng        = o.deliveryLng;
      shipperName        = o.shipperName;
      shipperPhone       = o.shipperPhone;
      shippingFee        = o.shippingFee;
      shippingProvider   = o.shippingProvider;
      shippingStatus     = o.shippingStatus;
      ahamoveOrderId     = o.ahamoveOrderId;
      driverInfo         = o.driverInfo;
      invoiceStatus      = o.invoiceStatus;
      invoiceNo          = o.invoiceNo;
      invoiceDate        = o.invoiceDate;
      invoicePdfUrl      = o.invoicePdfUrl;
      maCQT              = o.maCQT;
      maTraCuu           = o.maTraCuu;
      paymentStatus      = o.paymentInfo.paymentStatus;
      paymentConfirmedAt = o.paymentConfirmedAt;
      findingDriverSince = o.findingDriverSince;
      dispatchNote       = o.dispatchNote;
    };
  };

  // Immutable snapshot for public API (Order has var fields — not shareable directly)
  public type OrderPublic = {
    id : OrderId;
    isCod : Bool;
    restaurantId : RestaurantId;
    tableIdentifier : Text;
    orderType : OrderTypes.OrderType;
    deliveryAddress : ?Text;
    customerName : ?Text;
    customerPhone : ?Text;
    items : [OrderItem];
    status : OrderStatus;
    notes : ?Text;
    createdAt : CommonTypes.Timestamp;
    paymentStatus : PaymentTypes.PaymentStatus;
    paymentMethod : ?PaymentTypes.PaymentMethod;
    stripePaymentIntentId : ?Text;
    paidAt : ?CommonTypes.Timestamp;
    paymentConfirmedAt : ?CommonTypes.Timestamp;
    // Shipper info (shown to customers on tracking page and to delivery staff)
    shipperName      : ?Text;
    shipperPhone     : ?Text;
    shippingFee      : ?Nat;
    shippingProvider : ?Text;
    shippingStatus   : ?ShipperTypes.ShippingStatus;
    // AhaMove integration fields (needed by COD dispatch center)
    ahamoveOrderId          : ?Text;
    driverInfo              : ?ShipperTypes.DriverInfo;
    shippingTransferStatus  : ShipperTypes.ShippingTransferStatus;
    // VAT / e-invoice info
    vatInfo       : ?OrderTypes.VatInfo;
    invoiceNo     : ?Text;
    invoiceDate   : ?Text;
    invoicePdfUrl : ?Text;
    invoiceStatus : OrderTypes.InvoiceStatus;
    maCQT         : ?Text;
    maTraCuu      : ?Text;
    // Derived payment method label for invoice rendering
    paymentMethodLabel : Text;
    // Sepay QR payment code (prefix + 6-digit orderId, e.g. "BBH000001")
    orderCode : ?Text;
    // Subtotal: food-only price (excluding shipping fee)
    subtotal  : ?Nat;
    // FindingDriver timeout tracking
    findingDriverSince : ?Int;
    dispatchNote       : ?Text;
  };

  // Derive a Vietnamese payment method label for invoice display
  func derivePaymentLabel(o : Order) : Text {
    switch (o.paymentInfo.paymentMethod) {
      case (?#BankTransfer)     "Chuyển khoản";
      case (?#CashierTerminal)  "Tiền mặt";
      case _                    "Tiền mặt/Chuyển khoản";
    };
  };

  public func toPublic(o : Order) : OrderPublic = {
    id = o.id;
    restaurantId = o.restaurantId;
    tableIdentifier = o.tableIdentifier;
    orderType = o.orderType;
    deliveryAddress = o.deliveryAddress;
    customerName = o.customerName;
    customerPhone = o.customerPhone;
    items = o.items;
    status = o.status;
    notes = o.notes;
    createdAt = o.createdAt;
    paymentStatus = o.paymentInfo.paymentStatus;
    paymentMethod = o.paymentInfo.paymentMethod;
    stripePaymentIntentId = o.paymentInfo.stripePaymentIntentId;
    paidAt = o.paymentInfo.paidAt;
    paymentConfirmedAt = o.paymentConfirmedAt;
    shipperName      = o.shipperName;
    shipperPhone     = o.shipperPhone;
    shippingFee      = o.shippingFee;
    shippingProvider = o.shippingProvider;
    shippingStatus   = o.shippingStatus;
    ahamoveOrderId         = o.ahamoveOrderId;
    driverInfo             = o.driverInfo;
    shippingTransferStatus = o.shippingTransferStatus;
    vatInfo       = o.vatInfo;
    invoiceNo     = o.invoiceNo;
    invoiceDate   = o.invoiceDate;
    invoicePdfUrl = o.invoicePdfUrl;
    invoiceStatus = o.invoiceStatus;
    maCQT         = o.maCQT;
    maTraCuu      = o.maTraCuu;
    paymentMethodLabel = derivePaymentLabel(o);
    orderCode          = o.orderCode;
    subtotal           = o.subtotal;
    findingDriverSince = o.findingDriverSince;
    dispatchNote       = o.dispatchNote;
    isCod              = o.isCod;
  };

  public class OrderManager(
    orders : Map.Map<OrderId, Order>,
    state : { var nextOrderId : OrderId },
    defaultPrefix : Text,
    tingeePrefix : Text,
  ) {

    // Select the order-code prefix by payment method. For Tingee QR orders use
    // tingeePrefix; for everything else (COD, Stripe, etc.) use defaultPrefix.
    func prefixFor(method : ?PaymentTypes.PaymentMethod) : Text {
      switch (method) {
        case (?#TingeeQR) tingeePrefix;
        case _ defaultPrefix;
      };
    };

    public func placeOrder(
      restaurantId : RestaurantId,
      tableIdentifier : Text,
      items : [OrderItem],
      notes : ?Text,
      vatRequest : Bool,
      vatInfo : ?OrderTypes.VatInfo,
      // vatInfo.accountNo — buyer bank account number from Tax Authority API
    ) : async { orderId : OrderId } {
      let id = state.nextOrderId;
      state.nextOrderId += 1;
      // Table orders start with no payment method chosen yet — use defaultPrefix
      // (the default QR path). The code is regenerated/selected later if needed.
      let order : Order = {
        id;
        restaurantId;
        tableIdentifier;
        orderType = #TableOrder;
        deliveryAddress = null;
        deliveryLat     = null;
        deliveryLng     = null;
        customerName = null;
        customerPhone = null;
        items;
        var status = #PaymentPending;
        notes;
        createdAt = Time.now();
        paymentInfo = {
          var paymentStatus = #Unpaid;
          var paymentMethod = null;
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
        var vatRequest        = vatRequest;
        var vatInfo           = vatInfo;
        var invoiceNo         = null : ?Text;
        var invoiceDate       = null : ?Text;
        var invoicePdfUrl     = null : ?Text;
        var invoiceStatus     = #NotRequested : OrderTypes.InvoiceStatus;
        var invoiceError      = null : ?Text;
        var maCQT             = null : ?Text;
        var maTraCuu          = null : ?Text;
        var transactionCode   = null : ?Text;
        var orderCode         = ?generateOrderCode(defaultPrefix, id);
        var sepayTransactionId = null : ?Text;
        var sepayTransferAmount = null : ?Nat;
        var ahamoveOrderId    = null : ?Text;
        var driverInfo        = null : ?ShipperTypes.DriverInfo;
        var shippingTransferStatus = #notStarted : ShipperTypes.ShippingTransferStatus;
        var subtotal          = null : ?Nat;
        var findingDriverSince = null : ?Int;
        var dispatchNote      = null : ?Text;
        var isCod             = false;
      };
      orders.add(id, order);
      { orderId = id };
    };

    public func placeDeliveryOrder(
      restaurantId    : RestaurantId,
      items           : [OrderItem],
      notes           : ?Text,
      deliveryAddress : Text,
      customerName    : Text,
      customerPhone   : Text,
      vatRequest      : Bool,
      vatInfo         : ?OrderTypes.VatInfo,
      shippingFee     : ?Nat,
      deliveryLat     : ?Float,
      deliveryLng     : ?Float,
      isCod           : Bool,
      // vatInfo.accountNo — buyer bank account number from Tax Authority API
    ) : async { orderId : OrderId } {
      // Validate VAT: if vatRequest is true, taxCode must be present and non-empty
      if (vatRequest) {
        let validTaxCode = switch (vatInfo) {
          case null false;
          case (?info) {
            switch (info.taxCode) {
              case null false;
              case (?code) code.size() > 0;
            };
          };
        };
        if (not validTaxCode) {
          Runtime.trap("Mã số thuế là bắt buộc khi yêu cầu hoá đơn VAT");
        };
      };
      let id = state.nextOrderId;
      state.nextOrderId += 1;
      // Calculate total amount from items
      var totalAmountNat : Nat = 0;
      for (item in items.vals()) {
        totalAmountNat += item.price * item.quantity;
      };
      // subtotal = food-only price (total minus shipping fee)
      let subtotal : ?Nat = switch (shippingFee) {
        case (?fee) if (totalAmountNat < fee) ?totalAmountNat else ?(totalAmountNat - fee);
        case null   ?totalAmountNat;
      };
      // For COD orders: payment status is #WaitingDriverPayment (driver pays at kiosk)
      // For regular orders: payment status starts as #Unpaid (customer pays via QR)
      let initPaymentStatus : PaymentTypes.PaymentStatus = if isCod #WaitingDriverPayment else #Unpaid;
      // Initial payment method: COD orders use #Cod; regular orders have no method yet
      // (the customer picks Tingee later via createPaymentIntent). For order-code
      // prefix selection we use the initial method here — COD → defaultPrefix (kiosk QR),
      // null → defaultPrefix (default). Tingee codes are NOT generated at placement time
      // because the method is chosen later via createPaymentIntent.
      let initMethod : ?PaymentTypes.PaymentMethod = if isCod ?(#Cod : PaymentTypes.PaymentMethod) else null;
      let order : Order = {
        id;
        restaurantId;
        tableIdentifier = "";
        orderType = #DeliveryOrder;
        deliveryAddress = ?deliveryAddress;
        deliveryLat     = deliveryLat;
        deliveryLng     = deliveryLng;
        customerName = ?customerName;
        customerPhone = ?customerPhone;
        items;
        var status = if isCod #WaitingDriver else #PaymentPending;
        notes;
        createdAt = Time.now();
        paymentInfo = {
          var paymentStatus = initPaymentStatus;
          var paymentMethod = initMethod;
          var stripePaymentIntentId = null;
          var paidAt = null;
        };
        var paymentConfirmedAt = null;
        var shipperName       = null;
        var shipperPhone      = null;
        var shipperOrderId    = null;
        var shippingFee       = shippingFee;
        var shippingProvider  = null;
        var shippingStatus    = null;
        var vatRequest        = vatRequest;
        var vatInfo           = vatInfo;
        var invoiceNo         = null : ?Text;
        var invoiceDate       = null : ?Text;
        var invoicePdfUrl     = null : ?Text;
        var invoiceStatus     = #NotRequested : OrderTypes.InvoiceStatus;
        var invoiceError      = null : ?Text;
        var maCQT             = null : ?Text;
        var maTraCuu          = null : ?Text;
        var transactionCode   = null : ?Text;
        var orderCode         = ?generateOrderCode(prefixFor(initMethod), id);
        var sepayTransactionId = null : ?Text;
        var sepayTransferAmount = null : ?Nat;
        var ahamoveOrderId    = null : ?Text;
        var driverInfo        = null : ?ShipperTypes.DriverInfo;
        var shippingTransferStatus = #notStarted : ShipperTypes.ShippingTransferStatus;
        var subtotal          = subtotal;
        var findingDriverSince = null : ?Int;
        var dispatchNote      = null : ?Text;
        var isCod             = isCod;
      };
      orders.add(id, order);
      { orderId = id };
    };

    /// Return the tracking view for an order. Public — any caller may track an
    /// order by its orderId. Returns null if the order does not exist.
    public func getOrderForTracking(orderId : OrderId) : ?OrderTrackingPublic {
      switch (orders.get(orderId)) {
        case null null;
        case (?order) ?toTrackingPublic(order);
      };
    };

    // List delivery orders for store delivery tab.
    public func listDeliveryOrders(restaurantId : RestaurantId, dateFilter : ?Text) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          if (o.restaurantId != restaurantId or o.orderType != #DeliveryOrder) return false;
          o.status != #PaymentPending;
        })
        .filter(func(o : Order) : Bool {
          switch (dateFilter) {
            case null true;
            case (?df) isDateInDay(o.createdAt, df);
          };
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func listDeliveryOrdersForKitchen(restaurantId : RestaurantId, dateFilter : ?Text) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId and
          o.orderType == #DeliveryOrder and
          o.status != #PaymentPending
        })
        .filter(func(o : Order) : Bool {
          switch (dateFilter) {
            case null isToday(o.createdAt);
            case (?df) isDateInDay(o.createdAt, df);
          };
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func updateOrderStatus(id : OrderId, newStatus : OrderStatus) : Bool {
      switch (orders.get(id)) {
        case (?order) {
          order.status := newStatus;
          true;
        };
        case null false;
      };
    };

    public func getOrder(id : OrderId) : ?OrderPublic {
      switch (orders.get(id)) {
        case (?o) ?toPublic(o);
        case null null;
      };
    };

    // Exclude payment-pending orders from kitchen listing.
    // COD orders become visible once the driver has paid (paymentStatus = #Paid).
    func isVisibleToKitchen(o : Order) : Bool {
      (o.paymentInfo.paymentStatus == #Paid or o.paymentInfo.paymentStatus == #TingeePaid) and
      // PendingApproval removed — no approval needed
      o.status != #PaymentPending;
    };

    public func listOrdersByRestaurant(restaurantId : RestaurantId) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId and isVisibleToKitchen(o)
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    // List ALL orders for a restaurant regardless of payment status — for accounting use.
    // Includes #PaymentPending so accounting can do trial invoice publishing on unpaid orders.
    public func listAllOrdersForAccounting(restaurantId : RestaurantId) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func listActiveOrdersByRestaurant(restaurantId : RestaurantId, dateFilter : ?Text) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId and
          isVisibleToKitchen(o) and
          (switch (o.status) {
            case (#Preparing or #Ready) true;
            case _ false;
          })
        })
        .filter(func(o : Order) : Bool {
          switch (dateFilter) {
            case null isToday(o.createdAt);
            case (?df) isDateInDay(o.createdAt, df);
          };
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func listOrdersByTable(restaurantId : RestaurantId, tableIdentifier : Text) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId and o.tableIdentifier == tableIdentifier
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func listOrdersByStatus(restaurantId : RestaurantId, status : OrderStatus) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          o.restaurantId == restaurantId and o.status == status
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    public func settleTable(restaurantId : RestaurantId, tableIdentifier : Text) : Nat {
      var count = 0;
      let toRemove = orders.entries()
        .filter(func((_, o) : (OrderId, Order)) : Bool {
          o.restaurantId == restaurantId and
          o.tableIdentifier == tableIdentifier and
          o.status == #Completed
        })
        .map(func((id, _)) { id })
        .toArray();
      for (id in toRemove.values()) {
        orders.remove(id);
        count += 1;
      };
      count;
    };

    public func clearCompletedOrders(restaurantId : RestaurantId) : Nat {
      var count = 0;
      let toRemove = orders.entries()
        .filter(func((_, o) : (OrderId, Order)) : Bool {
          o.restaurantId == restaurantId and o.status == #Completed
        })
        .map(func((id, _)) { id })
        .toArray();
      for (id in toRemove.values()) {
        orders.remove(id);
        count += 1;
      };
      count;
    };

    public func createPaymentIntent(orderId : OrderId, method : PaymentTypes.PaymentMethod) : { #ok : { orderId : OrderId; totalAmount : Nat; currency : Text }; #err : { #NotFound } } {
      switch (orders.get(orderId)) {
        case (?order) {
          // Compute total from order items (VND — no decimal conversion)
          var total : Nat = 0;
          for (item in order.items.values()) {
            total += item.price * item.quantity;
          };
          // For Tingee QR: set #TingeePending so expireTingeeOrder and
          // getPendingTingeeCodes can track the QR lifecycle. Other methods
          // use the generic #Pending state.
          order.paymentInfo.paymentStatus := switch (method) {
            case (#TingeeQR) #TingeePending;
            case _ #Pending;
          };
          order.paymentInfo.paymentMethod := ?method;
          // Regenerate the order code with the prefix matching the chosen payment
          // method. Tingee orders use tingeePrefix; all others keep defaultPrefix.
          // This rewrites the code that was generated at placement time (which
          // used defaultPrefix as the default).
          order.orderCode := ?generateOrderCode(prefixFor(?method), order.id);
          #ok({ orderId; totalAmount = total; currency = "vnd" });
        };
        case null #err(#NotFound);
      };
    };

    public func confirmPayment(orderId : OrderId, paymentIntentId : Text) : { #ok : Bool; #err : { #NotFound } } {
      switch (orders.get(orderId)) {
        case (?order) {
          order.paymentInfo.paymentStatus := #Paid;
          order.paymentInfo.stripePaymentIntentId := ?paymentIntentId;
          order.paymentInfo.paidAt := ?Time.now();
          #ok(true);
        };
        case null #err(#NotFound);
      };
    };

    // Cashier confirms payment received (bank transfer or other manual confirmation)
    public func confirmPaymentByCashier(orderId : OrderId, restaurantId : RestaurantId) : { #ok : Bool; #err : { #NotFound; #WrongRestaurant } } {
      switch (orders.get(orderId)) {
        case null #err(#NotFound);
        case (?order) {
          if (order.restaurantId != restaurantId) return #err(#WrongRestaurant);
          order.paymentInfo.paymentStatus := #Paid;
          if (order.paymentInfo.paidAt == null) {
            order.paymentInfo.paidAt := ?Time.now();
          };
          order.paymentConfirmedAt := ?Time.now();
          #ok(true);
        };
      };
    };

    // Tingee auto-confirms bank transfer payment — stores transactionCode for audit trail
    // Sets paymentStatus to #TingeePaid
    //
    // totalAmountPaid (optional): when provided (e.g. from get-status fallback path),
    // validates that the paid amount >= order total (calcOrderTotal). If the paid
    // amount is less than the order total, the confirmation is REJECTED — the
    // order stays in its current payment status (#TingeePending) to prevent
    // partial / wrong-denomination confirmation. Returns #err(#AmountMismatch).
    // When null (webhook path), no amount validation is performed here — the
    // webhook handler validates amount before calling this function.
    public func confirmPaymentByTingee(orderId : OrderId, transactionCode : ?Text, totalAmountPaid : ?Nat) : { #ok : Bool; #err : { #NotFound; #AmountMismatch } } {
      switch (orders.get(orderId)) {
        case null #err(#NotFound);
        case (?order) {
          // Amount validation (only when totalAmountPaid is provided — get-status fallback path)
          switch (totalAmountPaid) {
            case null {};
            case (?paid) {
              var orderTotal : Nat = 0;
              for (item in order.items.vals()) {
                orderTotal += item.price * item.quantity;
              };
              if (paid < orderTotal) {
                Debug.print("[confirmPaymentByTingee] AMOUNT MISMATCH orderId=" # debug_show(orderId) # " expected=" # debug_show(orderTotal) # " paid=" # debug_show(paid));
                return #err(#AmountMismatch);
              };
            };
          };
          order.paymentInfo.paymentStatus := #TingeePaid;
          if (order.paymentInfo.paymentMethod == null) {
            order.paymentInfo.paymentMethod := ?(#TingeeQR);
          };
          if (order.paymentInfo.paidAt == null) {
            order.paymentInfo.paidAt := ?Time.now();
          };
          order.paymentConfirmedAt := ?Time.now();
          order.transactionCode := transactionCode;
          // Activate order: PaymentPending → Pending (delivery) or Preparing (dine-in)
          if (order.status == #PaymentPending) {
            order.status := switch (order.orderType) {
              case (#DeliveryOrder) #Pending;
              case (#TableOrder) #Preparing;
            };
          };
          #ok(true);
        };
      };
    };

    // Mark a Tingee QR as expired — transitions #TingeePending → #TingeeExpired
    // when get-status reports the QR has expired and the order has NOT been paid.
    // Idempotent: no-op if the order is not in #TingeePending (already paid, already
    // expired, or never had a Tingee QR). Returns true if the transition was applied.
    // Does NOT cancel the order — the frontend is responsible for triggering a
    // regenerate flow (new createPaymentIntent call) after observing #TingeeExpired.
    public func markTingeeExpired(orderId : OrderId) : { #ok : Bool; #err : { #NotFound } } {
      switch (orders.get(orderId)) {
        case null #err(#NotFound);
        case (?order) {
          if (order.paymentInfo.paymentStatus == #TingeePending) {
            order.paymentInfo.paymentStatus := #TingeeExpired;
            #ok(true);
          } else {
            // Not in #TingeePending — already paid, already expired, or wrong method.
            // Idempotent no-op.
            #ok(false);
          };
        };
      };
    };

    // List delivery orders for the enterprise delivery center.
    // Only returns WaitingDriverPayment orders (COD orders awaiting driver payment at kiosk).
    public func listDeliveryOrdersEnterpriseCentral(
      allowedRestaurantIds   : ?[Nat],
      dateFilter             : ?Text,
    ) : [OrderPublic] {
      orders.values()
        .filter(func(o : Order) : Bool {
          if (o.orderType != #DeliveryOrder) return false;
                o.status == #WaitingDriver or o.status == #WaitingDriverPayment;
        })
        .filter(func(o : Order) : Bool {
          switch (allowedRestaurantIds) {
            case null true;
            case (?ids) {
              if (ids.size() == 0) return true;
              ids.values().find(func(rid : Nat) : Bool { rid == o.restaurantId }) != null;
            };
          };
        })
        .filter(func(o : Order) : Bool {
          switch (dateFilter) {
            case null isToday(o.createdAt);
            case (?df) isDateInDay(o.createdAt, df);
          };
        })
        .map(func(o) { toPublic(o) })
        .toArray();
    };

    // Query payment + cashier-confirmation status for customer-side polling
    public func getOrderPaymentStatus(orderId : OrderId) : ?{ paymentStatus : PaymentTypes.PaymentStatus; paymentConfirmedAt : ?CommonTypes.Timestamp } {
      switch (orders.get(orderId)) {
        case null null;
        case (?order) ?{
          paymentStatus = order.paymentInfo.paymentStatus;
          paymentConfirmedAt = order.paymentConfirmedAt;
        };
      };
    };

    public func getPaymentStatus(orderId : OrderId) : ?PaymentTypes.PaymentStatus {
      switch (orders.get(orderId)) {
        case (?order) ?order.paymentInfo.paymentStatus;
        case null null;
      };
    };

    // Cancel an order — only allowed when the order is still in PaymentPending state.
    // Authorization (staff auth) is enforced at the mixin layer; lib just mutates state.
    public func cancelOrder(orderId : OrderId) : { #ok; #err : { #NotFound; #WrongStatus } } {
      switch (orders.get(orderId)) {
        case null #err(#NotFound);
        case (?order) {
          if (order.status != #PaymentPending) return #err(#WrongStatus);
          order.status := #Cancelled;
          #ok;
        };
      };
    };

    // Internal getter — returns the raw mutable Order for webhook validation (amount check, status check)
    // Not exposed publicly; only used inside the mixins layer
    // Lookup order by orderCode (for webhook matching)
    public func getOrderByOrderCode(code : Text) : ?Order {
      orders.values().find(func(o : Order) : Bool {
        switch (o.orderCode) {
          case (?c) c == code;
          case null false;
        };
      });
    };

        public func getOrderInternal(id : OrderId) : ?Order {
      orders.get(id);
    };
  };
};
