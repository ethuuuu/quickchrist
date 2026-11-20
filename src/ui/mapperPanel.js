import { CONFIG } from '../config.js';
import { onLocation } from '../location.js';
import { PLACE_CATEGORIES, CATEGORY_LABELS } from '../graph.js';

const REASONS = {
  'weak-gps': 'GPS is too weak to mark a point here. Wait until the dot turns green.',
  'not-walking': 'Start a walk first.',
  'not-ready': 'Finish or discard the current walk first.',
};

const EDGE_REASONS = {
  'same-node': 'You ended where this path started, so it was not saved. On loops, mark a junction partway round.',
  'too-short': 'That path was too short to save.',
  'missing-node': 'That path could not be saved.',
};

function describe(r) {
  const parts = [];
  if (r.place) parts.push(`Saved “${r.place.name}”.`);
  if (r.edge) {
    if (r.edge.ok) {
      parts.push(`Path saved, ${Math.round(r.edge.edge.length_m)} m.`);
      if (r.edge.parallel) parts.push('It is a second route between the same two points.');
    } else {
      parts.push(EDGE_REASONS[r.edge.reason] ?? 'Path not saved.');
    }
  }
  if (!r.created) parts.push('Joined a point you already mapped.');
  return parts.join(' ');
}

export function initMapperPanel(recorder, { onExit, toast }) {
  const $ = (id) => document.getElementById(id);
  const panel = $('mapper-panel');
  const status = $('gps-status');
  const placeForm = $('place-form');
  const placeOpenBtn = $('place-open-btn');
  const placeName = $('place-name');
  const placeCategory = $('place-category');
  const placeOutside = $('place-outside');

  for (const c of PLACE_CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = CATEGORY_LABELS[c];
    placeCategory.append(opt);
  }

  onLocation((ev) => {
    if (ev.type !== 'fix') return;
    const a = Math.round(ev.fix.accuracy);
    status.textContent = `GPS accurate to ${a} m`;
    status.dataset.quality =
      a <= CONFIG.GPS.NODE_ACCURACY_MAX_M ? 'good' : a <= CONFIG.GPS.ACCURACY_MAX_M ? 'fair' : 'weak';
  });

  function ok(result) {
    if (result.ok) return true;
    toast(REASONS[result.reason] ?? 'That did not work. Try again.');
    return false;
  }

  function closePlaceForm() {
    placeForm.hidden = true;
    placeOpenBtn.hidden = false;
    placeName.value = '';
    placeOutside.checked = false;
    render();
  }

  $('walk-start-btn').addEventListener('click', () => {
    const r = recorder.startWalk();
    if (ok(r)) toast(r.created ? 'Walk started at a new junction.' : 'Walk started from a point you already mapped.');
  });

  $('junction-btn').addEventListener('click', () => {
    const r = recorder.markNode(null);
    if (ok(r)) toast(describe(r));
  });

  $('walk-stop-btn').addEventListener('click', () => {
    const r = recorder.stopWalk();
    if (ok(r)) toast(`Walk ended. ${describe(r)}`);
  });

  $('walk-discard-btn').addEventListener('click', () => {
    if (!confirm('Discard the path since your last junction?')) return;
    recorder.discardWalk();
    toast('Walk discarded.');
  });

  $('undo-btn').addEventListener('click', () => {
    if (recorder.undo()) toast('Last change undone.');
  });

  for (const name of ['stairs', 'steep']) {
    $(`tag-${name}`).addEventListener('click', () => recorder.setTag(name, !recorder.getTags()[name]));
  }

  placeOpenBtn.addEventListener('click', () => {
    placeForm.hidden = false;
    placeOpenBtn.hidden = true;
    placeName.focus();
    render();
  });

  $('place-cancel-btn').addEventListener('click', closePlaceForm);

  $('place-save-btn').addEventListener('click', () => {
    const name = placeName.value.trim();
    if (!name) {
      toast('Type a name for this place first.');
      placeName.focus();
      return;
    }
    const r = recorder.savePlace({ name, category: placeCategory.value, outside: placeOutside.checked });
    if (!ok(r)) return;
    toast(describe(r));
    closePlaceForm();
  });

  $('mapper-exit-btn').addEventListener('click', () => {
    if (recorder.getState() === 'walking') {
      toast('End or discard the walk first.');
      return;
    }
    onExit();
  });

  function render() {
    const st = recorder.getState();
    const open = st !== 'off';
    panel.dataset.open = String(open);
    $('walk-idle-row').hidden = st !== 'ready';
    $('walk-active-row').hidden = st !== 'walking';
    $('tag-row').hidden = st !== 'walking';
    $('undo-btn').disabled = !recorder.canUndo();
    const tags = recorder.getTags();
    $('tag-stairs').setAttribute('aria-pressed', String(tags.stairs));
    $('tag-steep').setAttribute('aria-pressed', String(tags.steep));
    if (open) {
      document.body.dataset.sheet = 'open';
      document.body.style.setProperty('--sheet-h', `${panel.offsetHeight}px`);
    }
  }

  render();
  return { render };
}
