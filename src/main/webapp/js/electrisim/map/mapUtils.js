/**
 * Map utilities for geographic distance calculation and coordinate handling
 */

/**
 * Haversine formula - calculate great-circle distance between two points on Earth
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate total length of a polyline (array of [lat, lng] points)
 * @param {Array<[number, number]>} coords - Array of [lat, lng] coordinates
 * @returns {number} Total length in kilometers
 */
export function polylineLengthKm(coords) {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        total += haversineDistanceKm(
            coords[i][0], coords[i][1],
            coords[i + 1][0], coords[i + 1][1]
        );
    }
    return total;
}

/**
 * Generate unique ID for map elements
 * @param {string} prefix - Prefix for the ID
 * @param {Set<string>|Iterator<string>|Array<string>} existingIds - Set, iterator, or array of existing IDs to avoid collisions
 * @returns {string} Unique ID
 */
export function generateMapId(prefix, existingIds = new Set()) {
    const ids = existingIds instanceof Set ? existingIds : new Set(existingIds);
    let id;
    let n = 1;
    do {
        id = `${prefix}_${n}`;
        n++;
    } while (ids.has(id));
    return id;
}
