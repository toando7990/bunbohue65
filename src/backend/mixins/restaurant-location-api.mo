// Restaurant location API mixin — exposes endpoints for location-based features
import RestaurantManager "../RestaurantManager";
import CommonTypes "../types/common";
import LocationTypes "../types/restaurant-location";
import LocationLib "../lib/restaurant-location";
import Array "mo:core/Array";

mixin (
  restaurantState : RestaurantManager.State,
) {

  // Update restaurant coordinates and delivery radius — caller must be owner or admin
  public shared ({ caller }) func updateRestaurantLocation(
    restaurantId : CommonTypes.RestaurantId,
    update       : LocationTypes.RestaurantLocationUpdate,
  ) : async Bool {
    switch (RestaurantManager.getRestaurant(restaurantState, restaurantId)) {
      case null false;
      case (?restaurant) {
        if (not RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller)) return false;
        ignore LocationLib.applyLocationUpdate(restaurant, update);
        true;
      };
    };
  };

  // List restaurants that can deliver to the given coordinates.
  // Returns ids of eligible restaurants sorted by distance (nearest first).
  // Restaurants with deliveryRadiusKm == 0 are included (no restriction).
  public query func listRestaurantsNearby(
    latitude  : Float,
    longitude : Float,
  ) : async [CommonTypes.RestaurantId] {
    let all = RestaurantManager.listAllRestaurants(restaurantState);
    let nearby = all.filter(func(r) {
      switch (r.coordinateLatitude, r.coordinateLongitude, r.deliveryRadiusKm) {
        case (?lat, ?lon, ?radius) {
          LocationLib.isWithinDeliveryRadius(lat, lon, latitude, longitude, radius);
        };
        case _ true; // restaurant without location set is always included
      };
    });
    let sorted = nearby.sort(func(a, b) {
      switch (a.coordinateLatitude, a.coordinateLongitude, b.coordinateLatitude, b.coordinateLongitude) {
        case (?aLat, ?aLon, ?bLat, ?bLon) {
          let da = LocationLib.distanceKm(aLat, aLon, latitude, longitude);
          let db = LocationLib.distanceKm(bLat, bLon, latitude, longitude);
          if (da < db) #less else if (da > db) #greater else #equal;
        };
        case _ #equal;
      };
    });
    sorted.map(func(r) { r.id });
  };
};
