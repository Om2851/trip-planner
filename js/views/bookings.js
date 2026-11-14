// Bookings: journeys (train / bus / flight) and stays (hostels, hotels).
import { st, actions, T, readOnly, trainsOf, staysOf, tripDays, patchTrip } from '../store.js';
import { esc, fd, ft, daysBetween, form, randId } from '../ui.js';
import * as G from '../geo.js';

const KIND = { train: '🚆', bus: '🚌', flight: '✈️', ferry: '⛴️', other: '🧭' };

export function trainCard(t) {
  return `<div class="card" ${readOnly() ? '' : `data-act="editTrain" data-id="${t.id}"`} style="cursor:pointer">
    <div class="row" style="justify-content:space-between"><b>${KIND[t.kind] || '🚆'} ${esc(t.label || 'Journey')}</b>${t.pnr ? `<span class="pill">PNR ${esc(t.pnr)}</span>` : ''}</div>
    <div class="row" style="margin-top:8px;align-items:stretch;gap:12px;flex-wrap:nowrap"><div style="flex:1"><div class="tiny muted">FROM</div><b>${esc(t.from || '—')}</b><div class="small">${esc(fd(t.depDate))} ${esc(ft(t.depTime))}</div></div><div style="align-self:center;color:var(--sun);font-weight:700">→</div><div style="flex:1"><div class="tiny muted">TO</div><b>${esc(t.to || '—')}</b><div class="small">${esc(fd(t.arrDate))} ${esc(ft(t.arrTime))}</div></div></div>
    ${t.seat ? `<div class="small" style="margin-top:8px">💺 ${esc(t.seat)}</div>` : ''}${t.note ? `<div class="small muted" style="margin-top:6px;white-space:pre-wrap">${esc(t.note)}</div>` : ''}</div>`;
}
export function stayCard(s) {
  const loc = G.hasLL(s)
    ? `<a href="${G.placeLink(s)}" target="_blank" rel="noopener">📍 ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} — check pin ↗</a>`
    : '<span class="pill sun">No location — tap to add</span>';
  const nights = s.checkIn ? Math.max(0, daysBetween(s.checkIn, s.checkOut || s.checkIn)) : 0;
  return `<div class="card" ${readOnly() ? '' : `data-act="editStay" data-id="${s.id}"`} style="cursor:pointer">
    <div class="row" style="justify-content:space-between"><h3 style="font-size:18px">🛏 ${esc(s.name)}</h3>${s.ref ? `<span class="pill">${esc(s.ref)}</span>` : ''}</div>
    <div class="small" style="margin-top:6px">${s.checkIn ? esc(fd(s.checkIn)) + ' → ' + esc(fd(s.checkOut)) + ' · ' + nights + ' night' + (nights === 1 ? '' : 's') : '<span class="muted">Add dates</span>'}</div>
    ${s.address ? `<div class="small muted">${esc(s.address)}</div>` : ''}
    <div class="row small" style="margin-top:8px">${loc}${s.phone ? `<span>📞 ${esc(s.phone)}</span>` : ''}</div>
    ${s.note ? `<div class="small muted" style="margin-top:6px;white-space:pre-wrap">${esc(s.note)}</div>` : ''}</div>`;
}

export function vBookings() {
  const tr = trainsOf(), ss = staysOf();
  const gaps = tripDays().slice(0, -1).filter((dt) => !ss.some((x) => x.checkIn <= dt && dt < x.checkOut));
  return `<div class="sec"><h2>Getting there & back</h2>${readOnly() ? '' : '<button class="btn sun sm" data-act="editTrain">＋ Add</button>'}</div>
    ${tr.length ? tr.map(trainCard).join('') : '<div class="card empty">No journeys yet. Add your trains, buses or flights.</div>'}
    <div class="sec"><h2>Stays</h2>${readOnly() ? '' : '<button class="btn sun sm" data-act="editStay">＋ Add</button>'}</div>
    ${gaps.length && ss.length ? `<div class="hint" style="margin-bottom:12px">No stay booked for the night of ${gaps.map((g) => esc(fd(g))).join(', ')}.</div>` : ''}
    ${ss.length ? ss.map(stayCard).join('') : '<div class="card empty">No stays yet. Each day’s route starts from the place you’re staying that night.</div>'}`;
}

