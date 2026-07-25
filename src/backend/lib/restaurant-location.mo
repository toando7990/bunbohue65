// Restaurant location domain logic — distance calculations and radius filtering
import RestaurantTypes "../types/restaurant";
import LocationTypes "../types/restaurant-location";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Nat "mo:core/Nat";

module {
  // Calculate whether a target coordinate is within the given radius (km) of origin.
  // Uses Haversine approximation. Returns true if within range or if radius is 0 (no restriction).
  public func isWithinDeliveryRadius(
    originLat  : Float,
    originLon  : Float,
    targetLat  : Float,
    targetLon  : Float,
    radiusKm   : Nat,
  ) : Bool {
    if (radiusKm == 0) return true;
    distanceKm(originLat, originLon, targetLat, targetLon) <= radiusKm.toFloat();
  };

  // Compute the straight-line distance in km between two GPS coordinates.
  public func distanceKm(
    lat1 : Float,
    lon1 : Float,
    lat2 : Float,
    lon2 : Float,
  ) : Float {
    let r = 6371.0; // Earth radius in km
    let dLat = (lat2 - lat1) * Float.pi / 180.0;
    let dLon = (lon2 - lon1) * Float.pi / 180.0;
    let a = Float.sin(dLat / 2.0) * Float.sin(dLat / 2.0)
      + Float.cos(lat1 * Float.pi / 180.0)
        * Float.cos(lat2 * Float.pi / 180.0)
        * Float.sin(dLon / 2.0) * Float.sin(dLon / 2.0);
    let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
    r * c;
  };

  // Apply a location update to an existing restaurant record (returns updated record).
  public func applyLocationUpdate(
    restaurant : RestaurantTypes.Restaurant,
    update     : LocationTypes.RestaurantLocationUpdate,
  ) : RestaurantTypes.Restaurant {
    switch (update.coordinateLatitude)  { case (?v) { restaurant.coordinateLatitude  := ?v }; case null {} };
    switch (update.coordinateLongitude) { case (?v) { restaurant.coordinateLongitude := ?v }; case null {} };
    switch (update.deliveryRadiusKm)    { case (?v) { restaurant.deliveryRadiusKm    := ?v }; case null {} };
    switch (update.address)             { case (?v) { restaurant.address             := v  }; case null {} };
    restaurant;
  };
};
