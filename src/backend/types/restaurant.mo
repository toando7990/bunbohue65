// Restaurant domain types
import CommonTypes "common";
import ShipperTypes "shipper";

module {
  // StaffRole is defined in CommonTypes to avoid circular imports
  public type StaffRole = CommonTypes.StaffRole;

  public type StaffMember = {
    staffId : Principal;
    role : StaffRole;
  };

  // Which app handles automatic payment confirmation via webhook
  // #None = no app selected yet (new restaurants start unselected)
  // #Sepay is DEPRECATED — kept for stable compatibility; no longer set by new code (Sepay removed).
  public type AutoPaymentApp = { #None; #Sepay; #Tingee };
  public type DriverDispatchMode = { #InStore; #Central };

  // Driver dispatch mode — controls how delivery orders are routed after payment confirmation
  // DriverDispatchMode removed — all restaurants use central dispatch


  public type Restaurant = {
    id : CommonTypes.RestaurantId;
    var name : Text;
    ownerId : Principal;
    var staffMembers        : [StaffMember];
    var stripeEnabled       : Bool;
    var stripePublishableKey : ?Text;
    var stripeSecretKey     : ?Text;
    var bannerImageUrl      : ?Text;
    var tableServiceHours   : ?Text;
    var deliveryServiceHours : ?Text;
    var sepayApiToken       : ?Text;  // DEPRECATED — kept for stable compatibility (Sepay removed)
    var sepayEnabled        : Bool;   // DEPRECATED — kept for stable compatibility (Sepay removed)
    // Tingee per-restaurant fields REMOVED — Tingee config now lives at business level (BusinessProfile).
    // Auto-payment confirmation toggle and app selector
    var autoPaymentConfirmationEnabled : Bool;
    var autoPaymentConfirmationApp     : AutoPaymentApp;
    var brand1Name          : ?Text;
    var brand2Name          : ?Text;
    var brand3Name          : ?Text;
    var brand4Name          : ?Text;
    var brand5Name          : ?Text;
    var coordinateLatitude  : ?Float;
    var coordinateLongitude : ?Float;
    var deliveryRadiusKm    : ?Nat;
    var address             : Text;
    // Shipper integration config
    // NOTE: ahamoveApiKey/ahamovePhone were removed — AhaMove auth is now
    // business-level only (BusinessProfile.ahamoveApiKey/ahamoveMobile).
    var shippingFeeMode     : ?ShipperTypes.ShippingFeeMode;
    var autoShipperEnabled  : Bool;
      // Driver dispatch mode field

      // Driver dispatch mode: #InStore = store staff dispatches driver; #Central = enterprise delivery center dispatches
    var driverDispatchMode : DriverDispatchMode;  // deprecated — kept for stable compatibility, always #Central
  };

  public type BusinessProfileUpdate = {
    stripeEnabled         : ?Bool;
    stripePublishableKey  : ?Text;
    stripeSecretKey       : ?Text;
    bannerImageUrl        : ?Text;
    tableServiceHours     : ?Text;
    deliveryServiceHours  : ?Text;
    sepayApiToken         : ?Text;  // DEPRECATED — kept for stable compatibility (Sepay removed)
    sepayEnabled          : ?Bool;  // DEPRECATED — kept for stable compatibility (Sepay removed)
    // Tingee per-restaurant patch fields REMOVED — Tingee config now lives at business level (BusinessProfile).
    // Auto-payment confirmation
    autoPaymentConfirmationEnabled : ?Bool;
    autoPaymentConfirmationApp     : ?AutoPaymentApp;
    brand1Name            : ?Text;
    brand2Name            : ?Text;
    brand3Name            : ?Text;
    brand4Name            : ?Text;
    brand5Name            : ?Text;
    coordinateLatitude    : ?Float;
    coordinateLongitude   : ?Float;
    deliveryRadiusKm      : ?Nat;
    // Shipper integration config (all optional — patch only what changed)
    // NOTE: ahamoveApiKey/ahamovePhone removed — AhaMove auth is business-level.
    shippingFeeMode       : ?ShipperTypes.ShippingFeeMode;
    autoShipperEnabled    : ?Bool;
    // driverDispatchMode removed — all restaurants use central dispatch
    // COD settings update (null = no change, ?null = disable COD, ?{...} = update)
    codSettings           : ??CommonTypes.CodSettings;
  };
};
