// Places, distances and route optimisation.
// - Place search: Photon (OpenStreetMap, built for search-as-you-type), Nominatim as fallback.
// - Road distances: OSRM public demo server's /table service (one request per day plan).
// Everything falls back to straight-line estimates if a service is unreachable.

export const hasLL = (p) => !!p && typeof p.lat === 'number' && typeof p.lng === 'number';
export const llStr = (p) => p.lat.toFixed(5) + ',' + p.lng.toFixed(5);

export function hav(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Accepts "15.57, 73.74", Google Maps links with !3d..!4d.. (exact pin), ?q=lat,lng, or @lat,lng (map centre: approx)
export function parseLL(t) {
  if (!t) return null;
  try { t = decodeURIComponent(t); } catch (e) { /* keep raw */ }
  let approx = false;
  let m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || t.match(/^\s*\(?\s*(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)\s*\)?\s*$/);
  if (!m) { m = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/); approx = !!m; }
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, approx };
}

/* ---------- place search ---------- */
async function getJSON(url, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

export async function searchPlaces(q, bias) {
  q = (q || '').trim(); if (q.length < 2) return [];
  try {
    let url = 'https://photon.komoot.io/api/?limit=8&lang=en&q=' + encodeURIComponent(q);
    if (hasLL(bias)) url += '&lat=' + bias.lat + '&lon=' + bias.lng;
    const j = await getJSON(url);
    return (j.features || []).map((f) => {
      const p = f.properties || {}; const c = f.geometry && f.geometry.coordinates;
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.city || 'Unnamed place';
      const sub = [p.city && p.city !== name ? p.city : p.county, p.state, p.country].filter(Boolean).join(', ');
      return { name, sub, lat: c[1], lng: c[0] };
    }).filter((x) => hasLL(x));
  } catch (e) {
    console.warn('Photon failed, trying Nominatim', e);
    const j = await getJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=' + encodeURIComponent(q));
    return j.map((r) => { const parts = String(r.display_name).split(', '); return { name: r.name || parts[0], sub: parts.slice(1, 4).join(', '), lat: +r.lat, lng: +r.lon }; });
  }
}

/* ---------- road distance matrix (OSRM) ---------- */
const mem = new Map(); const pending = new Map();
let disk = {}; try { disk = JSON.parse(localStorage.getItem('yatri.osrm') || '{}'); } catch (e) { disk = {}; }
const keyOf = (pts) => pts.map((p) => p.lat.toFixed(4) + ',' + p.lng.toFixed(4)).join(';');

export function cachedMatrix(pts) {
  if (pts.length < 2) return null;
  const k = keyOf(pts);
  return mem.get(k) || disk[k] || null;
}

// Returns {d: metres[][], t: seconds[][]} or null on failure.
export function matrix(pts) {
  if (pts.length < 2) return Promise.resolve(null);
  const k = keyOf(pts);
  const hit = cachedMatrix(pts); if (hit) return Promise.resolve(hit);
  if (pending.has(k)) return pending.get(k);
  const coords = pts.map((p) => p.lng.toFixed(5) + ',' + p.lat.toFixed(5)).join(';');
  const pr = getJSON('https://router.project-osrm.org/table/v1/driving/' + coords + '?annotations=distance,duration', 10000)
    .then((j) => {
      if (j.code !== 'Ok' || !j.distances || j.distances.length !== pts.length) throw new Error(j.code || 'bad matrix');
      const M = { d: j.distances, t: j.durations };
      mem.set(k, M); disk[k] = M;
      const keys = Object.keys(disk); if (keys.length > 150) keys.slice(0, keys.length - 150).forEach((x) => delete disk[x]);
      try { localStorage.setItem('yatri.osrm', JSON.stringify(disk)); } catch (e) { /* full */ }
      return M;
    })
    .catch((e) => { console.warn('OSRM unavailable, using estimates', e); mem.set(k, null); return null; })
    .finally(() => pending.delete(k));
  pending.set(k, pr);
  return pr;
}
export const matrixFailed = (pts) => pts.length >= 2 && mem.has(keyOf(pts)) && mem.get(keyOf(pts)) === null;

/* ---------- transport modes & legs ---------- */
export const MODES = {
  scooty: { label: 'Rental scooty / bike', short: 'Scooty', ic: '🛵', gm: 'two-wheeler', f: 1.0, speed: 24 },
  cab: { label: 'Cab / taxi', short: 'Cab', ic: '🚕', gm: 'driving', f: 1.15, speed: 24 },
  bus: { label: 'Public transport', short: 'Transit', ic: '🚌', gm: 'transit', f: 1.8, speed: 15, wait: 15 },
};
export const DEFSET = { mode: 'scooty', rent: 400, fuel: 2.5, cabKm: 25, cabMin: 200, busKm: 2, busMin: 10 };

// i, j: indexes into the matrix; a, b: the points (for fallback)
export function leg(M, i, j, a, b, mode, set) {
  set = Object.assign({}, DEFSET, set || {});
  const Md = M && M.d && M.d[i] ? M.d[i][j] : null;
  const real = Md != null;
  const km = real ? Md / 1000 : hav(a, b) * 1.35;
  if (km < 0.9) return { km, min: Math.max(1, Math.round(km / 4.5 * 60)), cost: 0, ic: '🚶', walk: true, real };
  const md = MODES[mode] || MODES.scooty;
  const min = real && M.t[i][j] != null ? M.t[i][j] / 60 * md.f + (md.wait || 0) : km / md.speed * 60 + (md.wait || 0);
  const cost = mode === 'scooty' ? km * set.fuel : mode === 'cab' ? Math.max(set.cabMin, km * set.cabKm) : Math.max(set.busMin, km * set.busKm);
  return { km, min: Math.max(2, Math.round(min)), cost: Math.round(cost), ic: md.ic, real };
}
export const fk = (k) => (k < 10 ? k.toFixed(1) : Math.round(k)) + ' km';
export const fm = (m) => (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''));

