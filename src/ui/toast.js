let timer = 0;

export function toast(text, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.dataset.show = 'true';
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.dataset.show = 'false';
  }, ms);
}
