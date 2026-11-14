// Trip page: details, members & invites, view-only share link, transport costs, notes, leave/delete.
import { st, actions, rerender, T, myId, membersOf, isGroup, settingsOf, patchTrip } from '../store.js';
import { cloud } from '../cloud.js';
import { esc, fd, form, toast, confirmTap, copyText, randId, avatar, money } from '../ui.js';
import * as G from '../geo.js';
import { tripForm } from './trips.js';

const base = () => location.origin + location.pathname;
export const inviteLink = (code) => base() + '?join=' + code;
export const shareLink = (id) => base() + '?share=' + id;
const wa = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);

export function vSettings() {
  const t = T(); const me = myId(); const owner = t.ownerId === me; const mem = membersOf(); const s = settingsOf();
  let h = `<div class="sec"><h2>Trip</h2><button class="btn line sm" data-act="editTrip">Edit</button></div><div class="card">
    <h3 style="font-size:20px">${esc(t.name)}</h3><div class="small muted">${t.destination ? '📍 ' + esc(t.destination.name) + ' · ' : ''}${t.start ? esc(fd(t.start, true)) + ' → ' + esc(fd(t.end, true)) : 'No dates yet'} · ${esc(t.currency || 'INR')}${t.budget ? ' · budget ' + esc(money(t.budget, t.currency)) : ''}</div></div>`;

  // members + invite
  h += `<div class="sec"><h2>${isGroup() ? 'Travellers' : 'Travelling with friends?'}</h2></div><div class="card">`;
  h += mem.map((m) => `<div class="row" style="flex-wrap:nowrap;margin:6px 0">${avatar(m, 32)}<div style="flex:1"><b>${esc(m.name)}</b>${m.uid === me ? ' <span class="tiny muted">(you)</span>' : ''}${m.owner ? ' <span class="pill" style="font-size:10px">organiser</span>' : ''}</div>${owner && m.uid !== me ? `<button class="btn sm line" data-act="removeMember" data-u="${m.uid}">Remove</button>` : ''}</div>`).join('');
  if (t.inviteCode) {
    const L = inviteLink(t.inviteCode);
    h += `<div class="small muted" style="margin-top:12px">Invite link — anyone who opens it and signs in joins this trip and can edit the plan:</div><input readonly value="${esc(L)}" onclick="this.select()" style="margin:6px 0 10px;font-size:13px">
      <div class="row"><button class="btn sm" data-act="copy" data-v="${esc(L)}">Copy link</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${wa('Join our trip “' + t.name + '” on Yatri: ' + L)}">Send on WhatsApp</a><button class="btn sm line" data-act="newInvite">New link</button></div>`;
  } else h += `<p class="small muted">${isGroup() ? 'Add more people with an invite link.' : 'Invite friends — everyone can edit the plan, chat, share a packing list and split expenses.'}</p><button class="btn sun" data-act="newInvite">👥 Create invite link</button>`;
  h += '</div>';

  // share
  const sh = t.share || {};
  h += '<div class="sec"><h2>View-only link</h2></div><div class="card">';
  if (!sh.on) h += '<p class="small muted" style="margin-top:0">For family or friends who just want to follow along — no sign-in needed, can’t edit. Shows the itinerary and bookings. Chat, expenses, packing and notes are never shared.</p><button class="btn ghost" data-act="shareStart">🔗 Create view-only link</button>';
  else {
    const L = shareLink(sh.id);
    h += `<div class="small muted">Anyone with this link can view the plan:</div><input readonly value="${esc(L)}" onclick="this.select()" style="margin:6px 0 10px;font-size:13px">
      <div class="row"><button class="btn sm" data-act="copy" data-v="${esc(L)}">Copy link</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${wa('Follow my trip “' + t.name + '” (live): ' + L)}">Send on WhatsApp</a></div>
      <div class="row" style="justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><div class="small"><b>PNRs & booking refs</b><div class="muted">${sh.showRefs ? 'Visible on the link' : 'Hidden from the link'}</div></div><button class="btn sm line" data-act="shareRefs">${sh.showRefs ? 'Hide' : 'Show'}</button></div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sm danger" data-act="shareStop">Turn off link</button></div>`;
  }
  h += '</div>';

  // getting around
  h += `<div class="sec"><h2>Getting around</h2><button class="btn line sm" data-act="editCosts">Edit</button></div><div class="card"><b>${G.MODES[s.mode].ic} ${G.MODES[s.mode].label}</b><div class="small muted">Scooty ${money(s.rent, t.currency)}/day + ${money(s.fuel, t.currency)}/km fuel · Cab ${money(s.cabKm, t.currency)}/km (min ${money(s.cabMin, t.currency)}) · Transit ${money(s.busKm, t.currency)}/km</div></div>`;

  // notes
  h += `<div class="sec"><h2>Trip notes</h2></div><div class="card"><textarea id="tripNotes" style="min-height:140px" placeholder="Emergency numbers, rental shop, Wi-Fi passwords…${isGroup() ? ' (everyone on the trip can see these)' : ''}">${esc(t.notes || '')}</textarea><div class="row" style="margin-top:8px;justify-content:flex-end"><button class="btn sm" data-act="saveNotes">Save notes</button></div></div>`;

  h += `<div class="sec"><h2>Danger zone</h2></div><div class="card row" style="justify-content:space-between">${owner
    ? '<div class="small muted">Deletes the trip, chat, expenses and packing list for everyone.</div><button class="btn danger" data-act="deleteTrip">Delete trip</button>'
    : '<div class="small muted">You’ll lose access to this trip. Others keep it.</div><button class="btn danger" data-act="leaveTrip">Leave trip</button>'}</div>`;
  return h;
}