/* ---------- optimiser ---------- */
// cost(i, j) over indexes 0..n where 0 = start (if hasStart). Returns order of place indexes (1..n).
export function bestOrder(n, cost, round) {
  const idx = []; for (let i = 1; i <= n; i++) idx.push(i);
  if (n < 2) return idx;
  const tour = (seq) => { let c = 0, prev = 0; for (const s of seq) { c += cost(prev, s); prev = s; } if (round) c += cost(prev, 0); return c; };
  if (n <= 8) {
    let best = null, bestC = Infinity; const used = []; const cur = [];
    (function dfs(prev, c) {
      if (c >= bestC) return;
      if (cur.length === n) { const t = c + (round ? cost(prev, 0) : 0); if (t < bestC) { bestC = t; best = cur.slice(); } return; }
      for (let i = 1; i <= n; i++) { if (used[i]) continue; used[i] = 1; cur.push(i); dfs(i, c + cost(prev, i)); cur.pop(); used[i] = 0; }
    })(0, 0);
    return best;
  }
  // nearest neighbour + 2-opt
  const left = idx.slice(); let o = []; let p = 0;
  while (left.length) { let bi = 0, bd = Infinity; left.forEach((x, k) => { const d = cost(p, x); if (d < bd) { bd = d; bi = k; } }); p = left.splice(bi, 1)[0]; o.push(p); }
  let improved = true, guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let a = 0; a < n - 1; a++) for (let b = a + 1; b < n; b++) {
      const cand = o.slice(0, a).concat(o.slice(a, b + 1).reverse(), o.slice(b + 1));
      if (tour(cand) < tour(o) - 1e-9) { o = cand; improved = true; }
    }
  }
  return o;
}
export function tourCost(n, cost, order, round) { let c = 0, prev = 0; for (const s of order) { c += cost(prev, s); prev = s; } if (round && order.length) c += cost(prev, 0); return c; }

