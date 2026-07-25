// BKAV eHoadon integration mixin — worker-based invoice issuance
// IC canister only marks orders as #Pending; VPS FPT worker polls getPendingInvoices()
// and calls BKAV directly, then posts results back via /invoice-callback (HMAC-SHA256).
import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Debug "mo:core/Debug";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import BusinessProfileLib "../lib/business-profile";
import HmacLib "../lib/hmac";
import CommonTypes "../types/common";
import OrderTypes "../types/order";
import Blob "mo:core/Blob";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Bool "mo:core/Bool";

mixin (
  orders           : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState       : { var nextOrderId : OrderLib.OrderId },
  bpState          : BusinessProfileLib.State,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getOwner         : () -> Principal,
) {

  // ── Auth helpers ────────────────────────────────────────────────────────────
  // Replicates the auth pattern from enterprise-delivery-api.mo / cod-api.mo:
  // owner OR any principal in enterpriseStaffPermissions with #EnterpriseDelivery.
  // Named invoiceIsEnterpriseStaff / invoiceIsOwner to avoid duplicate-definition
  // conflicts with the same helpers in sibling mixins included in the same actor.

  func invoiceIsOwner(caller : Principal) : Bool {
    caller == getOwner();
  };

  func invoiceIsEnterpriseStaff(caller : Principal) : Bool {
    if (invoiceIsOwner(caller)) return true;
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Escape XML special characters
  func xmlEscape(s : Text) : Text {
    var out = "";
    for (c in s.chars()) {
      if      (c == '&')  { out := out # "&amp;"  }
      else if (c == '<')  { out := out # "&lt;"   }
      else if (c == '>')  { out := out # "&gt;"   }
      else if (c == '\"') { out := out # "&quot;" }
      else if (c == '\'') { out := out # "&apos;" }
      else                { out := out # Text.fromChar(c) };
    };
    out;
  };

  // Format current time as dd/MM/yyyy for BKAV InvoiceDate field
  func formatTimestampDdMmYyyy(timestamp : Int) : Text {
    let nowSec : Int = timestamp / 1_000_000_000;
    let days   : Int = nowSec / 86400;
    var z = days + 719468;
    let era : Int = if (z >= 0) z / 146097 else (z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  : Int = (5 * doy + 2) / 153;
    let d   : Int = doy - (153 * mp + 2) / 5 + 1;
    let m   : Int = if (mp < 10) mp + 3 else mp - 9;
    let finalY : Int = if (m <= 2) y + 1 else y;
    let dText = if (d < 10) "0" # d.toText() else d.toText();
    let mText = if (m < 10) "0" # m.toText() else m.toText();
    dText # "/" # mText # "/" # finalY.toText();
  };

  // Extract a text value from XML: <TagName>value</TagName>
  func xmlExtract(xml : Text, tag : Text) : ?Text {
    // Trim leading/trailing whitespace from a text value
    func trimWs(s : Text) : Text {
      // Remove leading and trailing whitespace by scanning chars
      // No trimStart/trim(#predicate) — those don't exist in Motoko base 0.16.0
      var chars = s.chars();
      var leading = true;
      var result = "";
      var trailingWs = "";
      for (c in chars) {
        if (leading) {
          if (c == ' ' or c == '\t' or c == '\n' or c == '\r') {
            // skip leading whitespace
          } else {
            leading := false;
            result := Text.fromChar(c);
            trailingWs := "";
          };
        } else {
          if (c == ' ' or c == '\t' or c == '\n' or c == '\r') {
            trailingWs := trailingWs # Text.fromChar(c);
          } else {
            result := result # trailingWs # Text.fromChar(c);
            trailingWs := "";
          };
        };
      };
      result
    };
    // Try extracting with a specific tag string (exact)
    func tryExact(t : Text) : ?Text {
      let open  = "<" # t # ">";
      let close = "</" # t # ">";
      let parts = xml.split(#text open) |> _.toArray();
      if (parts.size() < 2) return null;
      let rest  = parts[1];
      let inner = rest.split(#text close) |> _.toArray();
      if (inner.size() < 1) return null;
      let trimmed = trimWs(inner[0]);
      if (trimmed.size() == 0) return null;
      ?trimmed;
    };
    // Try bare tag (exact), then lowercase variant
    switch (tryExact(tag)) {
      case (?v) { return ?v };
      case null {};
    };
    // Lowercase fallback for case-insensitive matching
    let lowerTag = tag.toLower();
    if (lowerTag != tag) {
      switch (tryExact(lowerTag)) {
        case (?v) { return ?v };
        case null {};
      };
    };
    // Try with namespace prefixes
    let prefixes = ["ns:", "ns0:", "ns1:", "ns2:", "m:"];
    for (prefix in prefixes.vals()) {
      switch (tryExact(prefix # tag)) {
        case (?v) { return ?v };
        case null {};
      };
      switch (tryExact(prefix # lowerTag)) {
        case (?v) { return ?v };
        case null {};
      };
    };
    null;
  };

  // Build a single <Product> XML element for one order item
  // Prices are VAT-inclusive — reverse-calculate per line
  func buildProductXml(name : Text, unit : Text, qty : Nat, sellingPrice : Nat, vatRate : Nat) : Text {
    let lineTotal     : Nat = sellingPrice * qty;                          // total with VAT
    let lineBefore    : Nat = Nat.div(lineTotal * 100, 100 + vatRate);    // total before VAT
    let lineVat       : Nat = lineTotal - lineBefore;                     // VAT portion
    let unitBefore    : Nat = Nat.div(sellingPrice * 100, 100 + vatRate); // unit price before VAT
    let discount      : Nat = 0;                                          // discount per line (reserved)
    "<Product>" #
      "<ProdName>"     # xmlEscape(name)       # "</ProdName>" #
      "<ProdUnit>"     # xmlEscape(unit)       # "</ProdUnit>" #
      "<ProdQuantity>" # qty.toText()          # "</ProdQuantity>" #
      "<ProdPrice>"    # unitBefore.toText()   # "</ProdPrice>" #
      "<Discount>"     # discount.toText()     # "</Discount>" #
      "<Amount>"       # lineBefore.toText()   # "</Amount>" #
      "<VATRate>"      # vatRate.toText()      # "</VATRate>" #
      "<VATAmount>"    # lineVat.toText()      # "</VATAmount>" #
      "<Total>"        # lineTotal.toText()    # "</Total>" #
    "</Product>";
  };

  // Build the full SOAP envelope for importAndPublishInvoice
  func buildSoapEnvelope(
    username         : Text,
    password         : Text,
    invoiceSerial    : Text,
    invoiceForm      : Text,
    orderId          : Nat,
    invoiceDate      : Text,
    cusPersonName    : Text,  // "Người mua (Buyer Full Name)": empty for B2B, "Bán cho người tiêu dùng..." for retail
    cusCompanyName   : Text,  // "Đơn vị (Company Name)": company name for B2B, empty for retail
    cusTaxCode       : Text,
    cusAddress       : Text,
    cusEmail         : Text,
    cusPhone         : Text,  // buyer phone number for SMS invoice notification
    cusAccountNo     : Text,  // buyer bank account number (Account No.) from Tax Authority API
    sellerTaxCode    : Text,
    sellerPhone      : Text,
    paymentMethod    : Text,
    productsXml      : Text,
    totalBefore      : Nat,
    vatRate          : Nat,
    vatAmount        : Nat,
    grandTotal       : Nat,
  ) : Text {
    let xmlInvData =
      "<Inv>" #
        "<key>" # orderId.toText() # "</key>" #
        "<Invoice>" #
          "<CusCode></CusCode>" #
          "<CusName>"        # xmlEscape(cusPersonName)   # "</CusName>" #
          "<CusCompanyName>" # xmlEscape(cusCompanyName)  # "</CusCompanyName>" #
          "<CusTaxCode>"     # xmlEscape(cusTaxCode)      # "</CusTaxCode>" #
          "<CusAddress>"     # xmlEscape(cusAddress)      # "</CusAddress>" #
          "<CusEmail>"       # xmlEscape(cusEmail)        # "</CusEmail>" #
          "<CusPhone>"       # xmlEscape(cusPhone)        # "</CusPhone>" #
          "<CusAccountNo>"   # xmlEscape(cusAccountNo)    # "</CusAccountNo>" #
          "<SellerTaxCode>"  # xmlEscape(sellerTaxCode)   # "</SellerTaxCode>" #
          "<SellerPhone>"    # xmlEscape(sellerPhone)     # "</SellerPhone>" #
          "<PaymentMethod>"  # xmlEscape(paymentMethod)   # "</PaymentMethod>" #
          "<InvoiceSerial>"  # xmlEscape(invoiceSerial)   # "</InvoiceSerial>" #
          "<InvoiceForm>"    # xmlEscape(invoiceForm)     # "</InvoiceForm>" #
          "<InvoiceDate>"    # xmlEscape(invoiceDate)     # "</InvoiceDate>" #
          "<Products>" # productsXml # "</Products>" #
          "<Total>"     # totalBefore.toText() # "</Total>" #
          "<VATRate>"   # vatRate.toText()     # "</VATRate>" #
          "<VATAmount>" # vatAmount.toText()   # "</VATAmount>" #
          "<Amount>"    # grandTotal.toText()  # "</Amount>" #
          "<Note>"      # xmlEscape("Đơn hàng #" # orderId.toText()) # "</Note>" #
        "</Invoice>" #
      "</Inv>";
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>" #
    "<soapenv:Envelope " #
      "xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" " #
      "xmlns:web=\"http://WebService/\">" #
      "<soapenv:Header/>" #
      "<soapenv:Body>" #
        "<web:importAndPublishInvoice>" #
          "<username>" # xmlEscape(username) # "</username>" #
          "<password>" # xmlEscape(password) # "</password>" #
          "<xmlInvData>" # xmlInvData # "</xmlInvData>" #
        "</web:importAndPublishInvoice>" #
      "</soapenv:Body>" #
    "</soapenv:Envelope>";
  };

  // Truncate text to maxLen characters
  func truncateText(s : Text, maxLen : Nat) : Text {
    if (s.size() <= maxLen) return s;
    var out = "";
    var count = 0;
    for (c in s.chars()) {
      if (count < maxLen) { out := out # Text.fromChar(c); count += 1 };
    };
    out;
  };

  // ── Core invoice issuance ──────────────────────────────────────────────────

  /// Mark an order as #Pending so VPS worker will pick it up and issue the invoice.
  /// Never blocks order confirmation — non-fatal.
  /// Mark an order as #Pending so VPS worker will pick it up and issue the invoice.
  /// invoiceEnabled = false → retail invoice (Bán cho người tiêu dùng, no MST, no company info);
  /// invoiceEnabled = true  → VAT invoice using vatInfo (MST + company details).
  /// Never blocks order confirmation — non-fatal.
  func issueBkavInvoice(order : OrderLib.Order, invoiceEnabled : Bool) : async () {
    // Prevent double-queuing if already issued or pending
    switch (order.invoiceStatus) {
      case (#Issued) {
        Debug.print("[BKAV] Invoice already issued for order " # order.id.toText() # " — skipping");
        return;
      };
      case (#Pending) {
        Debug.print("[BKAV] Invoice already pending for order " # order.id.toText() # " — skipping");
        return;
      };
      case _ {};
    };
    // When invoiceEnabled = false → retail invoice: clear vatInfo so worker issues for Bán cho người tiêu dùng
    if (not invoiceEnabled) {
      order.vatInfo := null;
    };
    order.invoiceStatus := #Pending;
    order.invoiceError  := null;
    Debug.print("[BKAV] Order " # order.id.toText() # " queued for VPS worker invoice issuance (retail=" # Bool.toText(not invoiceEnabled) # ")");
  };

  // ── Worker-facing query endpoints ──────────────────────────────────────────


  public type PendingInvoiceItem = {
    orderId              : CommonTypes.OrderId;
    restaurantId         : CommonTypes.RestaurantId;
    items                : [OrderTypes.OrderItem];
    totalAmount          : Nat;
    createdAt            : Int;
    vatInfo              : ?OrderTypes.VatInfo;
    // buyerName / buyerAddress derived ONLY from vatInfo — never from delivery fields.
    // When isRetailInvoice = true, worker uses buyerName = "Bán cho người tiêu dùng" and empty address/taxCode.
    buyerName            : Text;
    buyerAddress         : Text;
    customerTaxCode      : ?Text;
    customerCompanyName  : ?Text;
    customerCompanyAddress : ?Text;
    isDemo               : Bool;
    // isRetailInvoice = true → issue retail receipt (Bán cho người tiêu dùng), false → issue VAT invoice with company info
    isRetailInvoice      : Bool;
  };

  /// List all orders with invoiceStatus == #Pending.
  /// Query call — free, no cycles cost, safe for frequent polling.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared query ({ caller }) func getPendingInvoices() : async [PendingInvoiceItem] {
    if (not invoiceIsEnterpriseStaff(caller)) return [];
    orders.values()
      .filter(func(o : OrderLib.Order) : Bool {
        o.invoiceStatus == #Pending
      })
      .map(func(o) {
        let (taxCode, companyName, companyAddress) : (Text, Text, Text) = switch (o.vatInfo) {
          case null ("", "", "");
          case (?vi) {
            let tc = switch (vi.taxCode) { case (?t) t; case null "" };
            (tc, vi.buyerName, vi.address);
          };
        };
        // For delivery orders, use order.subtotal (food-only cost, excluding shipping fee) for BKAV invoice.
        // Customer pays shipping fee directly to the driver (COD) — it must NOT appear on the tax invoice.
        // For dine-in orders, subtotal == totalAmount (no shipping fee), so the same logic works.
        var total : Nat = switch (o.subtotal) {
          case (?s) s;
          case null {
            var t : Nat = 0;
            for (item in o.items.vals()) { t += item.price * item.quantity };
            t;
          };
        };
        // buyerName / buyerAddress ONLY from vatInfo — never from delivery customerName/customerAddress
        let (buyerName_, buyerAddr_) : (Text, Text) = switch (o.vatInfo) {
          case null ("", "");
          case (?vi) {
            let tc = switch (vi.taxCode) { case (?t) t; case null "" };
            if (tc.size() == 0) ("", "") else (vi.buyerName, vi.address);
          };
        };
        {
          orderId                = o.id;
          restaurantId           = o.restaurantId;
          items                  = o.items;
          totalAmount            = total;
          createdAt              = o.createdAt;
          vatInfo                = o.vatInfo;
          buyerName              = buyerName_;
          buyerAddress           = buyerAddr_;
          customerTaxCode        = if (taxCode.size() > 0) ?taxCode else null;
          customerCompanyName    = if (companyName.size() > 0) ?companyName else null;
          customerCompanyAddress = if (companyAddress.size() > 0) ?companyAddress else null;
          isDemo                 = false;
          isRetailInvoice        = (o.vatInfo == null);
        }
      })
      .toArray();
  };

  /// SECURED: owner-only OR registered worker — returns BKAV partner credentials and callback secret.
  /// Query call — VPS worker calls this on startup and after each poll cycle.
  ///
  /// Auth model:
  ///   - caller == owner → returns real config
  ///   - caller == registered workerPrincipal (non-null) → returns real config
  ///   - otherwise → returns empty config (no credentials leaked)
  ///
  /// Bkav Sandbox has been removed — useDemo is always false (production only).
  /// Credentials are always selected from realGuid/realToken (production environment).
  ///
  /// NO fallback values are used — if realGuid/realToken is null, empty string "" is returned.
  /// The worker must handle empty credentials by skipping the poll cycle.
  public shared query ({ caller }) func getInvoiceWorkerConfig() : async {
    bkavProdEndpoint       : Text;
    bkavDemoEndpoint       : Text;
    partnerGUID            : Text;
    partnerToken           : Text;
    invoiceSerial          : Text;
    demoInvoiceSerial      : Text;
    prodInvoiceSerial      : Text;
    invoiceForm            : Text;
    vatRate                : Float;
    useDemo                : Bool;
    demoGuid               : Text;
    demoToken              : Text;
    realGuid               : Text;
    realToken              : Text;
    invoiceCallbackSecret  : Text;
    workerPrincipal        : Text;
  } {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    // Auth: owner OR registered worker principal. If workerPrincipal is null,
    // only owner can access. Non-matching callers get empty config.
    let isRegisteredWorker = switch (cfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else {
          try {
            let p = Principal.fromText(wp);
            p == caller;
          } catch _ {
            false;
          };
        };
      };
    };
    if (not (invoiceIsOwner(caller) or isRegisteredWorker)) {
      return {
        bkavProdEndpoint      = "";
        bkavDemoEndpoint      = "";
        partnerGUID            = "";
        partnerToken           = "";
        invoiceSerial          = "";
        demoInvoiceSerial      = "";
        prodInvoiceSerial      = "";
        invoiceForm            = "";
        vatRate                = 0.0;
        useDemo                = false;
        demoGuid               = "";
        demoToken              = "";
        realGuid               = "";
        realToken              = "";
        invoiceCallbackSecret  = "";
        workerPrincipal        = "";
      };
    };
    // Bkav Sandbox removed — always production mode.
    let useDemo = false;
    // Unwrap Optional fields — NO fallback defaults, use "" when null
    let demoGuidVal  = switch (cfg.demoGuid)  { case (?g) if (g.size() >= 5) g else ""; case null "" };
    let demoTokenVal = switch (cfg.demoToken) { case (?t) t; case null "" };
    let realGuidVal  = switch (cfg.realGuid)  { case (?g) if (g.size() >= 5) g else ""; case null "" };
    let realTokenVal = switch (cfg.realToken) { case (?t) t; case null "" };
    // Always use production credentials (Bkav Sandbox removed)
    let partnerGUID  = realGuidVal;
    let partnerToken = realTokenVal;
    let bkavDemoEndpoint = "";
    let bkavProdEndpoint = switch (cfg.realApiUrl) {
      case (?url) if (url.size() > 0) url else BusinessProfileLib.getDefaultRealEndpoint();
      case null BusinessProfileLib.getDefaultRealEndpoint();
    };
    // Resolve the active invoice serial — production only (Bkav Sandbox removed)
    let demoSerial = switch (cfg.bkavDemoInvoiceSerial) {
      case (?s) if (s.size() > 0) s else "C26MAA";
      case null switch (cfg.bkavInvoiceSerial) { case (?s) if (s.size() > 0) s else "C26MAA"; case null "C26MAA" };
    };
    let prodSerial = switch (cfg.bkavProdInvoiceSerial) { case (?s) s; case null "" };
    let activeSerial = prodSerial;
    {
      bkavProdEndpoint;
      bkavDemoEndpoint;
      partnerGUID;
      partnerToken;
      invoiceSerial     = activeSerial;
      demoInvoiceSerial = demoSerial;
      prodInvoiceSerial = prodSerial;
      invoiceForm       = switch (cfg.bkavInvoiceForm) { case (?f) f; case null "" };
      vatRate           = cfg.bkavVatRate.toFloat();
      useDemo;
      demoGuid               = demoGuidVal;
      demoToken              = demoTokenVal;
      realGuid               = realGuidVal;
      realToken              = realTokenVal;
      invoiceCallbackSecret  = BusinessProfileLib.getInvoiceCallbackSecret(bpState).get("");
      workerPrincipal        = switch (cfg.workerPrincipal) { case (?wp) wp; case null "" };
    };
  };



  /// Validate HMAC-SHA256 callback signature from VPS worker.
  /// Header: X-Invoice-Signature: hex(HMAC-SHA256(secret, body))
  /// Worker computes HMAC-SHA256 over the raw request body using the shared
  /// invoiceCallbackSecret and sends the lowercase hex digest in X-Invoice-Signature.
  /// Canister recomputes the expected signature from the received body + stored
  /// secret and compares it in constant time. This binds the body to the signature
  /// so the secret is never transmitted in cleartext and the body cannot be tampered with.
  func validateInvoiceCallbackSignature(body : Blob, headers : [(Text, Text)]) : Bool {
    // Find X-Invoice-Signature header (case-insensitive name match)
    var sigHeader = "";
    for ((name, value) in headers.vals()) {
      if (name.toLower() == "x-invoice-signature") {
        sigHeader := value;
      };
    };
    if (sigHeader.size() == 0) return false;

    // Get stored secret
    let secret = switch (BusinessProfileLib.getInvoiceCallbackSecret(bpState)) {
      case null return false;
      case (?s) if (s.size() == 0) return false else s;
    };

    // Compute expected signature: hex(HMAC-SHA256(secret, body))
    let expectedSig = HmacLib.toHex(HmacLib.hmacSha256(secret.encodeUtf8(), body));

    // Constant-time string comparison: reject if lengths differ first (fast path),
    // then compare character-by-character to avoid short-circuit timing leaks.
    if (expectedSig.size() != sigHeader.size()) return false;
    var match = true;
    let sChars = expectedSig.chars();
    let hChars = sigHeader.chars();
    loop {
      switch (sChars.next(), hChars.next()) {
        case (?sc, ?hc) { if (sc != hc) { match := false } };
        case (null, null) { return match };
        case _ { return false };
      };
    };
  };

  /// Parse a JSON field value (string) from a simple flat JSON object.
  func parseJsonField(json : Text, field : Text) : ?Text {
    let needle = "\"" # field # "\":\"";
    let parts  = json.split(#text needle) |> _.toArray();
    if (parts.size() < 2) return null;
    let afterColon = parts[1];
    let parts2 = afterColon.split(#text "\"") |> _.toArray();
    if (parts2.size() == 0) return null;
    let v = parts2[0];
    if (v.size() == 0) null else ?v;
  };

  /// Handle invoice callback from VPS worker.
  /// Expected JSON body: {"orderId":"123","status":"issued","invoiceNo":"...","invoiceDate":"...","maCQT":"...","errorMessage":"..."}
  /// Returns {status: Nat; body: Blob} for http_request_update.
  public shared func handleInvoiceCallback(body : Blob, headers : [(Text, Text)]) : async { status : Nat16; body : Blob } {
    // Validate signature
    if (not validateInvoiceCallbackSignature(body, headers)) {
      return { status = 401; body = "Unauthorized".encodeUtf8() };
    };

    let bodyText = switch (body.decodeUtf8()) {
      case null return { status = 400; body = "Invalid UTF-8 body".encodeUtf8() };
      case (?t) t;
    };

    // Parse required fields
    let orderIdText = switch (parseJsonField(bodyText, "orderId")) {
      case null return { status = 400; body = "Missing orderId".encodeUtf8() };
      case (?v) v;
    };
    let status = switch (parseJsonField(bodyText, "status")) {
      case null return { status = 400; body = "Missing status".encodeUtf8() };
      case (?v) v;
    };

    // Convert orderId text → Nat
    let orderId : Nat = switch (Nat.fromText(orderIdText)) {
      case null return { status = 400; body = "Invalid orderId".encodeUtf8() };
      case (?n) n;
    };

    // Real order invoice callback
    let order = switch (orders.get(orderId)) {
      case null return { status = 404; body = "Order not found".encodeUtf8() };
      case (?o) o;
    };

    if (status == "issued") {
      let invoiceNo   = parseJsonField(bodyText, "invoiceNo");
      let invoiceDate = parseJsonField(bodyText, "invoiceDate");
      let maCQT       = parseJsonField(bodyText, "maCQT");
      let maTraCuu    = parseJsonField(bodyText, "maTraCuu");
      order.invoiceStatus  := #Issued;
      order.invoiceNo      := invoiceNo;
      order.invoiceDate    := invoiceDate;
      order.maCQT          := maCQT;
      order.maTraCuu       := maTraCuu;
      order.invoiceError   := null;
      Debug.print("[BKAV] Worker confirmed invoice issued for order " # orderIdText);
    } else {
      let errCode  = parseJsonField(bodyText, "errorCode");
      let errMsg   = parseJsonField(bodyText, "errorMessage");
      let errorMsg = switch (errCode, errMsg) {
        case (?c, ?m) "[" # c # "] " # m;
        case (?c, null) "[" # c # "] L\u{1ED7}i t\u{1EEB} BKAV";
        case (null, ?m) m;
        case (null, null) "Worker kh\u{00F4}ng th\u{1EC3} ph\u{00E1}t h\u{00E0}nh h\u{00F3}a \u{0111}\u{01A1}n";
      };
      order.invoiceStatus := #Error;
      order.invoiceError  := ?errorMsg;
      Debug.print("[BKAV] Worker reported invoice error for order " # orderIdText # ": " # errorMsg);
    };

    { status = 200; body = "OK".encodeUtf8() };
  };

  // ── Public endpoints ────────────────────────────────────────────────────────

  /// Re-queue a failed invoice for the VPS worker to retry.
  /// Sets invoiceStatus back to #Pending so the worker will pick it up again.
  /// SECURED: requires authenticated enterprise delivery staff.
  public shared ({ caller }) func reissueBkavInvoice(orderId : CommonTypes.OrderId) : async Text {
    if (not invoiceIsEnterpriseStaff(caller)) return "Unauthorized";
    let order = switch (orders.get(orderId)) {
      case null return "Không tìm thấy đơn hàng";
      case (?o) o;
    };
    switch (order.invoiceStatus) {
      case (#Issued) return "Hoá đơn đã được phát hành";
      case _ {};
    };
    // Clear previous error and re-queue
    order.invoiceNo     := null;
    order.invoiceError  := null;
    order.invoiceStatus := #Pending;
    "OK: Đơn hàng đã được xếp hàng lại để phát hành hóa đơn";
  };
};
