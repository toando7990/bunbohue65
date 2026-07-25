// Shipper utility functions — Haversine distance and fallback shipping fee calculation
import Float "mo:core/Float";

module {
  /// Earth radius in kilometers
  let EARTH_RADIUS_KM : Float = 6371.0;

  /// Convert degrees to radians
  func toRadians(degrees : Float) : Float {
    degrees * Float.pi / 180.0
  };

  /// Calculate Haversine distance between two lat/lng points in kilometers.
  /// Returns distance in km (Float).
  public func haversineDistance(
    lat1 : Float,
    lng1 : Float,
    lat2 : Float,
    lng2 : Float,
  ) : Float {
    let dLat = toRadians(lat2 - lat1);
    let dLng = toRadians(lng2 - lng1);

    let a = Float.sin(dLat / 2.0) * Float.sin(dLat / 2.0) +
            Float.cos(toRadians(lat1)) * Float.cos(toRadians(lat2)) *
            Float.sin(dLng / 2.0) * Float.sin(dLng / 2.0);

    let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));

    EARTH_RADIUS_KM * c
  };

  /// Flat rate pricing table based on distance ranges (in km).
  /// Returns shipping fee in VND (Nat).
  public func calculateFlatRateShippingFee(distanceKm : Float) : Nat {
    if (distanceKm <= 2.0) { 15_000 }
    else if (distanceKm <= 5.0) { 25_000 }
    else if (distanceKm <= 10.0) { 40_000 }
    else if (distanceKm <= 15.0) { 60_000 }
    else if (distanceKm <= 20.0) { 80_000 }
    else { 100_000 }
  };

  /// Calculate fallback shipping fee using Haversine distance + flat rate pricing.
  /// Returns { shippingFee : Nat; distanceKm : Float }.
  public func calculateFallbackShippingFee(
    pickupLat : Float,
    pickupLng : Float,
    dropoffLat : Float,
    dropoffLng : Float,
  ) : { shippingFee : Nat; distanceKm : Float } {
    let distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    let shippingFee = calculateFlatRateShippingFee(distanceKm);
    { shippingFee; distanceKm }
  };
}
