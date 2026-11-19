// Bookings: journeys (train / bus / flight) and stays (hostels, hotels).
import { st, actions, T, readOnly, trainsOf, staysOf, tripDays, patchTrip } from '../store.js';
import { esc, fd, ft, daysBetween, form, randId, modal, closeModal, toast } from '../ui.js';
import { parseTicket, PNR_URL } from '../ticket.js';
import * as G from '../geo.js';

const KIND = { train: '🚆', bus: '🚌', flight: '✈️', ferry: '⛴️', other: '🧭' };

function duration(t) {
  if (!t.depDate || !t.depTime || !t.arrTime) return '';
  const [y, m, d] = t.depDate.split('-').map(Number);
  const [y2, m2, d2] = (t.arrDate || t.depDate).split('-').map(Number);
  const [h1, n1] = t.depTime.split(':').map(Number), [h2, n2] = t.arrTime.split(':').map(Number);
  let mins = Math.round((new Date(y2, m2 - 1, d2, h2, n2) - new Date(y, m - 1, d, h1, n1)) / 60000);
  if (mins <= 0) mins += 1440; if (mins > 4 * 1440) return '';
  return mins < 60 ? mins + ' min' : Math.floor(mins / 60) + ' h' + (mins % 60 ? ' ' + (mins % 60) + ' m' : '');
}
const tm = (x) => { if (!x) return '<span class="muted">--:--</span>'; const [a, b] = ft(x).split(' '); return `${a}<small>${b}</small>`; };

export function trainCard(t) {
  const dur = duration(t); const ic = KIND[t.kind] || '🚆';
  return `<div class="card ticket" ${readOnly() ? '' : `data-act="editTrain" data-id="${t.id}"`}>
    <div class="tk-top"><span class="tk-kind">${ic} ${esc(t.label || 'Journey')}</span>${t.pnr ? `<span class="pill">PNR ${esc(t.pnr)}</span>` : ''}</div>
    <div class="tk-route">
      <div class="tk-end"><div class="tk-time">${tm(t.depTime)}</div><div class="tk-stn">${esc(t.from || '—')}</div><div class="tk-date">${esc(fd(t.depDate))}</div></div>
      <div class="tk-mid"><span class="tk-dur">${esc(dur)}</span><div class="tk-line"><i>${ic}</i></div></div>
      <div class="tk-end r"><div class="tk-time">${tm(t.arrTime)}</div><div class="tk-stn">${esc(t.to || '—')}</div><div class="tk-date">${esc(fd(t.arrDate))}</div></div>
    </div>
    ${(t.seat || t.note || (t.pnr && (t.kind || 'train') === 'train')) ? `<div class="tk-perf"></div><div class="tk-bottom">
      ${t.seat ? `<div class="tk-seat"><span class="tiny muted">SEAT</span><b>${esc(t.seat)}</b></div>` : ''}
      ${t.note ? `<div class="small muted tk-note">${esc(t.note)}</div>` : ''}
      ${t.pnr && (t.kind || 'train') === 'train' ? `<button class="btn ghost sm" data-act="checkPnr" data-pnr="${esc(t.pnr)}">🔎 Check PNR status</button>` : ''}</div>` : ''}
  </div>`;
}
export function stayCard(s) {
  const nights = s.checkIn ? Math.max(0, daysBetween(s.checkIn, s.checkOut || s.checkIn)) : 0;
  const loc = G.hasLL(s)
    ? `<a href="${G.placeLink(s)}" target="_blank" rel="noopener">📍 ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} — check pin ↗</a>`
    : '<span class="pill sun">📍 No location — tap to add</span>';
  return `<div class="card staycard" ${readOnly() ? '' : `data-act="editStay" data-id="${s.id}"`}>
    <div class="sc-head"><div class="sc-ic">🛏</div><div style="flex:1;min-width:0"><h3>${esc(s.name)}</h3>${s.address ? `<div class="small muted">${esc(s.address)}</div>` : ''}</div>${s.ref ? `<span class="pill">${esc(s.ref)}</span>` : ''}</div>
    ${s.checkIn ? `<div class="sc-dates"><div><span class="tiny muted">CHECK-IN</span><b>${esc(fd(s.checkIn))}</b></div><div class="sc-n">${nights} night${nights === 1 ? '' : 's'}</div><div class="r"><span class="tiny muted">CHECK-OUT</span><b>${esc(fd(s.checkOut))}</b></div></div>` : '<div class="small muted" style="margin-top:8px">Add check-in & check-out dates</div>'}
    <div class="row small" style="margin-top:10px">${loc}${s.phone ? `<span>📞 ${esc(s.phone)}</span>` : ''}</div>
    ${s.note ? `<div class="small muted" style="margin-top:6px;white-space:pre-wrap">${esc(s.note)}</div>` : ''}</div>`;
}

