// Restaurant API mixin — exposes public restaurant management endpoints
import Principal "mo:core/Principal";
import RestaurantManager "../RestaurantManager";
import CommonTypes "../types/common";
import RestaurantTypes "../types/restaurant";
import BusinessProfileLib "../lib/business-profile";

mixin (
  restaurantState : RestaurantManager.State,
  bpState         : BusinessProfileLib.State,
) {

  // Public type for API boundary — no var fields
  public type RestaurantPublic = {
    id                   : CommonTypes.RestaurantId;
    name                 : Text;
    ownerId              : Principal;
    staffMembers         : [RestaurantTypes.StaffMember];
    stripeEnabled        : Bool;
    stripePublishableKey : ?Text;
    bannerImageUrl       : ?Text;
    tableServiceHours    : ?Text;
    deliveryServiceHours : ?Text;
    // Tingee per-restaurant fields REMOVED — Tingee config now lives at business level (BusinessProfile).
    // Auto-payment confirmation
    autoPaymentConfirmationEnabled : Bool;
    autoPaymentConfirmationApp     : RestaurantTypes.AutoPaymentApp;
    brand1Name           : ?Text;
    brand2Name           : ?Text;
    brand3Name           : ?Text;
    brand4Name           : ?Text;
    brand5Name           : ?Text;
    coordinateLatitude   : ?Float;
    coordinateLongitude  : ?Float;
    deliveryRadiusKm     : ?Nat;
    address              : Text;
  };

  func toPublicRestaurant(r : RestaurantTypes.Restaurant) : RestaurantPublic = {
    id                   = r.id;
    name                 = r.name;
    ownerId              = r.ownerId;
    staffMembers         = r.staffMembers;
    stripeEnabled        = r.stripeEnabled;
    stripePublishableKey = r.stripePublishableKey;
    bannerImageUrl       = r.bannerImageUrl;
    tableServiceHours    = r.tableServiceHours;
    deliveryServiceHours = r.deliveryServiceHours;
    autoPaymentConfirmationEnabled = r.autoPaymentConfirmationEnabled;
    autoPaymentConfirmationApp     = r.autoPaymentConfirmationApp;
    brand1Name           = r.brand1Name;
    brand2Name           = r.brand2Name;
    brand3Name           = r.brand3Name;
    brand4Name           = r.brand4Name;
    brand5Name           = r.brand5Name;
    coordinateLatitude   = r.coordinateLatitude;
    coordinateLongitude  = r.coordinateLongitude;
    deliveryRadiusKm     = r.deliveryRadiusKm;
    address              = r.address;
  };

  // Create a new restaurant; caller becomes the owner
  public shared ({ caller }) func createRestaurant(name : Text) : async CommonTypes.RestaurantId {
    RestaurantManager.createRestaurant(restaurantState, caller, name);
  };

  // Get a restaurant by id
  public query func getRestaurant(id : CommonTypes.RestaurantId) : async ?RestaurantPublic {
    switch (RestaurantManager.getRestaurant(restaurantState, id)) {
      case null null;
      case (?r) ?toPublicRestaurant(r);
    };
  };

  // List all restaurants owned by the caller
  public shared query ({ caller }) func listMyRestaurants() : async [RestaurantPublic] {
    RestaurantManager.listRestaurantsByOwner(restaurantState, caller)
      .map(func(r) { toPublicRestaurant(r) });
  };

  // List all restaurants — public, no authentication required (for customer delivery page)
  public query func listAllRestaurants() : async [RestaurantPublic] {
    RestaurantManager.listAllRestaurants(restaurantState)
      .map(func(r) { toPublicRestaurant(r) });
  };

  // Update restaurant name — only the owner can rename
  public shared ({ caller }) func updateRestaurantName(
    restaurantId : CommonTypes.RestaurantId,
    name         : Text,
  ) : async Bool {
    RestaurantManager.updateRestaurantName(restaurantState, caller, restaurantId, name);
  };

  // Update business profile — caller must be owner or admin
  public shared ({ caller }) func updateRestaurantProfile(
    restaurantId : CommonTypes.RestaurantId,
    update       : RestaurantTypes.BusinessProfileUpdate,
  ) : async Bool {
    RestaurantManager.updateRestaurantProfile(restaurantState, caller, restaurantId, update);
  };

  // Delete a restaurant — only the owner (creator) can delete
  public shared ({ caller }) func deleteRestaurant(
    restaurantId : CommonTypes.RestaurantId,
  ) : async Bool {
    RestaurantManager.deleteRestaurant(restaurantState, caller, restaurantId);
  };

  // Add a staff member — caller must be the owner
  public shared ({ caller }) func addStaffMember(
    restaurantId : CommonTypes.RestaurantId,
    staffId      : Principal,
    role         : RestaurantTypes.StaffRole,
  ) : async Bool {
    RestaurantManager.addStaffMember(restaurantState, caller, restaurantId, staffId, role);
  };

  // Remove a staff member — caller must be the owner
  public shared ({ caller }) func removeStaffMember(
    restaurantId : CommonTypes.RestaurantId,
    staffId      : Principal,
  ) : async Bool {
    RestaurantManager.removeStaffMember(restaurantState, caller, restaurantId, staffId);
  };

  // Update Stripe keys — caller must be owner or admin
  public shared ({ caller }) func updateRestaurantStripeKeys(
    restaurantId   : CommonTypes.RestaurantId,
    publishableKey : Text,
    secretKey      : Text,
  ) : async Bool {
    RestaurantManager.updateStripeKeys(restaurantState, caller, restaurantId, publishableKey, secretKey);
  };

  // Return the publishable key for a restaurant (safe to expose to frontend)
  public query func getRestaurantStripePublishableKey(
    restaurantId : CommonTypes.RestaurantId,
  ) : async ?Text {
    RestaurantManager.getStripePublishableKey(restaurantState, restaurantId);
  };

  // Check whether a Tingee Secret Token is configured at business level
  public query func hasTingeeSecretToken(restaurantId : CommonTypes.RestaurantId) : async Bool {
    ignore restaurantId; // Secret Token is at business level, not per-restaurant
    BusinessProfileLib.hasTingeeSecretToken(bpState);
  };

  // Update auto-payment confirmation settings — caller must be owner or admin
  public shared ({ caller }) func updateAutoPaymentConfirmationSettings(
    restaurantId : CommonTypes.RestaurantId,
    enabled      : Bool,
    app          : RestaurantTypes.AutoPaymentApp,
  ) : async Bool {
    RestaurantManager.updateAutoPaymentSettings(restaurantState, caller, restaurantId, enabled, app);
  };

  // Get the staff role of a principal for a restaurant
  public query func getStaffRole(
    restaurantId : CommonTypes.RestaurantId,
    staffId      : Principal,
  ) : async ?RestaurantTypes.StaffRole {
    RestaurantManager.getStaffRole(restaurantState, restaurantId, staffId);
  };
};
