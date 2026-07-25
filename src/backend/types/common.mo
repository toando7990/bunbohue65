// Cross-cutting shared types used across all domain modules
module {
  public type RestaurantId = Nat;
  public type MenuCategoryId = Nat;
  public type MenuItemId = Nat;
  public type TableId = Nat;
  public type OrderId = Nat;
  public type Timestamp = Int; // nanoseconds from Time.now()

  public type DeveloperProfile = {
    developerPrincipalId : Principal;
    businessOwnerPrincipalId : Principal;
    email : Text;
  };

  // Global business profile (one per deployment, independent of restaurants)
  public type BusinessProfile = {
    var logoUrl           : Text;
    // Business identity fields (consolidated from per-restaurant Restaurant type)
    var businessName      : ?Text;
    var address           : ?Text;
    var email             : ?Text;
    var domain            : ?Text;
    var brandLogo         : ?Text;
    // Shared bank account for all QR payment QR codes (used by every restaurant)
    var accountNumber     : ?Text;
    var bankName          : ?Text;
    var accountHolderName : ?Text;
    // Tingee credentials — stored at business level (not per-restaurant) for HMAC webhook verification and API calls
    var tingeeClientId    : ?Text;
    var tingeeSecretToken : ?Text;
    // Tingee order-code prefix (separate from Sepay). Empty = timestamp-based legacy code.
    var tingeeOrderPrefix   : Text;
    // Tingee Virtual Account (VA) — entered manually by the owner, used as the
    // destination VA for dynamic QR generation (http-outcalls to Tingee).
    var tingeeVA            : ?Text;
    // Tingee bank BIN — entered manually by the owner, used as the bankBin
    // field in the generate-dynamic-qr request body (http-outcalls to Tingee).
    var tingeeBankBin       : ?Text;
    // Tingee merchant ID — entered manually by the owner, used as the merchantId
    // field in the generate-dynamic-qr request body (http-outcalls to Tingee).
    var tingeeMerchantId    : ?Text;
    // Invoice provider selection and BKAV eHoadon configuration
    var invoiceProvider    : Text;  // "BKAV" (only supported provider)
    var bkavInvoiceSerial      : ?Text; // Invoice serial for BKAV (legacy, kept for backward compat)
    // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
    var bkavDemoInvoiceSerial : ?Text;
    var bkavProdInvoiceSerial : ?Text; // Invoice serial for BKAV production environment
    var bkavInvoiceForm       : ?Text; // Invoice form for BKAV
    // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
    var bkavEnvironment    : Text;
    var bkavVatRate        : Nat;   // VAT rate percent for BKAV: 0, 5, 8, 10, 15 (default 10)
    // Business identity for e-invoice seller info
    var taxCode              : ?Text; // MST doanh nghiệp (seller tax code)
    var phone                : ?Text; // SĐT doanh nghiệp (seller phone)
    // Invoice callback secret — used to authenticate VPS worker POST /invoice-callback (HMAC-SHA256)
    var invoiceCallbackSecret : ?Text;
    // BKAV credentials — production environment only (demo/sandbox removed).
    // DEPRECATED — kept for stable compatibility; no longer used by new code (Bkav Sandbox removed).
    var demoGuid   : ?Text;
    var demoToken  : ?Text;
    var realGuid   : ?Text; // PartnerGUID for production environment
    var realToken  : ?Text; // PartnerToken for production environment
    var realApiUrl : ?Text; // API URL for production (default: https://ws.ehoadon.vn/WSPublicEhoadon.asmx)
    // Worker principal — the VPS worker's Principal, registered by owner so the worker
    // can authenticate to getInvoiceWorkerConfig and receive real credentials.
    // Owner can only overwrite with a new value — null/empty preserves the existing value.
    var workerPrincipal : ?Text;
    // AhaMove business-level configuration
    var ahamoveApiKey    : ?Text;  // AhaMove server API key
    var ahamoveMobile    : ?Text;  // Số điện thoại tài khoản AhaMove (để lấy JWT token)
    // COD (Cash on Delivery) settings — Cash in Advance model
    var codSettings : ?CodSettings;
  };

  // Patch DTO for updateBusinessProfile endpoint — identity fields, all optional.
  // bankCode was moved into updateBusinessBankDetails (the "Thông tin ngân hàng"
  // group) — it is no longer patched here. Only fields the caller explicitly
  // provides are written; null = no change.
  // tingeeVA (Tingee Virtual Account) is patched here so the owner can save the
  // manually-entered VA used as the destination for dynamic QR generation.
  public type BusinessProfilePatch = {
    businessName : ?Text;
    address      : ?Text;
    email        : ?Text;
    domain       : ?Text;
    brandLogo    : ?Text;
    tingeeVA     : ?Text;
    tingeeBankBin    : ?Text;
    tingeeMerchantId : ?Text;
  };

  // COD settings — controls whether delivery orders can use Cash on Delivery
  // In the Cash-in-Advance model, the AhaMove driver pays the order value at the kiosk
  // and collects order value + shipping fee from the customer upon delivery.
  public type CodSettings = {
    isCodAllowed : Bool;
    codLimit      : Nat; // VND amount — orders above this cannot use COD
  };

  // Advertising banner image for the business (shown on delivery/ordering page)
  public type BannerImage = {
    id        : Nat;
    var imageUrl  : Text;
    var sortOrder : Nat;
  };

  // Saved recipient/delivery info for reuse on next order
  public type SavedRecipientInfo = {
    recipientName  : Text;
    recipientPhone : Text;
    locationName   : Text;
  };

  // Staff role — defined here (common) to avoid circular imports
  public type StaffRole = {
    #Admin;
    #Kitchen;
    #Waiter;
    #Cashier;
    #Delivery;
    #KioskOrder;
  };

  // Enterprise staff permissions types
  public type EnterprisePermission = {
    #EnterpriseDelivery;
    #CustomerSupport;
    #Accounting;
    #DeviceManagement;
  };

  public type EnterpriseStaffPermissions = {
    principalId : Principal;
    permissions : [EnterprisePermission];
  };

  // Enterprise office device types
  public type EnterpriseDeviceRole = {
    #EnterpriseDelivery;
    #CustomerSupport;
    #Accounting;
  };

  public type EnterpriseDeviceRecord = {
    deviceId       : Text;
    role           : EnterpriseDeviceRole;
    deviceName     : Text;
    deviceToken    : Text;
    activationCode : ?Text;
    codeExpiry     : ?Int;
    status         : { #Active; #Revoked };
    registeredAt   : Int;
  };

  // Kiosk fixed-device types
  public type DeviceId = Text;

  public type DeviceRecord = {
    deviceId       : DeviceId;
    restaurantId   : Nat;
    role           : StaffRole;
    deviceName     : Text;
    deviceToken    : Text;
    activationCode : Text;
    codeExpiry     : Int;
    status         : { #active; #revoked };
    createdAt      : Int;
    var lastUsedAt : Int;
  };

  // Shared (non-mutable) version for API responses
  public type DeviceRecordPublic = {
    deviceId       : DeviceId;
    restaurantId   : Nat;
    role           : StaffRole;
    deviceName     : Text;
    deviceToken    : Text;
    activationCode : Text;
    codeExpiry     : Int;
    status         : { #active; #revoked };
    createdAt      : Int;
    lastUsedAt     : Int;
  };
};
