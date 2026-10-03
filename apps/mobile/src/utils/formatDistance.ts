export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m away`;
  }

  const distanceKilometers = distanceMeters / 1000;
  const precision = distanceKilometers < 10 ? 1 : 0;
  return `${distanceKilometers.toFixed(precision)} km away`;
}