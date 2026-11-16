// Itinerary: day strip, route-optimised day plan with real road distances.
import { st, actions, rerender, T, readOnly, tripDays, dayOf, startOf, staysOf, settingsOf, patchTrip } from '../store.js';
import { esc, fd, ft, todayIso, toast, form, modal, closeModal } from '../ui.js';
import * as G from '../geo.js';
import { sceneSvg, sceneFor } from '../art.js';

const FAR_KM = 400;
const patch = patchTrip;
const saveDay = (date, d) => patch([[['days', date], d]]);

function dayMode(date) { const d = dayOf(date); const s = settingsOf(); return G.MODES[d.mode] ? d.mode : (G.MODES[s.mode] ? s.mode : 'scooty'); }

export function vPlan() {
  const days = tripDays();
  if (!days.length) {
    return `<div class="card empty-hero"><div class="eh-art">${sceneSvg(sceneFor(T()))}</div><h2>When are you going?</h2><p>Add your trip dates to start planning each day.</p>${readOnly() ? '' : '<button class="btn sun" data-act="editTrip">Set trip dates</button>'}</div>`;
  }
  const today = todayIso();
  if (!st.day || !days.includes(st.day)) st.day = days.includes(today) ? today : days[0];
  const strip = `<div class="daystrip">${days.map((dt, i) => {
    const c = dayOf(dt).places.length;
    return `<button data-act="pickDay" data-d="${dt}" class="${dt === st.day ? 'on' : ''}"><b>${dt === today ? 'Today' : 'Day ' + (i + 1)}</b><span>${esc(fd(dt))}${c ? ' · ' + c : ''}</span></button>`;
  }).join('')}</div>`;
  return strip + dayPlan(st.day) + (readOnly() ? '' : '<div class="hint">Tip: “Optimise route” finds the shortest loop from your stay using real road distances. If a place has a fixed time (e.g. sunset), optimise first, then nudge it with ↑ ↓.</div>');
}

