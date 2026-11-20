// Decides whether a GPS fix is good enough to keep while recording. Pure.
import { haversineM } from '../geo.js';

// prev: last kept fix or null. cfg: CONFIG.GPS.
// Returns { ok: true, reason: null } or { ok: false, reason: 'accuracy' | 'too-close' | 'too-fast' }.
export function shouldAcceptFix(prev, fix, cfg) {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > cfg.ACCURACY_MAX_M) return { ok: false, reason: 'accuracy' };
  if (!prev) return { ok: true, reason: null };
  const d = haversineM(prev.lat, prev.lon, fix.lat, fix.lon);
  if (d < cfg.MIN_STEP_M) return { ok: false, reason: 'too-close' };
  const dt = (fix.ts - prev.ts) / 1000;
  if (dt > 0 && d / dt > cfg.MAX_SPEED_MPS) return { ok: false, reason: 'too-fast' };
  return { ok: true, reason: null };
}
