/**
 * Haversine formula: distance between two lat/lng points in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface RestaurantWithCoords {
  id: bigint;
  coordinateLatitude?: number;
  coordinateLongitude?: number;
  isOpen?: boolean;
  [key: string]: unknown;
}

export interface RestaurantWithDistance extends RestaurantWithCoords {
  distanceKm: number;
}

/**
 * Sort restaurants by distance from a reference point.
 * Filters out closed restaurants or those without coordinates.
 */
export function sortRestaurantsByDistance(
  restaurants: RestaurantWithCoords[],
  lat: number,
  lng: number,
): RestaurantWithDistance[] {
  return restaurants
    .filter(
      (r) =>
        r.isOpen !== false &&
        r.coordinateLatitude != null &&
        r.coordinateLongitude != null,
    )
    .map((r) => ({
      ...r,
      distanceKm: haversineKm(
        lat,
        lng,
        r.coordinateLatitude!,
        r.coordinateLongitude!,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
