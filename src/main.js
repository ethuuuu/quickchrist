import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/app.css';
import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { emptyGraph, loadGraph, graphToJSON, nearestNode } from './graph.js';
import { shortestPath, routePolyline } from './router.js';
import { createMapView } from './map/mapView.js';
import { startLocation, onLocation } from './location.js';
import { loadWorkingGraph, saveWorkingGraph, clearWorkingGraph, downloadJSON, readJSONFile } from './storage.js';
import { createRecorder } from './recorder/recorder.js';
import { initMapperPanel } from './ui/mapperPanel.js';
import { initSearch } from './ui/search.js';
import { initSheet } from './ui/sheet.js';
import { initMenu } from './ui/menu.js';
import { toast } from './ui/toast.js';

const GPS_ERRORS = {
  1: 'Location is blocked. Allow location for this site in Chrome settings, then reload.',
  2: 'No GPS signal. Step into the open or wait a moment.',
  3: 'Still waiting for GPS…',
};

async function readGraphJSON() {
  const local = loadWorkingGraph();
  if (local) return { json: local, local: true };
  const res = await fetch(`${import.meta.env.BASE_URL}graph.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`graph.json: HTTP ${res.status}`);
  return { json: await res.json(), local: false };
}

// Turns a route end ({ type: 'gps' } or { type: 'place', placeId }) into a node id.
function resolveEnd(end, graph, user) {
  if (end.type === 'place') {
    const place = graph.places.get(end.placeId);
    return place ? { nodeId: place.node, msg: null } : { nodeId: null, msg: 'That place is no longer on the map.' };
  }
  if (!user) return { nodeId: null, msg: 'Finding your location…' };
  const hit = nearestNode(graph, user.lat, user.lon, CONFIG.ROUTE.START_SNAP_MAX_M);
  return hit
    ? { nodeId: hit.node.id, msg: null }
    : { nodeId: null, msg: 'You are away from the mapped paths. Choose a start place instead.' };
}

async function boot() {
  const store = createStore({
    graph: emptyGraph(),
    graphVersion: 0,
    usingLocalEdits: false,
    mode: 'navigate',
    user: null,
    from: { type: 'gps' },
    to: null,
    route: null,
    routeMsg: null,
    searchTarget: 'to',
  });

  const mapView = createMapView(document.getElementById('map'), {
    onPlaceTap: (placeId) => {
      if (store.get().mode === 'navigate') store.set({ to: { type: 'place', placeId } });
    },
  });

  let recorder = null;
  let panel = null;

  // Saves the graph, bumps the version (which re-runs routing), and redraws.
  function persistGraph() {
    const s = store.get();
    store.set({ graphVersion: s.graphVersion + 1, usingLocalEdits: true });
    if (!saveWorkingGraph(graphToJSON(s.graph))) toast('Phone storage is full. Export your map data now.');
    mapView.setGraph(s.graph, { showJunctions: s.mode === 'mapper' });
  }

  function setMode(mode) {
    store.set({ mode, to: mode === 'mapper' ? null : store.get().to });
    document.body.dataset.mode = mode;
    mapView.setGraph(store.get().graph, { showJunctions: mode === 'mapper' });
    if (mode === 'mapper') {
      recorder.enter();
      toast('Mapper mode on. Stand at a junction and tap Start walk here.');
    } else {
      recorder.exit();
    }
  }

  // 1. Load map data: phone edits first, otherwise the shipped graph.json.
  try {
    const { json, local } = await readGraphJSON();
    const { graph, errors } = loadGraph(json);
    if (errors.length > 0) console.warn('Map data problems:', errors);
    store.set({ graph, usingLocalEdits: local });
  } catch (err) {
    console.error(err);
    toast('Could not load map data. Check your connection and reload.');
  }
  mapView.setGraph(store.get().graph, { showJunctions: false });
  mapView.fitAll();

  // 2. GPS.
  let centerOnNextFix = false;
  let lastErrorText = '';
  let lastErrorAt = 0;
  onLocation((ev) => {
    if (ev.type === 'fix') {
      store.set({ user: ev.fix });
      mapView.setUser(ev.fix.lat, ev.fix.lon, ev.fix.accuracy);
      if (centerOnNextFix) {
        centerOnNextFix = false;
        mapView.centerOn(ev.fix.lat, ev.fix.lon);
      }
      return;
    }
    const text = GPS_ERRORS[ev.code] || ev.message;
    const now = Date.now();
    if (text && (text !== lastErrorText || now - lastErrorAt > 30000)) {
      lastErrorText = text;
      lastErrorAt = now;
      toast(text);
    }
  });

  document.getElementById('locate-btn').addEventListener('click', () => {
    const user = store.get().user;
    if (user) {
      mapView.centerOn(user.lat, user.lon);
    } else {
      centerOnNextFix = true;
      startLocation();
      toast('Finding your location…');
    }
  });

  // 3. Routing. Re-runs only when the start node, goal node, or graph actually change.
  let lastKey = '';
  let lastFitKey = '';
  store.subscribe((s) => {
    if (s.mode !== 'navigate' || !s.to) {
      if (lastKey !== '') {
        lastKey = '';
        lastFitKey = '';
        mapView.clearRoute();
        store.set({ route: null, routeMsg: null });
      }
      return;
    }
    if (s.from.type === 'gps' || s.to.type === 'gps') startLocation();

    const a = resolveEnd(s.from, s.graph, s.user);
    const b = resolveEnd(s.to, s.graph, s.user);
    const key = `${a.nodeId}|${b.nodeId}|${a.msg}|${b.msg}|${s.graphVersion}`;
    if (key === lastKey) return;
    lastKey = key;

    const msg = a.msg || b.msg;
    if (msg) {
      mapView.clearRoute();
      store.set({ route: null, routeMsg: msg });
      return;
    }
    const result = shortestPath(s.graph, a.nodeId, b.nodeId, 'shortest');
    if (!result) {
      mapView.clearRoute();
      store.set({ route: null, routeMsg: 'No mapped path connects these two places yet.' });
      return;
    }
    if (result.steps.length === 0) {
      mapView.clearRoute();
      store.set({ route: result, routeMsg: 'You are already there.' });
      return;
    }

    // Only move the map when the user picked new ends, not when GPS drifts.
    const fitKey = `${JSON.stringify(s.from)}|${JSON.stringify(s.to)}`;
    const fit = fitKey !== lastFitKey;
    lastFitKey = fitKey;
    const sheetH = Math.max(document.getElementById('route-sheet').offsetHeight, 220);
    mapView.showRoute(routePolyline(s.graph, result.steps), { fit, animate: fit, bottomPad: sheetH });
    store.set({ route: result, routeMsg: null });
  });

  // 4. Mapper mode.
  recorder = createRecorder({
    getGraph: () => store.get().graph,
    setGraph: (graph) => store.set({ graph }),
    onChange: (ev) => {
      if (ev.type === 'point') {
        mapView.addTracePoint(ev.fix.lat, ev.fix.lon);
        return;
      }
      if (ev.graphChanged) persistGraph();
      if (recorder.getState() === 'walking') {
        if (ev.type === 'walk-started' || ev.type === 'node-marked') mapView.startTrace([[ev.node.lat, ev.node.lon]]);
      } else {
        mapView.clearTrace();
      }
      panel.render();
    },
  });
  panel = initMapperPanel(recorder, { onExit: () => setMode('navigate'), toast });

  // 5. Navigate UI and menu.
  initSearch(store);
  initSheet(store, { onClose: () => store.set({ to: null }) });
  initMenu(store, {
    onToggleMapper: () => {
      const mode = store.get().mode;
      if (mode === 'mapper' && recorder.getState() === 'walking') {
        toast('End or discard the walk first.');
        return;
      }
      setMode(mode === 'mapper' ? 'navigate' : 'mapper');
    },
    onFitAll: () => mapView.fitAll(),
    onExport: () => {
      downloadJSON(graphToJSON(store.get().graph), 'graph.json');
      toast('Exported graph.json. Put it in the project’s public folder to ship it.');
    },
    onImport: async (file) => {
      try {
        const json = await readJSONFile(file);
        if (json?.version !== 1) {
          toast('That file is not Campus Route map data.');
          return;
        }
        const { graph, errors } = loadGraph(json);
        store.set({ graph });
        persistGraph();
        mapView.fitAll();
        toast(errors.length > 0 ? `Imported. Skipped ${errors.length} broken items.` : 'Imported map data.');
      } catch {
        toast('Could not read that file. Choose a graph.json exported from this app.');
      }
    },
    onDiscard: () => {
      clearWorkingGraph();
      window.location.reload();
    },
  });
}

boot();