export function vBookings() {
  const tr = trainsOf(), ss = staysOf();
  const gaps = tripDays().slice(0, -1).filter((dt) => !ss.some((x) => x.checkIn <= dt && dt < x.checkOut));
  return `<div class="bk-grid"><section><div class="sec"><h2>Journeys</h2>${readOnly() ? '' : '<div class="row" style="flex-wrap:nowrap"><button class="btn ghost sm" data-act="pasteTicket">📋 Paste ticket</button><button class="btn sun sm" data-act="editTrain">＋ Add</button></div>'}</div>
    ${tr.length ? tr.map(trainCard).join('') : `<div class="card empty">No journeys yet.${readOnly() ? '' : '<br><br>Booked on IRCTC? Paste the booking SMS or e-ticket email and Yatri fills in the details.<br><br><button class="btn sun" data-act="pasteTicket">📋 Paste my ticket</button>'}</div>`}
    </section><section><div class="sec"><h2>Stays</h2>${readOnly() ? '' : '<button class="btn sun sm" data-act="editStay">＋ Add</button>'}</div>
    ${gaps.length && ss.length ? `<div class="hint" style="margin-bottom:12px">No stay booked for the night of ${gaps.map((g) => esc(fd(g))).join(', ')}.</div>` : ''}
    ${ss.length ? ss.map(stayCard).join('') : '<div class="card empty">No stays yet. Each day’s route starts from the place you’re staying that night.</div>'}</section></div>`;
}

actions.editTrain = (el) => openTrain(el.dataset.id, null);
function openTrain(id, prefill, banner) {
  const t = id ? { ...trainsOf().find((x) => x.id === id), ...(prefill || {}) } : (prefill || {});
  form(banner ? 'Check & save' : id ? 'Edit journey' : 'Add a journey', [
    { k: 'kind', label: 'Type', type: 'select', opts: [['train', '🚆 Train'], ['bus', '🚌 Bus'], ['flight', '✈️ Flight'], ['ferry', '⛴️ Ferry'], ['other', '🧭 Other']] },
    { k: 'label', label: 'Name / number', ph: '22224 Vande Bharat' },
    { k: 'from', label: 'From', ph: 'Mumbai CSMT' }, { k: 'to', label: 'To', ph: 'Madgaon' },
    { k: 'depDate', label: 'Departs', type: 'date' }, { k: 'depTime', label: 'Time', type: 'time' },
    { k: 'arrDate', label: 'Arrives', type: 'date' }, { k: 'arrTime', label: 'Time', type: 'time' },
    { k: 'pnr', label: 'PNR / booking no.' }, { k: 'seat', label: 'Coach & seat', ph: 'C4 · 37' },
    { k: 'note', label: 'Notes', type: 'textarea', full: 1, ph: 'Platform, food, who booked…' },
  ], { kind: 'train', ...t }, (o, ctx) => {
    if (!o.label && !o.from) { ctx.msg('Give it a name or a From station'); return false; }
    delete t.found;
    const { id: _, ...rest } = { ...t, ...o };
    patchTrip([[['trains', id || randId(10)], rest]]);
  }, id ? () => patchTrip([[['trains', id], undefined]]) : null, {
    bind: (bg) => { if (banner) bg.querySelector('h3').insertAdjacentHTML('afterend', `<div class="hint" style="margin:-4px 0 14px">${banner}</div>`); },
  });
}

actions.pasteTicket = () => {
  modal(`<h3>📋 Paste your ticket</h3><p class="small muted" style="margin-top:0">Copy the IRCTC booking <b>SMS</b> or the <b>e-ticket email</b> text and paste it below. It’s read on your phone — nothing is sent anywhere.</p>
    <textarea data-tk style="min-height:170px" placeholder="PNR:8355898701,TRN:22224,DOJ:19-11-26,CC,NK-CSMT,DP:19:30,…"></textarea>
    <div class="form-msg tiny" style="color:#b3261e;margin-top:8px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn line" data-x>Cancel</button><button class="btn sun" data-go>Read ticket</button></div>`, (bg) => {
    bg.querySelector('[data-x]').onclick = closeModal;
    bg.querySelector('[data-go]').onclick = () => {
      const r = parseTicket(bg.querySelector('[data-tk]').value);
      if (!r.pnr && !r.label) { bg.querySelector('.form-msg').textContent = 'Couldn’t find a PNR or train number in that text. Paste the full SMS or email.'; return; }
      const missing = ['train', 'stations', 'date', 'time'].filter((k) => !r.found.includes(k));
      const existing = r.pnr && trainsOf().find((x) => x.pnr === r.pnr);
      const { found, ...vals } = r;
      Object.keys(vals).forEach((k) => { if (vals[k] === '' || vals[k] == null) delete vals[k]; });
      if (existing) { // keep richer details you already saved
        if (existing.label && vals.label && existing.label.startsWith(vals.label)) delete vals.label;
        if (existing.note && vals.note && !existing.note.includes(vals.note)) vals.note = existing.note + '\n' + vals.note; else if (existing.note) delete vals.note;
      }
      const banner = `✓ Found ${found.join(', ')}.${missing.length ? ' Please fill in: ' + missing.join(', ') + '.' : ' Check the details and tap Save.'}${existing ? ' This updates your existing journey with the same PNR.' : ''}`;
      openTrain(existing ? existing.id : null, vals, banner);
    };
  });
};

actions.checkPnr = (el) => {
  const pnr = el.dataset.pnr;
  try { navigator.clipboard.writeText(pnr).then(() => toast('PNR ' + pnr + ' copied — paste it on the Indian Railways page'), () => toast('Your PNR: ' + pnr)); } catch (e) { toast('Your PNR: ' + pnr); }
  window.open(PNR_URL, '_blank', 'noopener');
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