/* ---------- actions ---------- */
actions.openSettings = () => { location.hash = '#/trip/' + st.tripId + '/trip'; };
actions.editTrip = () => tripForm(T());
actions.copy = (el) => copyText(el.dataset.v);
actions.saveNotes = () => { const v = document.getElementById('tripNotes').value; patchTrip([['notes', v]]); toast('Notes saved'); };
actions.editCosts = () => {
  const s = settingsOf(); const c = T().currency || 'INR';
  form('Getting around', [
    { k: 'mode', label: 'Default way to travel', type: 'select', full: 1, opts: Object.keys(G.MODES).map((k) => [k, G.MODES[k].ic + ' ' + G.MODES[k].label]) },
    { k: 'rent', label: `Scooty rent / day (${c})`, type: 'number' }, { k: 'fuel', label: `Fuel / km (${c})`, type: 'number' },
    { k: 'cabKm', label: `Cab fare / km (${c})`, type: 'number' }, { k: 'cabMin', label: `Cab minimum fare (${c})`, type: 'number' },
    { k: 'busKm', label: `Transit fare / km (${c})`, type: 'number' }, { k: 'busMin', label: `Transit minimum (${c})`, type: 'number' },
  ], s, (o) => {
    const n = { mode: o.mode }; ['rent', 'fuel', 'cabKm', 'cabMin', 'busKm', 'busMin'].forEach((k) => { const v = parseFloat(o[k]); n[k] = isNaN(v) ? G.DEFSET[k] : v; });
    patchTrip([['settings', n]]);
  });
};
actions.newInvite = () => {
  const t = T(); const old = t.inviteCode; const code = randId(12);
  cloud.createInvite(st.tripId, myId(), code).then(() => { if (old) cloud.deleteInvite(old); });
  patchTrip([['inviteCode', code]]);
  toast(old ? 'New invite link — the old one no longer works' : 'Invite link created');
};
actions.removeMember = (el) => {
  if (!confirmTap(el, 'Tap to remove')) return;
  const u = el.dataset.u; patchTrip([['members', (T().members || []).filter((x) => x !== u)], [['memberInfo', u], undefined]]);
};
actions.shareStart = () => { const sh = T().share || {}; patchTrip([['share', { id: sh.id || randId(20), on: true, showRefs: !!sh.showRefs }]]); toast('View-only link created'); };
actions.shareRefs = () => { const sh = T().share; patchTrip([['share', { ...sh, showRefs: !sh.showRefs }]]); };
actions.shareStop = (el) => {
  if (!confirmTap(el, 'Tap again to turn off')) return;
  const sh = T().share; cloud.deleteShare(sh.id);
  patchTrip([['share', { id: randId(20), on: false, showRefs: !!sh.showRefs }]]);
  toast('Link turned off — the old link no longer works');
};
actions.leaveTrip = (el) => {
  if (!confirmTap(el, 'Tap again to leave')) return;
  cloud.leaveTrip(st.tripId, myId()); location.hash = '#/'; toast('You left the trip');
};
actions.deleteTrip = (el) => {
  if (!confirmTap(el, 'Tap again to delete for everyone')) return;
  const id = st.tripId; const t = T();
  if (t.share && t.share.on) cloud.deleteShare(t.share.id);
  if (t.inviteCode) cloud.deleteInvite(t.inviteCode);
  location.hash = '#/';
  cloud.deleteTrip(id).then(() => toast('Trip deleted'), (e) => toast('Couldn’t delete: ' + (e.code || e.message)));
  rerender();
};

// A cleaned, public copy of the plan for the view-only link.
export function publicCopy(t) {
  const c = JSON.parse(JSON.stringify({ name: t.name, destination: t.destination || null, start: t.start || '', end: t.end || '', currency: t.currency || 'INR', trains: t.trains || {}, stays: t.stays || {}, days: t.days || {}, settings: t.settings || {}, members: t.members || [], memberInfo: t.memberInfo || {}, ownerId: t.ownerId }));
  if (!(t.share && t.share.showRefs)) {
    Object.values(c.trains).forEach((x) => { delete x.pnr; delete x.seat; delete x.note; });
    Object.values(c.stays).forEach((x) => { delete x.ref; delete x.phone; delete x.note; });
  }
  return c;
}
