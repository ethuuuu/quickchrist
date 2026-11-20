// Geometry helpers. Pure: no browser APIs.
// A "point" is an array [lat, lon] or [lat, lon, ele].

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in metres between two lat/lon positions.
export function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Total length in metres of a list of points.
export function polylineLengthM(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Flat x/y in metres around (lat0, lon0). Accurate enough inside a campus.
export function makeProjector(lat0, lon0) {
  const kx = Math.cos(toRad(lat0)) * 111320;
  const ky = 110540;
  return (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky];
}

// Distance from point p to segment a-b, all as [x, y] in metres.
function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Ramer–Douglas–Peucker simplification. Removes points that lie within
// epsilonM metres of the line between their neighbours. Always keeps the
// first and last point. Uses a stack instead of recursion (safe for long walks).
export function simplifyRDP(points, epsilonM) {
  if (points.length <= 2) return points.slice();
  const project = makeProjector(points[0][0], points[0][1]);
  const xy = points.map((p) => project(p[0], p[1]));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDist = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointSegmentDistance(xy[i], xy[start], xy[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilonM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}