function dayPlan(date) {
  const trip = T(); const d = dayOf(date); const st0 = startOf(date); const base = G.hasLL(st0) ? st0 : null;
  const mode = dayMode(date); const set = settingsOf();
  const pts = d.places.filter(G.hasLL);
  const all = (base ? [base] : []).concat(pts); // matrix order
  let M = G.cachedMatrix(all);
  if (!M && all.length >= 2 && !G.matrixFailed(all)) G.matrix(all).then((x) => { if (x) rerender(); });
  const off = base ? 1 : 0; // matrix index of pts[0]
  const ix = new Map(pts.map((p, i) => [p, i + off]));

  const legs = []; let prev = base, prevI = 0;
  pts.forEach((p) => { if (prev) legs.push(G.leg(M, prevI, ix.get(p), prev, p, mode, set)); prev = p; prevI = ix.get(p); });
  if (base && d.round && pts.length) legs.push(G.leg(M, prevI, 0, prev, base, mode, set));
  let tk = 0, tm = 0, tc = 0; legs.forEach((l) => { tk += l.km; tm += l.min; tc += l.cost; });
  if (mode === 'scooty' && legs.length) tc += set.rent;
  const real = legs.length && legs.every((l) => l.real);
  const cur = trip.currency || 'INR';
  const fmtC = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  const days = tripDays();

  let h = `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="tiny muted">${esc(fd(date, true))}</div><h2 style="font-size:22px">${esc(d.title || 'Day ' + (days.indexOf(date) + 1))}</h2></div><button class="btn line sm" data-act="editDay" data-d="${date}">Edit day</button></div>`;
  h += `<div class="modes" style="margin-top:10px">${Object.keys(G.MODES).map((k) => `<button data-act="setMode" data-d="${date}" data-m="${k}" class="${k === mode ? 'on' : ''}">${G.MODES[k].ic} ${G.MODES[k].short}</button>`).join('')}</div>`;
  if (d.places.length) {
    h += `<div class="summary" style="margin-top:12px"><div><b>${d.places.length}</b><span class="tiny muted">places</span></div>`;
    if (legs.length) h += `<div><b>${real ? '' : '~'}${G.fk(tk)}</b><span class="tiny muted">by road</span></div><div><b>~${G.fm(tm)}</b><span class="tiny muted">travel time</span></div><div><b>~${fmtC(tc)}</b><span class="tiny muted">${mode === 'scooty' ? 'rent + fuel' : mode === 'cab' ? 'cab fares' : 'transit fares'}</span></div>`;
    h += '</div>';
    if (legs.length) h += `<div class="tiny muted" style="margin-top:6px">${real ? '✓ Real road distances (OpenStreetMap). Times and costs are estimates.' : (M || G.matrixFailed(all) ? 'Road distances unavailable right now — showing estimates.' : 'Fetching road distances…')} Tap “route ↗” on a leg for live directions.</div>`;
    if (pts.length) h += `<div style="margin-top:12px">${G.mapSvg(base, pts, d.round)}</div>`;
    h += `<div class="row" style="margin-top:12px">${pts.length >= 2 ? `<button class="btn sun" data-act="optimise" data-d="${date}">✨ Optimise route</button>` : ''}${pts.length && mode !== 'bus' ? `<a class="btn ghost" target="_blank" rel="noopener" href="${G.routeLink(base, pts, d.round, mode)}">🧭 Full route in Maps</a>` : ''}</div>`;
  }
  h += '</div><div class="card">';
  const stayName = st0 ? esc(st0.name) : 'No stay for this day';
  const staySub = st0 ? (base ? 'Start' + (d.round ? ' & finish' : '') + ' here' : 'Add this stay’s location (Bookings) to plan the route') : 'Add a stay in Bookings, or pick one in “Edit day”';
  h += `<div class="place"><div class="num home">⌂</div><div class="body"><div class="name">${stayName}</div><div class="small muted">${staySub}</div></div></div>`;
  prev = base; prevI = 0;
  d.places.forEach((p, i) => {
    if (prev && G.hasLL(p)) {
      const l = G.leg(M, prevI, ix.get(p), prev, p, mode, set);
      h += `<div class="leg">↓ ${l.ic} ${l.real ? '' : '~'}${G.fk(l.km)} · ~${G.fm(l.min)}${l.cost ? ' · ~' + fmtC(l.cost) : l.walk ? ' · walk' : ''} · <a target="_blank" rel="noopener" href="${G.legLink(prev, p, l.walk ? 'walk' : mode)}">route ↗</a></div>`;
    } else h += '<div class="leg">↓</div>';
    h += `<div class="place ${p.done ? 'done' : ''}"><div class="num ${G.hasLL(p) ? '' : 'nill'}">${i + 1}</div><div class="body"><div class="name" data-act="editPlace" data-d="${date}" data-i="${i}">${esc(p.name)} <span class="tiny muted" style="font-weight:400">✎</span></div>`
      + ((p.time || p.note) ? `<div class="small muted">${p.time ? '⏰ ' + esc(ft(p.time)) + ' ' : ''}${esc(p.note || '')}</div>` : '')
      + (G.hasLL(p) ? '' : '<div class="tiny" style="color:#a8431a">No location — tap Edit to add one</div>')
      + `<div class="acts"><button class="icon ${p.done ? 'on' : ''}" data-act="toggleDone" data-d="${date}" data-i="${i}">${p.done ? '✓ Visited' : '○ Visited'}</button><button class="icon" data-act="move" data-d="${date}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon" data-act="move" data-d="${date}" data-i="${i}" data-dir="1" ${i === d.places.length - 1 ? 'disabled' : ''}>↓</button><button class="icon" data-act="editPlace" data-d="${date}" data-i="${i}">✎ Edit</button><a class="icon" style="text-decoration:none" target="_blank" rel="noopener" href="${G.placeLink(p)}">Map ↗</a></div></div></div>`;
    if (G.hasLL(p)) { prev = p; prevI = ix.get(p); }
  });
  if (base && d.round && prev && prev !== base) {
    const l = G.leg(M, prevI, 0, prev, base, mode, set);
    h += `<div class="leg">↓ ${l.ic} ${l.real ? '' : '~'}${G.fk(l.km)} · ~${G.fm(l.min)}${l.cost ? ' · ~' + fmtC(l.cost) : ''} · <a target="_blank" rel="noopener" href="${G.legLink(prev, base, l.walk ? 'walk' : mode)}">route ↗</a></div><div class="place"><div class="num home">⌂</div><div class="body"><div class="name">Back to ${esc(st0.name)}</div></div></div>`;
  }
  if (!d.places.length) h += '<div class="empty">No places yet for this day.</div>';
  h += `<div class="row" style="margin-top:14px"><button class="btn" data-act="addPlaces" data-d="${date}">＋ Add places</button></div></div>`;
  return h;
}

