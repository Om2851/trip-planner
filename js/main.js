// Yatri — boot, routing, subscriptions and the page shell.
import { st, actions, setRender, rerender, myId, myName, membersOf, T, APP_NAME } from './store.js';
import { cloud } from './cloud.js';
import { $, esc, fd, fdShort, toast, avatar, closeModal } from './ui.js';
import { vPlan } from './views/plan.js';
import { vBookings } from './views/bookings.js';
import { vBag } from './views/bag.js';
import { vMoney } from './views/money.js';
import { vChat, chatAfterRender, unreadCount } from './views/chat.js';
import { vSettings, publicCopy } from './views/settings.js';
import { vHome } from './views/trips.js';
import { coverHtml, sceneSvg } from './art.js';

/* ---------- errors ---------- */
const FRIENDLY = {
  'permission-denied': 'You don’t have access to that (were you removed from the trip?)',
  unavailable: 'You’re offline — changes will sync when you’re back online',
  'auth/unauthorized-domain': 'This website isn’t allowed to sign in yet — add it under Firebase → Authentication → Settings → Authorized domains',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key in firebase-config.js isn’t valid',
};
cloud.onError = (e) => { console.error(e); toast(FRIENDLY[e && e.code] || 'Something went wrong: ' + ((e && (e.code || e.message)) || e)); };

