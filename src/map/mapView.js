// The ONLY file that knows about Leaflet. Everything else talks to the map
// through the functions returned by createMapView(). To swap map engines
// later, rewrite this file and keep the same returned functions.
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONFIG } from '../config.js';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createMapView(container, { onPlaceTap = () => {} } = {}) {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    maxZoom: CONFIG.MAX_ZOOM,
  });
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  // Panes control stacking. Route above paths; user dot above route.
  // pointer-events none lets taps fall through to the place dots below.
  map.createPane('routePane');
  map.getPane('routePane').style.zIndex = '420';
  map.getPane('routePane').style.pointerEvents = 'none';
  map.createPane('userPane');
  map.getPane('userPane').style.zIndex = '450';
  map.getPane('userPane').style.pointerEvents = 'none';

  // Canvas draws many shapes cheaply. SVG is used only for the route, so it can animate.
  const canvas = L.canvas({ padding: 0.3, tolerance: 8 });
  const routeSvg = L.svg({ pane: 'routePane', padding: 0.3 });
  const userCanvas = L.canvas({ pane: 'userPane', padding: 0.3 });

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const pathsLayer = L.layerGroup().addTo(map);
  const placesLayer = L.layerGroup().addTo(map);
  const traceLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const userLayer = L.layerGroup().addTo(map);

  let tiles = null;
  let lastGraph = null;
  let showJunctions = false;
  let lastUser = null;
  let userDot = null;
  let userRing = null;
  let trace = null;
  let routeToken = 0;
  let lastRoute = null;

  function applyTiles() {
    const t = darkQuery.matches ? CONFIG.TILES.dark : CONFIG.TILES.light;
    if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains,
      maxNativeZoom: t.maxNativeZoom,
      maxZoom: CONFIG.MAX_ZOOM,
      detectRetina: false,
      keepBuffer: 1,
    }).addTo(map);
  }

  function redrawGraph() {
    pathsLayer.clearLayers();
    placesLayer.clearLayers();
    if (!lastGraph) return;
    const pathColor = cssVar('--c-path');
    const ink = cssVar('--c-ink');
    const ink2 = cssVar('--c-ink-2');
    const surface = cssVar('--c-surface');

    for (const e of lastGraph.edges.values()) {
      L.polyline(e.points.map((p) => [p[0], p[1]]), {
        renderer: canvas, color: pathColor, weight: 3, opacity: 0.8,
        dashArray: e.tags.stairs ? '2 6' : null, interactive: false,
      }).addTo(pathsLayer);
    }
    if (showJunctions) {
      for (const n of lastGraph.nodes.values()) {
        L.circleMarker([n.lat, n.lon], {
          renderer: canvas, radius: 4, color: ink2, weight: 2, fillColor: surface, fillOpacity: 1, interactive: false,
        }).addTo(pathsLayer);
      }
    }
    for (const p of lastGraph.places.values()) {
      const n = lastGraph.nodes.get(p.node);
      if (!n) continue;
      const dot = L.circleMarker([n.lat, n.lon], {
        renderer: canvas, radius: 7, color: surface, weight: 2, fillColor: ink, fillOpacity: 1,
      });
      dot.on('click', () => onPlaceTap(p.id));
      dot.addTo(placesLayer);
    }
  }

  function setGraph(graph, opts = {}) {
    lastGraph = graph;
    if (typeof opts.showJunctions === 'boolean') showJunctions = opts.showJunctions;
    redrawGraph();
  }

  function fitAll() {
    if (lastGraph && lastGraph.nodes.size > 0) {
      const lls = [...lastGraph.nodes.values()].map((n) => [n.lat, n.lon]);
      map.fitBounds(L.latLngBounds(lls), { padding: [40, 40], maxZoom: 18 });
    } else if (CONFIG.DEFAULT_CENTER) {
      map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);
    } else {
      map.setView([12.97, 77.59], 11); // Bengaluru overview until the campus centre is configured
    }
  }

  // Draws the line from start to end by animating stroke-dashoffset on one SVG path.
  function animateDraw(el) {
    if (!el || typeof el.getTotalLength !== 'function') return;
    const len = el.getTotalLength();
    if (!len) return;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.getBoundingClientRect(); // make the browser apply the start state before the transition
    el.style.transition = 'stroke-dashoffset 650ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    el.style.strokeDashoffset = '0';
    const reset = () => {
      el.style.transition = '';
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
    };
    el.addEventListener('transitionend', reset, { once: true });
    map.once('zoomstart', reset); // zooming changes the path length, so stop the effect
  }

  function drawRoute(latlngs, animate) {
    routeLayer.clearLayers();
    const route = cssVar('--c-route');
    const surface = cssVar('--c-surface');
    L.polyline(latlngs, {
      renderer: routeSvg, color: surface, weight: 11, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(routeLayer);
    const line = L.polyline(latlngs, {
      renderer: routeSvg, color: route, weight: 6, lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(routeLayer);
    L.circleMarker(latlngs[0], {
      renderer: routeSvg, radius: 7, color: route, weight: 3, fillColor: surface, fillOpacity: 1, interactive: false,
    }).addTo(routeLayer);
    L.circleMarker(latlngs[latlngs.length - 1], {
      renderer: routeSvg, radius: 8, color: surface, weight: 3, fillColor: route, fillOpacity: 1, interactive: false,
    }).addTo(routeLayer);
    if (animate && !reduceMotion.matches) animateDraw(line.getElement());
  }

  // fit: move the map to show the whole route first. bottomPad: pixels hidden by the sheet.
  function showRoute(latlngs, { fit = true, animate = true, bottomPad = 0 } = {}) {
    if (!latlngs || latlngs.length < 2) {
      clearRoute();
      return;
    }
    lastRoute = latlngs;
    const token = ++routeToken;
    if (!fit) {
      drawRoute(latlngs, false);
      return;
    }
    routeLayer.clearLayers();
    let drawn = false;
    const draw = () => {
      if (drawn || token !== routeToken) return; // a newer route replaced this one
      drawn = true;
      drawRoute(latlngs, animate);
    };
    map.once('moveend', draw);
    map.fitBounds(L.latLngBounds(latlngs), {
      paddingTopLeft: [32, 96],
      paddingBottomRight: [32, bottomPad + 24],
      maxZoom: 18,
    });
    setTimeout(draw, 450); // fallback when the map did not need to move
  }

  function clearRoute() {
    routeToken++;
    lastRoute = null;
    routeLayer.clearLayers();
  }

  function setUser(lat, lon, accuracyM) {
    lastUser = { lat, lon, accuracyM };
    const ll = [lat, lon];
    if (!userDot) {
      const here = cssVar('--c-here');
      const surface = cssVar('--c-surface');
      userRing = L.circle(ll, {
        renderer: userCanvas, radius: accuracyM, color: here, weight: 1, opacity: 0.6, fillColor: here, fillOpacity: 0.12, interactive: false,
      }).addTo(userLayer);
      userDot = L.circleMarker(ll, {
        renderer: userCanvas, radius: 7, color: surface, weight: 3, fillColor: here, fillOpacity: 1, interactive: false,
      }).addTo(userLayer);
      return;
    }
    userRing.setLatLng(ll);
    userRing.setRadius(accuracyM);
    userDot.setLatLng(ll);
  }

  function centerOn(lat, lon, zoom) {
    map.setView([lat, lon], zoom ?? Math.max(map.getZoom(), CONFIG.DEFAULT_ZOOM), { animate: true });
  }

  function startTrace(latlngs = []) {
    clearTrace();
    trace = L.polyline(latlngs, { renderer: canvas, color: cssVar('--c-rec'), weight: 4, interactive: false }).addTo(traceLayer);
  }

  function addTracePoint(lat, lon) {
    if (trace) trace.addLatLng([lat, lon]);
  }

  function clearTrace() {
    traceLayer.clearLayers();
    trace = null;
  }

  darkQuery.addEventListener('change', () => {
    applyTiles();
    redrawGraph();
    userLayer.clearLayers();
    userDot = null;
    userRing = null;
    if (lastUser) setUser(lastUser.lat, lastUser.lon, lastUser.accuracyM);
    if (lastRoute) drawRoute(lastRoute, false);
    if (trace) {
      const lls = trace.getLatLngs();
      startTrace(lls);
    }
  });

  applyTiles();
  fitAll();

  return { setGraph, fitAll, showRoute, clearRoute, setUser, centerOn, startTrace, addTracePoint, clearTrace };
}