/* ---------- links ---------- */
export const placeLink = (p) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(hasLL(p) ? llStr(p) : p.name);
export const legLink = (a, b, mode) => 'https://www.google.com/maps/dir/?api=1&origin=' + llStr(a) + '&destination=' + llStr(b) + '&travelmode=' + (mode === 'walk' ? 'walking' : (MODES[mode] || MODES.cab).gm);
export function routeLink(start, pts, round, mode) {
  if (!pts.length) return '';
  let gm = (MODES[mode] || MODES.cab).gm; if (gm === 'transit') gm = 'driving';
  let origin, dest, way;
  if (start) { origin = start; if (round) { dest = start; way = pts; } else { dest = pts[pts.length - 1]; way = pts.slice(0, -1); } }
  else { if (pts.length === 1) return placeLink(pts[0]); origin = pts[0]; dest = pts[pts.length - 1]; way = pts.slice(1, -1); }
  return 'https://www.google.com/maps/dir/?api=1&origin=' + llStr(origin) + '&destination=' + llStr(dest) + (way.length ? '&waypoints=' + way.slice(0, 9).map(llStr).join('%7C') : '') + '&travelmode=' + gm;
}

/* ---------- mini map ---------- */
export function mapSvg(base, pts, round) {
  const all = (base ? [base] : []).concat(pts); if (all.length < 2) return '';
  const mid = all.reduce((s, p) => s + p.lat, 0) / all.length, cos = Math.cos(mid * Math.PI / 180);
  const xs = all.map((p) => p.lng * cos), ys = all.map((p) => -p.lat);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 340, H = 200, P = 22, sc = Math.min((W - 2 * P) / ((x1 - x0) || 1e-3), (H - 2 * P) / ((y1 - y0) || 1e-3));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const X = (p) => (ox + (p.lng * cos - x0) * sc).toFixed(1), Y = (p) => (oy + (-p.lat - y0) * sc).toFixed(1);
  const seq = (base ? [base] : []).concat(pts); if (round && base) seq.push(base);
  let h = `<svg class="map" viewBox="0 0 ${W} ${H}"><polyline points="${seq.map((p) => X(p) + ',' + Y(p)).join(' ')}" fill="none" stroke="#e2622b" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round"/>`;
  if (base) h += `<rect x="${X(base) - 11}" y="${Y(base) - 11}" width="22" height="22" rx="6" fill="#0f5b66"/><text x="${X(base)}" y="${+Y(base) + 4}" text-anchor="middle" font-size="12" fill="#fff">⌂</text>`;
  pts.forEach((p, i) => { h += `<circle cx="${X(p)}" cy="${Y(p)}" r="11" fill="#fff" stroke="#e2622b" stroke-width="2.5"/><text x="${X(p)}" y="${+Y(p) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#14303a">${i + 1}</text>`; });
  return h + '</svg>';
}

/* ---------- place picker (search box + results) used in modals ---------- */
export function bindPlacePicker(root, { bias, onPick, esc }) {
  const input = root.querySelector('[data-pp-q]'); const out = root.querySelector('[data-pp-out]'); const btn = root.querySelector('[data-pp-go]');
  let results = [];
  const run = async () => {
    const q = input.value.trim();
    const ll = parseLL(q);
    if (ll) { results = [{ name: 'Pinned location', sub: ll.lat.toFixed(4) + ', ' + ll.lng.toFixed(4) + (ll.approx ? ' · map centre, may be imprecise' : ''), lat: ll.lat, lng: ll.lng }]; }
    else {
      if (q.length < 2) return;
      out.innerHTML = '<div class="tiny muted" style="padding:8px 2px">Searching…</div>';
      try { results = await searchPlaces(q, bias); }
      catch (e) { out.innerHTML = '<div class="tiny" style="padding:8px 2px;color:#b3261e">Search is unavailable right now — paste a Google Maps link or coordinates instead.</div>'; return; }
    }
    out.innerHTML = results.length ? results.map((r, i) => `<div class="pick"><div><b>${esc(r.name)}</b><div class="tiny muted">${esc(r.sub || '')}${bias && hasLL(bias) ? ' · ' + Math.round(hav(bias, r)) + ' km away' : ''}</div></div><button type="button" class="btn sm ghost" data-pp-i="${i}">Choose</button></div>`).join('') : '<div class="tiny muted" style="padding:8px 2px">No results. Try a different spelling, or paste a Google Maps link / coordinates.</div>';
  };
  let tm = null;
  input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 450); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tm); run(); } });
  if (btn) btn.onclick = run;
  out.addEventListener('click', (e) => { const b = e.target.closest('[data-pp-i]'); if (!b) return; onPick(results[+b.dataset.ppI], b); });
}
export const placePickerHtml = (ph) => `<div class="row" style="flex-wrap:nowrap"><input data-pp-q placeholder="${ph || 'Search a place, or paste a Google Maps link'}" autocomplete="off"><button type="button" class="btn sm" data-pp-go>Search</button></div><div data-pp-out class="pp-out"></div>`;

