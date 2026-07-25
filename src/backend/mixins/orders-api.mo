// Orders API mixin — exposes public order management endpoints
import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import CommonTypes "../types/common";
import OrderTypes "../types/order";
import PaymentTypes "../types/payment";
import RestaurantManager "../RestaurantManager";
import BusinessProfileLib "../lib/business-profile";
import RestaurantTypes "../types/restaurant";
import Debug "mo:core/Debug";
import Iter "mo:core/Iter";
import Hmac "../lib/hmac";
import Nat8 "mo:core/Nat8";
import Array "mo:core/Array";
import Nat32 "mo:core/Nat32";
import Char "mo:core/Char";
import Time "mo:core/Time";
import Int "mo:core/Int";
import DynamicQRLib "../lib/dynamic-qr";

mixin (
  orders : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState : { var nextOrderId : OrderLib.OrderId },
  restaurantState : RestaurantManager.State,
  bpState : BusinessProfileLib.State,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
  getCanisterPrincipal : () -> async Principal,
  issueBkavInvoice     : (OrderLib.Order) -> async (),
  bookAhamoveShipper   : (Text) -> async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text },
  verifyDeviceToken     : shared (Text) -> async { #ok : { restaurantId : Nat; role : CommonTypes.StaffRole; deviceName : Text }; #err : Text },
  dynamicQRStore        : Map.Map<OrderLib.OrderId, DynamicQRLib.DynamicQRRecord>,
) {

  // Check if caller is the business owner
  func ordIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  // Check if caller is an authorized enterprise staff member (owner or any staff with permissions).
  // Renamed to avoid duplicate-definition with the same helper in enterprise-delivery-api.mo
  // (both mixins are included in the same actor block).
  func ordersIsEnterpriseStaff(caller : Principal) : Bool {
    if (ordIsOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        entry.permissions.size() > 0;
      };
    };
  };

  // Helper: look up a header value (case-insensitive) from a headers list
  func getHeader(headers : [(Text, Text)], name : Text) : ?Text {
    let lower = name.toLower();
    for ((k, v) in headers.vals()) {
      if (k.toLower() == lower) return ?v;
    };
    null;
  };

  // Helper: constant-time-ish comparison of two Text values.
  // Pads the shorter input with zero bytes so the comparison always runs over
  // the same number of bytes regardless of input length — this prevents timing
  // from leaking length information. The result is still correct: equal inputs
  // return true, unequal inputs return false (the pad byte is fixed and only
  // applied to the shorter side, so equal-length equal-content inputs still
  // XOR to zero, and any real content difference still surfaces as a non-zero
  // diff byte).
  func constantTimeEqual(a : Text, b : Text) : Bool {
    let aLen = a.size();
    let bLen = b.size();
    let maxLen = if (aLen > bLen) aLen else bLen;
    var diff : Nat8 = 0;
    let ai = a.chars();
    let bi = b.chars();
    var i = 0;
    loop {
      if (i >= maxLen) return diff == 0;
      let ca : Nat8 = switch (ai.next()) {
        case (?c) Nat8.fromNat(c.toNat32().toNat());
        case null 0; // pad shorter side with zero byte
      };
      let cb : Nat8 = switch (bi.next()) {
        case (?c) Nat8.fromNat(c.toNat32().toNat());
        case null 0; // pad shorter side with zero byte
      };
      diff |= (ca ^ cb);
      i += 1;
    };
  };
  // Place a new order — no authentication required (anonymous ordering preserved).
  // Returns orderId and the generated orderCode.
  // Tracking is now public via getOrderForTracking(orderId).
  public shared func placeOrder(
    restaurantId : CommonTypes.RestaurantId,
    tableIdentifier : Text,
    items : [OrderTypes.OrderItem],
    notes : ?Text,
    vatRequest : Bool,
    vatInfo : ?OrderTypes.VatInfo,
  ) : async { orderId : CommonTypes.OrderId; orderCode : ?Text } {
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    let result = await manager.placeOrder(restaurantId, tableIdentifier, items, notes, vatRequest, vatInfo);
    let orderCode = switch (manager.getOrder(result.orderId)) {
      case (?o) o.orderCode;
      case null null;
    };
    { orderId = result.orderId; orderCode };
  };

  // Place a delivery order from a remote customer (no table).
  // Returns orderId and orderCode.
  // For COD orders (isCod = true): validates COD settings and returns error if exceeded.
  // The orderCode is the payment QR code — for COD orders this QR is shown to the driver at the kiosk.
  // Tracking is now public via getOrderForTracking(orderId).
  public shared func placeDeliveryOrder(
    restaurantId  : CommonTypes.RestaurantId,
    items         : [OrderTypes.OrderItem],
    notes         : ?Text,
    deliveryAddress : Text,
    customerName  : Text,
    customerPhone : Text,
    vatRequest    : Bool,
    vatInfo       : ?OrderTypes.VatInfo,
    shippingFee   : ?Nat,
    deliveryLat   : ?Float,
    deliveryLng   : ?Float,
    isCod         : Bool,
  ) : async { #ok : { orderId : CommonTypes.OrderId; orderCode : ?Text }; #err : Text } {
    // COD validation: enforce business-level COD settings (allowed + amount limit)
    if (isCod) {
      switch (BusinessProfileLib.getCodSettings(bpState)) {
        case null return #err("COD không được bật");
        case (?settings) {
          if (not settings.isCodAllowed) return #err("COD không được bật");
          var totalAmount : Nat = 0;
          for (item in items.vals()) {
            totalAmount += item.price * item.quantity;
          };
          if (totalAmount > settings.codLimit) {
            return #err("Số tiền COD vượt giới hạn cho phép");
          };
        };
      };
    };
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    let result = try {
      await manager.placeDeliveryOrder(
        restaurantId, items, notes, deliveryAddress, customerName, customerPhone,
        vatRequest, vatInfo, shippingFee, deliveryLat, deliveryLng, isCod,
      );
    } catch (e) {
      return #err(e.message());
    };
    let orderCode = switch (manager.getOrder(result.orderId)) {
      case (?o) o.orderCode;
      case null null;
    };
    #ok({ orderId = result.orderId; orderCode });
  };

  // Customer-facing order tracking endpoint.
  // Returns the order tracking view (status, shipper info, driver location, invoice, payment status)
  // for the given orderId. Returns null if the order does not exist.
  // This is the SINGLE endpoint customers use to track their order — replaces the
  // previously-public getOrder / getAhamoveOrderStatus / getOrderPaymentStatus / getInvoiceInfo /
  // getPaymentStatus for customer-side polling. Preserves anonymous ordering (no principal needed).
  public query func getOrderForTracking(
    orderId : CommonTypes.OrderId,
  ) : async ?OrderLib.OrderTrackingPublic {
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).getOrderForTracking(orderId);
  };

  // List delivery orders for the store delivery tab.
  // SECURED: requires authenticated enterprise staff (caller verified via isEnterpriseStaff).
  // Anonymous/public access is no longer permitted — delivery orders contain customer PII
  // (name, phone, address) and tracking data. Staff use this; customers use getOrderForTracking.
  public shared ({ caller }) func listDeliveryOrders(
    restaurantId : CommonTypes.RestaurantId,
    dateFilter : ?Text,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listDeliveryOrders(restaurantId, dateFilter));
  };

  // List paid delivery orders only — for kitchen/restaurant staff view
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listDeliveryOrdersForKitchen(
    restaurantId : CommonTypes.RestaurantId,
    dateFilter : ?Text,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listDeliveryOrdersForKitchen(restaurantId, dateFilter));
  };

  // Update order status — kitchen/staff use
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func updateOrderStatus(
    id : CommonTypes.OrderId,
    newStatus : OrderTypes.OrderStatus,
  ) : async { #ok : Bool; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.updateOrderStatus(id, newStatus));
  };

  // Get a single order by id.
  // SECURED: requires authenticated enterprise staff. Customers must use
  // getOrderForTracking(orderId) instead. Returns null on unauthorized access.
  public shared ({ caller }) func getOrder(id : CommonTypes.OrderId) : async ?OrderLib.OrderPublic {
    if (not ordersIsEnterpriseStaff(caller)) return null;
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).getOrder(id);
  };

  // List all orders for a restaurant.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listOrdersByRestaurant(
    restaurantId : CommonTypes.RestaurantId
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listOrdersByRestaurant(restaurantId));
  };

  // List ALL orders for a restaurant regardless of payment status — for the accounting view.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listAllOrdersForAccounting(
    restaurantId : CommonTypes.RestaurantId
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listAllOrdersForAccounting(restaurantId));
  };

  // List only Pending and Preparing orders for a restaurant.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listActiveOrdersByRestaurant(
    restaurantId : CommonTypes.RestaurantId,
    dateFilter : ?Text,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listActiveOrdersByRestaurant(restaurantId, dateFilter));
  };

  // List all orders for a specific table.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listOrdersByTable(
    restaurantId : CommonTypes.RestaurantId,
    tableIdentifier : Text,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listOrdersByTable(restaurantId, tableIdentifier));
  };

  // List orders for a restaurant filtered by status — waiter sees Ready, cashier sees Completed.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func listOrdersByStatus(
    restaurantId : CommonTypes.RestaurantId,
    status : OrderTypes.OrderStatus,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.listOrdersByStatus(restaurantId, status));
  };

  // Settle (clear completed orders) for a specific table — cashier use.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func settleTable(
    restaurantId : CommonTypes.RestaurantId,
    tableIdentifier : Text,
  ) : async { #ok : Nat; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.settleTable(restaurantId, tableIdentifier));
  };

  // Remove completed orders for a restaurant, return count removed.
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func clearCompletedOrders(
    restaurantId : CommonTypes.RestaurantId
  ) : async { #ok : Nat; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.clearCompletedOrders(restaurantId));
  };

  // Get business-level bank details for QR payment — shared across all restaurants.
  // SECURED: requires authenticated enterprise staff OR a verified kiosk-order
  // device token. Bank details contain sensitive PII (account number, bank name,
  // account holder) and must not leak to anonymous callers.
  // Two authorized paths:
  //   1. caller is owner or has an entry in enterpriseStaffPermissions (existing)
  //   2. caller passes a valid kiosk-order device token via the deviceToken
  //      parameter — verified via verifyDeviceToken (KioskDevicesMixin) with
  //      role == #KioskOrder. This lets the kiosk display the business bank
  //      QR for payment without requiring a principal-based staff login.
  // Behavior for owner/enterprise staff is unchanged when deviceToken is null/empty.
  // NOTE: This is an update (not query) because verifyDeviceToken updates
  // lastUsedAt on the device record. The owner/staff fast-path returns before
  // any device-token verification, so it incurs no extra cost.
  public shared ({ caller }) func getBusinessBankDetails(
    deviceToken : ?Text,
  ) : async ?BusinessProfileLib.BusinessBankDetails {
    if (ordersIsEnterpriseStaff(caller)) {
      return BusinessProfileLib.getBusinessBankDetails(bpState);
    };
    // Kiosk-order device token path — verify and check role.
    switch (deviceToken) {
      case null return null;
      case (?token) {
        if (token.size() == 0) return null;
        switch (await verifyDeviceToken(token)) {
          case (#err(_)) null;
          case (#ok(info)) {
            switch (info.role) {
              case (#KioskOrder) BusinessProfileLib.getBusinessBankDetails(bpState);
              case _ null;
            };
          };
        };
      };
    };
  };

  // BankDetails returned to customer when they choose bank-transfer payment
  public type BankDetails = {
    accountNumber     : Text;
    bankName          : Text;
    accountHolderName : Text;
    totalAmount       : Nat;
  };

  // Create a payment intent for an order.
  // - BankTransfer: returns bankDetails with QR-code data for the customer
  // - ApplePay/CreditCard: returns publishableKey so frontend can call Stripe.js directly
  // - Other methods: returns orderId + totalAmount only
  // SECURED: requires authenticated enterprise staff. Anyone could otherwise mutate
  // paymentStatus to #Pending on arbitrary orders.
  public shared ({ caller }) func createPaymentIntent(
    orderId      : CommonTypes.OrderId,
    method       : PaymentTypes.PaymentMethod,
    restaurantId : CommonTypes.RestaurantId,
  ) : async {
    #ok : {
      orderId      : CommonTypes.OrderId;
      totalAmount  : Nat;
      currency     : Text;
      publishableKey : ?Text;
      bankDetails  : ?BankDetails;
    };
    #err : { #NotFound; #StripeNotEnabled; #Unauthorized };
  } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    switch (manager.createPaymentIntent(orderId, method)) {
      case (#err(e)) #err(e);
      case (#ok(base)) {
        // For Stripe-based methods, validate restaurant has Stripe enabled
        let (publishableKey, bankDetails) : (?Text, ?BankDetails) = switch (method) {
          case (#ApplePay or #CreditCard) {
            switch (RestaurantManager.getRestaurant(restaurantState, restaurantId)) {
              case null (null, null);
              case (?r) {
                if (not r.stripeEnabled) return #err(#StripeNotEnabled);
                (r.stripePublishableKey, null);
              };
            };
          };
          case (#BankTransfer) {
            // Always use the business-level bank account for QR payment (not per-restaurant)
            let bd : ?BankDetails = switch (BusinessProfileLib.getBusinessBankDetails(bpState)) {
              case (?details) ?{
                accountNumber     = details.accountNumber;
                bankName          = details.bankName;
                accountHolderName = details.accountHolderName;
                totalAmount       = base.totalAmount;
              };
              case null null;
            };
            (null, bd);
          };
          case _ (null, null);
        };
        #ok({
          orderId      = base.orderId;
          totalAmount  = base.totalAmount;
          currency     = base.currency;
          publishableKey;
          bankDetails;
        });
      };
    };
  };

  // Confirm payment for an order (called after successful Stripe confirmation on frontend).
  // SECURED: requires authenticated enterprise staff. Without this guard anyone could mark
  // any order as #Paid — CRITICAL.
  public shared ({ caller }) func confirmPayment(
    orderId : CommonTypes.OrderId,
    paymentIntentId : Text,
  ) : async { #ok : Bool; #err : { #NotFound; #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).confirmPayment(orderId, paymentIntentId);
  };

  // Get payment status for an order.
  // SECURED: requires authenticated enterprise staff. Customers must use
  // getOrderForTracking(orderId) (which includes paymentStatus in the tracking view).
  public shared ({ caller }) func getPaymentStatus(
    orderId : CommonTypes.OrderId
  ) : async { #ok : ?PaymentTypes.PaymentStatus; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    #ok(manager.getPaymentStatus(orderId));
  };

  // Cashier confirms payment received (bank transfer or other manual confirmation).
  // SECURED: requires authenticated enterprise staff.
  public shared ({ caller }) func confirmPaymentByCashier(
    orderId      : CommonTypes.OrderId,
    restaurantId : CommonTypes.RestaurantId,
  ) : async { #ok : Bool; #err : { #NotFound; #WrongRestaurant; #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).confirmPaymentByCashier(orderId, restaurantId);
  };

  // Helper: check whether the given app is selected for auto-payment confirmation
  // Logic (per user instructions): only checks app match — does NOT check
  // autoPaymentConfirmationEnabled flag. Special case: when settings.app == #None
  // (no app selected yet), return false so webhooks don't auto-confirm before
  // the owner has chosen an app. When settings = null (no settings record at
  // all), return true to preserve existing behavior.
  func isAutoConfirmEnabled(restaurantId : CommonTypes.RestaurantId, app : RestaurantTypes.AutoPaymentApp) : Bool {
    switch (RestaurantManager.getAutoPaymentSettings(restaurantState, restaurantId)) {
      case null true; // no settings configured → always allow
      case (?s) {
        if (s.app == #None) false // no app selected yet → do not auto-confirm
        else s.app == app; // only check app type
      };
    };
  };

  // Helper: simple JSON field extractor — returns value after `"key":` (string or number)
  // Handles both `"key":"value"` and `"key":123` forms. Returns null if not found.
  // Extract a string field value from JSON: "key":"value"
  func jsonExtractTextField(json : Text, key : Text) : ?Text {
    let marker = "\"" # key # "\":\"";
    let parts = json.split(#text(marker)).toArray();
    if (parts.size() < 2) return null;
    let afterKey = parts[1];
    let valueParts = afterKey.split(#text("\"")).toArray();
    if (valueParts.size() < 1) return null;
    ?valueParts[0]
  };

  // Extract a number field value from JSON: "key":123
  // Extract a number field value from JSON: "key":123
  func jsonExtractNumberField(json : Text, key : Text) : ?Text {
    let marker = "\"" # key # "\":";
    let parts = json.split(#text(marker)).toArray();
    if (parts.size() < 2) return null;
    let afterKey = parts[1];
    var digits = "";
    label digitScan for (c in afterKey.chars()) {
      if (c >= '0' and c <= '9') {
        digits := digits # Text.fromChar(c);
      } else {
        break digitScan;
      };
    };
    if (digits.size() == 0) return null;
    ?digits
  };

  // Helper: extract a value from the Tingee webhook additionalData array.
  // additionalData JSON form: "additionalData":[{"name":"orderCode","value":"BBH000001"}]
  // Returns the value of the element whose name==key, or null if additionalData
  // is absent, empty, or no element matches the key.
  func jsonExtractAdditionalData(bodyText : Text, key : Text) : ?Text {
    // Locate the "additionalData":[ ... ] array body.
    let arrayMarker = "\"additionalData\":[";
    let parts = bodyText.split(#text(arrayMarker)).toArray();
    if (parts.size() < 2) return null;
    let afterArray = parts[1];
    // Find the closing ] of the array
    let closeParts = afterArray.split(#text("]")).toArray();
    if (closeParts.size() < 1) return null;
    let arrayBody = closeParts[0];
    // Split into object chunks by "}". Each object looks like {"name":"...","value":"..."}
    let objChunks = arrayBody.split(#text("}")).toArray();
    for (chunk in objChunks.vals()) {
      // Each chunk should contain "name":"<key>" and "value":"<value>"
      let nameMarker = "\"" # key # "\"";
      if (chunk.contains(#text(nameMarker))) {
        // Extract the value field from this chunk
        switch (jsonExtractTextField(chunk, "value")) {
          case (?v) {
            if (v.size() > 0) return ?v;
          };
          case null {};
        };
      };
    };
    null;
  };

  // Helper: calculate order total from items (price × quantity)
  func calcOrderTotal(items : [OrderTypes.OrderItem]) : Nat {
    var total = 0;
    for (item in items.vals()) {
      total += item.price * item.quantity;
    };
    total;
  };

  // ── Tingee body canonicalization ──────────────────────────────────────────
  // Per Tingee spec, the HMAC message is `ts + ":" + JSON.stringify(body)` where
  // `body` is the parsed JSON re-serialized in Tingee's fixed key order:
  //   clientId, transactionCode, amount, content, bank, accountNumber,
  //   vaAccountNumber, transactionDate, additionalData
  // The backend has no JSON library, so we extract each field with the existing
  // helpers and rebuild a compact JSON string by hand. `additionalData` is an
  // array of objects — we extract its raw array body (between the outer `[` and
  // `]`) and re-emit it verbatim, since its element shape is already fixed by
  // Tingee.
  //
  // Fallback: if any of the mandatory scalar fields cannot be extracted, we
  // return the raw `bodyText` unchanged to preserve the previous behavior
  // (backward compatibility — old webhooks still verify against the raw body).
  func jsonEscape(s : Text) : Text {
    // Minimal JSON string escaping for the fields we re-serialize.
    let quote = Char.fromNat32(0x22); // "
    let backslash = Char.fromNat32(0x5C); // \
    var out = "";
    for (c in s.chars()) {
      switch (c) {
        case (quote) out := out # "\\\"";
        case (backslash) out := out # "\\\\";
        case ('\n') out := out # "\\n";
        case ('\r') out := out # "\\r";
        case ('\t') out := out # "\\t";
        case (_) out := out # c.toText();
      };
    };
    out;
  };

  // Extract the raw text of a field value (string, number, array, or object)
  // following `"key":` in `json`. For strings, returns the inner text without
  // quotes. For numbers, returns the digit run. For arrays/objects, returns the
  // raw text between the opening and matching closing bracket (best-effort,
  // no nested-bracket tracking — Tingee's additionalData is a flat array of
  // flat objects, so a single-level scan suffices).
  func jsonExtractRaw(json : Text, key : Text) : ?Text {
    let marker = "\"" # key # "\":";
    let parts = json.split(#text(marker)).toArray();
    if (parts.size() < 2) return null;
    let after = parts[1];
    // Skip leading whitespace to determine the value's first character.
    let chars = after.chars();
    var firstChar : ?Char = null;
    label findFirst for (c in chars) {
      if (c == ' ' or c == '\t' or c == '\n' or c == '\r') {
        // skip
      } else {
        firstChar := ?c;
        break findFirst;
      };
    };
    switch (firstChar) {
      case null null;
      case (?fc) {
        let quote = Char.fromNat32(0x22); // "
        if (fc == quote) {
          // String — extract until the next unescaped quote
          switch (jsonExtractTextField(json, key)) {
            case (?v) ?v;
            case null null;
          };
        } else if (fc == '[') {
          // Array — return raw text between [ and the first ]
          let arrMarker = "\"" # key # "\":[";
          let arrParts = json.split(#text(arrMarker)).toArray();
          if (arrParts.size() < 2) return null;
          let afterArr = arrParts[1];
          let closeParts = afterArr.split(#text("]")).toArray();
          if (closeParts.size() < 1) return null;
          ?("[" # closeParts[0] # "]");
        } else if (fc == '{') {
          // Object — best-effort: return text between { and the first }
          let objMarker = "\"" # key # "\":{";
          let objParts = json.split(#text(objMarker)).toArray();
          if (objParts.size() < 2) return null;
          let afterObj = objParts[1];
          let closeParts = afterObj.split(#text("}")).toArray();
          if (closeParts.size() < 1) return null;
          ?("{" # closeParts[0] # "}");
        } else {
          // Number (or literal true/false/null) — digit run
          switch (jsonExtractNumberField(json, key)) {
            case (?v) ?v;
            case null null;
          };
        };
      };
    };
  };

  // Receive Tingee webhook — verifies HMAC-SHA512 signature then confirms payment.
  // Tingee JSON payload: { clientId, transactionCode, amount, content, bank, accountNumber, vaAccountNumber, transactionDate }
  // content field contains the bank transfer description with embedded order code "DH{orderId}" or "DH-{orderId}"
  // Amount validation: only confirms payment when webhook amount >= order total
  // Signature formula: HMAC_SHA512(requestTimestamp + ":" + body, secretToken)
  // Receive Tingee webhook — verifies HMAC-SHA512 signature then confirms payment.
  // Tingee JSON payload: { clientId, transactionCode, amount, content, bank, accountNumber, vaAccountNumber, transactionDate }
  // content field contains the bank transfer description with embedded order code "DH{orderId}" or "DH-{orderId}"
  // Amount validation: only confirms payment when webhook amount >= order total
  //
  // HMAC formula (per official Tingee docs):
  //   hash = HMAC_SHA512(x-request-timestamp + ":" + responseBody, secretToken)
  // where responseBody is the JSON we intend to return (e.g. {"code":"00","message":"Success"})
  // The signature is computed over the RESPONSE body, NOT the request body.
  //
  // Response codes (Tingee spec):
  //   "00" — success
  //   "02" — already processed (duplicate)
  //   "09" — invalid signature
  //   other — error
  public shared func receiveTingeeWebhook(body : Blob, headers : [(Text, Text)]) : async Text {
    let bodyText = switch (body.decodeUtf8()) {
      case null return "{\"code\":\"99\",\"message\":\"invalid utf-8\"}";
      case (?t) t;
    };

    // --- Parse JSON fields ---
    // content is parsed for audit only — it MUST NOT be used as a match source,
    // and it MUST NOT be logged (PII: payment note/description may include
    // customer or order details). Kept as an explicit ignore to document intent.
    let contentField = jsonExtractTextField(bodyText, "content");
    ignore contentField;
    let amountField  = jsonExtractNumberField(bodyText, "amount");
    let txCodeField  = jsonExtractTextField(bodyText, "transactionCode");

    // MANDATORY match: derive orderCode from additionalData element where name=="orderCode".
    // No content fallback, no raw body scan. Reject with code "01" if absent/empty/unparseable.
    let orderCode : ?Text = jsonExtractAdditionalData(bodyText, "orderCode");

    // Parse webhook amount (VND, integer)
    let webhookAmount : ?Nat = switch (amountField) {
      case (?amtText) Nat.fromText(amtText);
      case null null;
    };

    let txCode = switch (txCodeField) {
      case (?t) t;
      case null "(none)";
    };
    Debug.print("[Tingee webhook] transactionCode=" # txCode # " amount=" # debug_show(webhookAmount) # " orderCode=" # debug_show(orderCode));

    // --- Helper: verify HMAC-SHA512 signature ---
    // Formula: HMAC_SHA512(timestamp + ":" + responseBody, secretToken)
    // secretToken is looked up from the restaurant associated with the order.
    // If no secret is configured, skip verification (backward compatible).
    let xSignature = getHeader(headers, "x-signature");
    let xTimestamp = getHeader(headers, "x-request-timestamp");

    // Inner helper to verify the signature per official Tingee spec:
    //   HMAC-SHA512(secretToken, x-request-timestamp + ":" + JSON.stringify(body))
    // The message uses the RAW request body bytes Tingee sent, NOT a re-serialized
    // canonical form. Tingee signs JSON.stringify(body) on its side according to
    // the insertion order Tingee parses; if we re-serialize with a hard-coded key
    // order that differs from what Tingee sent, the canonical body would not
    // equal JSON.stringify(body) Tingee signed → HMAC mismatch → reject a valid
    // webhook. Verifying the raw bytes is safer: an attacker sending malformed
    // JSON cannot forge a valid signature, so the HMAC still rejects it.
    // Returns false if verification fails — the caller must reject.
    func verifySignature(rawBody : Blob, secretToken : Text, sig : Text, ts : Text) : Bool {
      let keyBlob = secretToken.encodeUtf8();
      // message = (ts # ":") encoded as UTF-8 bytes, concatenated with raw body bytes.
      let prefixBlob = (ts # ":").encodeUtf8();
      let msgBlob = Blob.fromArray(Blob.toArray(prefixBlob).concat(Blob.toArray(rawBody)));
      let computedSig = Hmac.toHex(Hmac.hmacSha512(keyBlob, msgBlob));
      constantTimeEqual(computedSig, sig.toLower())
    };

    // --- Fix 5: Authenticate BEFORE any order lookup or idempotency check ---
    // An unauthenticated request must not trigger order lookups or be
    // deduplicated against real orders. The sequence is now:
    //   (1) clientId validation                     [here]
    //   (2) HMAC signature verification              [here]
    //   (3) order lookup via getOrderByOrderCode    [below]
    //   (4) idempotency check                        [below]
    //   (5) amount validation                        [below]
    //   (6) side effects + confirmPaymentByTingee   [below]
    //
    // Replay protection: there is NO timestamp/replay window check. Replay
    // attacks are blocked by (a) HMAC signature verification (an attacker
    // cannot forge a valid signature for a modified body) and (b) per-order
    // idempotency via the #TingeePaid flag (a replayed webhook for an already
    // paid order returns code "02" — idempotent ack). x-request-timestamp is
    // still required as an input to the HMAC message.

    // --- (1) clientId validation ---
    // Secret Token is stored at BUSINESS level (BusinessProfile), so clientId
    // must also be validated against the business profile for consistency.
    let payloadClientId = jsonExtractTextField(bodyText, "clientId");
    switch (payloadClientId) {
      case (?pid) {
        switch (BusinessProfileLib.getTingeeClientId(bpState)) {
          case (?configuredId) {
            if (configuredId.size() > 0 and pid != configuredId) {
              Debug.print("[Tingee webhook] CLIENT ID MISMATCH expected=" # configuredId # " got=" # pid);
              return "{\"code\":\"09\",\"message\":\"Invalid signature\"}";
            };
          };
          case null {}; // no clientId configured — skip check
        };
      };
      case null {}; // no clientId in payload — skip check
    };

    // --- (2) HMAC-SHA512 verification over REQUEST body ---
    // Secret Token is stored at business level (BusinessProfile), not per-restaurant.
    // Formula: HMAC_SHA512(secretToken, x-request-timestamp + ":" + rawRequestBody)
    // The raw request body Blob is passed directly — no re-serialization.
    let secretToken : ?Text = BusinessProfileLib.getTingeeSecretToken(bpState);
    switch (secretToken) {
      case (?token) {
        if (token.size() > 0) {
          switch (xSignature, xTimestamp) {
            case (?sig, ?ts) {
              if (not verifySignature(body, token, sig, ts)) {
                Debug.print("[Tingee webhook] INVALID SIGNATURE (pre-lookup)");
                return "{\"code\":\"09\",\"message\":\"Invalid signature\"}";
              };
            };
            case _ {
              // Missing headers when secret is configured — reject
              Debug.print("[Tingee webhook] MISSING SIGNATURE HEADERS (pre-lookup)");
              return "{\"code\":\"09\",\"message\":\"Invalid signature\"}";
            };
          };
        };
      };
      case null {}; // no secret configured — skip verification
    };

    // --- (3) order lookup ---
    // Backward-compat: try orderCode first (from additionalData), then fall
    // back to billId (from additionalData) when orderCode is absent or does
    // not match any order. The billId fallback resolves orders that were
    // paid via a Tingee dynamic QR (the billId is stored on the
    // DynamicQRRecord and mapped back to the underlying Order).
    let billId : ?Text = jsonExtractAdditionalData(bodyText, "billId");
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));

    // Resolve the order: orderCode first, billId second.
    let resolvedOrder : ?OrderLib.Order = switch (orderCode) {
      case null {
        // No orderCode — try billId fallback.
        switch (billId) {
          case null null;
          case (?bid) DynamicQRLib.getOrderByBillId(dynamicQRStore, orders, bid);
        };
      };
      case (?code) {
        switch (manager.getOrderByOrderCode(code)) {
          case (?order) ?order; // orderCode matched — use it (existing behavior)
          case null {
            // orderCode present but no match — try billId fallback.
            switch (billId) {
              case null null;
              case (?bid) DynamicQRLib.getOrderByBillId(dynamicQRStore, orders, bid);
            };
          };
        };
      };
    };

    switch (resolvedOrder) {
      case null {
        // Neither orderCode nor billId resolved an order.
        if (orderCode == null and billId == null) {
          "{\"code\":\"01\",\"message\":\"no order id found\"}";
        } else {
          "{\"code\":\"03\",\"message\":\"order not found\"}";
        };
      };
      case (?order) {
        let oid = order.id;
            // --- (4) idempotency check ---
            // Already processed? (#TingeePaid means already confirmed)
            if (order.paymentInfo.paymentStatus == #TingeePaid) {
              // Signature was already verified above (step 3), so this ack is
              // safe to return without re-verifying.
              "{\"code\":\"02\",\"message\":\"Already processed\"}";
            } else {

            // Check app selection
            if (not isAutoConfirmEnabled(order.restaurantId, #Tingee)) {
              return "{\"code\":\"04\",\"message\":\"app not configured\"}";
            };

            // --- (5) amount validation ---
            let orderTotal = calcOrderTotal(order.items);
            // Do NOT leak order amounts to an unauthenticated or partially-authenticated
            // caller — the response contains only the code and a generic message.
            let insufficientBody = "{\"code\":\"10\",\"message\":\"Amount mismatch\"}";
            let successBody = "{\"code\":\"00\",\"message\":\"Success\"}";

            // amount is MANDATORY — reject if missing
            switch (webhookAmount) {
              case (?amt) {
                if (amt < orderTotal) {
                  Debug.print("[Tingee webhook] INSUFFICIENT AMOUNT orderId=" # debug_show(oid) # " expected=" # debug_show(orderTotal) # " received=" # debug_show(amt));
                  return insufficientBody;
                };
              };
              case null {
                // amount missing — return insufficient; never confirm without amount
                Debug.print("[Tingee webhook] MISSING AMOUNT FIELD (final check) for orderId=" # debug_show(oid));
                return insufficientBody;
              };
            };

            // --- (6) side effects FIRST, confirmPaymentByTingee LAST ---
            // Rationale: if confirmPaymentByTingee ran first and a side effect
            // failed, the order would be marked paid but the delivery never
            // booked — an inconsistent state. By running side effects first and
            // confirming last, a side-effect failure leaves the order
            // unconfirmed (retryable) rather than falsely paid.
            // Store transactionCode for audit trail.
            let txCodeToStore : ?Text = switch (txCodeField) {
              case (?t) if (t == "(none)") null else ?t;
              case null null;
            };
            // Fetch order for side effects. Do NOT confirm payment yet.
            // COD delivery orders: driver has paid at kiosk → kitchen starts (#Preparing),
            // then book AhaMove shipper (driver is physically present).
            // Regular delivery orders: transition #Pending → #FindingDriver and book AhaMove shipper.
            switch (manager.getOrderInternal(oid)) {
              case null {};
              case (?confirmedOrder) {
                if (confirmedOrder.isCod and confirmedOrder.orderType == #DeliveryOrder) {
                  // ── COD delivery: 2-step transition so #Preparing is observable ──
                  // Step 1: driver paid at kiosk → kitchen starts. #Preparing is committed
                  //         to stable state by the await on issueBkavInvoice below, so it
                  //         becomes observable via getOrder/getOrderStatus before Step 2.
                  confirmedOrder.status := #Preparing;
                  confirmedOrder.findingDriverSince := null;
                  // Issue BKAV invoice (food total only). The await commits #Preparing.
                  await issueBkavInvoice(confirmedOrder);
                  // Step 2: book AhaMove shipper — driver is physically present at the kiosk.
                  // Guard against races: only advance to #FindingDriver if the order is
                  // still #Preparing (a competing webhook may have already moved it).
                  let shipResult = await bookAhamoveShipper((confirmedOrder.id).toText());
                  if (confirmedOrder.status == #Preparing) {
                    switch (shipResult) {
                      case (#ok(info)) {
                        confirmedOrder.status := #FindingDriver;
                        confirmedOrder.findingDriverSince := ?Time.now();
                        confirmedOrder.ahamoveOrderId := ?info.ahamoveOrderId;
                      };
                      case (#err(msg)) {
                        confirmedOrder.status := #DispatchCenter;
                        confirmedOrder.findingDriverSince := null;
                        confirmedOrder.dispatchNote := ?("[AhaMove booking failed] " # msg);
                      };
                    };
                  };
                } else {
                  // Regular (non-COD) flow
                  // Issue invoice for all orders — non-fatal: never blocks payment confirmation.
                  // The await commits #Pending (set at order placement) to stable state so
                  // it becomes observable before the #FindingDriver transition below.
                  await issueBkavInvoice(confirmedOrder);
                  // For regular (non-COD) delivery orders, transition to #FindingDriver and book shipper.
                  if (confirmedOrder.orderType == #DeliveryOrder and confirmedOrder.status == #Pending) {
                    confirmedOrder.status := #FindingDriver;
                    confirmedOrder.findingDriverSince := ?Time.now();
                    // Book AhaMove shipper — guard against races: only advance if still #FindingDriver.
                    let shipResult = await bookAhamoveShipper((confirmedOrder.id).toText());
                    if (confirmedOrder.status == #FindingDriver) {
                      switch (shipResult) {
                        case (#ok(info)) {
                          confirmedOrder.ahamoveOrderId := ?info.ahamoveOrderId;
                        };
                        case (#err(msg)) {
                          confirmedOrder.status := #DispatchCenter;
                          confirmedOrder.findingDriverSince := null;
                          confirmedOrder.dispatchNote := ?("[AhaMove booking failed] " # msg);
                        };
                      };
                    };
                  };
                };
              };
            };
            // Side effects completed — NOW confirm payment as the final step.
            // If any side effect above trapped, this line is never reached and
            // the order stays un-#TingeePaid, allowing a retry webhook to re-run.
            // totalAmountPaid = null: the webhook path already validated amount
            // above (step 5), so no re-validation is needed inside confirmPaymentByTingee.
            ignore manager.confirmPaymentByTingee(oid, txCodeToStore, null);
            successBody;
            };
      };
    };
  };

  // ── Tingee get-status fallback confirm path ─────────────────────────────────
  // Called by the frontend poller (every 5s) when Tingee get-status-dynamic-qr
  // reports the QR as fully paid but the webhook has NOT fired (or was missed).
  // This is the FALLBACK confirmation path — the webhook (receiveTingeeWebhook)
  // remains the PRIMARY path and is unchanged.
  //
  // Idempotency: if the order is already #TingeePaid (webhook won the race),
  // returns #ok(true) silently without re-confirming or re-running side effects.
  // This prevents double side-effects (BKAV invoice + AhaMove booking) when both
  // the webhook and the get-status fallback fire for the same order.
  //
  // Amount validation: totalAmountPaid (from get-status data.billInfo.totalAmountPaid)
  // MUST be >= order total (calcOrderTotal). If less, the order is NOT confirmed —
  // returns #err(#AmountMismatch) and the order stays in #TingeePending. This
  // blocks partial-payment and wrong-denomination confirmation.
  //
  // Side-effect ordering: BKAV invoice + AhaMove booking run BEFORE setting
  // #TingeePaid, identical to the webhook path. A side-effect failure leaves the
  // order un-#TingeePaid (retryable) rather than falsely paid.
  //
  // SECURED: requires authenticated enterprise staff. Without this guard anyone
  // could call this with an arbitrary amount to mark any order as paid.
  public shared ({ caller }) func confirmPaymentByTingeeStatus(
    orderId          : CommonTypes.OrderId,
    totalAmountPaid  : Nat,
    transactionCode  : ?Text,
  ) : async { #ok : Bool; #err : { #NotFound; #Unauthorized; #AmountMismatch; #AlreadyPaid; #NotTingeePending } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    switch (manager.getOrderInternal(orderId)) {
      case null return #err(#NotFound);
      case (?order) {
        // Idempotency: already paid via webhook → silent ack, no double side-effect.
        if (order.paymentInfo.paymentStatus == #TingeePaid) {
          return #ok(true);
        };
        // Only confirm orders that are currently #TingeePending (QR was generated,
        // payment was awaited). Reject orders in any other payment state to avoid
        // confirming COD / Stripe / cashier-confirmed orders through this path.
        if (order.paymentInfo.paymentStatus != #TingeePending) {
          return #err(#NotTingeePending);
        };
        // Amount validation: paid amount must cover the order total.
        let orderTotal = calcOrderTotal(order.items);
        if (totalAmountPaid < orderTotal) {
          Debug.print("[confirmPaymentByTingeeStatus] INSUFFICIENT AMOUNT orderId=" # debug_show(orderId) # " expected=" # debug_show(orderTotal) # " paid=" # debug_show(totalAmountPaid));
          return #err(#AmountMismatch);
        };
        // ── Side effects FIRST, confirmPaymentByTingee LAST ──
        // Same ordering as the webhook path: if a side effect traps, the order
        // stays un-#TingeePaid and a retry (next poll or webhook) can re-run.
        // COD delivery orders: driver paid at kiosk → kitchen starts (#Preparing),
        // then book AhaMove shipper. Regular delivery: #Pending → #FindingDriver.
        if (order.isCod and order.orderType == #DeliveryOrder) {
          order.status := #Preparing;
          order.findingDriverSince := null;
          await issueBkavInvoice(order);
          let shipResult = await bookAhamoveShipper((order.id).toText());
          if (order.status == #Preparing) {
            switch (shipResult) {
              case (#ok(info)) {
                order.status := #FindingDriver;
                order.findingDriverSince := ?Time.now();
                order.ahamoveOrderId := ?info.ahamoveOrderId;
              };
              case (#err(msg)) {
                order.status := #DispatchCenter;
                order.findingDriverSince := null;
                order.dispatchNote := ?("[AhaMove booking failed] " # msg);
              };
            };
          };
        } else {
          await issueBkavInvoice(order);
          if (order.orderType == #DeliveryOrder and order.status == #Pending) {
            order.status := #FindingDriver;
            order.findingDriverSince := ?Time.now();
            let shipResult = await bookAhamoveShipper((order.id).toText());
            if (order.status == #FindingDriver) {
              switch (shipResult) {
                case (#ok(info)) {
                  order.ahamoveOrderId := ?info.ahamoveOrderId;
                };
                case (#err(msg)) {
                  order.status := #DispatchCenter;
                  order.findingDriverSince := null;
                  order.dispatchNote := ?("[AhaMove booking failed] " # msg);
                };
              };
            };
          };
        };
        // Side effects completed — NOW confirm payment as the final step.
        // totalAmountPaid is passed through so confirmPaymentByTingee re-validates
        // the amount (defense in depth). If it returns #err(#AmountMismatch) the
        // order stays un-#TingeePaid despite the side effects above having run —
        // this is acceptable because the side effects are idempotent on retry
        // (BKAV invoice is keyed by orderId; AhaMove booking is guarded by the
        // status == #Preparing / #FindingDriver race check).
        switch (manager.confirmPaymentByTingee(orderId, transactionCode, ?totalAmountPaid)) {
          case (#ok(_)) #ok(true);
          case (#err(#NotFound)) #err(#NotFound);
          case (#err(#AmountMismatch)) #err(#AmountMismatch);
        };
      };
    };
  };

  // ── Tingee QR expired transition ────────────────────────────────────────────
  // Called by the frontend poller when Tingee get-status-dynamic-qr reports the
  // QR as EXPIRED and the order has NOT been paid. Transitions the order's
  // paymentStatus from #TingeePending → #TingeeExpired so the frontend can show
  // the expired state and offer a "regenerate QR" action (new createPaymentIntent
  // call with #TingeeQR).
  //
  // Idempotent: no-op (returns #ok(false)) if the order is not in #TingeePending
  // (already paid, already expired, or never had a Tingee QR). Does NOT cancel
  // the order — the order stays in #PaymentPending status so a new QR can be
  // generated for the same order.
  //
  // SECURED: requires authenticated enterprise staff. The frontend poller runs
  // as an authenticated staff session.
  public shared ({ caller }) func markTingeeExpired(
    orderId : CommonTypes.OrderId,
  ) : async { #ok : Bool; #err : { #NotFound; #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    switch (manager.markTingeeExpired(orderId)) {
      case (#ok(transitioned)) #ok(transitioned);
      case (#err(#NotFound)) #err(#NotFound);
    };
  };

  // Get invoice status information for an order — used by frontend to show invoice progress.
  // SECURED: requires authenticated enterprise staff. Customers must use
  // getOrderForTracking(orderId) (which includes invoiceStatus / invoiceNo / etc. in the tracking view).
  public shared ({ caller }) func getInvoiceInfo(
    orderId : CommonTypes.OrderId
  ) : async { #ok : ?{ invoiceStatus : Text; invoiceNo : ?Text; invoiceDate : ?Text; maCQT : ?Text; errorMessage : ?Text }; #err : { #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    let manager = OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState));
    switch (manager.getOrderInternal(orderId)) {
      case null #ok(null);
      case (?order) {
        #ok(?{
          invoiceStatus = switch (order.invoiceStatus) {
            case (#NotRequested) "NotRequested";
            case (#Pending)      "Pending";
            case (#Issued)       "Issued";
            case (#Error)        "Error";
          };
          invoiceNo    = order.invoiceNo;
          invoiceDate  = order.invoiceDate;
          maCQT        = order.maCQT;
          errorMessage = order.invoiceError;
        });
      };
    };
  };

  // Return the ready-to-use Tingee webhook URL for this canister, derived
  // dynamically from the canister's own principal so it is correct in every
  // environment (draft, live, etc.). Principal.fromActor requires an async
  // context, so this is an update (shared) function rather than a query, and
  // the canister principal is obtained via the getCanisterPrincipal callback
  // supplied by the composition root (main.mo).
  public shared func getWebhookEndpointInfo() : async Text {
    let canisterId = await getCanisterPrincipal();
    "https://" # canisterId.toText() # ".raw.icp0.io/receiveTingeeWebhook";
  };

  // Poll payment + cashier-confirmation status.
  // SECURED: requires authenticated enterprise staff. Customers must use
  // getOrderForTracking(orderId) (which includes paymentStatus in the tracking view).
  public shared ({ caller }) func getOrderPaymentStatus(
    orderId : CommonTypes.OrderId
  ) : async ?{ paymentStatus : PaymentTypes.PaymentStatus; paymentConfirmedAt : ?CommonTypes.Timestamp } {
    if (not ordersIsEnterpriseStaff(caller)) return null;
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).getOrderPaymentStatus(orderId);
  };

  // Cancel an order — staff initiated via caller auth.
  // Only allowed when order is in PaymentPending state.
  public shared ({ caller }) func cancelOrder(
    orderId : CommonTypes.OrderId,
  ) : async { #ok; #err : { #NotFound; #WrongStatus; #Unauthorized } } {
    if (not ordersIsEnterpriseStaff(caller)) return #err(#Unauthorized);
    OrderLib.OrderManager(orders, orderState, BusinessProfileLib.getDefaultOrderPrefix(bpState), BusinessProfileLib.getTingeeOrderPrefix(bpState)).cancelOrder(orderId);
  };

  // ── COD pending payments ────────────────────────────────────────────────────

  /// Returns orderCodes for COD orders with paymentStatus = #WaitingDriverPayment.
  /// The VPS worker / kiosk polls this to know which COD QR codes to display.
  /// Enterprise-staff only — exposes orderCode + orderTotal + shippingFee.
  public shared query ({ caller }) func getPendingCodPayments() : async ?[{ orderCode : Text; orderTotal : Nat; shippingFee : Nat }] {
    if (not ordersIsEnterpriseStaff(caller)) return null;
    ?orders.values()
      .filter(func(o : OrderLib.Order) : Bool {
        o.isCod and o.paymentInfo.paymentStatus == #WaitingDriverPayment and
        OrderLib.isToday(o.createdAt)
      })
      .map(func(o) {
        let code = switch (o.orderCode) { case (?c) c; case null "" };
        var total : Nat = 0;
        for (item in o.items.vals()) { total += item.price * item.quantity };
        let fee = switch (o.shippingFee) { case (?f) f; case null 0 };
        { orderCode = code; orderTotal = total; shippingFee = fee };
      })
      .filter(func(r : { orderCode : Text; orderTotal : Nat; shippingFee : Nat }) : Bool {
        r.orderCode.size() > 0
      })
      .toArray();
  };

  // 30 seconds in nanoseconds
  transient let FINDING_DRIVER_TIMEOUT_NS : Int = 30_000_000_000;

  /// Called by the VPS worker on each poll cycle to auto-expire FindingDriver orders
  /// that have not received a shipper acceptance webhook within 30 seconds.
  /// Moves timed-out orders to #DispatchCenter for manual staff handling.
  /// Enterprise-staff only — triggers order status mutations.
  public shared ({ caller }) func checkFindingDriverTimeout() : async { #ok : Nat; #err : Text } {
    if (not ordersIsEnterpriseStaff(caller)) return #err("Unauthorized");
    var transitioned = 0;
    let now = Time.now();
    orders.values().forEach(func(order : OrderLib.Order) {
      if (order.status == #FindingDriver) {
        switch (order.findingDriverSince) {
          case (?since) {
            if (now - since >= FINDING_DRIVER_TIMEOUT_NS) {
              order.status := #DispatchCenter;
              order.findingDriverSince := null;
              order.dispatchNote := ?("[Timeout] No driver accepted within 30s — moved to dispatch center");
              transitioned += 1;
            };
          };
          case null {
            // findingDriverSince not set — set it now so timeout counts from here
            order.findingDriverSince := ?now;
          };
        };
      };
    });
    #ok(transitioned);
  };
};
