// One shared GPS watcher for the whole app.
// Listeners get { type: 'fix', fix } or { type: 'error', code, message }.
import { CONFIG } from './config.js';

const listeners = new Set();
let watchId = null;
let last = null;

function emit(event) {
  for (const fn of listeners) fn(event);
}

function handlePosition(pos) {
  const c = pos.coords;
  last = {
    lat: c.latitude,
    lon: c.longitude,
    alt: Number.isFinite(c.altitude) ? c.altitude : null,
    accuracy: c.accuracy,
    ts: pos.timestamp,
  };
  emit({ type: 'fix', fix: last });
}

function handleError(err) {
  emit({ type: 'error', code: err.code, message: err.message });
}

export function startLocation() {
  if (watchId !== null) return true;
  if (!('geolocation' in navigator)) {
    emit({ type: 'error', code: 0, message: 'This browser cannot read GPS.' });
    return false;
  }
  if (!window.isSecureContext) {
    emit({ type: 'error', code: 0, message: 'GPS needs a secure page. Open the https:// address.' });
    return false;
  }
  watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: CONFIG.GPS.TIMEOUT_MS,
  });
  return true;
}

export function stopLocation() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function onLocation(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lastFix() {
  return last;
}
