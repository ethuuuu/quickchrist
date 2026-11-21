// Every tunable number lives here. Never hard-code these values elsewhere.
export const CONFIG = {
  // HUMAN FILLS IN: [lat, lon] of the campus main gate. Leave null until given.
  // Agents must never guess this value.
  DEFAULT_CENTER: [12.863833, 77.434773],
  DEFAULT_ZOOM: 17,
  MAX_ZOOM: 19,

  TILES: {
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=cb1_5d98_1_17c9eb010b01ddd08a967bb0',
      subdomains: 'abcd',
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=cb1_5d98_1_17c9eb010b01ddd08a967bb0',
      subdomains: 'abcd',
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },

  // Average walking speed in metres per second (about 4.7 km/h).
  WALK_SPEED_MPS: 1.3,

  GPS: {
    ACCURACY_MAX_M: 20,      // fixes worse than this are ignored while recording
    NODE_ACCURACY_MAX_M: 12, // marking a junction or place needs at least this accuracy
    MIN_STEP_M: 3,           // ignore fixes closer than this to the last kept fix
    MAX_SPEED_MPS: 4,        // ignore jumps faster than a brisk walk
    TIMEOUT_MS: 15000,
  },

  GRAPH: {
    SNAP_RADIUS_M: 10,  // a new junction this close to an old one reuses the old one
    RDP_EPSILON_M: 2,   // path simplification tolerance
    MIN_EDGE_M: 3,      // shorter paths are not saved
  },

  ROUTE: {
    START_SNAP_MAX_M: 80, // "Your location" must be this close to a mapped point
  },

  UNDO_LIMIT: 30,

  STORAGE: {
    GRAPH: 'cr.workingGraph.v1',
    RECENT: 'cr.recent.v1',
  },
};
