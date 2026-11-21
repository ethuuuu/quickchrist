Current phase: 4
Status: not started

## Completed phases
- Phase 0: Scaffold (`npm test` passes, `npm run build` succeeds, git initialized with .gitignore).
- Phase 1: Core logic (pure modules and tests pass, purity check clean).
- Phase 2: Map shell (Leaflet map, GPS watcher, storage, styles, recorder state machine, UI shell, stubs for menu/search/sheet; build budgets passed: JS gzip 52.55 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB; campus gate set to [12.863833, 77.434773]).
- Phase 3: Menu (unlocks Mapper mode). `src/ui/menu.js` replaces the stub per §7.3: menu toggle with aria-expanded, mapper/fit/export/import/discard items, close on Escape/click-outside/item click, import via hidden file input, discard with confirm. Build passes: JS gzip 53.29 kB ≤ 75 kB, CSS gzip 8.94 kB ≤ 12 kB.

## Notes for the next session
- Phase 4 will implement `src/ui/search.js` (§7.4) and `src/ui/sheet.js` (§7.5) — Navigation UI.

## Questions for the human
- Please confirm on phone: menu opens/closes, Mapper mode shows the mapper panel, a short test walk with 2–3 junctions draws grey paths, Undo works, Export downloads `graph.json`, Import loads it back.
- Would you like to deploy to Vercel instead of GitHub Pages so you can map from the phone over HTTPS?