/* ---------- actions ---------- */
actions.pickDay = (el) => { st.day = el.dataset.d; rerender(); };
actions.setMode = (el) => { const d = dayOf(el.dataset.d); d.mode = el.dataset.m; saveDay(el.dataset.d, d); };
actions.toggleDone = (el) => { const d = dayOf(el.dataset.d); const p = d.places[+el.dataset.i]; p.done = !p.done; saveDay(el.dataset.d, d); };
actions.move = (el) => {
  const d = dayOf(el.dataset.d); const i = +el.dataset.i; const j = i + +el.dataset.dir;
  if (j < 0 || j >= d.places.length) return;
  [d.places[i], d.places[j]] = [d.places[j], d.places[i]]; saveDay(el.dataset.d, d);
};

actions.optimise = async (el) => {
  const date = el.dataset.d; const d = dayOf(date); const s0 = startOf(date); const base = G.hasLL(s0) ? s0 : null;
  const pts = d.places.filter(G.hasLL); const rest = d.places.filter((p) => !G.hasLL(p));
  if (pts.length < 2) return toast('Add at least 2 places with a location first');
  el.disabled = true; el.textContent = 'Optimising…';
  const all = (base ? [base] : []).concat(pts);
  const M = await G.matrix(all);
  const off = base ? 1 : 0;
  // index 0 = base (or a virtual start with zero cost when there is no stay)
  const P = (k) => (k === 0 ? base : pts[k - 1]);
  const cost = (a, b) => {
    if (!base && a === 0) return 0; if (!base && b === 0) return 0;
    const ia = a === 0 ? 0 : a - 1 + off, ib = b === 0 ? 0 : b - 1 + off;
    if (M && M.d[ia] && M.d[ia][ib] != null) return M.d[ia][ib];
    return G.hav(P(a), P(b)) * 1350;
  };
  const before = pts.map((_, k) => k + 1);
  const order = G.bestOrder(pts.length, cost, !!base && d.round);
  const c0 = G.tourCost(pts.length, cost, before, !!base && d.round), c1 = G.tourCost(pts.length, cost, order, !!base && d.round);
  d.places = order.map((k) => pts[k - 1]).concat(rest);
  saveDay(date, d);
  toast(c1 < c0 - 50 ? `Route optimised — ${G.fk((c0 - c1) / 1000)} shorter${M ? '' : ' (estimated)'}` : 'Already the shortest order 👌');
};

actions.editDay = (el) => {
  const date = el.dataset.d; const d = dayOf(date); const s = settingsOf();
  const opts = [['', 'Auto (stay booked for that night)']].concat(staysOf().map((x) => [x.id, x.name + (G.hasLL(x) ? '' : ' (no location)')]));
  form(fd(date, true), [
    { k: 'title', label: 'Day title', full: 1, ph: 'Beaches & forts' },
    { k: 'startId', label: 'Start from', type: 'select', opts, full: 1 },
    { k: 'mode', label: 'Getting around', type: 'select', full: 1, opts: [['', 'Trip default (' + G.MODES[s.mode].label + ')']].concat(Object.keys(G.MODES).map((k) => [k, G.MODES[k].ic + ' ' + G.MODES[k].label])) },
    { k: 'round', label: 'End of day', type: 'select', full: 1, opts: [['1', 'Come back to the stay'], ['0', 'End at the last place']] },
  ], { title: d.title, startId: d.startId, mode: d.mode, round: d.round ? '1' : '0' }, (o) => {
    Object.assign(d, { title: o.title, startId: o.startId, mode: o.mode, round: o.round === '1' }); saveDay(date, d);
  });
};