actions.editTrain = (el) => {
  const id = el.dataset.id; const t = id ? trainsOf().find((x) => x.id === id) : {};
  form(id ? 'Edit journey' : 'Add a journey', [
    { k: 'kind', label: 'Type', type: 'select', opts: [['train', '🚆 Train'], ['bus', '🚌 Bus'], ['flight', '✈️ Flight'], ['ferry', '⛴️ Ferry'], ['other', '🧭 Other']] },
    { k: 'label', label: 'Name / number', ph: '22224 Vande Bharat' },
    { k: 'from', label: 'From', ph: 'Mumbai CSMT' }, { k: 'to', label: 'To', ph: 'Madgaon' },
    { k: 'depDate', label: 'Departs', type: 'date' }, { k: 'depTime', label: 'Time', type: 'time' },
    { k: 'arrDate', label: 'Arrives', type: 'date' }, { k: 'arrTime', label: 'Time', type: 'time' },
    { k: 'pnr', label: 'PNR / booking no.' }, { k: 'seat', label: 'Coach & seat', ph: 'C4 · 37' },
    { k: 'note', label: 'Notes', type: 'textarea', full: 1, ph: 'Platform, food, who booked…' },
  ], { kind: 'train', ...t }, (o, ctx) => {
    if (!o.label && !o.from) { ctx.msg('Give it a name or a From station'); return false; }
    const { id: _, ...rest } = { ...t, ...o };
    patchTrip([[['trains', id || randId(10)], rest]]);
  }, id ? () => patchTrip([[['trains', id], undefined]]) : null);
};

actions.editStay = (el) => {
  const id = el.dataset.id; const s = id ? staysOf().find((x) => x.id === id) : {};
  const dest = T().destination;
  form(id ? 'Edit stay' : 'Add a stay', [
    { k: 'name', label: 'Hostel / hotel name', full: 1, ph: 'GoStops Goa' },
    { k: 'checkIn', label: 'Check-in', type: 'date' }, { k: 'checkOut', label: 'Check-out', type: 'date' },
    { k: 'address', label: 'Address', full: 1 },
    { k: 'loc', label: 'Location (for route planning)', full: 1, ph: 'Paste a Google Maps link or 15.5733, 73.7400', help: 'In Google Maps, find the hotel, long-press <b>its</b> pin (not your blue dot) and copy the coordinates.' },
    { k: 'ref', label: 'Booking ref' }, { k: 'phone', label: 'Phone', type: 'tel' },
    { k: 'note', label: 'Notes', type: 'textarea', full: 1, ph: 'Check-in time, Wi-Fi, locker code…' },
  ], { ...s, loc: G.hasLL(s) ? G.llStr(s) : '' }, (o, ctx) => {
    if (!o.name) { ctx.msg('Name is needed'); return false; }
    const ll = G.parseLL(o.loc);
    if (o.loc && !ll) { ctx.msg('Couldn’t read that location — paste coordinates like 15.5733, 73.7400'); return false; }
    if (ll && G.hasLL(dest) && G.hav(ll, dest) > 400 && !ctx.form.dataset.okFar) {
      ctx.form.dataset.okFar = 1; ctx.msg(`This pin is ~${Math.round(G.hav(ll, dest))} km from ${dest.name} — probably your current location. Fix it, or tap Save again to keep it.`); return false;
    }
    if (ll && ll.approx && !ctx.form.dataset.okApprox) { ctx.form.dataset.okApprox = 1; ctx.msg('That link only had the map’s centre, not the exact pin. Paste the coordinates for accuracy, or tap Save again.'); return false; }
    const { id: _, loc, ...rest } = { ...s, ...o };
    if (ll) { rest.lat = ll.lat; rest.lng = ll.lng; } else { delete rest.lat; delete rest.lng; }
    patchTrip([[['stays', id || randId(10)], rest]]);
  }, id ? () => {
    const pairs = [[['stays', id], undefined]];
    Object.entries(T().days || {}).forEach(([dt, d]) => { if (d.startId === id) pairs.push([['days', dt, 'startId'], '']); });
    patchTrip(pairs);
  } : null);
};
