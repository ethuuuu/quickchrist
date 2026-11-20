// Phone storage and file import/export.
import { CONFIG } from './config.js';

export function loadWorkingGraph() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.GRAPH);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns false when storage is full or blocked.
export function saveWorkingGraph(json) {
  try {
    localStorage.setItem(CONFIG.STORAGE.GRAPH, JSON.stringify(json));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkingGraph() {
  try {
    localStorage.removeItem(CONFIG.STORAGE.GRAPH);
  } catch {
    /* nothing to clear */
  }
}

export function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(CONFIG.STORAGE.RECENT) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(placeId) {
  const list = [placeId, ...loadRecent().filter((id) => id !== placeId)].slice(0, 8);
  try {
    localStorage.setItem(CONFIG.STORAGE.RECENT, JSON.stringify(list));
  } catch {
    /* recent places are optional */
  }
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJSONFile(file) {
  return JSON.parse(await file.text());
}
