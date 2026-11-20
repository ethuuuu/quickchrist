// Mapper-mode state machine.
// States: 'off' (navigate mode), 'ready' (mapper open, standing), 'walking'.
// It edits the graph in place and reports through onChange(event), where
// event.type is 'state' | 'point' | 'walk-started' | 'node-marked' | 'place-saved'
// | 'walk-ended' | 'walk-discarded' | 'undo', and event.graphChanged says whether
// the graph must be saved and redrawn.
import { CONFIG } from '../config.js';
import { onLocation, startLocation, lastFix } from '../location.js';
import { shouldAcceptFix } from './filter.js';
import { snapOrCreateNode, addEdgeFromFixes, addPlace, graphToJSON, loadGraph } from '../graph.js';

export function createRecorder({ getGraph, setGraph, onChange }) {
  let state = 'off';
  let segment = null; // { fromNodeId, fixes: [], tags: { stairs, steep } }
  let lastAccepted = null;
  let wakeLock = null;
  let unsubscribe = null;
  const undoStack = [];

  function emit(event) {
    onChange({ graphChanged: false, ...event });
  }

  // A recent fix accurate enough to place a junction or place.
  function goodFix() {
    const f = lastFix();
    if (!f) return null;
    if (Date.now() - f.ts > 10000) return null;
    if (f.accuracy > CONFIG.GPS.NODE_ACCURACY_MAX_M) return null;
    return f;
  }

  function newSegment(fromNodeId) {
    segment = { fromNodeId, fixes: [], tags: { stairs: false, steep: false } };
    lastAccepted = null;
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(graphToJSON(getGraph())));
    if (undoStack.length > CONFIG.UNDO_LIMIT) undoStack.shift();
  }

  function handleLocation(ev) {
    if (ev.type !== 'fix' || state !== 'walking') return;
    if (!shouldAcceptFix(lastAccepted, ev.fix, CONFIG.GPS).ok) return;
    lastAccepted = ev.fix;
    segment.fixes.push(ev.fix);
    emit({ type: 'point', fix: ev.fix });
  }

  // Keeps the screen on while walking. Android stops GPS for web pages when the screen is off.
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch {
      wakeLock = null;
    }
  }

  function unlockScreen() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state === 'walking') lockScreen();
  });

  function enter() {
    if (state !== 'off') return;
    state = 'ready';
    startLocation();
    unsubscribe = onLocation(handleLocation);
    emit({ type: 'state' });
  }

  function exit() {
    if (state === 'off') return;
    if (state === 'walking') discardWalk();
    state = 'off';
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    emit({ type: 'state' });
  }

  function startWalk() {
    if (state !== 'ready') return { ok: false, reason: 'not-ready' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    pushUndo();
    const { node, created } = snapOrCreateNode(getGraph(), fix.lat, fix.lon, fix.alt, 'junction', CONFIG.GRAPH.SNAP_RADIUS_M);
    if (!created) undoStack.pop();
    newSegment(node.id);
    state = 'walking';
    lockScreen();
    emit({ type: 'walk-started', node, graphChanged: created });
    return { ok: true, node, created };
  }

  // Ends the current segment at the current position. placeInfo turns the point into a place.
  function markNode(placeInfo) {
    if (state !== 'walking') return { ok: false, reason: 'not-walking' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    const g = getGraph();
    pushUndo();
    const kind = placeInfo ? 'place' : 'junction';
    const { node, created } = snapOrCreateNode(g, fix.lat, fix.lon, fix.alt, kind, CONFIG.GRAPH.SNAP_RADIUS_M);
    const edge = addEdgeFromFixes(g, segment.fromNodeId, node.id, segment.fixes, segment.tags, CONFIG.GRAPH);
    const place = placeInfo ? addPlace(g, node.id, placeInfo.name, placeInfo.category, placeInfo.outside) : null;
    const changed = created || edge.ok || place !== null;
    if (!changed) undoStack.pop();
    newSegment(node.id);
    emit({ type: 'node-marked', node, graphChanged: changed });
    return { ok: true, node, created, edge, place };
  }

  function savePlace(placeInfo) {
    if (state === 'walking') return markNode(placeInfo);
    if (state !== 'ready') return { ok: false, reason: 'not-ready' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    const g = getGraph();
    pushUndo();
    const { node, created } = snapOrCreateNode(g, fix.lat, fix.lon, fix.alt, 'place', CONFIG.GRAPH.SNAP_RADIUS_M);
    const place = addPlace(g, node.id, placeInfo.name, placeInfo.category, placeInfo.outside);
    emit({ type: 'place-saved', node, graphChanged: true });
    return { ok: true, node, created, edge: null, place };
  }

  function stopWalk() {
    const r = markNode(null);
    if (!r.ok) return r;
    segment = null;
    state = 'ready';
    unlockScreen();
    emit({ type: 'walk-ended' });
    return r;
  }

  function discardWalk() {
    if (state !== 'walking') return;
    segment = null;
    state = 'ready';
    unlockScreen();
    emit({ type: 'walk-discarded' });
  }

  function setTag(name, on) {
    if (state !== 'walking' || !(name in segment.tags)) return;
    segment.tags[name] = on === true;
    emit({ type: 'state' });
  }

  function undo() {
    if (state !== 'ready' || undoStack.length === 0) return false;
    const { graph } = loadGraph(JSON.parse(undoStack.pop()));
    setGraph(graph);
    emit({ type: 'undo', graphChanged: true });
    return true;
  }

  return {
    getState: () => state,
    getTags: () => (segment ? { ...segment.tags } : { stairs: false, steep: false }),
    canUndo: () => state === 'ready' && undoStack.length > 0,
    enter, exit, startWalk, markNode, savePlace, stopWalk, discardWalk, setTag, undo,
  };
}
