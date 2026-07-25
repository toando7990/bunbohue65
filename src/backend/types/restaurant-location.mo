// Restaurant location domain types — coordinates and delivery radius
module {
  // Optional GPS coordinates for a restaurant location
  public type RestaurantCoordinates = {
    latitude  : Float;
    longitude : Float;
  };

  // Input for updating restaurant location settings
  public type RestaurantLocationUpdate = {
    address             : ?Text;
    coordinateLatitude  : ?Float;
    coordinateLongitude : ?Float;
    deliveryRadiusKm    : ?Nat;
  };
};
