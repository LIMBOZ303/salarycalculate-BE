/**
 * GPS Utility Functions
 * Haversine formula to calculate distance between two GPS coordinates
 */

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees) => {
  return (degrees * Math.PI) / 180;
};

/**
 * Check if a location is within a certain radius
 * @param {number} empLat - Employee latitude
 * @param {number} empLng - Employee longitude
 * @param {number} branchLat - Branch latitude
 * @param {number} branchLng - Branch longitude
 * @param {number} radiusMeters - Allowed radius in meters
 * @returns {{ isWithin: boolean, distance: number }}
 */
const isWithinRadius = (empLat, empLng, branchLat, branchLng, radiusMeters) => {
  const distance = calculateDistance(empLat, empLng, branchLat, branchLng);
  return {
    isWithin: distance <= radiusMeters,
    distance: Math.round(distance * 100) / 100, // round to 2 decimals
  };
};

/**
 * Validate location accuracy
 * @param {number} accuracy - GPS accuracy in meters
 * @param {number} maxAccuracy - Maximum allowed accuracy (default: 100m)
 * @returns {boolean}
 */
const validateLocationAccuracy = (accuracy, maxAccuracy = 100) => {
  if (!accuracy) return false;
  return accuracy <= maxAccuracy;
};

export {  calculateDistance, isWithinRadius, validateLocationAccuracy  };
