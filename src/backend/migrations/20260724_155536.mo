// Migration that adds the worker-heartbeat stable state (heartbeats map +
// retryPolicy) to the actor. Preserves all existing stable state unchanged
// (stable upgrade pattern: every prior NewActor field is carried forward
// from `old`; only the new `workerHeartbeatState` field is seeded to its
// empty initializer).
//
// Self-contained: only mo:core imports, all types inlined. The chain replays
// forever, so this file must never depend on project modules whose shapes may
// drift.
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Nat64 "mo:core/Nat64";

module {
  // ── Inlined stable types (mirror types/common.mo + lib/business-profile.mo
  // + types/worker-heartbeat.mo + lib/worker-heartbeat.mo) ────────────────────

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
    var demoToken               : ?Text;
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

  type BpState = {
    profile         : BusinessProfile;
    bannerImages    : List.List<BannerImage>;
    bannerCounter    : { var nextId : Nat };
    savedRecipients  : Map.Map<Principal, SavedRecipientInfo>;
  };

  // WorkerHeartbeat types (mirror types/worker-heartbeat.mo)
  type WorkerId = Text;
  type RetryPolicy = {
    maxRetries        : Nat;
    baseDelayMs       : Nat;
    maxDelayMs        : Nat;
    backoffMultiplier : Float;
  };
  type WorkerHeartbeat = {
    var lastHeartbeatAt : Int;
  };
  type WorkerHeartbeatState = {
    heartbeats      : Map.Map<WorkerId, WorkerHeartbeat>;
    var retryPolicy : RetryPolicy;
  };

  // ── Inlined types for the previously-stable fields (mirror the prior
  // migration's NewActor) ────────────────────────────────────────────────────

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

  type Table = {
    id : Nat; restaurantId : Nat; tableNumber : Text; qrCodeUrl : Text;
  };
  type TableState = {
    tables   : Map.Map<Nat, Table>;
    counters : { var nextId : Nat };
  };

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

  type ReservationStatus = { #Pending; #Confirmed; #Arrived; #Cancelled };
  type Reservation = {
    id : Nat; restaurantId : Nat; customerName : Text; customerPhone : Text;
    partySize : Nat; date : Text; timeSlot : Text; durationMinutes : Nat;
    tableId : ?Nat; var status : ReservationStatus; notes : ?Text;
    customerEmail : ?Text; createdAt : Int;
  };

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

  type DeveloperProfile = {
    developerPrincipalId : Principal;
    businessOwnerPrincipalId : Principal;
    email : Text;
  };

  type DeviceRecord = {
    deviceId : Text; restaurantId : Nat; role : StaffRole;
    deviceName : Text; deviceToken : Text; activationCode : Text;
    codeExpiry : Int; status : { #active; #revoked };
    createdAt : Int; var lastUsedAt : Int;
  };

  type EnterprisePermission = {
    #EnterpriseDelivery; #CustomerSupport; #Accounting; #DeviceManagement;
  };
  type EnterpriseStaffPermissions = {
    principalId : Principal; permissions : [EnterprisePermission];
  };

  type EnterpriseDeviceRole = { #EnterpriseDelivery; #CustomerSupport; #Accounting };
  type EnterpriseDeviceRecord = {
    deviceId : Text; role : EnterpriseDeviceRole; deviceName : Text;
    deviceToken : Text; activationCode : ?Text; codeExpiry : ?Int;
    status : { #Active; #Revoked }; registeredAt : Int;
  };

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

  // ── Migration domain/codomain ──────────────────────────────────────────────

  // OldActor mirrors the NewActor of the previous migration (20260724_140000.mo):
  // all 19 durable state fields + bpStateStable. Every field is carried forward
  // unchanged; only the new `workerHeartbeatState` is seeded.
  type OldActor = {
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

  // NewActor = OldActor + workerHeartbeatState. The new field is seeded to its
  // empty initializer (empty heartbeats map + default retry policy); all
  // existing fields are carried forward from `old` unchanged (stable upgrade
  // pattern — preserve existing state).
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
    var workerHeartbeatState       : WorkerHeartbeatState;
  };

  // Empty initializer for the new worker-heartbeat state — mirrors
  // WorkerHeartbeatLib.empty() but inlined here so the migration stays
  // self-contained (only mo:core imports).
  func emptyWorkerHeartbeatState() : WorkerHeartbeatState = {
    heartbeats    = Map.empty();
    var retryPolicy = {
      maxRetries        = 3;
      baseDelayMs       = 5000;
      maxDelayMs        = 60000;
      backoffMultiplier = 2.0;
    };
  };

  // Carry forward every existing stable field unchanged; seed only the new
  // workerHeartbeatState to its empty initializer. This is the stable upgrade
  // pattern — existing state is preserved, new state gets a sensible default.
  public func migration(old : OldActor) : NewActor {
    {
      var restaurantState            = old.restaurantState;
      var menuState                  = old.menuState;
      var masterMenuState            = old.masterMenuState;
      var tableState                 = old.tableState;
      var orders                     = old.orders;
      var orderState                 = old.orderState;
      var dynamicQRStore             = old.dynamicQRStore;
      var reservations               = old.reservations;
      var reservationState           = old.reservationState;
      var developerProfiles          = old.developerProfiles;
      var kioskDevices               = old.kioskDevices;
      var kioskActivationIndex       = old.kioskActivationIndex;
      var kioskDeviceCounter         = old.kioskDeviceCounter;
      var staffRestaurantFilter      = old.staffRestaurantFilter;
      var enterpriseStaffPermissions = old.enterpriseStaffPermissions;
      var enterpriseDevices          = old.enterpriseDevices;
      var enterpriseActivationIndex  = old.enterpriseActivationIndex;
      var enterpriseDevCounter       = old.enterpriseDevCounter;
      var kbState                    = old.kbState;
      var bpStateStable              = old.bpStateStable;
      var workerHeartbeatState       = emptyWorkerHeartbeatState();
    };
  };
};
