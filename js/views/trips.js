// Home: the user's trips, create/edit a trip, import the v1 Goa plan.
import { st, actions, rerender, myId, myName, membersOf, patchTrip, APP_NAME } from '../store.js';
import { cloud } from '../cloud.js';
import { esc, fd, fdShort, todayIso, daysBetween, modal, closeModal, toast, randId, CURRENCIES, avatar, firstName, themeSeg } from '../ui.js';
import * as G from '../geo.js';
import { VIBES } from './bag.js';
import { coverHtml, sceneSvg } from '../art.js';

function tripStatus(t) {
  const today = todayIso();
  if (!t.start) return { label: 'No dates yet', cls: '' };
  if (today < t.start) { const n = daysBetween(today, t.start); return { label: n === 1 ? 'Tomorrow!' : `In ${n} days`, cls: 'sun' }; }
  if (!t.end || today <= t.end) return { label: 'Happening now', cls: 'live' };
  return { label: 'Done', cls: 'muted' };
}

export function vHome() {
  const trips = st.trips.slice().sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  const today = todayIso();
  const upcoming = trips.filter((t) => !t.end || t.end >= today), past = trips.filter((t) => t.end && t.end < today).reverse();
  let h = `<header class="top home">${sceneSvg('sunset', 'hdr-art')}<div class="hdr-shade"></div><div class="wrap"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div class="brand">${APP_NAME}</div><button class="avbtn" data-act="account">${avatar({ uid: myId(), name: myName() }, 34)}</button></div>
    <h1 style="margin-top:14px">Hi ${esc(firstName(myName()))} 👋</h1><p>Where to next?</p></div></header><main class="wrap">`;
  let imported = false; try { imported = !!localStorage.getItem('yatri.legacyImported.' + myId()); } catch (e) { /* */ }
  if (st.legacy && !imported) {
    h += `<div class="card hint-card"><b>Bring over your earlier plan?</b><div class="small muted" style="margin:4px 0 10px">We found “${esc((st.legacy.trip && st.legacy.trip.name) || 'Goa Trip')}” from the first version of the planner.</div><div class="row"><button class="btn sun sm" data-act="importLegacy">Import it</button><button class="btn line sm" data-act="dismissLegacy">No thanks</button></div></div>`;
  }
  if (!st.tripsReady) h += '<div class="trip-grid">' + '<div class="sk-trip"><div class="shimmer"></div><i class="shimmer"></i><i class="shimmer" style="width:40%"></i></div>'.repeat(2) + '</div>';
  else if (!trips.length) h += `<div class="card empty-hero"><div class="eh-art">${sceneSvg('mountains')}</div><h2>Plan your first trip</h2><p class="muted">Add where you’re going and when. Then invite friends, build your packing list and track spending — all in one place.</p><button class="btn sun" data-act="newTrip">＋ New trip</button></div>`;
  else {
    h += `<div class="sec"><h2>Your trips</h2><button class="btn sun sm" data-act="newTrip">＋ New trip</button></div>`;
    h += upcoming.length ? '<div class="trip-grid">' + upcoming.map(tripCard).join('') + '</div>' : '<div class="card empty">No upcoming trips.</div>';
    if (past.length) h += '<div class="sec"><h2 class="muted" style="font-size:16px">Past trips</h2></div><div class="trip-grid past">' + past.map(tripCard).join('') + '</div>';
  }
  return h + '</main>';
}
function tripCard(t) {
  const s = tripStatus(t); const mem = membersOf(t);
  return `<a class="card tripcard" href="#/trip/${t.id}/plan"><div class="tc-art">${coverHtml(t)}<span class="pill tc-pill ${s.cls}">${esc(s.label)}</span></div><div class="tc-body"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><h3>${esc(t.name || 'Trip')}</h3><div class="small muted">${t.destination ? '📍 ' + esc(t.destination.name) : ''}${t.start ? ' · ' + esc(fdShort(t.start)) + ' – ' + esc(fdShort(t.end)) : ''}</div></div></div>
    <div class="row" style="margin-top:10px;justify-content:space-between"><div class="avs">${mem.slice(0, 5).map((m) => avatar(m, 26)).join('')}${mem.length > 5 ? `<span class="tiny muted">+${mem.length - 5}</span>` : ''}</div><span class="tiny muted">${mem.length > 1 ? mem.length + ' travellers' : 'Solo'}</span></div></div></a>`;
}

