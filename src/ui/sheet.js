import { CONFIG } from '../config.js';
import { formatDistance, formatWalk } from '../format.js';

export function initSheet(store, handlers) {
  const sheet = document.getElementById('route-sheet');
  const fromBtn = document.getElementById('from-btn');
  const fromName = document.getElementById('from-name');
  const toBtn = document.getElementById('to-btn');
  const toName = document.getElementById('to-name');
  const swapBtn = document.getElementById('swap-btn');
  const routeWalk = document.getElementById('route-walk');
  const routeDist = document.getElementById('route-dist');
  const routeMsg = document.getElementById('route-msg');
  const routeCloseBtn = document.getElementById('route-close-btn');
  const searchInput = document.getElementById('search-input');

  let lastOpen = null;
  let lastBodySheet = null;
  let lastFromName = null;
  let lastToName = null;
  let lastWalkHidden = null;
  let lastDistHidden = null;
  let lastMsgHidden = null;
  let lastMsgText = null;

  function nameFor(end, graph) {
    if (end.type === 'gps') return 'Your location';
    return graph.places.get(end.placeId)?.name ?? 'Unknown place';
  }

  function render(s) {
    if (s.mode !== 'navigate') {
      sheet.dataset.open = 'false';
      return;
    }

    const open = s.to !== null;
    sheet.dataset.open = String(open);
    document.body.dataset.sheet = open ? 'open' : 'closed';
    if (!open) return;

    const fromNameText = nameFor(s.from, s.graph);
    const toNameText = nameFor(s.to, s.graph);
    if (lastFromName !== fromNameText) { fromName.textContent = fromNameText; lastFromName = fromNameText; }
    if (lastToName !== toNameText) { toName.textContent = toNameText; lastToName = toNameText; }

    if (s.route && s.route.steps.length > 0) {
      if (lastWalkHidden !== false) { routeWalk.hidden = false; lastWalkHidden = false; }
      if (lastDistHidden !== false) { routeDist.hidden = false; lastDistHidden = false; }
      routeWalk.textContent = formatWalk(s.route.lengthM, CONFIG.WALK_SPEED_MPS);
      routeDist.textContent = formatDistance(s.route.lengthM);
    } else {
      if (lastWalkHidden !== true) { routeWalk.hidden = true; lastWalkHidden = true; }
      if (lastDistHidden !== true) { routeDist.hidden = true; lastDistHidden = true; }
    }

    if (lastMsgHidden !== !s.routeMsg) { routeMsg.hidden = !s.routeMsg; lastMsgHidden = !s.routeMsg; }
    if (lastMsgText !== s.routeMsg) { routeMsg.textContent = s.routeMsg ?? ''; lastMsgText = s.routeMsg ?? ''; }

    document.body.style.setProperty('--sheet-h', `${sheet.offsetHeight}px`);
  }

  fromBtn.addEventListener('click', () => {
    store.set({ searchTarget: 'from' });
    searchInput.focus();
  });

  toBtn.addEventListener('click', () => {
    store.set({ searchTarget: 'to' });
    searchInput.focus();
  });

  swapBtn.addEventListener('click', () => {
    const s = store.get();
    if (s.to) store.set({ from: s.to, to: s.from });
  });

  routeCloseBtn.addEventListener('click', () => {
    handlers.onClose();
  });

  store.subscribe(render);
  render(store.get());
}
