import { searchPlaces } from '../searchIndex.js';
import { CATEGORY_LABELS } from '../graph.js';
import { loadRecent, pushRecent } from '../storage.js';

export function initSearch(store) {
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');
  const topbar = document.querySelector('.topbar');

  let lastPlaceholder = null;
  let lastDisabled = null;
  let lastListHidden = null;

  function setPlaceholder(value) {
    if (lastPlaceholder !== value) { input.placeholder = value; lastPlaceholder = value; }
  }
  function setDisabled(value) {
    if (lastDisabled !== value) { input.disabled = value; lastDisabled = value; }
  }
  function setListHidden(value) {
    if (lastListHidden !== value) { list.hidden = value; lastListHidden = value; }
  }

  function metaFor(place) {
    if (place.outside) return 'Off campus';
    return CATEGORY_LABELS[place.category] ?? 'Other';
  }

  function render() {
    const s = store.get();

    if (s.mode === 'mapper') {
      setDisabled(true);
      setPlaceholder('Search is off while mapping');
      setListHidden(true);
      return;
    }

    setDisabled(false);
    setPlaceholder(s.searchTarget === 'from' ? 'Choose start' : 'Where to?');

    const results = searchPlaces(s.graph.places.values(), input.value, loadRecent(), 8);
    const fragment = document.createDocumentFragment();

    if (s.graph.places.size === 0) {
      const li = document.createElement('li');
      li.className = 'results-empty';
      li.textContent = 'No places yet. Open the menu, turn on Mapper mode, and add a place.';
      fragment.appendChild(li);
    } else {
      let added = 0;

      if (s.searchTarget === 'from') {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'result';
        b.dataset.id = '__gps';
        const name = document.createElement('span');
        name.className = 'result-name';
        name.textContent = 'Your location';
        const meta = document.createElement('span');
        meta.className = 'result-meta';
        meta.textContent = 'Use GPS';
        b.appendChild(name);
        b.appendChild(meta);
        li.appendChild(b);
        fragment.appendChild(li);
        added++;
      }

      for (const place of results) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'result';
        b.dataset.id = place.id;
        const name = document.createElement('span');
        name.className = 'result-name';
        name.textContent = place.name;
        const meta = document.createElement('span');
        meta.className = 'result-meta';
        meta.textContent = metaFor(place);
        b.appendChild(name);
        b.appendChild(meta);
        li.appendChild(b);
        fragment.appendChild(li);
        added++;
      }

      if (added === 0) {
        const li = document.createElement('li');
        li.className = 'results-empty';
        li.textContent = `No place matches “${input.value}”. Try another name.`;
        fragment.appendChild(li);
      }
    }

    list.replaceChildren(fragment);
    setListHidden(false);
  }

  function choose(id) {
    const s = store.get();
    const target = s.searchTarget;
    const end = id === '__gps' ? { type: 'gps' } : { type: 'place', placeId: id };
    if (id !== '__gps') pushRecent(id);
    store.set({ [target]: end, searchTarget: 'to' });
    input.value = '';
    setListHidden(true);
    input.blur();
  }

  input.addEventListener('focus', render);
  input.addEventListener('input', render);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const b = list.querySelector('button[data-id]');
      if (b) choose(b.dataset.id);
    }
    if (e.key === 'Escape') {
      setListHidden(true);
      input.blur();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!topbar.contains(e.target)) {
      setListHidden(true);
    }
  });

  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    choose(b.dataset.id);
  });

  store.subscribe(render);
  render();
}