function farCheck(ll, ctx) {
  const dest = T().destination;
  if (!ll || !G.hasLL(dest)) return true;
  const km = G.hav(ll, dest);
  if (km < FAR_KM || ctx.form.dataset.okFar) return true;
  ctx.form.dataset.okFar = 1;
  ctx.msg(`This pin is ~${Math.round(km)} km from ${dest.name}. If you copied your current location by mistake, fix it. Otherwise tap Save again.`);
  return false;
}

actions.editPlace = (el) => editPlace(el.dataset.d, +el.dataset.i);
function editPlace(date, i) {
  const d = dayOf(date); const isNew = i == null || i < 0; const p = isNew ? {} : d.places[i];
  const days = tripDays();
  const fields = [
    { k: 'name', label: 'Place', full: 1 },
    { k: 'loc', label: 'Location', full: 1, ph: 'Google Maps link or 15.60, 73.73', help: 'In Google Maps, long-press the exact spot and copy the coordinates shown.' },
    { k: 'time', label: 'Time (optional)', type: 'time' }, { k: 'note', label: 'Note', ph: 'Sunset ~6 pm' },
  ];
  if (days.length > 1) fields.push({ k: 'day', label: 'Day', type: 'select', full: 1, opts: days.map((dt, k) => [dt, 'Day ' + (k + 1) + ' · ' + fd(dt)]) });
  form(isNew ? 'Add a custom place' : 'Edit place', fields, { ...p, loc: G.hasLL(p) ? G.llStr(p) : '', day: date }, (o, ctx) => {
    if (!o.name) { ctx.msg('Give the place a name'); return false; }
    const ll = G.parseLL(o.loc);
    if (o.loc && !ll) { ctx.msg('Couldn’t read that location — paste coordinates like 15.5733, 73.7400'); return false; }
    if (!farCheck(ll, ctx)) return false;
    const np = { ...p, name: o.name, time: o.time, note: o.note };
    if (ll) { np.lat = ll.lat; np.lng = ll.lng; } else { delete np.lat; delete np.lng; }
    const to = o.day || date;
    if (isNew) { const t = dayOf(to); t.places.push(np); saveDay(to, t); return; }
    if (to === date) { d.places[i] = np; saveDay(date, d); return; }
    d.places.splice(i, 1); const t = dayOf(to); t.places.push(np);
    patch([[['days', date], d], [['days', to], t]]); toast('Moved to ' + fd(to));
  }, isNew ? null : () => { d.places.splice(i, 1); saveDay(date, d); });
}

actions.addPlaces = (el) => {
  const date = el.dataset.d; const dest = T().destination; const s0 = startOf(date);
  const bias = G.hasLL(s0) ? s0 : dest;
  modal(`<h3>Add places · ${esc(fd(date))}</h3>${G.placePickerHtml('Search beaches, cafés, forts, museums…')}
    <div class="row" style="margin-top:10px"><button type="button" class="btn line sm" data-custom>＋ Add with my own link / coordinates</button></div>
    <div class="tiny muted" style="margin-top:8px">Search results © OpenStreetMap contributors.</div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sun" data-done>Done</button></div>`, (bg) => {
    G.bindPlacePicker(bg, {
      bias, esc,
      onPick: (r, btn) => {
        const d = dayOf(date);
        if (G.hasLL(dest) && G.hav(r, dest) > FAR_KM && !btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = `${Math.round(G.hav(r, dest))} km away — add?`; return; }
        d.places.push({ name: r.name, lat: r.lat, lng: r.lng, note: '' }); saveDay(date, d);
        btn.disabled = true; btn.textContent = 'Added ✓'; btn.className = 'btn sm line';
      },
    });
    bg.querySelector('[data-custom]').onclick = () => editPlace(date, -1);
    bg.querySelector('[data-done]').onclick = closeModal;
  });
};
