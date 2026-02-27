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
 * Ray-casting point-in-polygon test
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {Array<[number, number]>} polygon - Array of [lat, lng] vertices (closed)
 * @returns {boolean}
 */
export function pointInPolygon(lat, lng, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [latI, lngI] = polygon[i];
        const [latJ, lngJ] = polygon[j];
        if (((latI > lat) !== (latJ > lat)) &&
            (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Place wind turbines in a grid within a polygon, respecting minimum distance.
 * @param {Array<[number, number]>} polygon - Array of [lat, lng] vertices (closed)
 * @param {number} count - Desired number of turbines
 * @param {number} minDistKm - Minimum distance between turbines in km
 * @returns {Array<{lat: number, lng: number}>} Array of turbine positions
 */
export function placeTurbinesInPolygon(polygon, count, minDistKm) {
    if (!polygon || polygon.length < 3 || count < 1 || minDistKm <= 0) return [];

    // Bounding box
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of polygon) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    }

    // Approximate degrees per km at center latitude (1 deg lat ≈ 111 km, 1 deg lng ≈ 111*cos(lat) km)
    const centerLat = (minLat + maxLat) / 2;
    const degPerKmLat = 1 / 111;
    const degPerKmLng = 1 / (111 * Math.cos(centerLat * Math.PI / 180));
    const stepLat = minDistKm * degPerKmLat;
    const stepLng = minDistKm * degPerKmLng;

    const candidates = [];
    for (let lat = minLat; lat <= maxLat; lat += stepLat) {
        for (let lng = minLng; lng <= maxLng; lng += stepLng) {
            if (pointInPolygon(lat, lng, polygon)) {
                candidates.push({ lat, lng });
                if (candidates.length >= count) break;
            }
        }
        if (candidates.length >= count) break;
    }
    return candidates.slice(0, count);
}

/**
 * Check if two line segments (a1-a2) and (b1-b2) intersect.
 * Each point is [lat, lng] or {lat, lng}.
 */
function segmentsIntersect(a1, a2, b1, b2) {
    const toArr = (p) => Array.isArray(p) ? p : [p.lat, p.lng];
    const [ax1, ay1] = toArr(a1);
    const [ax2, ay2] = toArr(a2);
    const [bx1, by1] = toArr(b1);
    const [bx2, by2] = toArr(b2);
    const d1 = (bx2 - bx1) * (ay1 - by1) - (by2 - by1) * (ax1 - bx1);
    const d2 = (bx2 - bx1) * (ay2 - by1) - (by2 - by1) * (ax2 - bx1);
    const d3 = (ax2 - ax1) * (by1 - ay1) - (ay2 - ay1) * (bx1 - ax1);
    const d4 = (ax2 - ax1) * (by2 - ay1) - (ay2 - ay1) * (bx2 - ax1);
    if (d1 * d2 > 0 || d3 * d4 > 0) return false;
    if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
        return Math.max(ax1, ax2) >= Math.min(bx1, bx2) && Math.max(bx1, bx2) >= Math.min(ax1, ax2) &&
            Math.max(ay1, ay2) >= Math.min(by1, by2) && Math.max(by1, by2) >= Math.min(ay1, ay2);
    }
    return true;
}

/**
 * Check if segment (p1,p2) shares an endpoint with segment (a,b) - if so they don't "cross" in the middle
 */
function sharesEndpoint(p1, p2, a, b) {
    const ids = new Set([p1.id, p2.id, a.id, b.id]);
    return ids.size < 4;
}

/**
 * Compute optimal 66 kV cable routing for offshore wind farm.
 * - Groups turbines into strings of max 5
 * - Connects each string to nearest offshore substation
 * - Minimizes length and avoids cable crossings
 * @param {Array} nodes - All map nodes { id, type, lat, lng }
 * @param {number} maxTurbinesPerString - Default 5
 * @returns {Array<{from: string, to: string, coords: Array<[number,number]>}>} Cables to add
 */
