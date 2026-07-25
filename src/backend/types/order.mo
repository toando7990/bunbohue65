// Order domain types
import CommonTypes "common";
import PaymentTypes "payment";
import ShipperTypes "shipper";

module {
  public type OrderType = {
    #TableOrder;
    #DeliveryOrder;
  };

  public type OrderStatus = {
    #Cancelled;        // order cancelled by customer before payment was confirmed
    #Completed;
    #Delivered;
    #DispatchCenter;   // timed out finding driver — needs manual dispatch by staff
    #FindingDriver;    // delivery order is searching for a shipper after payment (up to 30s)
    #PaymentPending;   // order created but awaiting payment webhook confirmation
    #Pending;
    #PendingApproval;  // deprecated — kept for stable compatibility, no longer used in new orders
    #Preparing;
    #Ready;
    #WaitingDriver;         // COD order: created, awaiting driver assignment by dispatch center
    #WaitingDriverPayment; // COD order: driver assigned, waiting for driver to scan QR (Tingee) at kiosk
  };

  public type VatInfo = {
    taxCode   : ?Text; // null = individual (no tax code)
    buyerName : Text;
    address   : Text;
    email     : Text;
    accountNo : ?Text; // buyer bank account number from Tax Authority API
  };

  public type InvoiceStatus = {
    #NotRequested;
    #Pending;   // queued for VPS worker to issue
    #Issued;
    #Error;
  };

  public type OrderItem = {
    menuItemId : CommonTypes.MenuItemId;
    name : Text;     // snapshot at time of order
    price : Nat;     // snapshot at time of order
    quantity : Nat;
    itemNote : ?Text;
    unit : ?Text;    // unit of measure snapshot (e.g. "tô", "đĩa", "phần")
  };

  public type Order = {
    id : CommonTypes.OrderId;
    restaurantId : CommonTypes.RestaurantId;
    tableIdentifier : Text; // table number or remote identifier
    orderType : OrderType;  // defaults to #TableOrder for backward compat
    deliveryAddress : ?Text;
    deliveryLat     : ?Float;   // geocoded latitude of customer delivery address
    deliveryLng     : ?Float;   // geocoded longitude of customer delivery address
    customerName : ?Text;
    customerPhone : ?Text;
    items : [OrderItem];
    var status : OrderStatus;
    notes : ?Text;
    createdAt : CommonTypes.Timestamp;
    paymentInfo : PaymentTypes.PaymentInfo;
    var paymentConfirmedAt : ?CommonTypes.Timestamp;
    // Shipper integration fields
    var shipperName       : ?Text;
    var shipperPhone      : ?Text;
    var shipperOrderId    : ?Text;
    var shippingFee       : ?Nat;
    var shippingProvider  : ?Text;
    var shippingStatus    : ?ShipperTypes.ShippingStatus;
    // MISA e-invoice fields
    var vatRequest   : Bool;
    var vatInfo      : ?VatInfo;
    var invoiceNo    : ?Text;
    var invoiceDate  : ?Text;
    var invoicePdfUrl : ?Text;
    var invoiceStatus : InvoiceStatus;
    var maCQT           : ?Text;  // Mã của cơ quan thuế (from BKAV response)
    var maTraCuu        : ?Text;  // Mã tra cứu hóa đơn (from BKAV response)
    var invoiceError    : ?Text;  // Specific error reason when invoiceStatus = #Error
    var transactionCode : ?Text;  // Tingee / bank transfer transaction code for audit trail
    // Sepay QR payment fields
    var orderCode           : ?Text;  // Short QR payment code (DH + 6 hex bytes), generated on creation
    var sepayTransactionId  : ?Text;  // DEPRECATED — kept for stable compatibility (Sepay removed)
    var sepayTransferAmount : ?Nat;   // DEPRECATED — kept for stable compatibility (Sepay removed)
    // AhaMove integration fields
    var ahamoveOrderId          : ?Text;                               // AhaMove order ID from bookShipper response
    var shippingTransferStatus  : ShipperTypes.ShippingTransferStatus; // status of shipping fee transfer to AhaMove
    var driverInfo              : ?ShipperTypes.DriverInfo;            // driver assigned by AhaMove
    // Subtotal: food-only price (excluding shipping fee), used for BKAV invoice
    var subtotal                : ?Nat;
    // FindingDriver timeout tracking
    var findingDriverSince      : ?Int;   // timestamp (ns) when status entered #FindingDriver
    var dispatchNote            : ?Text;  // reason set when order moved to #DispatchCenter
    // COD (Cash in Advance) flag — driver pays at kiosk, then collects from customer on delivery
    var isCod                   : Bool;
  };

  // Public tracking view returned by getOrderForTracking(orderId).
  // Contains only the fields needed for the customer-facing tracking progress bar:
  // order status, shipper info, driver location, and invoice info.
  // Public — any caller may track an order by its orderId.
  public type OrderTrackingPublic = {
    orderId            : CommonTypes.OrderId;
    status             : OrderStatus;
    orderType          : OrderType;
    // Tọa độ giao hàng đã geocode (lat/lng) — dùng cho bản đồ theo dõi đơn
    deliveryLat        : ?Float;
    deliveryLng        : ?Float;
    // Shipper / driver tracking
    shipperName        : ?Text;
    shipperPhone       : ?Text;
    shippingFee        : ?Nat;
    shippingProvider   : ?Text;
    shippingStatus     : ?ShipperTypes.ShippingStatus;
    ahamoveOrderId     : ?Text;
    driverInfo         : ?ShipperTypes.DriverInfo;
    // Invoice info (for VAT progress display)
    invoiceStatus      : InvoiceStatus;
    invoiceNo          : ?Text;
    invoiceDate        : ?Text;
    invoicePdfUrl      : ?Text;
    maCQT              : ?Text;
    maTraCuu           : ?Text;
    // Payment status (for tracking the payment step)
    paymentStatus      : PaymentTypes.PaymentStatus;
    paymentConfirmedAt : ?CommonTypes.Timestamp;
    // FindingDriver timeout tracking (for dispatch-center status display)
    findingDriverSince : ?Int;
    dispatchNote       : ?Text;
  };

  // Demo invoice record — stores state for worker-based BKAV demo invoice issuance
  // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
  public type DemoInvoice = {
    demoId          : Nat;
    orderId         : ?Nat;  // linked real order, null = synthetic demo
    var status      : { #Pending; #Issued; #Error };
    var invoiceNo   : ?Text;
    var invoiceDate : ?Text;
    var maCQT       : ?Text;
    var errorMessage: ?Text;
    createdAt       : Int;
  };

  // Public result type returned by getDemoInvoiceStatus
  // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
  public type DemoInvoiceResult = {
    status      : Text;
    invoiceNo   : ?Text;
    invoiceDate : ?Text;
    maCQT       : ?Text;
    errorMessage: ?Text;
  };

  // Tingee webhook additionalData item — internal-only, used to match orders by orderCode.
  // JSON form: {"name":"orderCode","value":"BBH000001"}
  public type TingeeAdditionalDataItem = {
    name : Text;
    value : Text;
  };

  // Tingee webhook payload — internal-only type for parsing the webhook body.
  // additionalData is the MANDATORY match source for orderCode (no content fallback).
  public type TingeeWebhookPayload = {
    clientId : ?Text;
    transactionCode : ?Text;
    amount : ?Nat;
    content : ?Text; // parsed for audit/logging only — NOT used as a match source
    additionalData : ?[TingeeAdditionalDataItem];
  };

  public type DateFilter = ?Text; // "YYYY-MM-DD" or null for all dates

  // View type returned by getDemoInvoiceOrders
  // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
  public type DemoOrderView = {
    orderId             : CommonTypes.OrderId;
    orderStatus         : Text;  // text version of OrderStatus variant
    totalAmount         : Nat;
    createdAt           : Int;
    tableId             : Text;
    restaurantId        : CommonTypes.RestaurantId;
    customerName        : ?Text;
    customerPhone       : ?Text;
    items               : [OrderItem];
    // demo invoice fields
    demoInvoiceStatus   : Text;   // "not_issued" | "pending" | "issued" | "error"
    demoInvoiceId       : ?Nat;   // demoId if a demo invoice exists
    demoInvoiceNo       : ?Text;
    demoInvoiceDate     : ?Text;
    demoMaCQT           : ?Text;
    demoInvoiceError    : ?Text;
  };
};