/* ---------- routing ---------- */
const VIEWS = ['plan', 'bookings', 'bag', 'money', 'chat', 'trip'];
function parseRoute() {
  const m = location.hash.match(/^#\/trip\/([A-Za-z0-9]+)(?:\/(\w+))?/);
  return m ? { tripId: m[1], view: VIEWS.includes(m[2]) ? m[2] : 'plan' } : { tripId: null, view: 'plan' };
}
const qs = new URLSearchParams(location.search);
st.shareId = (qs.get('share') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || null;
st.joinCode = (qs.get('join') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || null;

let unsubs = []; let lastShareJson = {};
function closeTrip() { unsubs.forEach((u) => { try { u(); } catch (e) { /* */ } }); unsubs = []; st.trip = null; st.tripMissing = false; st.msgs = []; st.expenses = []; st.packing = []; st.day = null; }
function openTrip(id) {
  closeTrip(); st.tripId = id;
  unsubs.push(cloud.watchTrip(id, (trip, pending) => {
    st.trip = trip; st.pending = pending; st.tripMissing = !trip; rerender();
    // keep the view-only copy fresh
    if (trip && trip.share && trip.share.on && !pending) {
      const pub = publicCopy(trip); const json = JSON.stringify(pub);
      if (lastShareJson[trip.share.id] !== json) {
        lastShareJson[trip.share.id] = json;
        const owner = (trip.memberInfo || {})[trip.ownerId];
        cloud.saveShare(trip.share.id, trip.id, owner ? owner.name : myName(), pub);
      }
    }
  }, (e) => { st.tripMissing = true; console.warn(e); rerender(); }));
  const sub = (name, key) => unsubs.push(cloud.watchSub(id, name, (rows) => { st[key] = rows; rerender(); }, (e) => console.warn(name, e)));
  sub('messages', 'msgs'); sub('expenses', 'expenses'); sub('packing', 'packing');
}
let lastRoute = '';
function route() {
  if (st.shareId) { rerender(); return; }
  const r = parseRoute();
  if (r.tripId !== st.tripId) { if (r.tripId && st.user) openTrip(r.tripId); else { closeTrip(); st.tripId = r.tripId; } }
  st.view = r.view;
  closeModal();
  const key = location.hash;
  rerender();
  if (key !== lastRoute) { lastRoute = key; if (st.view === 'chat') chatAfterRender(true); else window.scrollTo(0, 0); }
}
window.addEventListener('hashchange', route);

/* ---------- auth & boot ---------- */
let tripsUnsub = null;
if (st.shareId) {
  cloud.watchShare(st.shareId, (d) => { st.sharedLoaded = true; if (!d) { st.sharedGone = true; st.shared = null; } else { st.sharedGone = false; st.shared = d.state; st.sharedOwner = d.ownerName || ''; } rerender(); },
    () => { st.sharedLoaded = true; st.sharedGone = true; rerender(); });
  st.view = (location.hash.match(/#\/(plan|bookings)/) || [])[1] || 'plan';
  window.addEventListener('hashchange', () => { const v = (location.hash.match(/#\/(plan|bookings)/) || [])[1]; st.view = v || 'plan'; rerender(); });
} else {
  cloud.onAuth(async (u) => {
    st.user = u; st.authReady = true;
    if (tripsUnsub) { tripsUnsub(); tripsUnsub = null; }
    st.trips = []; st.tripsReady = false; st.legacy = null;
    if (!u) { closeTrip(); st.tripId = null; rerender(); return; }
    tripsUnsub = cloud.watchTrips(u.uid, (trips) => { st.trips = trips; st.tripsReady = true; rerender(); }, (e) => { st.tripsReady = true; cloud.onError(e); });
    cloud.getLegacy(u.uid).then((l) => { if (l && (l.trains || l.days)) { st.legacy = l; rerender(); } });
    if (st.joinCode) {
      st.joining = true; rerender();
      try {
        const tripId = await cloud.joinWithCode(st.joinCode, u);
        history.replaceState(null, '', location.pathname + '#/trip/' + tripId + '/plan');
        toast('You joined the trip 🎉');
      } catch (e) {
        console.error(e); history.replaceState(null, '', location.pathname + '#/');
        toast(e.code === 'invite/not-found' ? 'That invite link isn’t valid any more — ask for a new one' : 'Couldn’t join: ' + (e.code || e.message));
      }
      st.joining = false; st.joinCode = null;
    }
    st.tripId = null; route();
  });
}

/* ---------- page shell ---------- */
const IC = {
  plan: '<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15"/>',
  bookings: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  bag: '<path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6"/>',
  money: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
};
function nav(items) {
  const unread = st.view === 'chat' ? 0 : unreadCount();
  return `<nav class="bottom"><div class="wrap">${items.map(([k, l]) => `<a href="${st.shareId ? '#/' + k : '#/trip/' + st.tripId + '/' + k}" class="${st.view === k ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>${l}${k === 'chat' && unread ? `<i class="badge">${unread > 9 ? '9+' : unread}</i>` : ''}</a>`).join('')}</div></nav>`;
}
function tripHeader(t) {
  const mem = membersOf(t);
  const status = !navigator.onLine ? '<span class="sync"><i class="dot warn"></i>Offline · changes sync later</span>' : st.pending ? '<span class="sync"><i class="dot busy"></i>Saving…</span>' : '';
  return `<header class="top trip">${coverHtml(t, 'hdr-art')}<div class="hdr-shade"></div><div class="wrap hdr-in">
    <div class="hdr-bar">${st.shareId ? '<span></span>' : '<a class="back" href="#/" aria-label="All trips">‹</a>'}
    ${st.shareId ? `<span class="sync"><i class="dot"></i>👀 ${esc(st.sharedOwner ? st.sharedOwner.split(' ')[0] + '’s trip' : 'Shared trip')} · view-only · live</span>` : `<a class="gear ${st.view === 'trip' ? 'on' : ''}" href="#/trip/${st.tripId}/trip" aria-label="Trip settings">⚙︎</a>`}</div>
    <div><h1>${esc(t.name || 'Trip')}</h1><p>${t.destination ? '📍 ' + esc(t.destination.name) : ''}${t.start ? ' · ' + esc(fdShort(t.start)) + ' – ' + esc(fdShort(t.end)) : ''}</p>
    <div class="row" style="margin-top:10px;justify-content:space-between"><div class="avs">${mem.slice(0, 6).map((m) => avatar(m, 28)).join('')}</div>${st.shareId ? '' : status}</div></div></div></header>`;
}
function welcome() {
  return `<div class="welcome"><div class="hero">${sceneSvg('beach', 'hero-art')}<div class="hdr-shade"></div><div class="wrap">
      <div class="brand big-brand">${APP_NAME}</div>
      <h1>Plan together.<br>Pack smart.<br>Split fair.</h1>
      <p>One app for the whole trip — day plans with the best route, a packing list that thinks for you, group chat and shared expenses.</p>
      ${st.joinCode ? '<div class="invite-banner">🎉 You’ve been invited to a trip. Sign in to join it.</div>' : ''}
      <button class="btn google" data-act="signIn"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Continue with Google</button>
      <div class="tiny" style="opacity:.75;margin-top:10px">Free · works offline · your trips are private to you and the people you invite</div>
    </div></div>
    <main class="wrap features">
      ${[['🗺️', 'Day plans, best route', 'Add places for each day and Yatri orders them into the shortest loop from your stay — with real road distances, time and cost by scooty, cab or public transport.'],
    ['🎒', 'PackYourBag', 'A checklist built for your trip’s length and type — beach, hills, trek, rainy season, flying… Shared things like a first-aid kit get claimed by one person.'],
    ['💬', 'Group chat', 'Invite friends with a link. Everyone sees and edits the same plan, and chats right inside the trip.'],
    ['💸', 'Split expenses', 'Anyone adds what they paid, split equally or exactly. Yatri shows who owes whom — and the fewest payments to settle up.'],
    ['🚆', 'Bookings in one place', 'Trains, buses, flights and stays with PNRs and check-in dates, ready when you need them.'],
    ['📴', 'Works offline', 'Install it on your phone. Your plan opens with no signal and syncs when you’re back online.']]
    .map(([i, t, d], k) => `<div class="card feat"><div class="fi f${k}">${i}</div><div><b>${t}</b><p class="small muted">${d}</p></div></div>`).join('')}
      <div class="gallery">${['mountains', 'city', 'desert', 'forest'].map((k) => `<div class="g-item">${sceneSvg(k)}<span>${{ mountains: 'Hills', city: 'Cities', desert: 'Deserts', forest: 'Forests' }[k]}</span></div>`).join('')}</div>
      <p class="tiny muted" style="text-align:center;margin:20px 0 40px">${APP_NAME} — made for travellers. Place search & road data © OpenStreetMap contributors.</p>
    </main></div>`;
}
const splash = (msg) => `<div class="splash"><div class="splash-art">${sceneSvg('sunset')}</div><div class="brand big-brand">${APP_NAME}</div><p>${esc(msg)}</p></div>`;

function page() {
  if (st.shareId) {
    if (!st.sharedLoaded) return splash('Loading trip…');
    if (st.sharedGone) return `<div class="splash"><div class="brand big-brand">${APP_NAME}</div><h2>This link isn’t active</h2><p>The owner may have turned sharing off, or the link is incomplete.</p><a class="btn sun" href="${location.pathname}">Plan your own trip</a></div>`;
    const v = st.view === 'bookings' ? vBookings() : vPlan();
    return tripHeader(T()) + `<main class="wrap">${v}<p class="tiny muted" style="text-align:center;margin:24px 0">Made with <a href="${location.pathname}">${APP_NAME}</a> — plan your own trip.</p></main>` + nav([['plan', 'Plan'], ['bookings', 'Bookings']]);
  }
  if (!st.authReady) return splash('Loading…');
  if (!st.user) return welcome();
  if (st.joining) return splash('Joining the trip…');
  if (!st.tripId) return vHome();
  if (!st.trip) return st.tripMissing
    ? `<div class="splash"><h2>Trip not found</h2><p>It may have been deleted, or you’re no longer a member.</p><a class="btn sun" href="#/">Back to my trips</a></div>`
    : splash('Opening trip…');
  const views = { plan: vPlan, bookings: vBookings, bag: vBag, money: vMoney, chat: vChat, trip: vSettings };
  return tripHeader(st.trip) + `<main class="wrap ${st.view === 'chat' ? 'chatmain' : ''}">${views[st.view]()}</main>` + nav([['plan', 'Plan'], ['bookings', 'Bookings'], ['bag', 'Bag'], ['money', 'Money'], ['chat', 'Chat']]);
}

const KEEP = ['chatInput', 'tripNotes'];
function render() {
  const app = $('#app');
  const ae = document.activeElement; const saved = {};
  KEEP.forEach((id) => { const el = document.getElementById(id); if (el) saved[id] = { v: el.value, focus: ae === el, s: el.selectionStart, e: el.selectionEnd }; });
  const sx = window.scrollY;
  document.documentElement.classList.toggle('ro', !!st.shareId);
  app.innerHTML = page();
  KEEP.forEach((id) => { const el = document.getElementById(id); const s = saved[id]; if (el && s) { el.value = s.v; if (s.focus) { el.focus(); try { el.setSelectionRange(s.s, s.e); } catch (e) { /* */ } } } });
  window.scrollTo(0, sx);
  if (st.view === 'chat' && st.trip && !st.shareId) chatAfterRender(false);
}
setRender(render);

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('.modal-bg') || el.disabled) return;
  const name = el.dataset.act;
  if (st.shareId && name !== 'pickDay') return;
  if (el.tagName === 'A') e.preventDefault();
  const fn = actions[name]; if (fn) fn(el, e);
});
actions.signIn = () => cloud.signIn().catch((e) => { if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') cloud.onError(e); });
window.addEventListener('online', rerender); window.addEventListener('offline', rerender);

render();
