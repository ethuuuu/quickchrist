export function initMenu(store, handlers) {
  const $ = (id) => document.getElementById(id);
  const menu = $('menu');
  const btn = $('menu-btn');
  const mapperItem = $('menu-mapper');
  const discardItem = $('menu-discard');
  const importFile = $('import-file');

  function open() {
    const s = store.get();
    mapperItem.setAttribute('aria-pressed', s.mode === 'mapper' ? 'true' : 'false');
    discardItem.hidden = !s.usingLocalEdits;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close();
  });

  function itemClick(id, handler) {
    const el = $(id);
    el.addEventListener('click', () => {
      close();
      handler();
    });
  }

  itemClick('menu-mapper', handlers.onToggleMapper);
  itemClick('menu-fit', handlers.onFitAll);
  itemClick('menu-export', handlers.onExport);

  $('menu-import').addEventListener('click', () => {
    close();
    importFile.click();
  });
  importFile.addEventListener('change', () => {
    if (importFile.files && importFile.files[0]) {
      handlers.onImport(importFile.files[0]);
      importFile.value = '';
    }
  });

  itemClick('menu-discard', () => {
    if (
      confirm(
        'Discard your map edits on this phone and go back to the shipped map?'
      )
    ) {
      handlers.onDiscard();
    }
  });
}
