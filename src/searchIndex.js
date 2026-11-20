// Place search scoring. Pure.
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreText(text, q) {
  const t = normalize(text);
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(' ').some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

// places: any iterable of place objects. recentIds: newest first.
export function searchPlaces(places, query, recentIds = [], limit = 8) {
  const list = [...places];
  const q = normalize(query);

  if (!q) {
    const rank = new Map(recentIds.map((id, i) => [id, i]));
    return list
      .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  const scored = [];
  for (const p of list) {
    let s = scoreText(p.name, q);
    for (const alias of p.aliases ?? []) s = Math.max(s, scoreText(alias, q) - 5);
    if (s > 0) {
      if (recentIds.includes(p.id)) s += 3;
      scored.push([s, p]);
    }
  }
  scored.sort((x, y) => y[0] - x[0] || x[1].name.localeCompare(y[1].name));
  return scored.slice(0, limit).map((x) => x[1]);
}
