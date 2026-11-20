// Human-readable distance and time. Pure.
export function formatDistance(m) {
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 10) return `${Math.round(m)} m`;
  const r = Math.round(m / 10) * 10;
  if (r < 1000) return `${r} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatWalk(m, speedMps) {
  const seconds = m / speedMps;
  if (seconds < 60) return 'Under 1 min walk';
  return `${Math.round(seconds / 60)} min walk`;
}