export function computeOffshoreCableRouting(nodes, maxTurbinesPerString = 5) {
    const turbines = nodes.filter(n => n.type === 'offshore_wind_turbine');
    const substations = nodes.filter(n => n.type === 'offshore_substation');
    if (turbines.length === 0 || substations.length === 0) return [];

    const dist = (a, b) => haversineDistanceKm(a.lat, a.lng, b.lat, b.lng);
    const angleFrom = (center, p) => Math.atan2(p.lng - center.lng, p.lat - center.lat);

    const cables = [];
    const cableSegments = [];

    const addCable = (from, to) => {
        const coords = [[from.lat, from.lng], [to.lat, to.lng]];
        cables.push({ from: from.id, to: to.id, coords });
        cableSegments.push({ from, to, coords });
    };

    const addCablesForString = (ordered, sub, preferSubAtEnd) => {
        const toAdd = [];
        for (let j = 0; j < ordered.length - 1; j++) {
            toAdd.push({ from: ordered[j], to: ordered[j + 1] });
        }
        const subEnd = preferSubAtEnd ? ordered[ordered.length - 1] : ordered[0];
        toAdd.push({ from: subEnd, to: sub });
        return toAdd;
    };

    const countNewCrossings = (toAdd) => {
        let count = 0;
        const tempSegs = [...cableSegments];
        for (const { from, to } of toAdd) {
            for (const seg of tempSegs) {
                if ((seg.from.id === from.id && seg.to.id === to.id) || (seg.from.id === to.id && seg.to.id === from.id)) continue;
                if (sharesEndpoint(from, to, seg.from, seg.to)) continue;
                if (segmentsIntersect(from, to, seg.from, seg.to)) count++;
            }
            tempSegs.push({ from, to, coords: null });
        }
        return count;
    };

    for (const sub of substations) {
        const assigned = turbines
            .filter(t => substations.reduce((a, b) => dist(t, a) <= dist(t, b) ? a : b).id === sub.id)
            .sort((a, b) => angleFrom(sub, a) - angleFrom(sub, b));

        const stringGroups = [];
        for (let i = 0; i < assigned.length; i += maxTurbinesPerString) {
            const group = assigned.slice(i, i + maxTurbinesPerString);
            if (group.length > 0) stringGroups.push(group);
        }

        for (let i = stringGroups.length - 1; i >= 0; i--) {
            if (stringGroups[i].length === 1) {
                const orphan = stringGroups[i][0];
                let bestJ = -1;
                let bestDist = Infinity;
                for (let j = 0; j < stringGroups.length; j++) {
                    if (j === i) continue;
                    const minDist = Math.min(...stringGroups[j].map(t => dist(orphan, t)));
                    if (minDist < bestDist && stringGroups[j].length <= maxTurbinesPerString) {
                        bestDist = minDist;
                        bestJ = j;
                    }
                }
                if (bestJ >= 0) {
                    stringGroups[bestJ].push(orphan);
                    stringGroups.splice(i, 1);
                }
            }
        }

        for (const stringTurbines of stringGroups) {
            if (stringTurbines.length === 0) continue;

            const nearestNeighborOrder = (start) => {
                const ordered = [start];
                const remaining = new Set(stringTurbines.filter(t => t.id !== start.id));
                while (remaining.size > 0) {
                    const last = ordered[ordered.length - 1];
                    let best = null, bestD = Infinity;
                    for (const t of remaining) {
                        const d = dist(last, t);
                        if (d < bestD) { bestD = d; best = t; }
                    }
                    if (best) { ordered.push(best); remaining.delete(best); }
                }
                return ordered;
            };

            const closestToSub = stringTurbines.reduce((a, b) => dist(a, sub) <= dist(b, sub) ? a : b);
            const farthestFromSub = stringTurbines.reduce((a, b) => dist(a, sub) >= dist(b, sub) ? a : b);

            const orderFromClosest = nearestNeighborOrder(closestToSub);
            const orderFromFarthest = nearestNeighborOrder(farthestFromSub);

            let bestOrdered = orderFromClosest;
            let bestSubAtEnd = true;
            let bestCrossings = Infinity;

            for (const ord of [orderFromClosest, orderFromFarthest]) {
                for (const subAtEnd of [true, false]) {
                    const toAdd = addCablesForString(ord, sub, subAtEnd);
                    const c = countNewCrossings(toAdd);
                    if (c < bestCrossings || (c === bestCrossings && dist(ord[subAtEnd ? ord.length - 1 : 0], sub) < dist(bestOrdered[bestSubAtEnd ? bestOrdered.length - 1 : 0], sub))) {
                        bestCrossings = c;
                        bestOrdered = ord;
                        bestSubAtEnd = subAtEnd;
                    }
                }
            }

            const finalOrdered = bestOrdered;
            const subEnd = bestSubAtEnd ? finalOrdered[finalOrdered.length - 1] : finalOrdered[0];

            for (let j = 0; j < finalOrdered.length - 1; j++) {
                addCable(finalOrdered[j], finalOrdered[j + 1]);
            }
            addCable(subEnd, sub);
        }
    }
    return cables;
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
