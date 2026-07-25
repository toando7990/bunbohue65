// COD (Cash on Delivery) public API mixin
// Cash-in-Advance model: driver pays at kiosk, collects from customer on delivery
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import CodLib "../lib/cod";
import BusinessProfileLib "../lib/business-profile";
import CodTypes "../types/cod";
import CommonTypes "../types/common";

mixin (
  orders            : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState        : { var nextOrderId : OrderLib.OrderId },
  bpState           : BusinessProfileLib.State,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getOwner          : () -> Principal,
  // Callbacks to other mixins
  issueBkavInvoice  : (OrderLib.Order) -> async (),
  bookAhamoveShipper: (Text) -> async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text },
) {

  // Check if caller is the business owner
  func codIsOwner(caller : Principal) : Bool {
    caller == getOwner();
  };

  // Check whether the caller is the registered worker principal. Mirrors the
  // auth check in getInvoiceWorkerConfig() (bkav-invoice-api.mo) and
  // dqrIsRegisteredWorker (dynamic-qr-api.mo): the worker principal is stored
  // in BusinessProfile.workerPrincipal (under the Bkav config) as a Text. We
  // compare the caller's principal text representation directly with the
  // stored text — this avoids the M0039 "misplaced try" error (try/catch is
  // not allowed in a synchronous func body). Returns false when no worker
  // principal is registered or the stored text is empty.
  func codIsRegisteredWorker(caller : Principal) : Bool {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    switch (cfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else caller.toText() == wp;
      };
    };
  };

  // Combined auth: owner OR registered worker. Used by confirmAhamoveBooking
  // (the VPS worker posts the AhaMove booking result back; the owner can also
  // call it directly for manual reconciliation). Mirrors dqrIsOwnerOrWorker.
  func codIsOwnerOrWorker(caller : Principal) : Bool {
    codIsOwner(caller) or codIsRegisteredWorker(caller);
  };

  // Check if caller is an authorized enterprise delivery staff member.
  // Replicates the auth pattern from enterprise-delivery-api.mo (owner OR
  // any principal in enterpriseStaffPermissions with #EnterpriseDelivery).
  // Named codIsEnterpriseStaff to avoid duplicate-definition conflicts with
  // the same helper in enterprise-delivery-api.mo / orders-api.mo /
  // shipper-api.mo, which are all included in the same actor block.
  func codIsEnterpriseStaff(caller : Principal) : Bool {
    if (codIsOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        let found = entry.permissions.find(
          func(p : CommonTypes.EnterprisePermission) : Bool {
            switch p { case (#EnterpriseDelivery) true; case _ false };
          }
        );
        found != null;
      };
    };
  };

  // ── COD Order Creation ───────────────────────────────────────────────────────

  /// Creates a new COD delivery order.
  /// - No payment QR generated
  /// - Status = #WaitingDriver (awaiting dispatch center to assign/book a driver)
  /// - PaymentStatus = #WaitingDriverPayment (driver pays at kiosk before pickup)
  /// Requires: COD enabled in business profile and order total <= codLimit
  /// Intentionally anonymous — DO NOT secure this endpoint (anonymous ordering flow).
  public shared func createCodOrder(request : CodTypes.CodOrderRequest) : async CodTypes.CodOrderResponse {
    await CodLib.createCodOrder(orders, orderState, bpState, request);
  };

  // ── Dispatch Center Queries ────────────────────────────────────────────────────

  /// Returns all orders in #WaitingDriverPayment status (both COD and non-COD).
  /// Used by dispatch center staff dashboard.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared query ({ caller }) func getDispatchCenterOrders() : async { #ok : [CodTypes.DispatchCenterOrder]; #err : { #Unauthorized } } {
    if (not codIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    #ok(CodLib.getDispatchCenterOrders(orders));
  };

  /// Returns only COD orders awaiting driver assignment.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared query ({ caller }) func getCodDispatchOrders() : async { #ok : [CodTypes.DispatchCenterOrder]; #err : { #Unauthorized } } {
    if (not codIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    #ok(CodLib.getCodDispatchOrders(orders));
  };

  // ── Driver Assignment ──────────────────────────────────────────────────────────

  /// Books an AhaMove driver for a COD order.
  /// Accepts orders in #WaitingDriver or #WaitingDriverPayment status.
  /// After booking, transitions order to #WaitingDriverPayment.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared ({ caller }) func bookDriverForCodOrder(orderId : OrderLib.OrderId) : async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text } {
    if (not codIsEnterpriseStaff(caller)) return #err("Unauthorized");
    switch (orders.get(orderId)) {
      case null #err("Order not found");
      case (?order) {
        await CodLib.bookDriverForCodOrder(order, bookAhamoveShipper);
      };
    };
  };

  /// Assigns a driver to a COD order.
  /// Transitions order from #DispatchCenter → #WaitingDriverPayment.
  /// Called by dispatch center staff or auto-assignment logic.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared ({ caller }) func assignCodDriver(orderId : OrderLib.OrderId, driverPrincipal : Principal) : async { #ok; #err : Text } {
    if (not codIsEnterpriseStaff(caller)) return #err("Unauthorized");
    switch (orders.get(orderId)) {
      case null #err("Order not found");
      case (?order) {
        CodLib.assignDriverToCodOrder(order, driverPrincipal);
        #ok;
      };
    };
  };

  // ── COD Validation ─────────────────────────────────────────────────────────────

  /// Checks if COD is allowed for a given order total.
  /// Frontend calls this before showing COD option to customer.
  /// Intentionally public — needed pre-order by anonymous customers.
  public shared query func checkCodAllowed(orderTotal : Nat) : async Bool {
    CodLib.isCodAllowed(bpState, orderTotal);
  };

  // ── Frontend-driven AhaMove booking confirmation ───────────────────────────────

  /// Persists an AhaMove booking result that the frontend already obtained from the VPS proxy.
  /// Does NOT call AhaMove or any HTTP outcall — only persists the result.
  /// Guards order.status == #WaitingDriver ONLY (same guard as bookDriverForCodOrder).
  //
  // Auth model: workerPrincipal (owner OR registered workerPrincipal) — mirror
  // dqrIsOwnerOrWorker pattern in dynamic-qr-api.mo. #EnterpriseDelivery staff
  // no longer have callback authority; only the owner and the registered
  // workerPrincipal can post booking results back.
  public shared ({ caller }) func confirmAhamoveBooking(
    orderId         : OrderLib.OrderId,
    ahamoveOrderId  : Text,
    fare            : Nat,
    status          : Text,
  ) : async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text } {
    if (not codIsOwnerOrWorker(caller)) return #err("Unauthorized");
    switch (orders.get(orderId)) {
      case null #err("Order not found");
      case (?order) {
        CodLib.confirmAhamoveBooking(order, ahamoveOrderId, fare, status);
      };
    };
  };

  /// Read-only verification used by the VPS worker before calling AhaMove.
  /// Returns { valid; status; restaurantId } where valid is true only if the order
  /// exists AND order.status == #WaitingDriver.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared query ({ caller }) func verifyOrderForBooking(orderId : OrderLib.OrderId) : async { #ok : { valid : Bool; status : Text; restaurantId : ?Text }; #err : { #Unauthorized } } {
    if (not codIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    #ok(CodLib.verifyOrderForBooking(orders, orderId));
  };
}