/* ---------- time-aware day planning ---------- */
// Times are minutes after midnight. A place can have:
//   due  — "be there at" time (e.g. sunset 17:30). Arriving early means waiting
//          until LEAD minutes before it; arriving after it counts as late.
//   stay — minutes spent there (default 60).
export const LEAD = 15;
export const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
export const fromMin = (x) => { x = ((Math.round(x) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };

// order: place indexes 1..n; travel(i, j): minutes between indexes (0 = stay)
export function simulate(order, travel, info, startMin, round, hasBase) {
  let t = startMin, prev = hasBase ? 0 : null, late = 0, wait = 0, lateStops = 0;
  const stops = [];
  for (const k of order) {
    const tr = prev == null ? 0 : travel(prev, k);
    const arrive = t + tr; let start = arrive; let w = 0, l = 0;
    const due = info[k].due;
    if (due != null) {
      if (arrive < due - LEAD) { w = due - LEAD - arrive; start = due - LEAD; }
      if (arrive > due) { l = arrive - due; lateStops++; }
    }
    const leave = start + info[k].stay;
    stops[k] = { arrive, start, leave, wait: w, late: l, travel: tr };
    late += l; wait += w; t = leave; prev = k;
  }
  const back = round && hasBase && order.length ? travel(prev, 0) : 0;
  return { stops, end: t + back, back, late, wait, lateStops };
}
// Lower is better: finish as early as possible, and being late is very costly.
const score = (r) => r.end + 40 * r.late;

export function bestTimedOrder(n, travel, info, startMin, round, hasBase) {
  const idx = []; for (let i = 1; i <= n; i++) idx.push(i);
  if (n < 2) return idx;
  const run = (o) => score(simulate(o, travel, info, startMin, round, hasBase));
  if (n <= 8) {
    let best = idx, bestS = Infinity; const used = []; const cur = [];
    (function dfs() {
      if (cur.length === n) { const s = run(cur); if (s < bestS) { bestS = s; best = cur.slice(); } return; }
      for (let i = 1; i <= n; i++) { if (used[i]) continue; used[i] = 1; cur.push(i); dfs(); cur.pop(); used[i] = 0; }
    })();
    return best;
  }
  // larger days: start from "timed stops sorted by time, others by nearest", then improve with 2-opt + moves
  let o = idx.slice().sort((a, b) => (info[a].due ?? 1e9) - (info[b].due ?? 1e9));
  let s = run(o), improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let a = 0; a < n - 1; a++) for (let b = a + 1; b < n; b++) {
      const c1 = o.slice(0, a).concat(o.slice(a, b + 1).reverse(), o.slice(b + 1)); const s1 = run(c1);
      if (s1 < s - 1e-9) { o = c1; s = s1; improved = true; continue; }
      const c2 = o.slice(); const [x] = c2.splice(a, 1); c2.splice(b, 0, x); const s2 = run(c2);
      if (s2 < s - 1e-9) { o = c2; s = s2; improved = true; }
    }
  }
  return o;
}

/* ---------- sunrise / sunset (NOAA algorithm) ---------- */
// Returns "HH:MM" in the device's time zone for that date, or '' (polar day/night).
export function sunTime(dateIso, lat, lng, rising) {
  const [Y, Mo, D] = dateIso.split('-').map(Number);
  const N = Math.floor((Date.UTC(Y, Mo - 1, D) - Date.UTC(Y, 0, 0)) / 864e5);
  const rad = Math.PI / 180, lngHour = lng / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634; L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad; RA = ((RA % 360) + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90; RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * rad), cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return '';
  let H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad; H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  const offset = -new Date(Y, Mo - 1, D, 12).getTimezoneOffset() / 60;
  return fromMin((UT + offset) * 60);
}
