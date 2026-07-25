// Migration that consumes the v57 production canister (which only persists
// `bpStateStable` — the 19 state fields were discarded by the v57 migration)
// and installs the fixed actor that restores all 19 durable state fields plus
// bpStateStable. The 19 state fields are seeded to their EMPTY initializers
// (NOT read from `old`, because v57 does not have them) so the runtime can
// install the new stable vars on upgrade; bpStateStable is carried forward
// from `old` unchanged.
//
// Self-contained: only mo:core imports, all types inlined. The chain replays
// forever, so this file must never depend on project modules whose shapes may
// drift.
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Nat64 "mo:core/Nat64";

module {
  // ── Inlined stable types (mirror types/common.mo + lib/business-profile.mo) ──

  type CodSettings = {
    isCodAllowed : Bool;
    codLimit     : Nat;
  };

  type BusinessProfile = {
    var logoUrl                : Text;
    var businessName           : ?Text;
    var address                : ?Text;
    var email                  : ?Text;
    var domain                 : ?Text;
    var brandLogo              : ?Text;
    var accountNumber          : ?Text;
    var bankName               : ?Text;
    var accountHolderName      : ?Text;
    var tingeeClientId         : ?Text;
    var tingeeSecretToken      : ?Text;
    var tingeeOrderPrefix      : Text;
    var tingeeVA               : ?Text;
    var tingeeBankBin          : ?Text;
    var tingeeMerchantId       : ?Text;
    var invoiceProvider        : Text;
    var bkavInvoiceSerial      : ?Text;
    var bkavDemoInvoiceSerial  : ?Text;
    var bkavProdInvoiceSerial  : ?Text;
    var bkavInvoiceForm        : ?Text;
    var bkavEnvironment        : Text;
    var bkavVatRate            : Nat;
    var taxCode                : ?Text;
    var phone                  : ?Text;
    var invoiceCallbackSecret  : ?Text;
    var demoGuid               : ?Text;
    var demoToken              : ?Text;
    var realGuid               : ?Text;
    var realToken              : ?Text;
    var realApiUrl             : ?Text;
    var workerPrincipal        : ?Text;
    var ahamoveApiKey          : ?Text;
    var ahamoveMobile          : ?Text;
    var codSettings            : ?CodSettings;
  };

  type BannerImage = {
    id            : Nat;
    var imageUrl  : Text;
    var sortOrder : Nat;
  };

  type SavedRecipientInfo = {
    recipientName  : Text;
    recipientPhone : Text;
    locationName   : Text;
  };

  // BusinessProfileLib.State — the durable stable shape owned by the actor.
  type BpState = {
    profile         : BusinessProfile;
    bannerImages    : List.List<BannerImage>;
    bannerCounter    : { var nextId : Nat };
    savedRecipients  : Map.Map<Principal, SavedRecipientInfo>;
  };

  // ── Inlined types for the 31 discarded previously-stable fields ───────────
  // These mirror the shapes that existed in the previous actor version. They
  // are only used to type OldActor so the compiler can confirm every previously
  // stable field is explicitly consumed; the values are discarded in the
  // migration body.

  // RestaurantManager.State
  type StaffRole = {
    #Admin; #Kitchen; #Waiter; #Cashier; #Delivery; #KioskOrder;
  };
  type StaffMember = { staffId : Principal; role : StaffRole };
  type AutoPaymentApp = { #None; #Sepay; #Tingee };
  type DriverDispatchMode = { #InStore; #Central };
  type ShippingFeeMode = { #CustomerPays; #RestaurantPays };
  type Restaurant = {
    id : Nat;
    var name : Text;
    ownerId : Principal;
    var staffMembers : [StaffMember];
    var stripeEnabled : Bool;
    var stripePublishableKey : ?Text;
    var stripeSecretKey : ?Text;
    var bannerImageUrl : ?Text;
    var tableServiceHours : ?Text;
    var deliveryServiceHours : ?Text;
    var sepayApiToken : ?Text;
    var sepayEnabled : Bool;
    var autoPaymentConfirmationEnabled : Bool;
    var autoPaymentConfirmationApp : AutoPaymentApp;
    var brand1Name : ?Text;
    var brand2Name : ?Text;
    var brand3Name : ?Text;
    var brand4Name : ?Text;
    var brand5Name : ?Text;
    var coordinateLatitude : ?Float;
    var coordinateLongitude : ?Float;
    var deliveryRadiusKm : ?Nat;
    var address : Text;
    var shippingFeeMode : ?ShippingFeeMode;
    var autoShipperEnabled : Bool;
    var driverDispatchMode : DriverDispatchMode;
  };
  type RestaurantState = {
    restaurants : Map.Map<Nat, Restaurant>;
    counters    : { var nextId : Nat };
  };

  // MenuManager.State
  type MenuCategory = {
    id : Nat; restaurantId : Nat; name : Text; position : Nat;
  };
  type MenuItem = {
    id : Nat; restaurantId : Nat; categoryId : Nat;
    name : Text; description : Text; price : Nat;
    imageUrl : ?Text; available : Bool; unit : ?Text;
  };
  type MenuState = {
    categories : Map.Map<Nat, MenuCategory>;
    items      : Map.Map<Nat, MenuItem>;
    counters   : { var nextCategoryId : Nat; var nextItemId : Nat };
  };

  // MasterMenuManager.State
  type MasterMenuItem = {
    id : Nat; categoryId : Nat; name : Text; description : Text;
    price : Nat; imageUrl : ?Text; unit : ?Text; position : Nat; isActive : Bool;
  };
  type MasterMenuCategory = { id : Nat; name : Text; position : Nat };
  type MasterMenuState = {
    masterItems        : Map.Map<Nat, MasterMenuItem>;
    masterCategories   : Map.Map<Nat, MasterMenuCategory>;
    restaurantOverrides : Map.Map<(Nat, Nat), Bool>;
    counters           : { var nextItemId : Nat; var nextCategoryId : Nat };
  };

  // TableManager.State
  type Table = {
    id : Nat; restaurantId : Nat; tableNumber : Text; qrCodeUrl : Text;
  };
  type TableState = {
    tables   : Map.Map<Nat, Table>;
    counters : { var nextId : Nat };
  };

  // OrderLib types
  type OrderType = { #TableOrder; #DeliveryOrder };
  type OrderStatus = {
    #Cancelled; #Completed; #Delivered; #DispatchCenter; #FindingDriver;
    #PaymentPending; #Pending; #PendingApproval; #Preparing; #Ready;
    #WaitingDriver; #WaitingDriverPayment;
  };
  type PaymentStatus = {
    #Unpaid; #Pending; #Paid; #Failed;
    #SepayPending; #SepayPaid; #SepayExpired;
    #WaitingDriverPayment; #TingeePending; #TingeePaid; #TingeeExpired;
  };
  type PaymentMethod = {
    #CustomerOnline; #CashierTerminal; #BankTransfer; #ApplePay;
    #CreditCard; #SepayQR; #TingeeQR; #Stripe; #Cod;
  };
  type PaymentInfo = {
    var paymentStatus : PaymentStatus;
    var paymentMethod : ?PaymentMethod;
    var stripePaymentIntentId : ?Text;
    var paidAt : ?Int;
  };
  type InvoiceStatus = { #NotRequested; #Pending; #Issued; #Error };
  type VatInfo = {
    taxCode : ?Text; buyerName : Text; address : Text;
    email : Text; accountNo : ?Text;
  };
  type ShippingStatus = {
    #SearchingShipper; #ShipperAccepted; #PickedUp; #Delivering; #DeliveryFailed;
  };
  type ShippingTransferStatus = {
    #notStarted; #pending; #completed; #failed; #notRequired;
  };
  type DriverInfo = {
    name : Text; phone : Text; vehiclePlate : Text;
    eta : ?Int; lat : ?Float; lng : ?Float;
  };
  type OrderItem = {
    menuItemId : Nat; name : Text; price : Nat;
    quantity : Nat; itemNote : ?Text; unit : ?Text;
  };
  type Order = {
    id : Nat; restaurantId : Nat; tableIdentifier : Text; orderType : OrderType;
    deliveryAddress : ?Text; deliveryLat : ?Float; deliveryLng : ?Float;
    customerName : ?Text; customerPhone : ?Text; items : [OrderItem];
    var status : OrderStatus; notes : ?Text; createdAt : Int;
    paymentInfo : PaymentInfo; var paymentConfirmedAt : ?Int;
    var shipperName : ?Text; var shipperPhone : ?Text; var shipperOrderId : ?Text;
    var shippingFee : ?Nat; var shippingProvider : ?Text; var shippingStatus : ?ShippingStatus;
    var vatRequest : Bool; var vatInfo : ?VatInfo;
    var invoiceNo : ?Text; var invoiceDate : ?Text; var invoicePdfUrl : ?Text;
    var invoiceStatus : InvoiceStatus; var maCQT : ?Text; var maTraCuu : ?Text;
    var invoiceError : ?Text; var transactionCode : ?Text;
    var orderCode : ?Text; var sepayTransactionId : ?Text; var sepayTransferAmount : ?Nat;
    var ahamoveOrderId : ?Text; var shippingTransferStatus : ShippingTransferStatus;
    var driverInfo : ?DriverInfo; var subtotal : ?Nat;
    var findingDriverSince : ?Int; var dispatchNote : ?Text; var isCod : Bool;
  };

  // ReservationLib types
  type ReservationStatus = { #Pending; #Confirmed; #Arrived; #Cancelled };
  type Reservation = {
    id : Nat; restaurantId : Nat; customerName : Text; customerPhone : Text;
    partySize : Nat; date : Text; timeSlot : Text; durationMinutes : Nat;
    tableId : ?Nat; var status : ReservationStatus; notes : ?Text;
    customerEmail : ?Text; createdAt : Int;
  };

  // DynamicQR types
  type DynamicQRStatus = { #pending; #paid; #expired; #deleted };
  type TransactionInfo = {
    transactionCode : ?Text; amount : ?Nat; bankCode : ?Text;
    paidAt : ?Text; paymentMethod : ?Text; reference : ?Text;
  };
  type DynamicQRRecord = {
    qrId : Text; qrString : Text; var status : DynamicQRStatus;
    billId : Text; idempotencyKey : Text; orderId : Nat;
    createdAt : Int; expiresAt : ?Int;
    var totalAmountPaid : Nat; var transactionInfos : [TransactionInfo];
  };

  // DeveloperProfile
  type DeveloperProfile = {
    developerPrincipalId : Principal;
    businessOwnerPrincipalId : Principal;
    email : Text;
  };

  // Kiosk device types
  type DeviceRecord = {
    deviceId : Text; restaurantId : Nat; role : StaffRole;
    deviceName : Text; deviceToken : Text; activationCode : Text;
    codeExpiry : Int; status : { #active; #revoked };
    createdAt : Int; var lastUsedAt : Int;
  };

  // Enterprise staff permissions
  type EnterprisePermission = {
    #EnterpriseDelivery; #CustomerSupport; #Accounting; #DeviceManagement;
  };
  type EnterpriseStaffPermissions = {
    principalId : Principal; permissions : [EnterprisePermission];
  };

  // Enterprise device types
  type EnterpriseDeviceRole = { #EnterpriseDelivery; #CustomerSupport; #Accounting };
  type EnterpriseDeviceRecord = {
    deviceId : Text; role : EnterpriseDeviceRole; deviceName : Text;
    deviceToken : Text; activationCode : ?Text; codeExpiry : ?Int;
    status : { #Active; #Revoked }; registeredAt : Int;
  };

  // KioskBackground state
  type BackgroundImage = {
    id : Nat; url : Text; fileName : Text; uploadedAt : Int; isDefault : Bool;
  };
  type SuggestionConfig = {
    suggestionsEnabled : Bool; maxAddOns : Nat; maxDrinks : Nat;
  };
  type KioskBackgroundState = {
    var backgroundImages : [BackgroundImage];
    var suggestionConfig : SuggestionConfig;
    var nextImageId : Nat;
  };

  // ── Inlined IC http-outcalls types (mirror mixins/shipper-api.mo + ──────────
  // types/dynamic-qr.mo). The previous actor version stored `dqrIc` and `ic` as
  // stable actor references whose `http_request` method signatures used these
  // EXACT record types (confirmed against the .old/.../backend.most baseline).
  // M0170 rejects `Any` because Any is NOT a stable subtype of these concrete
  // records — the previous-version types must be inlined verbatim, including
  // the `transform` field whose `function` is a shared function reference. The
  // baseline proves the stable-compatibility checker accepted this shape in the
  // previous version, so inlining the same types here satisfies M0170.
  //
  // `DQRIcHttpRequest` / `DQRIcHttpResponse` were type aliases for
  // `IcHttpRequest` / `IcHttpResponse` in the previous version (see
  // mixins/dynamic-qr-api.mo lines 70-73), so they are aliased here too.
  type IcHttpResponse = {
    status  : Nat;
    headers : [{ name : Text; value : Text }];
    body    : Blob;
  };
  type IcTransformArgs = {
    response : IcHttpResponse;
    context  : Blob;
  };
  type IcTransformFn = shared (IcTransformArgs) -> async IcHttpResponse;
  type IcHttpRequest = {
    url                : Text;
    max_response_bytes : ?Nat64;
    method             : { #get; #post; #head };
    headers            : [{ name : Text; value : Text }];
    body               : ?Blob;
    transform          : ?{ function : IcTransformFn; context : Blob };
  };
  type DQRIcHttpRequest = IcHttpRequest;
  type DQRIcHttpResponse = IcHttpResponse;

  // ── Migration domain/codomain ──────────────────────────────────────────────

  // OldActor mirrors the ACTUAL current production canister (v57), which only
  // persists `bpStateStable` in stable memory. The v57 migration discarded the
  // 19 state fields (restaurantState, menuState, etc.) and the 11 true
  // constants, leaving only bpStateStable durable. When upgrading v57 → this
  // fixed version, the runtime restores stable vars from v57's persisted
  // state, which contains ONLY bpStateStable — so OldActor must list ONLY
  // bpStateStable. Listing the 19 state fields here would make the compiler
  // expect them in persisted state and trap with "stable variable X not found
  // in persisted state" at upgrade time.
  type OldActor = {
    var bpStateStable : BpState;
  };

  // The new actor carries forward all 19 durable state fields plus
  // bpStateStable. The 19 state fields are seeded to their empty initializers
  // by this migration (v57 does not have them in persisted state); bpStateStable
  // is carried forward from `old` unchanged. The 11 true constants and the
  // legacy bpState alias are `transient let` in the new actor and are
  // re-initialized on every restart, so they are not part of NewActor.
  type NewActor = {
    var restaurantState            : RestaurantState;
    var menuState                  : MenuState;
    var masterMenuState            : MasterMenuState;
    var tableState                 : TableState;
    var orders                     : Map.Map<Nat, Order>;
    var orderState                 : { var nextOrderId : Nat };
    var dynamicQRStore             : Map.Map<Nat, DynamicQRRecord>;
    var reservations               : Map.Map<Nat, Reservation>;
    var reservationState           : { var nextReservationId : Nat };
    var developerProfiles          : Map.Map<Principal, DeveloperProfile>;
    var kioskDevices               : Map.Map<Text, DeviceRecord>;
    var kioskActivationIndex       : Map.Map<Text, Text>;
    var kioskDeviceCounter         : { var count : Nat };
    var staffRestaurantFilter      : Map.Map<Principal, [Nat]>;
    var enterpriseStaffPermissions : Map.Map<Principal, EnterpriseStaffPermissions>;
    var enterpriseDevices          : Map.Map<Text, EnterpriseDeviceRecord>;
    var enterpriseActivationIndex  : Map.Map<Text, Text>;
    var enterpriseDevCounter       : { var count : Nat };
    var kbState                    : KioskBackgroundState;
    var bpStateStable              : BpState;
  };

  // ── Empty initializers for the 19 state fields ───────────────────────────
  // The current production canister (v57) discarded these fields, so they are
  // NOT present in v57's persisted state. The migration must seed them to
  // their empty initializers (NOT read them from `old`) so the runtime can
  // install the new stable vars on upgrade. These mirror the .empty() / fresh
  // initializers in the project's lib modules but are inlined here so the
  // migration stays self-contained (only mo:core imports).

  func emptyRestaurantState() : RestaurantState = {
    restaurants = Map.empty();
    counters    = { var nextId = 1 };
  };

  func emptyMenuState() : MenuState = {
    categories = Map.empty();
    items      = Map.empty();
    counters   = { var nextCategoryId = 1; var nextItemId = 1 };
  };

  func emptyMasterMenuState() : MasterMenuState = {
    masterItems        = Map.empty();
    masterCategories   = Map.empty();
    restaurantOverrides = Map.empty();
    counters           = { var nextItemId = 1; var nextCategoryId = 1 };
  };

  func emptyTableState() : TableState = {
    tables   = Map.empty();
    counters = { var nextId = 1 };
  };

  func emptyKioskBackgroundState() : KioskBackgroundState = {
    var backgroundImages  = [];
    var suggestionConfig  = { suggestionsEnabled = false; maxAddOns = 0; maxDrinks = 0 };
    var nextImageId       = 1;
  };

  // On fresh install (OldActor = {}) the chain starts from an empty record, so
  // the field values are seeded by the actor's transient initializers on first
  // restart. On upgrade from v57 the previous actor only persists
  // `bpStateStable` — the 19 state fields were discarded by the v57 migration
  // and are NOT present in v57's persisted state. Therefore this migration:
  //   (1) carries forward `bpStateStable` from `old` unchanged, and
  //   (2) seeds all 19 state fields to their EMPTY initializers (NOT from
  //       `old`, because `old` does not have them). The runtime then installs
  //       the new stable vars from these seeded values.
  // Reading the 19 fields from `old` would trap at upgrade time with
  // "stable variable X not found in persisted state".
  public func migration(old : OldActor) : NewActor {
    {
      var restaurantState            = emptyRestaurantState();
      var menuState                  = emptyMenuState();
      var masterMenuState            = emptyMasterMenuState();
      var tableState                 = emptyTableState();
      var orders                     = Map.empty();
      var orderState                 = { var nextOrderId = 0 };
      var dynamicQRStore             = Map.empty();
      var reservations               = Map.empty();
      var reservationState           = { var nextReservationId = 0 };
      var developerProfiles          = Map.empty();
      var kioskDevices               = Map.empty();
      var kioskActivationIndex       = Map.empty();
      var kioskDeviceCounter         = { var count = 0 };
      var staffRestaurantFilter      = Map.empty();
      var enterpriseStaffPermissions = Map.empty();
      var enterpriseDevices          = Map.empty();
      var enterpriseActivationIndex  = Map.empty();
      var enterpriseDevCounter       = { var count = 0 };
      var kbState                    = emptyKioskBackgroundState();
      var bpStateStable              = old.bpStateStable;
    };
  };
};
