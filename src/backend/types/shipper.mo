// Shipper integration types — AhaMove
module {
  /// Shipping provider variant (AhaMove only)
  public type ShipperProvider = {
    #AhaMove;
  };

  /// Who pays the shipping fee
  public type ShippingFeeMode = {
    #CustomerPays;   // fee added to order total
    #RestaurantPays; // restaurant absorbs fee, not shown to customer
  };

  /// Real-time status of the assigned shipper
  public type ShippingStatus = {
    #SearchingShipper;
    #ShipperAccepted;
    #PickedUp;
    #Delivering;
    #DeliveryFailed;
  };

  /// Result returned after a successful shipper booking call
  public type ShipperBookingResult = {
    shipperName  : ?Text;
    shipperPhone : ?Text;
    shippingFee  : ?Nat;
    provider     : Text;
    distanceKm   : ?Float;
  };

  /// Per-restaurant shipper configuration
  // NOTE: ahamoveApiKey/ahamovePhone removed — AhaMove auth is business-level
  // (BusinessProfile.ahamoveApiKey/ahamoveMobile). Only the per-restaurant
  // shipping-fee policy and auto-shipper toggle remain here.
  public type ShipperConfig = {
    shippingFeeMode    : ?ShippingFeeMode;
    autoShipperEnabled : Bool;
  };

  /// Partial update for shipper config (all optional so callers patch only what changed)
  public type ShipperConfigUpdate = {
    shippingFeeMode    : ?ShippingFeeMode;
    autoShipperEnabled : ?Bool;
  };
  // ── AhaMove-specific types ────────────────────────────────────────────────

  /// Business-level AhaMove configuration stored in BusinessProfile
  public type AhamoveConfig = {
    apiKey     : Text;
    mobile     : ?Text;  // Số điện thoại tài khoản AhaMove (để lấy JWT token)
    // DEPRECATED — kept for stable compatibility; no longer used by new code (Ahamove Sandbox removed).
    isTestMode : Bool;
  };

  /// Real-time status of an AhaMove order
  public type AhamoveOrderStatus = {
    #processing;
    #accepted;
    #pickingUp;
    #delivering;
    #completed;
    #cancelled;
    #failed;
  };

  /// Whether the shipping fee has been transferred to AhaMove
  public type ShippingTransferStatus = {
    #notStarted;    // default — not yet attempted
    #pending;       // transfer initiated but not yet confirmed
    #completed;     // transfer confirmed
    #failed;        // transfer failed, manual retry needed
    #notRequired;   // COD mode — driver collects shipping fee from customer directly
  };

  /// Driver information from AhaMove API
  public type DriverInfo = {
    name         : Text;
    phone        : Text;
    vehiclePlate : Text;
    eta          : ?Int;
    lat          : ?Float;  // driver's current latitude (nullable — AhaMove may not return it)
    lng          : ?Float;  // driver's current longitude (nullable — AhaMove may not return it)
  };

  /// Full AhaMove order record stored in the canister
  public type AhamoveOrder = {
    orderId                    : Text;
    ahamoveOrderId             : Text;
    var status                 : AhamoveOrderStatus;
    shippingFee                : Nat;
    var driverInfo             : ?DriverInfo;
    createdAt                  : Int;
    var updatedAt              : Int;
    var shippingTransferStatus : ShippingTransferStatus;
  };

  /// Config object returned to the VPS worker for polling
  public type AhamoveWorkerConfig = {
    apiKey       : Text;
    mobile       : Text;  // Số điện thoại tài khoản AhaMove (để lấy JWT token)
    // DEPRECATED — kept for stable compatibility; no longer used by new code (Ahamove Sandbox removed).
    isTestMode   : Bool;
    ordersToSync : [{ orderId : Text; ahamoveOrderId : Text }];
  };

  // ── Pending Ahamove booking queue item (worker poll) ───────────────────────
  // Returned by getPendingAhamoveBookings() — the VPS worker polls this query
  // to discover delivery orders that need an AhaMove shipper booking. In the
  // Bkav-like architecture, bookAhamoveShipper ONLY marks the order as
  // #PendingAhamove (no HTTP outcall); the worker performs the actual AhaMove
  // booking via the VPS proxy and posts the result back via
  // confirmAhamoveBooking (existing method in cod-api.mo).
  //
  // The pending queue is DERIVED from existing state (the orders map) — there
  // is no separate pending-queue stable var. An order is "pending Ahamove" when
  // its shippingProvider == "AhaMove" (or it is a delivery order in
  // #WaitingDriver / #WaitingDriverPayment state) AND it has NO ahamoveOrderId
  // yet (the worker has not yet posted the booking result back).
  //
  // The item carries the full booking context the worker needs to call the
  // AhaMove booking endpoint through the VPS proxy — the worker does NOT need
  // to re-fetch the order from the canister.
  public type PendingAhamoveBookingItem = {
    orderId         : Text;          // order id as Text (worker uses Text ids)
    restaurantId    : Nat;
    orderCode       : Text;          // Tingee/AhaMove order code (order.orderCode, fallback to orderId text)
    pickupAddress   : Text;          // restaurant / business address (bpState.profile.address)
    restaurantName  : Text;          // restaurant name (for the AhaMove path[0].name)
    pickupLat       : ?Float;        // restaurant latitude (path[0].lat) — null when not set
    pickupLng       : ?Float;        // restaurant longitude (path[0].lng) — null when not set
    dropoffAddress  : Text;          // customer delivery address (order.deliveryAddress)
    dropoffLat      : ?Float;        // customer latitude (path[1].lat) — null when not set
    dropoffLng      : ?Float;        // customer longitude (path[1].lng) — null when not set
    customerName    : Text;          // customer name (path[1].name) — "Khách hàng" when null
    customerPhone   : Text;          // customer phone (path[1].mobile) — "" when null
    totalAmount     : Nat;           // shipping fee / total pay (order.shippingFee, fallback 25000)
    serviceId       : Text;          // AhaMove service id derived from restaurant latitude (HAN-BIKE / DAD-BIKE / SGN-BIKE)
  };
};