/* ---------- create / edit trip ---------- */
export function tripForm(existing) {
  const t = existing || { currency: 'INR', vibes: [] };
  let dest = t.destination || null;
  const html = `<h3>${existing ? 'Edit trip' : 'New trip'}</h3>
    <label>Where are you going?</label>
    <div data-dest-chosen class="chosen" style="${dest ? '' : 'display:none'}"><span data-dest-name>${dest ? '📍 ' + esc(dest.name) : ''}</span><button type="button" class="btn sm line" data-dest-change>Change</button></div>
    <div data-dest-search style="${dest ? 'display:none' : ''}">${G.placePickerHtml('City, region or country — e.g. Goa, Manali, Bali')}</div>
    <div class="grid2" style="margin-top:12px">
      <div class="full"><label>Trip name</label><input name="name" value="${esc(t.name || '')}" placeholder="Goa with the gang"></div>
      <div><label>First day</label><input name="start" type="date" value="${esc(t.start || '')}"></div>
      <div><label>Last day</label><input name="end" type="date" value="${esc(t.end || '')}"></div>
      <div class="full"><label>Currency</label><select name="currency">${CURRENCIES.map((c) => `<option ${c === (t.currency || 'INR') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="full"><label>What kind of trip? <span class="muted" style="text-transform:none;font-weight:400">(for packing suggestions)</span></label><div class="chips" data-chips="vibes">${VIBES.map(([k, l]) => `<button type="button" data-v="${k}" class="${(t.vibes || []).includes(k) ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    </div>
    <div class="form-msg tiny" style="color:#b3261e;margin-top:10px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn line" data-x>Cancel</button><button class="btn sun" data-save>${existing ? 'Save' : 'Create trip'}</button></div>`;
  modal(html, (bg) => {
    const q = (s) => bg.querySelector(s);
    bg.querySelectorAll('[data-chips] button').forEach((b) => { b.onclick = () => b.classList.toggle('on'); });
    const choose = (r) => {
      dest = { name: r.sub ? r.name + ', ' + r.sub.split(', ').slice(-1)[0] : r.name, lat: r.lat, lng: r.lng };
      q('[data-dest-name]').textContent = '📍 ' + dest.name; q('[data-dest-chosen]').style.display = ''; q('[data-dest-search]').style.display = 'none';
      if (!q('[name=name]').value.trim()) q('[name=name]').value = r.name + ' trip';
    };
    G.bindPlacePicker(bg, { esc, onPick: choose });
    q('[data-dest-change]').onclick = () => { q('[data-dest-chosen]').style.display = 'none'; q('[data-dest-search]').style.display = ''; q('[data-pp-q]').focus(); };
    q('[data-x]').onclick = closeModal;
    q('[data-save]').onclick = () => {
      const msg = (m) => { q('.form-msg').textContent = m; };
      const name = q('[name=name]').value.trim(), start = q('[name=start]').value, end = q('[name=end]').value;
      if (!dest) return msg('Search and choose a destination first');
      if (!name) return msg('Give your trip a name');
      if (start && end && end < start) return msg('The last day is before the first day');
      if ((start && !end) || (!start && end)) return msg('Add both the first and last day (or neither for now)');
      const vibes = [...bg.querySelectorAll('[data-chips] button.on')].map((b) => b.dataset.v);
      const data = { name, destination: dest, start, end, currency: q('[name=currency]').value, vibes };
      if (existing) { patchTrip(Object.entries(data)); closeModal(); return; }
      const id = cloud.createTrip({
        ...data, ownerId: myId(), members: [myId()], memberInfo: { [myId()]: { name: myName() } },
        settings: { ...G.DEFSET, mode: 'scooty' }, trains: {}, stays: {}, days: {}, notes: '', budget: 0,
        share: { id: randId(20), on: false, showRefs: false },
      });
      closeModal(); location.hash = '#/trip/' + id + '/plan';
    };
  });
}

actions.newTrip = () => tripForm(null);
actions.account = () => {
  modal(`<h3>${esc(myName())}</h3><p class="small muted" style="margin-top:0">${esc(st.user.email || '')}</p><label>Appearance</label>${themeSeg()}<div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn line" data-x>Close</button><button class="btn danger" data-out>Sign out</button></div>`, (bg) => {
    bg.querySelector('[data-x]').onclick = closeModal;
    bg.querySelector('[data-out]').onclick = () => { closeModal(); cloud.signOut(); };
  });
};
actions.dismissLegacy = () => { try { localStorage.setItem('yatri.legacyImported.' + myId(), '1'); } catch (e) { /* */ } rerender(); };
actions.importLegacy = () => {
  const L = st.legacy; const toMap = (arr) => { const m = {}; (arr || []).forEach((x) => { const { id, ...rest } = x; m[id || randId(10)] = rest; }); return m; };
  const id = cloud.createTrip({
    name: (L.trip && L.trip.name) || 'Goa Trip', destination: { name: 'Goa, India', lat: 15.4909, lng: 73.8278 },
    start: (L.trip && L.trip.start) || '', end: (L.trip && L.trip.end) || '', currency: 'INR', vibes: ['beach', 'train', 'roadtrip'],
    ownerId: myId(), members: [myId()], memberInfo: { [myId()]: { name: myName() } },
    settings: { ...G.DEFSET, ...(L.settings || {}) }, trains: toMap(L.trains), stays: toMap(L.stays), days: L.days || {}, notes: L.notes || '', budget: 0,
    share: { id: randId(20), on: false, showRefs: false },
  });
  try { localStorage.setItem('yatri.legacyImported.' + myId(), '1'); } catch (e) { /* */ }
  toast('Imported your Goa plan'); location.hash = '#/trip/' + id + '/plan';
};
