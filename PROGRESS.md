Skeleton complete

## Completed phases
- Phase 0: Scaffold (`npm test` passes, `npm run build` succeeds, git initialized with .gitignore).
- Phase 1: Core logic (pure modules and tests pass, purity check clean).
- Phase 2: Map shell (Leaflet map, GPS watcher, storage, styles, recorder state machine, UI shell, stubs for menu/search/sheet; build budgets passed: JS gzip 52.55 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB; campus gate set to [12.863833, 77.434773]).
- Phase 3: Menu (unlocks Mapper mode). `src/ui/menu.js` replaces the stub per §7.3: menu toggle with aria-expanded, mapper/fit/export/import/discard items, close on Escape/click-outside/item click, import via hidden file input, discard with confirm. Build passes: JS gzip 53.29 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB.
- Phase 4: Navigation UI. `src/ui/search.js` (§7.4) — place search with recent-first empty query, "Your location" GPS item for 'from' target, Enter/Escape/click-outside handling, event-delegated result clicks, store subscription for placeholder/disabled. `src/ui/sheet.js` (§7.5) — route sheet with from/to names, walk time/distance, message area, swap, close; `--sheet-h` CSS variable updates; subscribe + initial render. Build passes: JS gzip 54.89 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB.
- Phase 5: Polish and performance pass (§9). No forbidden CSS/JS patterns (`backdrop-filter`, `filter:`, `transition: all`, `setInterval`). No forbidden copy ("Submit", "OK", apologies). Global `:focus-visible` focus ring. Motion limited to transform/opacity except the route draw-in (650ms, §9-exempt). `prefers-reduced-motion` respected. Build budgets pass: JS gzip 54.89 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB.

## Deployment
- Deployed to Vercel: https://campus-route-three.vercel.app (production)
- Project: deploygo/campus-route
- Deployment protection: vercel_authentication (sign in to Vercel to access)
- GitHub: https://github.com/ethuuuu/quickchrist (not auto-linked to Vercel; deploy from CLI or connect repo in Vercel dashboard)

## Questions for the human
- Please confirm on phone (with real recorded data): searching a place shows the route with draw-in animation; sheet shows walking time and distance; "From" can be changed to a place; swap works; Close clears the route; no stutter when panning, zooming, opening the sheet, or when the route draws.
- After mapping, share the exported `graph.json` so it can be committed as the shipped `public/graph.json`.
- Pick an item from §13 (roadmap) to build next: least-effort routing, better elevation, OSM bootstrap, offline/PWA, map editing, snap-to-edges, avoid-stairs profile, draggable sheet, live follow, or engine swap.
