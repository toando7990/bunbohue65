// Shipper integration API mixin — AhaMove booking and webhook endpoints
//
// Bkav-like architecture (per user instructions + doNotBuild + this dispatch):
//   - The canister ONLY receives webhooks and queries state. It does NOT make
//     HTTP outcalls to AhaMove. All external traffic flows through the VPS proxy.
//   - bookAhamoveShipper ONLY marks the order as #PendingAhamove (sets
//     shippingProvider := ?"AhaMove", shippingStatus := ?#SearchingShipper,
//     leaves ahamoveOrderId := null) and exposes getPendingAhamoveBookings()
//     for the VPS worker to poll. The worker performs the actual AhaMove
//     booking via the VPS proxy and posts the result back via
//     confirmAhamoveBooking (existing method in cod-api.mo).
//   - receiveAhamoveWebhook stays as-is — AhaMove pushes status updates back.
//   - getAhamoveWorkerConfig stays as-is — returns AhaMove credentials +
//     ordersToSync for the worker.
//   - Worker auth: callback/poll methods verify caller == owner OR caller ==
//     registered workerPrincipal (mirrors dqrIsRegisteredWorker /
//     dqrIsOwnerOrWorker in dynamic-qr-api.mo).
//   - NO worker health dashboard (doNotBuild).
//   - NO configurable retry/backoff policy for the worker (doNotBuild).
//
// bookAhamoveShipper and getPendingAhamoveBookings are implemented (Bkav-like
// architecture: bookAhamoveShipper only marks the order as pending AhaMove;
// getPendingAhamoveBookings derives the pending queue from the orders map).
// The pending queue is DERIVED from existing state (the orders map) — there is
// no separate pending-queue stable var, so NO migration is required and NO
// stable var is added (per requirement: preserve stable vars, never lose data,
// never repeat M0250/M0251).
import Map "mo:core/Map";
import Text "mo:core/Text";
import Char "mo:core/Char";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import CommonTypes "../types/common";
import ShipperTypes "../types/shipper";
import RestaurantManager "../RestaurantManager";
import Float "mo:core/Float";

import BusinessProfileLib "../lib/business-profile";
import Debug "mo:core/Debug";
import ShipperLib "../lib/shipper";

