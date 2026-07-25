// RestaurantManager — module-function style matching MenuManager pattern
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import CommonTypes "types/common";
import RestaurantTypes "types/restaurant";

module {
  public type RestaurantId  = CommonTypes.RestaurantId;
  public type Restaurant    = RestaurantTypes.Restaurant;
  public type StaffRole            = RestaurantTypes.StaffRole;
  public type StaffMember          = RestaurantTypes.StaffMember;
  public type BusinessProfileUpdate = RestaurantTypes.BusinessProfileUpdate;

  public type AutoPaymentApp    = RestaurantTypes.AutoPaymentApp;
  public type State = {
    restaurants : Map.Map<RestaurantId, Restaurant>;
    counters    : { var nextId : RestaurantId };
  };

  public func empty() : State = {
    restaurants = Map.empty();
    counters    = { var nextId = 1 };
  };

  /// Create a new restaurant owned by caller. Returns the new RestaurantId.
  public func createRestaurant(state : State, caller : Principal, name : Text) : RestaurantId {
    let id = state.counters.nextId;
    state.counters.nextId += 1;
    let restaurant : Restaurant = {
      id;
      var name;
      ownerId = caller;
      var staffMembers          = [];
      var stripeEnabled         = false;
      var stripePublishableKey  = null;
      var stripeSecretKey       = null;
      var bannerImageUrl        = null;
      var tableServiceHours     = null;
      var deliveryServiceHours  = null;
      var sepayApiToken         = null;
      var sepayEnabled          = false;
      var autoPaymentConfirmationEnabled = false;
      var autoPaymentConfirmationApp     = #None;
      var brand1Name            = null;
      var brand2Name            = null;
      var brand3Name            = null;
      var brand4Name            = null;
      var brand5Name            = null;
      var coordinateLatitude    = null;
      var coordinateLongitude   = null;
      var deliveryRadiusKm      = null;
      var address               = "";
      // NOTE: ahamoveApiKey/ahamovePhone not initialized — removed from Restaurant
      // type. AhaMove auth is business-level (BusinessProfile.ahamoveApiKey/ahamoveMobile).
      var shippingFeeMode       = null;
      var autoShipperEnabled    = false;
      var driverDispatchMode    = #Central;
    };
    state.restaurants.add(id, restaurant);
    id;
  };

  /// Return the restaurant with the given id, or null.
  public func getRestaurant(state : State, id : RestaurantId) : ?Restaurant {
    state.restaurants.get(id);
  };

  /// List all restaurants owned by the given principal.
  public func listRestaurantsByOwner(state : State, owner : Principal) : [Restaurant] {
    state.restaurants.values()
      |> _.filter(func(r : Restaurant) : Bool { r.ownerId == owner })
      |> _.toArray();
  };

  /// Delete a restaurant. Only the owner may call this. Returns false if not found or unauthorized.
  public func deleteRestaurant(state : State, caller : Principal, restaurantId : RestaurantId) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId != caller) return false;
        state.restaurants.remove(restaurantId);
        true;
      };
    };
  };

  /// Add a staff member to a restaurant. Only the owner may call this.
  public func addStaffMember(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    staffId      : Principal,
    role         : StaffRole,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId != caller) return false;
        let existing = restaurant.staffMembers.filter(func(m : StaffMember) : Bool { m.staffId != staffId });
        restaurant.staffMembers := existing.concat([{ staffId; role }]);
        true;
      };
    };
  };

  /// Remove a staff member. Only the owner may call this.
  public func removeStaffMember(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    staffId      : Principal,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId != caller) return false;
        restaurant.staffMembers := restaurant.staffMembers.filter(func(m : StaffMember) : Bool { m.staffId != staffId });
        true;
      };
    };
  };

  /// Return the role of a staff member, or null if not a member.
  public func getStaffRole(state : State, restaurantId : RestaurantId, staffId : Principal) : ?StaffRole {
    switch (state.restaurants.get(restaurantId)) {
      case null null;
      case (?restaurant) {
        switch (restaurant.staffMembers.find(func(m : StaffMember) : Bool { m.staffId == staffId })) {
          case null null;
          case (?member) ?member.role;
        };
      };
    };
  };

  /// Update the restaurant name. Only the owner may call this. Returns false if not found or unauthorized.
  public func updateRestaurantName(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    name         : Text,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId != caller) return false;
        restaurant.name := name;
        true;
      };
    };
  };

  /// Update business profile fields. Caller must be owner or admin. Returns false if not found or unauthorized.
  public func updateRestaurantProfile(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    update       : BusinessProfileUpdate,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (not isOwnerOrAdmin(state, restaurantId, caller)) return false;
        // NOTE: businessName/address/email/domain/brandLogo/accountNumber/bankName/
        // accountHolderName were removed from the Restaurant type — they now live at
        // business level (BusinessProfile). The 8 corresponding switch cases are deleted.
        switch (update.stripeEnabled)       { case (?v) { restaurant.stripeEnabled       := v  }; case null {} };
        switch (update.stripePublishableKey) { case (?v) { restaurant.stripePublishableKey  := ?v }; case null {} };
        switch (update.stripeSecretKey)      { case (?v) { restaurant.stripeSecretKey       := ?v }; case null {} };
        switch (update.bannerImageUrl)       { case (?v) { restaurant.bannerImageUrl        := ?v }; case null {} };
        switch (update.tableServiceHours)    { case (?v) { restaurant.tableServiceHours     := ?v }; case null {} };
        switch (update.deliveryServiceHours) { case (?v) { restaurant.deliveryServiceHours  := ?v }; case null {} };
        switch (update.sepayApiToken)        { case (?v) { restaurant.sepayApiToken          := ?v }; case null {} };
        switch (update.sepayEnabled)         { case (?v) { restaurant.sepayEnabled           := v  }; case null {} };
        switch (update.autoPaymentConfirmationEnabled) { case (?v) { restaurant.autoPaymentConfirmationEnabled := v  }; case null {} };
        switch (update.autoPaymentConfirmationApp)     { case (?v) { restaurant.autoPaymentConfirmationApp     := v  }; case null {} };
        switch (update.brand1Name)           { case (?v) { restaurant.brand1Name             := ?v }; case null {} };
        switch (update.brand2Name)           { case (?v) { restaurant.brand2Name             := ?v }; case null {} };
        switch (update.brand3Name)           { case (?v) { restaurant.brand3Name             := ?v }; case null {} };
        switch (update.brand4Name)           { case (?v) { restaurant.brand4Name             := ?v }; case null {} };
        switch (update.brand5Name)           { case (?v) { restaurant.brand5Name             := ?v }; case null {} };
        switch (update.coordinateLatitude)   { case (?v) { restaurant.coordinateLatitude      := ?v }; case null {} };
        switch (update.coordinateLongitude)  { case (?v) { restaurant.coordinateLongitude     := ?v }; case null {} };
        switch (update.deliveryRadiusKm)     { case (?v) { restaurant.deliveryRadiusKm        := ?v }; case null {} };
        // driverDispatchMode removed — all restaurants use central dispatch
        true;
      };
    };
  };

  /// Update Stripe keys for a restaurant. Caller must be owner or admin.
  public func updateStripeKeys(
    state            : State,
    caller           : Principal,
    restaurantId     : RestaurantId,
    publishableKey   : Text,
    secretKey        : Text,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (not isOwnerOrAdmin(state, restaurantId, caller)) return false;
        restaurant.stripePublishableKey := ?publishableKey;
        restaurant.stripeSecretKey      := ?secretKey;
        true;
      };
    };
  };

  /// Return the publishable key (safe to expose to frontend). Returns null if not set.
  public func getStripePublishableKey(state : State, restaurantId : RestaurantId) : ?Text {
    switch (state.restaurants.get(restaurantId)) {
      case null null;
      case (?restaurant) restaurant.stripePublishableKey;
    };
  };

  /// Return all restaurants as an array (public, no auth check).
  public func listAllRestaurants(state : State) : [Restaurant] {
    state.restaurants.values().toArray();
  };

  /// Update Sepay settings for a restaurant. Caller must be owner or admin.
  public func updateSepaySettings(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    apiToken     : Text,
    enabled      : Bool,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (not isOwnerOrAdmin(state, restaurantId, caller)) return false;
        restaurant.sepayApiToken := ?apiToken;
        restaurant.sepayEnabled  := enabled;
        true;
      };
    };
  };

  /// Get Sepay token for a restaurant (internal, for webhook verification).
  public func getSepayApiToken(state : State, restaurantId : RestaurantId) : ?Text {
    switch (state.restaurants.get(restaurantId)) {
      case null null;
      case (?restaurant) restaurant.sepayApiToken;
    };
  };

  /// Get auto-payment confirmation settings for a restaurant.
  public func getAutoPaymentSettings(state : State, restaurantId : RestaurantId) : ?{ enabled : Bool; app : AutoPaymentApp } {
    switch (state.restaurants.get(restaurantId)) {
      case null null;
      case (?restaurant) ?{
        enabled = restaurant.autoPaymentConfirmationEnabled;
        app     = restaurant.autoPaymentConfirmationApp;
      };
    };
  };

  /// Update auto-payment confirmation settings. Caller must be owner or admin.
  public func updateAutoPaymentSettings(
    state        : State,
    caller       : Principal,
    restaurantId : RestaurantId,
    enabled      : Bool,
    app          : AutoPaymentApp,
  ) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (not isOwnerOrAdmin(state, restaurantId, caller)) return false;
        restaurant.autoPaymentConfirmationEnabled := enabled;
        restaurant.autoPaymentConfirmationApp     := app;
        true;
      };
    };
  };

  /// Get the driver dispatch mode for a restaurant (defaults to #InStore if not found).
  /// Get the driver dispatch mode — REMOVED, all restaurants use central dispatch
  public func getDriverDispatchMode(state : State, restaurantId : RestaurantId) : { #Central } {
    ignore (state, restaurantId);
    #Central;
  };

  /// Returns true if caller is the owner or has Admin role.
  public func isOwnerOrAdmin(state : State, restaurantId : RestaurantId, caller : Principal) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId == caller) return true;
        switch (restaurant.staffMembers.find(func(m : StaffMember) : Bool { m.staffId == caller })) {
          case null false;
          case (?member) { member.role == #Admin };
        };
      };
    };
  };

  /// Returns true if caller is the owner or any staff member.
  public func isStaff(state : State, restaurantId : RestaurantId, caller : Principal) : Bool {
    switch (state.restaurants.get(restaurantId)) {
      case null false;
      case (?restaurant) {
        if (restaurant.ownerId == caller) return true;
        switch (restaurant.staffMembers.find(func(m : StaffMember) : Bool { m.staffId == caller })) {
          case null false;
          case (?_) true;
        };
      };
    };
  };
};
