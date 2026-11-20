# AGENTS.md — Campus Route

You are a coding agent working in this repository. This file is your teacher.
Read ALL of it before you do anything. It is loaded automatically every session.

There is a second file, `docs/REFERENCE.md`. It holds tested code that you copy
into the project. You do not need to read it all at once. Open it only when a
step below says "copy from R<number>".

---

## 0. How to work (read this first, every session)

1. Open `PROGRESS.md`. Its first line tells you the current phase.
   If `PROGRESS.md` does not exist, you are in Phase 0.
2. Do ONLY the current phase. Do not start the next phase, even if it looks easy.
3. Do the steps of the phase in order. After each step, run the check under it.
4. When a step says "copy from R5", open `docs/REFERENCE.md`, find the heading
   `## R5`, and copy the code inside the fenced block (between the ``` lines)
   into the file named in that heading. Copy it exactly. Do not "improve" it,
   do not shorten it, do not rename anything. It is tested and tuned for a slow phone.
   Do not copy the ``` fence lines themselves.
5. When every item in the phase's "Done when" list is true:
   update `PROGRESS.md`, commit (see §11), then STOP and tell the human
   exactly what to test on their phone.
6. If the same error survives 2 fix attempts, STOP. Write the full error text
   in `PROGRESS.md` under "Questions for the human" and ask the human.

### Golden rules

- Make small edits. Change only the files the current step names.
  Never rewrite a whole file to fix one line. Use your edit tool, not a full rewrite.
- Never delete or rename a file unless a step tells you to.
- Never install a package that is not listed in §3.
- Plain JavaScript with ES modules. No TypeScript. No React, Vue, jQuery,
  lodash, Tailwind, Bootstrap, or any UI kit.
- Every local import path is relative and ends in `.js`:
  `import { haversineM } from './geo.js';` (correct)
  `import { haversineM } from './geo';` (wrong — breaks in Node tests)
- PURE modules (listed in §4) must never use `document`, `window`, `navigator`,
  `localStorage`, `fetch`, `import.meta`, Leaflet, or CSS imports.
  They run inside Node during `npm test`, where those things do not exist.
- Only `src/map/mapView.js` may import Leaflet. Nothing else.
- All tunable numbers live in `src/config.js`. Never hard-code a number
  like 20 (metres) or 1.3 (walking speed) anywhere else.
- Never invent coordinates, place names, or campus facts. Ask the human.
- Never run `npm run dev` yourself. It starts a server that never exits, and
  your shell will hang. Use `npm test` and `npm run build` for checks.
  The human runs `npm run dev` when they test on the phone.

---

## 1. What we are building

A mobile web app for students at Christ University, Kengeri Campus (Bengaluru).
It finds the shortest WALKING route between places on campus and a few places
just outside it (metro, bus stop, shops).

The map background comes from OpenStreetMap tiles. The walking paths do NOT come
from OpenStreetMap. The human records them by walking around campus with their
phone while the app is in "Mapper mode". The app turns those GPS traces into a
graph, and routes with Dijkstra's algorithm.

The target phone is weak: MediaTek Helio G35 (PowerVR GE8320 GPU, 2–3 GB RAM,
720p screen). The app must feel smooth and modern on THAT phone. See §9.

Two modes:
- **Navigate mode** (default): search a place, see the shortest route,
  walking time, and distance.
- **Mapper mode**: walk, tap "Mark junction" where paths meet, tap
  "Add a place here" at destinations. Export the data as `graph.json`.

---

## 2. Words used in this project

- **node**: a point in the walking network. Has `kind`: `"junction"` (paths meet
  or turn) or `"place"` (a destination).
- **edge**: a walkable path between two nodes, stored as a polyline (list of points).
  Edges are two-way.
- **place**: a named destination such as "Main Auditorium". Attached to one node.
- **graph**: all nodes + edges + places.
- **fix**: one GPS reading `{ lat, lon, alt, accuracy, ts }`.
  `accuracy` is in metres (smaller is better). `ts` is milliseconds since 1970.
- **segment**: the fixes recorded since the last node was marked.
- **route**: the cheapest list of edges from a start node to a goal node.
- **profile**: the rule that turns an edge into a cost. Today only `"shortest"`
  (cost = length in metres). A `"least-effort"` profile comes later (§13).
- **working graph**: the graph saved on the phone (localStorage) after edits.
- **shipped graph**: `public/graph.json`, committed to the repo.

---

## 3. Stack (exact)

| Thing | Choice | Why |
|---|---|---|
| Build tool | Vite (latest) | Fast dev server, tiny output |
| Language | JavaScript ES2020, ES modules | No compile step to debug |
| Map engine | Leaflet **1.9.4** exactly | ~40 KB, moves tiles with CSS transforms, smooth on weak GPUs |
| Tiles | CARTO Positron / Dark Matter (OpenStreetMap data) | Clean look, light + dark |
| HTTPS in dev | `@vitejs/plugin-basic-ssl` | Phone GPS only works on HTTPS |
| Font | `@fontsource/atkinson-hyperlegible` (400, 700) | Built for legibility; readable in sunlight while walking |
| Tests | Node's built-in test runner (`node --test`) | Zero extra packages |
| Node | 20 or newer | |

Install commands (Phase 0 runs these, nothing else ever gets installed):

```
npm install leaflet@1.9.4 @fontsource/atkinson-hyperlegible
npm install -D vite @vitejs/plugin-basic-ssl
```

---

## 4. File tree (final shape)

```
.
├── AGENTS.md                 this file
├── PROGRESS.md               phase tracker (you update it)
├── docs/REFERENCE.md         code to copy
├── index.html                app markup (R16)
├── package.json              (R1)
├── vite.config.js            (R2)
├── .gitignore                (R3)
├── public/
│   └── graph.json            shipped map data
├── src/
│   ├── main.js               BROWSER  wires everything together (R24)
│   ├── config.js             PURE     all tunable numbers (R5)
│   ├── geo.js                PURE     distance, simplification (R6)
│   ├── heap.js               PURE     min-heap for Dijkstra (R7)
│   ├── cost.js               PURE     edge cost per profile (R8)
│   ├── graph.js              PURE     load/validate/edit graph (R9)
│   ├── router.js             PURE     Dijkstra + route polyline (R10)
│   ├── format.js             PURE     "5 min walk", "420 m" (R11)
│   ├── searchIndex.js        PURE     place search scoring (R12)
│   ├── store.js              PURE     tiny state store (R14)
│   ├── location.js           BROWSER  single GPS watcher (R19)
│   ├── storage.js            BROWSER  localStorage, export/import (R20)
│   ├── map/
│   │   └── mapView.js        BROWSER  the ONLY Leaflet file (R18)
│   ├── recorder/
│   │   ├── filter.js         PURE     accept/reject GPS fixes (R13)
│   │   └── recorder.js       BROWSER  mapper-mode state machine (R22)
│   ├── ui/
│   │   ├── toast.js          BROWSER  (R21)
│   │   ├── mapperPanel.js    BROWSER  (R23)
│   │   ├── menu.js           BROWSER  YOU WRITE IT in Phase 3 (§7.3)
│   │   ├── search.js         BROWSER  YOU WRITE IT in Phase 4 (§7.4)
│   │   └── sheet.js          BROWSER  YOU WRITE IT in Phase 4 (§7.5)
│   └── styles/
│       └── app.css           (R17)
├── tests/                    one test file per pure module (R15)
└── .github/workflows/deploy.yml   optional (R25)
```

### Import rules (who may import whom)

- PURE modules import only other PURE modules.
- `mapView.js` imports `leaflet`, `leaflet/dist/leaflet.css`, and `config.js`. Nothing else.
- `ui/*.js` files never import `mapView.js`. They get what they need as
  function arguments (callbacks) from `main.js`.
- `main.js` is the only file that imports everything.

Why: the map engine can be swapped later (MapLibre, a custom engine) by
rewriting ONE file. Keep that boundary clean.

---

## 5. Data format: `public/graph.json`

```json
{
  "version": 1,
  "nodes": [
    { "id": "n_abc", "lat": 12.860123, "lon": 77.437456, "ele": 812.4, "kind": "junction" },
    { "id": "n_def", "lat": 12.860901, "lon": 77.438002, "ele": null,  "kind": "place" }
  ],
  "edges": [
    {
      "id": "e_xyz", "a": "n_abc", "b": "n_def",
      "points": [[12.860123, 77.437456, 812.4], [12.86051, 77.43771, null], [12.860901, 77.438002, null]],
      "length_m": 104.7,
      "tags": { "stairs": false, "steep": true }
    }
  ],
  "places": [
    { "id": "p_1", "name": "Block A", "node": "n_def", "category": "academic", "aliases": ["A block"], "outside": false }
  ]
}
```

(The coordinates above are made-up examples. They are not campus locations.)

Rules:
- `points[0]` equals node `a`'s position. The last point equals node `b`'s position.
- Each point is `[lat, lon, ele]`. `ele` is metres or `null`. Lat/lon have at most 6 decimals.
- `ele` is collected now (from phone GPS altitude, often `null`) so a
  least-effort profile can use it later. Never remove the field.
- `tags.stairs` / `tags.steep` are set by the human while walking. They are the
  most reliable effort signal we have. Never remove them.
- `category` is one of: `academic`, `food`, `hostel`, `sports`, `admin`, `transport`, `other`.
- In memory (after `loadGraph`) nodes, edges, and places are `Map`s keyed by id,
  plus `adj`: a `Map` from node id to `[{ to, edgeId }]`.

Initial content of `public/graph.json`:

```json
{"version":1,"nodes":[],"edges":[],"places":[]}
```

---

## 6. Phases

### Phase 0 — Scaffold

Steps:
1. Run `node --version`. It must be v20 or higher. If not, STOP and tell the human.
2. If there is no `.git` folder, run `git init`.
3. Create `package.json` — copy from R1.
4. Run both install commands from §3.
5. Create `vite.config.js` (R2), `.gitignore` (R3), `PROGRESS.md` (R4).
6. Create `public/graph.json` with the initial content from §5.
7. Create a temporary `index.html`:
   ```html
   <!doctype html>
   <html lang="en"><head><meta charset="utf-8"><title>Campus Route</title></head>
   <body><p>Campus Route</p><script type="module" src="/src/main.js"></script></body></html>
   ```
8. Create a temporary `src/main.js` containing one line: `console.log('Campus Route booting');`
9. Create `tests/smoke.test.js`:
   ```js
   import { test } from 'node:test';
   import assert from 'node:assert/strict';
   test('smoke', () => { assert.equal(1 + 1, 2); });
   ```

Done when:
- [ ] `npm test` passes (1 test).
- [ ] `npm run build` succeeds and creates `dist/`.
- [ ] `git status` does not list `node_modules/` or `dist/`.

### Phase 1 — Core logic (pure modules + tests)

Steps (copy each, then run `npm test` after each test file is added):
1. `src/config.js` (R5). Leave `DEFAULT_CENTER: null`. Only the human fills it.
2. `src/geo.js` (R6), `src/heap.js` (R7), `src/cost.js` (R8).
3. `src/graph.js` (R9), `src/router.js` (R10).
4. `src/format.js` (R11), `src/searchIndex.js` (R12), `src/recorder/filter.js` (R13), `src/store.js` (R14).
5. All test files from R15 (each has its own file name in its heading).
6. Purity check. Run:
   ```
   grep -nE "document|window|navigator|localStorage|fetch\(|import\.meta|leaflet" src/config.js src/geo.js src/heap.js src/cost.js src/graph.js src/router.js src/format.js src/searchIndex.js src/store.js src/recorder/filter.js
   ```
   Expected: no output.

Done when:
- [ ] `npm test` passes every test.
- [ ] The purity check prints nothing.

How Dijkstra works here (so you can debug it):
- `dist` maps node id → best known cost from the start.
- The heap holds `(cost, nodeId)` pairs. We pop the cheapest.
- A node can be in the heap more than once. When popped, if it is already in
  `done`, skip it ("lazy deletion"). This is correct and simpler than decrease-key.
- When we pop the goal, stop. Walk `prev` backwards to rebuild the path.
- Edges are two-way: `adj` lists each edge from both ends.
- `routePolyline` reverses an edge's points when we walk it from `b` to `a`.

### Phase 2 — Map shell

Steps:
1. Replace `index.html` with R16.
2. Create `src/styles/app.css` (R17).
3. Create `src/map/mapView.js` (R18), `src/location.js` (R19), `src/storage.js` (R20), `src/ui/toast.js` (R21).
4. Create `src/recorder/recorder.js` (R22) and `src/ui/mapperPanel.js` (R23).
5. Create these three STUB files exactly (they are replaced in Phases 3 and 4):
   `src/ui/menu.js`:
   ```js
   // STUB — replaced in Phase 3.
   export function initMenu(store, handlers) {}
   ```
   `src/ui/search.js`:
   ```js
   // STUB — replaced in Phase 4.
   export function initSearch(store) {}
   ```
   `src/ui/sheet.js`:
   ```js
   // STUB — replaced in Phase 4.
   export function initSheet(store, handlers) {}
   ```
6. Replace `src/main.js` with R24.
7. Run `npm test` and `npm run build`.
8. Ask the human: "Please give me the latitude and longitude of the campus main
   gate (right-click it on openstreetmap.org)." Put it in `CONFIG.DEFAULT_CENTER`
   as `[lat, lon]`. If the human does not answer, leave it `null` (the map then
   shows Bengaluru and the locate button finds the user).
9. Optional: ask the human if they want GitHub Pages deployment now
   (it gives a permanent HTTPS address, which makes mapping walks easier).
   If yes: create `.github/workflows/deploy.yml` from R25 and tell the human to
   set Settings → Pages → Source to "GitHub Actions" in their repo.

Done when:
- [ ] `npm test` and `npm run build` pass.
- [ ] Build output: JS gzip ≤ 75 kB, CSS gzip ≤ 12 kB (Vite prints these).
- [ ] Tell the human to run `npm run dev` and check on the phone (see §10):
      map tiles show, the locate button shows a marigold dot, dark mode
      on the phone switches to dark tiles.

### Phase 3 — Menu (unlocks Mapper mode)

Steps:
1. Replace the stub `src/ui/menu.js` with your own code following §7.3 exactly.
2. Run `npm test` and `npm run build`.

Done when:
- [ ] Build passes.
- [ ] Human confirms on phone: menu opens and closes, Mapper mode shows the
      mapper panel, a short test walk with 2–3 junctions draws grey paths,
      Undo works, Export downloads `graph.json`, Import loads it back.
- [ ] Remind the human: "Export after every mapping session. Data on the phone
      is stored per web address; if the laptop's Wi-Fi address changes, the
      app opens empty and you must Import your last export."

### Phase 4 — Navigation UI

Steps:
1. Replace the stub `src/ui/search.js` following §7.4.
2. Replace the stub `src/ui/sheet.js` following §7.5.
3. Run `npm test` and `npm run build`.

Done when:
- [ ] Build passes.
- [ ] Human confirms on phone with real recorded data: searching a place shows
      the route with a draw-in animation; the sheet shows walking time and
      distance; "From" can be changed to a place; swap works; Close clears the route.

### Phase 5 — Polish and performance pass

Steps:
1. Check every rule in §9 against the code. Fix any violation with a small edit.
2. Run: `grep -rnE "backdrop-filter|filter:|transition: *all|setInterval" src/`
   Expected: no output. Fix anything it finds.
3. Check every user-visible string against §8 (copy rules).
4. Check keyboard focus: every button shows the focus ring from `app.css`.
5. Run `npm run build` and confirm the size budgets from Phase 2.

Done when:
- [ ] All checks above pass.
- [ ] Human confirms: no stutter when panning, zooming, opening the sheet,
      or when the route draws, on the Helio G35 phone.

After Phase 5, the skeleton is complete. Write "Skeleton complete" in
PROGRESS.md and wait for the human to pick an item from §13.

---

## 7. Behaviour specs

### 7.1 State (owned by `main.js`, held in `store.js`)

```js
{
  graph,            // in-memory graph from loadGraph()
  graphVersion,     // number, +1 after every edit (triggers re-routing)
  usingLocalEdits,  // true when the working graph came from localStorage
  mode,             // 'navigate' | 'mapper'
  user,             // latest GPS fix or null
  from,             // { type: 'gps' } or { type: 'place', placeId }
  to,               // null, { type: 'gps' }, or { type: 'place', placeId }
  route,            // result of shortestPath() or null
  routeMsg,         // string shown in the sheet instead of a route, or null
  searchTarget,     // 'to' | 'from' — which end the search box is filling
}
```

`store.set(patch)` merges the patch and calls every subscriber with the new state.
Subscribers must be safe to call many times (they re-render; that is fine).

### 7.2 Mapper mode (already implemented in R22 + R23 — read to understand)

- "Start walk here" needs a fix with accuracy ≤ `CONFIG.GPS.NODE_ACCURACY_MAX_M`.
  It snaps to an existing node within `SNAP_RADIUS_M`, or creates a junction.
- While walking, fixes pass through `shouldAcceptFix` (drops inaccurate fixes,
  fixes closer than 3 m, and jumps faster than 4 m/s).
- "Mark junction" closes the segment into an edge (simplified with
  Ramer–Douglas–Peucker, ε = 2 m) and starts a new segment from that node.
- "Stairs" / "Steep" chips tag the CURRENT segment and reset at each junction.
- "Add a place here" works walking or standing still.
- "Undo last change" only works when not walking. It restores a JSON snapshot.
- The screen is kept awake with the Wake Lock API while walking, because
  Android stops GPS for web pages when the screen turns off.
- Every graph change is saved to localStorage immediately.

### 7.3 `src/ui/menu.js` — you write this in Phase 3

Export exactly: `export function initMenu(store, handlers)`

`handlers` has: `onToggleMapper()`, `onFitAll()`, `onExport()`,
`onImport(file)`, `onDiscard()`. `main.js` already passes them.

Elements (already in `index.html`): `#menu-btn`, `#menu`, `#menu-mapper`,
`#menu-fit`, `#menu-export`, `#menu-import`, `#menu-discard`, `#import-file`.

Behaviour:
1. Clicking `#menu-btn` toggles `#menu.hidden`. Set `#menu-btn`'s
   `aria-expanded` to `"true"`/`"false"` to match.
2. Every time the menu OPENS, read `store.get()` and:
   - set `#menu-mapper` attribute `aria-pressed` to `"true"` if `mode === 'mapper'`, else `"false"`;
   - set `#menu-discard.hidden = !usingLocalEdits`.
3. Close the menu (hidden = true, aria-expanded = "false") when:
   - any menu item is clicked (close first, then run its handler);
   - the Escape key is pressed (listen on `document` for `keydown`);
   - a `pointerdown` happens outside both `#menu` and `#menu-btn`
     (use `element.contains(event.target)`).
4. Items:
   - `#menu-mapper` → `handlers.onToggleMapper()`
   - `#menu-fit` → `handlers.onFitAll()`
   - `#menu-export` → `handlers.onExport()`
   - `#menu-import` → `document.getElementById('import-file').click()`.
     On the file input's `change` event: if `input.files[0]` exists, call
     `handlers.onImport(input.files[0])`, then set `input.value = ''` so the
     same file can be chosen again.
   - `#menu-discard` → `if (confirm('Discard your map edits on this phone and go back to the shipped map?')) handlers.onDiscard();`
5. Register every listener ONCE inside `initMenu`. Never add listeners inside
   another listener (that leaks and makes handlers fire many times).

Template to start from:
```js
export function initMenu(store, handlers) {
  const $ = (id) => document.getElementById(id);
  const menu = $('menu');
  const btn = $('menu-btn');

  function open() { /* step 2, then menu.hidden = false; btn aria-expanded true */ }
  function close() { /* menu.hidden = true; btn aria-expanded false */ }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  // ... steps 3 and 4
}
```

### 7.4 `src/ui/search.js` — you write this in Phase 4

Export exactly: `export function initSearch(store)`

Imports you need:
```js
import { searchPlaces } from '../searchIndex.js';
import { CATEGORY_LABELS } from '../graph.js';
import { loadRecent, pushRecent } from '../storage.js';
```

Elements: `#search-input`, `#search-results` (a `<ul>`), `.topbar`.

Behaviour:
1. `render()` builds the result list:
   - `const s = store.get();`
   - `const results = searchPlaces(s.graph.places.values(), input.value, loadRecent(), 8);`
   - If `s.searchTarget === 'from'`, put a "Your location" item FIRST with id `__gps`.
   - Each result is `<li><button class="result" data-id="ID"><span class="result-name">NAME</span><span class="result-meta">META</span></button></li>`.
     META is `"Off campus"` if `place.outside`, else `CATEGORY_LABELS[place.category]`.
     For "Your location", META is `"Use GPS"`.
   - Build elements with `document.createElement` and `textContent`.
     NEVER put place names into `innerHTML` (imported files could contain HTML).
   - Build into a `DocumentFragment`, then `list.replaceChildren(fragment)`. One DOM write.
   - If the graph has no places: one `<li class="results-empty">` with
     `No places yet. Open the menu, turn on Mapper mode, and add a place.`
   - If there are places but no matches: `<li class="results-empty">` with
     `No place matches “TEXT”. Try another name.`
   - Show the list: `list.hidden = false`.
2. Events:
   - `focus` and `input` on the input → `render()`.
   - `keydown` Enter on the input → choose the first result button, if any.
   - `keydown` Escape → hide the list and `input.blur()`.
   - `pointerdown` on `document` outside `.topbar` → hide the list.
   - ONE `click` listener on the list (event delegation):
     `const b = e.target.closest('button[data-id]'); if (!b) return; choose(b.dataset.id);`
3. `choose(id)`:
   - Target is `store.get().searchTarget`.
   - If `id === '__gps'` the end is `{ type: 'gps' }`, else `{ type: 'place', placeId: id }`
     and call `pushRecent(id)`.
   - `store.set({ [target]: end, searchTarget: 'to' })`.
   - Clear the input, hide the list, `input.blur()`.
4. Subscribe to the store:
   - `input.placeholder = s.searchTarget === 'from' ? 'Choose start' : 'Where to?'`
   - In mapper mode: `input.disabled = true` and placeholder `'Search is off while mapping'`,
     and hide the list. In navigate mode: `input.disabled = false`.
   - Only write a DOM property when its value actually changes (compare first).

### 7.5 `src/ui/sheet.js` — you write this in Phase 4

Export exactly: `export function initSheet(store, handlers)` — `handlers.onClose()`.

Imports:
```js
import { CONFIG } from '../config.js';
import { formatDistance, formatWalk } from '../format.js';
```

Elements: `#route-sheet`, `#from-btn`, `#from-name`, `#to-btn`, `#to-name`,
`#swap-btn`, `#route-walk`, `#route-dist`, `#route-msg`, `#route-close-btn`, `#search-input`.

`render(s)` (subscribe it, and call it once at start):
1. If `s.mode !== 'navigate'`: set `sheet.dataset.open = 'false'` and RETURN
   without touching `document.body` (the mapper panel owns it then).
2. `open = s.to !== null`. Set `sheet.dataset.open = String(open)` and
   `document.body.dataset.sheet = open ? 'open' : 'closed'`. If not open, return.
3. Names: an end `{ type: 'gps' }` shows `Your location`. A place end shows
   `s.graph.places.get(id)?.name ?? 'Unknown place'`.
4. If `s.route` exists and `s.route.steps.length > 0`:
   `#route-walk` = `formatWalk(s.route.lengthM, CONFIG.WALK_SPEED_MPS)`,
   `#route-dist` = `formatDistance(s.route.lengthM)`, both visible.
   Otherwise hide both.
5. `#route-msg.hidden = !s.routeMsg`, text = `s.routeMsg ?? ''`.
6. Last: `document.body.style.setProperty('--sheet-h', sheet.offsetHeight + 'px')`
   (this lifts the locate button above the sheet).

Clicks (register once):
- `#from-btn` → `store.set({ searchTarget: 'from' })`, then focus `#search-input`.
- `#to-btn` → `store.set({ searchTarget: 'to' })`, then focus `#search-input`.
- `#swap-btn` → `const s = store.get(); if (s.to) store.set({ from: s.to, to: s.from });`
- `#route-close-btn` → `handlers.onClose()`.

---

## 8. Design spec

The look: campus wayfinding signage. Quiet map, one strong route line.
The route is drawn like a transit line: a white casing with a signal-blue line
on top, a hollow start ring, a solid end disc. The "you are here" dot is
marigold, like the dot on a campus signboard. That route moment is the ONE
memorable element. Everything else stays calm.

Tokens (defined in `app.css`, light and dark). Use ONLY these, never new hex values:
- `--c-ink` text, `--c-ink-2` secondary text, `--c-surface` panels,
  `--c-surface-2` fills, `--c-line` borders
- `--c-route` route + primary buttons, `--c-on-route` text on them
- `--c-here` user location, `--c-rec` recording, `--c-ok` good GPS, `--c-path` mapped paths

Type: Atkinson Hyperlegible, 400 and 700 only. Sizes: `--fs-s` 13px,
`--fs-m` 16px, `--fs-l` 20px, `--fs-xl` 28px. Sentence case everywhere.
No ALL CAPS labels. No monospace.

Shape hierarchy: search pill fully round, sheets 20px top corners,
buttons 12px, chips fully round, FAB circle.

Touch targets: at least 44×44 px.

Motion:
- Only animate `transform` and `opacity`.
- Durations: 160 ms (small things), 240 ms (sheets). Easing `var(--ease-out)`.
- The route draw-in (650 ms) is the only motion that is not a direct
  response to a tap. Do not add more ambient motion: no pulsing dots,
  no shimmer, no looping animations.
- `prefers-reduced-motion` is respected globally in `app.css`. Keep it.

Copy rules:
- Buttons say exactly what happens: "Start walk here", "Mark junction",
  "Export map data". Never "Submit" or "OK".
- An action keeps its name: the button "Export map data" → toast "Exported…".
- Errors say what went wrong AND how to fix it. They never apologise.
- Empty states tell the user what to do next.

---

## 9. Performance rules (Helio G35 budget)

CSS:
- Never use `backdrop-filter`, `filter`, blur, or glassmorphism.
- Never animate `width`, `height`, `top`, `left`, `margin`, `box-shadow`, or colours.
- Never use `transition: all`.
- Shadows: only `var(--shadow-float)` on floating controls. No large soft shadows.
- No gradients over the map.
- `will-change: transform` only on `.sheet` and `.panel` (already set). Nowhere else.

JavaScript:
- No `setInterval`. Use events. Use `requestAnimationFrame` only for real animation.
- On each GPS fix, update only the user marker (`setLatLng`), never redraw the graph.
- While recording, add ONE point to the trace (`addLatLng`), never `setLatLngs` of the whole trace.
- Build lists in a `DocumentFragment`, write to the DOM once.
- Do not read layout (`offsetHeight`, `getBoundingClientRect`) inside loops.
- Register event listeners once. Never inside other listeners.

Leaflet (already configured in R18 — do not change these):
- `preferCanvas: true` and a canvas renderer for paths, places, user dot, trace.
- One SVG renderer, in its own pane, only for the route (so it can animate).
- `detectRetina: false` (half the tile downloads), `keepBuffer: 1` (less memory).
- Never use `L.marker` with the default icon (its image paths break under Vite,
  and DOM markers are slower). Use `L.circleMarker`.

Budgets (from `npm run build` output):
- JS ≤ 75 kB gzip (Leaflet is ~40 of that). CSS ≤ 12 kB gzip.

---

## 10. Commands, and how the human tests on the phone

| Command | Who runs it | What it does |
|---|---|---|
| `npm test` | you | Runs all tests in Node. Must pass before every commit. |
| `npm run build` | you | Builds to `dist/`. Prints sizes. Must pass. |
| `npm run dev` | HUMAN ONLY | HTTPS dev server, reachable from the phone. Never exits. |
| `npm run preview` | HUMAN ONLY | Serves the built `dist/`. Never exits. |

Phone testing steps (tell the human these when a phase asks for a phone check):
1. Laptop and phone on the same network. Campus Wi-Fi often blocks phone↔laptop
   traffic; if the page will not load, turn on the phone's hotspot and connect
   the laptop to it.
2. Run `npm run dev`. Vite prints `Network: https://<address>:5173/`.
3. Open that address in Chrome on the phone. Chrome warns about the certificate
   (it is a self-signed dev certificate): tap Advanced → Proceed.
4. Allow location when asked.
5. For walking tests away from the laptop, either carry the laptop on the
   hotspot, or use the GitHub Pages deployment (Phase 2, step 9).
6. Desk testing without walking: Chrome DevTools → More tools → Sensors →
   Location lets you fake a position.

---

## 11. Git rules

- Commit once per finished phase: `git add -A && git commit -m "phase N: <short summary>"`.
- Do NOT add `Co-Authored-By`, `Generated with`, `Claude-Session`, or any AI
  attribution lines or trailers to commit messages. The message is only the summary line.
- Never change `git config` (user.name, user.email, or anything else).
- Never push, force-push, rebase, or delete branches unless the human asks.
- Never commit `node_modules/` or `dist/` (`.gitignore` handles this).

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| GPS error "Only secure origins are allowed", or code 1 on the phone | Page opened over `http://` | Use the `https://` Network URL. Check Chrome site settings → Location → Allow. |
| Map is grey, or tiles appear scattered | `leaflet/dist/leaflet.css` not imported, or `#map` has no height | `mapView.js` must import the CSS. `app.css` gives `#map` `position: fixed; inset: 0`. |
| Broken image icons on the map | Someone used `L.marker` | Replace with `L.circleMarker`. |
| `npm test`: "Cannot use import statement outside a module" | `"type": "module"` missing | Restore `package.json` from R1. |
| `npm test`: "document is not defined" / "window is not defined" | A pure module touches the browser | Move that code to a BROWSER module. Re-run the Phase 1 purity check. |
| `npm test`: "Cannot read properties of undefined (reading 'BASE_URL')" | `import.meta.env` in a pure module | Only `main.js` may use `import.meta.env`. |
| `npm test`: "Cannot find module '../src/geo'" | Import path missing `.js` | Add `.js` to the path. |
| Route is null although paths look connected | Two junctions placed close but not snapped, so the graph is split | Re-walk that spot and mark the junction again; it snaps within 10 m. |
| Route is null right after an edit | `adj` not updated | Edits must go through `graph.js` functions (they update `adj`). Never push to `graph.edges` directly. |
| Recording stops when the screen turns off | Browsers pause GPS for background pages | Wake lock keeps the screen on; tell the human not to lock the phone mid-walk. |
| Phone cannot open the dev URL | Network isolation or laptop firewall | Use the phone hotspot; allow incoming connections for Node on the laptop. |
| Data gone after reopening | Different address = different localStorage | Import the last exported `graph.json`. |
| Build fails after copying reference code | Fence lines or headings got copied | Remove any ``` lines or `## R` lines from the file. |

---

## 13. Roadmap — do NOT build any of this until the human asks

Each item notes where it plugs in, so the skeleton never has to be torn down.

1. **Least-effort routing.** Add a profile in `cost.js` only. Sketch:
   `cost = length_m × (tags.steep ? 1.5 : 1) + (tags.stairs ? 25 : 0) + 8 × climb_m`,
   where `climb_m` is the elevation gained going `from → to` (direction matters,
   which is why `edgeCost` already receives `fromId`). 8 m per metre climbed
   comes from Naismith's hiking rule. Add a profile switch in the sheet.
2. **Better elevation.** Phone GPS altitude is noisy (often ±10 m or worse), and
   free elevation models (SRTM, Copernicus, 30 m grid) are too coarse for paths
   20 m apart. Options: average altitude over many walks per node; a build-time
   script `scripts/fill-elevation.js` that fills `ele` from a DEM API. Never call
   an elevation API from the phone at runtime.
3. **Bootstrap from OpenStreetMap.** A build-time script that downloads
   `highway=footway|path|steps|pedestrian` ways inside the campus boundary via the
   Overpass API and converts them to `graph.json` format. OSM `incline` and
   `highway=steps` map onto our `steep` / `stairs` tags.
4. **Offline / installable app.** Web app manifest + service worker caching the
   app shell and `graph.json`. Respect tile providers' usage policies: do not
   bulk-download tiles.
5. **Map editing.** Delete an edge, move a node, rename a place, edit aliases.
6. **Snap to edges.** Start from the nearest point on an edge instead of the nearest node.
7. **Avoid-stairs profile** for accessibility (cost = Infinity on stairs edges).
8. **Draggable sheet** with a pointer-events gesture (transform only).
9. **Live follow** while walking: re-centre, show remaining distance.
10. **Engine swap** (MapLibre GL or a custom renderer): rewrite `mapView.js`
    only, keeping the same exported functions.