mixin (
  orders          : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState      : { var nextOrderId : OrderLib.OrderId },
  restaurantState : RestaurantManager.State,
  bpState         : BusinessProfileLib.State,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  // Check if caller is the business owner
  func shipIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  // Check if caller is an authorized enterprise staff member (owner or any staff with permissions).
  // Renamed to avoid duplicate-definition with the same helper in orders-api.mo and
  // enterprise-delivery-api.mo (all three mixins are included in the same actor block).
  func shipperIsEnterpriseStaff(caller : Principal) : Bool {
    if (shipIsOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        entry.permissions.size() > 0;
      };
    };
  };

  // ── Worker auth helpers (mirror dqrIsRegisteredWorker / dqrIsOwnerOrWorker
  // in dynamic-qr-api.mo) ────────────────────────────────────────────────────
  // The worker principal is stored in BusinessProfile.workerPrincipal (under
  // the Bkav config) as a Text; we parse it back to Principal and compare.
  // Returns false when no worker principal is registered or the stored text
  // is not a valid principal.

  func shipIsRegisteredWorker(caller : Principal) : Bool {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    switch (cfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else caller.toText() == wp;
      };
    };
  };

  // Combined auth: owner OR registered worker. Used by the worker poll query
  // getPendingAhamoveBookings (the VPS worker polls it; the owner can also
  // call it directly for manual reconciliation).
  func shipIsOwnerOrWorker(caller : Principal) : Bool {
    shipIsOwner(caller) or shipIsRegisteredWorker(caller);
  };

  /// Return the AhaMove service ID appropriate for the restaurant's latitude.
  /// Hà Nội (lat >= 20.5) → "HAN-BIKE", Đà Nẵng (12.0 < lat < 20.5) → "DAD-BIKE", TP.HCM (lat <= 12.0) → "SGN-BIKE".
  func ahamoveServiceId(lat : Float) : Text {
    if (lat >= 20.5) { "HAN-BIKE" }
    else if (lat <= 12.0) { "SGN-BIKE" }
    else { "DAD-BIKE" }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  // NOTE: getShipperConfig / updateShipperConfig endpoints were removed — they
  // read/wrote the dead per-restaurant ahamoveApiKey/ahamovePhone fields.
  // AhaMove auth is business-level (BusinessProfile.ahamoveApiKey/ahamoveMobile,
  // managed via saveAhamoveConfig/getAhamoveConfig). The per-restaurant
  // shippingFeeMode/autoShipperEnabled keepers are patched through
  // updateRestaurantProfile's shipper fields.

  /// Update the live shipper name, phone and shipping status for an order.
  public shared ({ caller }) func updateShipperStatus(
    orderId        : CommonTypes.OrderId,
    shipperName    : Text,
    shipperPhone   : Text,
    shippingStatus : ShipperTypes.ShippingStatus,
  ) : async { #ok; #err : Text } {
    if (not shipperIsEnterpriseStaff(caller)) return #err "Unauthorized";
    switch (orders.get(orderId)) {
      case null { #err "Order not found" };
      case (?order) {
        order.shipperName    := ?shipperName;
        order.shipperPhone   := ?shipperPhone;
        order.shippingStatus := ?shippingStatus;
        #ok;
      };
    };
  };

  /// Book a shipper for a delivery order.
  public shared ({ caller }) func bookShipper(
    orderId      : CommonTypes.OrderId,
    restaurantId : CommonTypes.RestaurantId,
  ) : async { #ok : ShipperTypes.ShipperBookingResult; #err : Text } {
    if (not shipperIsEnterpriseStaff(caller)) return #err "Unauthorized";
    let order = switch (orders.get(orderId)) {
      case null { return #err "Order not found" };
      case (?o) o;
    };
    switch (order.orderType) {
      case (#DeliveryOrder) {};
      case (_) { return #err "Chỉ có thể đặt shipper cho đơn giao hàng" };
    };
    switch (order.status) {
      case (#WaitingDriver or #WaitingDriverPayment) {};
      case (_) { return #err "Đơn hàng phải ở trạng thái Chờ tài xế hoặc Chờ tài xế thanh toán" };
    };
    let rest = switch (restaurantState.restaurants.get(restaurantId)) {
      case null { return #err "Restaurant not found" };
      case (?r) r;
    };
    if (not rest.autoShipperEnabled) {
      return #err "Tính năng đặt shipper tự động chưa được bật";
    };
    // Book via AhaMove through VPS proxy
    switch (await bookAhamoveShipper(orderId.toText())) {
      case (#ok info) {
        #ok {
          shipperName  = null;
          shipperPhone = null;
          shippingFee  = ?info.fare;
          provider     = "AhaMove";
          distanceKm   = ?info.distanceKm;
        };
      };
      case (#err msg) { #err msg };
    };
  };


  /// Estimate shipping fee via AhaMove API directly from restaurantId + dropoff address.
  /// Does NOT require an existing order — safe to call before order creation.
  /// Book a shipper with AhaMove after payment is confirmed.;


  /// Book a shipper with AhaMove after payment is confirmed.
  //
  // Bkav-like architecture: this method ONLY marks the order as
  // #PendingAhamove — it does NOT make an HTTP outcall to AhaMove. It sets:
  //   order.shippingProvider := ?"AhaMove"
  //   order.shippingStatus   := ?#SearchingShipper
  //   order.ahamoveOrderId   := null  (the worker has not yet posted the
  //                                   booking result back via
  //                                   confirmAhamoveBooking)
  // The VPS worker polls getPendingAhamoveBookings(), performs the actual
  // AhaMove booking through the VPS proxy, and posts the result back via
  // confirmAhamoveBooking (existing method in cod-api.mo), which fills in
  // ahamoveOrderId / fare / distanceKm.
  //
  // The return type { ahamoveOrderId : Text; status : Text; fare : Nat;
  // distanceKm : Float } is preserved for backward compatibility with
  // bookShipper and retryBookShipper. In the new architecture the immediate
  // return carries placeholder values (ahamoveOrderId = "", status =
  // "PENDING", fare = 0, distanceKm = 0.0) — the real values arrive later
  // via the webhook / confirmAhamoveBooking.
  //
  // Authorization: enterprise staff (owner or any permission holder).
  public shared ({ caller }) func bookAhamoveShipper(
    orderId : Text,
  ) : async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat; distanceKm : Float }; #err : Text } {
    if (not shipperIsEnterpriseStaff(caller)) return #err("Unauthorized");
    // Parse orderId Text → Nat (same pattern as retryBookShipper below).
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err("Invalid orderId");

    let order = switch (orders.get(orderIdNat)) {
      case null { return #err("order not found") };
      case (?o) o;
    };

    // Bkav-like architecture: NO HTTP outcall. Just mark the order as pending
    // AhaMove booking. The VPS worker polls getPendingAhamoveBookings() and
    // performs the actual AhaMove booking through the VPS proxy, then posts
    // the result back via confirmAhamoveBooking (in cod-api.mo).
    order.shippingProvider := ?"AhaMove";
    order.shippingStatus   := ?#SearchingShipper;
    order.ahamoveOrderId   := null;

    // Placeholder return — real values arrive later via webhook /
    // confirmAhamoveBooking. Preserved for backward compatibility with
    // bookShipper and retryBookShipper.
    #ok {
      ahamoveOrderId = "";
      status         = "PENDING";
      fare           = 0;
      distanceKm     = 0.0;
    };
  };

  // ── Worker poll query ──────────────────────────────────────────────────────

  // List all pending AhaMove bookings the VPS worker must perform. The worker
  // polls this query (free, no cycles cost, safe for frequent polling) to
  // discover delivery orders that need an AhaMove shipper booking. In the
  // Bkav-like architecture, bookAhamoveShipper ONLY marks the order as
  // #PendingAhamove (no HTTP outcall); the worker performs the actual AhaMove
  // booking through the VPS proxy and posts the result back via
  // confirmAhamoveBooking (existing method in cod-api.mo).
  //
  // The pending queue is DERIVED from existing state (the orders map) — there
  // is no separate pending-queue stable var. An order is "pending Ahamove"
  // when it is a delivery order whose shippingProvider == "AhaMove" AND whose
  // ahamoveOrderId == null (the worker has not yet posted the booking result
  // back). Each item carries the full booking context the worker needs to call
  // the AhaMove booking endpoint through the VPS proxy — the worker does NOT
  // need to re-fetch the order from the canister.
  //
  // SECURED: requires owner OR registered worker principal (same auth model as
  // getAhamoveWorkerConfig / getPendingDynamicQRs). Non-matching callers get
  // an empty list.
  //
  public shared query ({ caller }) func getPendingAhamoveBookings() : async [ShipperTypes.PendingAhamoveBookingItem] {
    if (not shipIsOwnerOrWorker(caller)) return [];

    // Derive the pending queue from the orders map — no separate stable var.
    // An order is "pending AhaMove" when shippingProvider == "AhaMove" AND
    // ahamoveOrderId is null or empty (worker has not yet posted the booking
    // result back via confirmAhamoveBooking).
    let pending = orders.entries()
      .filter(func((_, order) : (OrderLib.OrderId, OrderLib.Order)) : Bool {
        switch (order.shippingProvider) {
          case (?p) {
            p == "AhaMove" and (
              switch (order.ahamoveOrderId) {
                case null true;
                case (?aid) aid.size() == 0;
              }
            );
          };
          case null false;
        };
      })
      .map(func((id, order) : (OrderLib.OrderId, OrderLib.Order)) : ShipperTypes.PendingAhamoveBookingItem {
        // Look up restaurant for pickup info. Extract the fields we need in
        // each branch (rather than unifying a var-field Restaurant with a
        // non-var anonymous record) so Motoko does not have to unify the two
        // record types.
        let (pickupAddr, restName, restLat, restLng) = switch (restaurantState.restaurants.get(order.restaurantId)) {
          case null {
            // Restaurant missing — emit zeroed pickup fields so the worker
            // can still identify the order and skip it gracefully.
            ("", "", null, null);
          };
          case (?r) {
            (r.address, r.name, r.coordinateLatitude, r.coordinateLongitude);
          };
        };
        let serviceId = ahamoveServiceId(
          switch (restLat) { case null 0.0; case (?l) l }
        );

        {
          orderId         = id.toText();
          restaurantId    = order.restaurantId;
          orderCode       = switch (order.orderCode) { case (?c) c; case null "" };
          pickupAddress   = pickupAddr;
          restaurantName  = restName;
          pickupLat       = restLat;
          pickupLng       = restLng;
          dropoffAddress  = switch (order.deliveryAddress) { case (?a) a; case null "" };
          dropoffLat      = order.deliveryLat;
          dropoffLng      = order.deliveryLng;
          customerName    = switch (order.customerName) { case (?n) n; case null "" };
          customerPhone   = switch (order.customerPhone) { case (?p) p; case null "" };
          totalAmount     = switch (order.shippingFee) { case (?f) f; case null 0 };
          serviceId       = serviceId;
        };
      })
      .toArray();

    pending;
  };

  /// Webhook endpoint called by the VPS worker to push order/shipper status
  /// updates back into the canister.
  //
  // Auth model: workerPrincipal ONLY (mirror dqrIsOwnerOrWorker pattern in
  // dynamic-qr-api.mo). The caller MUST be the business owner OR the
  // registered workerPrincipal (stored in BusinessProfile.workerPrincipal under
  // the Bkav config). HMAC-SHA256 verification has been REMOVED — workerPrincipal
  // is the sole auth mechanism. Non-matching callers get #err "Unauthorized".
  // The signature / requestBody parameters are kept in the signature for
  // backward compatibility with existing worker code but are IGNORED.
  public shared ({ caller }) func receiveAhamoveWebhook(
    orderId     : Text,
    newStatus   : Text,
    driverInfo  : ?ShipperTypes.DriverInfo,
    signature   : Text,
    requestBody : Text,
  ) : async { #ok; #err : Text } {
    ignore (signature, requestBody);
    // ── workerPrincipal auth (sole mechanism) ───────────────────────────────
    // Mirror dqrIsOwnerOrWorker: owner OR registered workerPrincipal. No HMAC
    // fallback path — non-matching callers are rejected outright.
    if (not shipIsOwnerOrWorker(caller)) return #err("Unauthorized");

    // Find the order by ahamoveOrderId OR by numeric orderId
    var targetOrder : ?OrderLib.Order = null;
    var foundOrder = false;

    // Try numeric orderId first
    var orderIdNat : Nat = 0;
    var numericValid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { numericValid := false };
    };
    if (numericValid) {
      switch (orders.get(orderIdNat)) {
        case (?o) { targetOrder := ?o; foundOrder := true };
        case null {};
      };
    };

    // If not found by numeric id, search by ahamoveOrderId
    if (not foundOrder) {
      label search for ((_, o) in orders.entries()) {
        switch (o.ahamoveOrderId) {
          case (?aid) {
            if (aid == orderId) {
              targetOrder := ?o;
              foundOrder  := true;
              break search;
            };
          };
          case null {};
        };
      };
    };

    let order = switch (targetOrder) {
      case null { return #err("Order not found: " # orderId) };
      case (?o) o;
    };

    // Map AhaMove status string to ShippingStatus variant
    let shippingStatus : ?ShipperTypes.ShippingStatus =
      if (newStatus == "ASSIGNING" or newStatus == "PROCESSING")    ?#SearchingShipper
      else if (newStatus == "ACCEPTED")                              ?#ShipperAccepted
      else if (newStatus == "IN_PROCESS" or newStatus == "PICKING") ?#PickedUp
      else if (newStatus == "DELIVERING")                            ?#Delivering
      else if (newStatus == "COMPLETED")                             ?#Delivering  // stays Delivering until admin confirms
      else if (newStatus == "CANCEL" or newStatus == "FAILED")       ?#DeliveryFailed
      else null;

    switch (shippingStatus) {
      case (?s) { order.shippingStatus := ?s };
      case null {};
    };

    // Update driver info if provided.
    // Polling refresh may arrive without lat/lng (AhaMove doesn't always return
    // coordinates). Preserve the last known lat/lng from the previous driverInfo
    // so the frontend keeps showing the driver's last position until a fresh
    // coordinate arrives.
    switch (driverInfo) {
      case (?info) {
        let merged = switch (order.driverInfo) {
          case (?prev) {
            {
              info with
              lat = switch (info.lat) { case (?l) ?l; case null prev.lat };
              lng = switch (info.lng) { case (?l) ?l; case null prev.lng };
            };
          };
          case null info;
        };
        order.driverInfo    := ?merged;
        order.shipperName   := ?merged.name;
        order.shipperPhone  := ?merged.phone;
      };
      case null {};
    };

    // ── Order status transitions based on AhaMove shipper status ───────────
    // ACCEPTED or IN_PROCESS: shipper has taken the order → send to kitchen as #Pending (Chờ bếp xử lý)
    if (newStatus == "ACCEPTED" or newStatus == "IN_PROCESS" or newStatus == "PICKING") {
      switch (order.status) {
        case (#FindingDriver or #DispatchCenter or #WaitingDriverPayment or #PaymentPending) {
          order.status := #Pending;
        };
        case _ {}; // already in kitchen flow — leave alone
      };
    };

    // COMPLETED: shipper confirmed delivery → mark as Delivered.
    // Only transition from kitchen-flow states (#Pending/#Preparing/#Ready) to
    // avoid a race where COMPLETED arrives before ACCEPTED and skips the kitchen
    // (which would jump #FindingDriver → #Delivered). If the order is still in
    // #FindingDriver/#DispatchCenter, leave it — staff will reconcile manually.
    if (newStatus == "COMPLETED") {
      switch (order.status) {
        case (#Pending or #Preparing or #Ready) {
          order.status := #Delivered;
        };
        case _ {};
      };
    };

    // CANCEL/FAILED: shipper cancelled — only transition back if order not yet in kitchen
    if (newStatus == "CANCEL" or newStatus == "FAILED") {
      switch (order.status) {
        case (#FindingDriver) {
          // No shipper found / cancelled before dispatch — send to manual dispatch center
          order.status := #DispatchCenter;
        };
        case _ {}; // if already in kitchen, keep it there
      };
    };

    #ok;
  };

  /// Retry booking an AhaMove shipper for an order that previously failed.
  public shared ({ caller }) func retryBookShipper(
    orderId : Text,
  ) : async { #ok : { ahamoveOrderId : Text; fare : Nat; distanceKm : Float }; #err : Text } {
    if (not shipperIsEnterpriseStaff(caller)) return #err("Unauthorized");
    // Clear previous ahamove state and retry booking
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err("Invalid orderId");

    let order = switch (orders.get(orderIdNat)) {
      case null { return #err("Order not found") };
      case (?o) o;
    };

    // Reset AhaMove booking state before retry
    order.ahamoveOrderId         := null;
    order.shippingStatus         := null;
    order.shippingTransferStatus := #notStarted;

    // Re-use bookAhamoveShipper logic
    switch (await bookAhamoveShipper(orderId)) {
      case (#ok result) { #ok { ahamoveOrderId = result.ahamoveOrderId; fare = result.fare; distanceKm = result.distanceKm } };
      case (#err e)     { #err e };
    };
  };

  /// Returns AhaMove worker configuration including pending orders to sync.
  //
  // Auth model mirrors getDynamicQRWorkerConfig() (dynamic-qr-api.mo) and
  // getInvoiceWorkerConfig() (bkav-invoice-api.mo):
  //   - caller == owner → returns real config
  //   - caller == registered workerPrincipal (non-null) → returns real config
  //   - otherwise → returns empty config (no credentials leaked)
  // The worker principal is stored in BusinessProfile.workerPrincipal (under
  // the Bkav config) as a Text; we compare caller.toText() directly with the
  // stored text (avoids M0039 "misplaced try" — no Principal.fromText in a
  // sync query func). Query call — the VPS worker calls this on startup and
  // after each poll cycle.
  public shared query ({ caller }) func getAhamoveWorkerConfig() : async { #ok : ShipperTypes.AhamoveWorkerConfig; #err : Text } {
    // Auth: owner OR registered worker principal. Non-matching callers get
    // an empty config (no credentials leaked) — same pattern as
    // getDynamicQRWorkerConfig / getInvoiceWorkerConfig.
    if (not shipIsOwnerOrWorker(caller)) {
      return #ok {
        apiKey       = "";
        mobile       = "";
        isTestMode   = false; // DEPRECATED — always false (Ahamove Sandbox removed)
        ordersToSync = [];
      };
    };

    // Collect orders that have an ahamoveOrderId and are not yet completed/cancelled
    let ordersToSync = orders.values()
      .filter(func(o : OrderLib.Order) : Bool {
        switch (o.ahamoveOrderId) {
          case null false;
          case (?_) {
            // Only sync orders that are still in active delivery states
            switch (o.shippingStatus) {
              case (?(#DeliveryFailed)) false;
              case _ {
                switch (o.status) {
                  case (#Delivered) false;
                  case (#Cancelled) false;
                  case _ true;
                };
              };
            };
          };
        };
      })
      .map(func(o) {
        {
          orderId        = o.id.toText();
          ahamoveOrderId = switch (o.ahamoveOrderId) { case (?aid) aid; case null "" };
        };
      })
      .toArray();

    // AhaMove config is stored at business level in bpState
    let ahamoveCfg = switch (BusinessProfileLib.getAhamoveConfig(bpState)) {
      case null { return #err("AhaMove API key not configured") };
      case (?cfg) cfg;
    };

    #ok {
      apiKey       = ahamoveCfg.apiKey;
      mobile       = switch (ahamoveCfg.mobile) { case (?m) m; case null "" };
      isTestMode   = false; // DEPRECATED — always false (Ahamove Sandbox removed)
      ordersToSync = ordersToSync;
    };
  };

  /// Update the shipping fee transfer status for an order (called by admin or VPS worker).
  public shared ({ caller }) func updateShippingTransferStatus(
    orderId : Text,
    status  : ShipperTypes.ShippingTransferStatus,
  ) : async { #ok; #err : Text } {
    if (not shipperIsEnterpriseStaff(caller)) return #err("Unauthorized");
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err("Invalid orderId");

    switch (orders.get(orderIdNat)) {
      case null { #err("Order not found") };
      case (?order) {
        order.shippingTransferStatus := status;
        #ok;
      };
    };
  };

  /// Return AhaMove tracking fields for an order (for staff polling).
  /// SECURED: requires authenticated enterprise staff. Customers must use
  /// getOrderForTracking(orderId) (which includes shipper tracking fields in
  /// the tracking view).
  public shared ({ caller }) func getAhamoveOrderStatus(
    orderId : CommonTypes.OrderId,
  ) : async {
    #ok : {
      ahamoveOrderId : ?Text;
      shippingStatus : ?ShipperTypes.ShippingStatus;
      shipperName    : ?Text;
      shipperPhone   : ?Text;
      driverInfo     : ?ShipperTypes.DriverInfo;
      orderStatus    : OrderLib.OrderStatus;
      shippingFee    : ?Nat;
      shippingProvider : ?Text;
    };
    #err : Text;
  } {
    if (not shipperIsEnterpriseStaff(caller)) return #err("Unauthorized");
    switch (orders.get(orderId)) {
      case null { #err("Order not found") };
      case (?order) {
        #ok {
          ahamoveOrderId   = order.ahamoveOrderId;
          shippingStatus   = order.shippingStatus;
          shipperName      = order.shipperName;
          shipperPhone     = order.shipperPhone;
          driverInfo       = order.driverInfo;
          orderStatus      = order.status;
          shippingFee      = order.shippingFee;
          shippingProvider = order.shippingProvider;
        };
      };
    };
  };
};
