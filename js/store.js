// App state + a tiny action registry. Views read `st` and register click
// handlers in `actions`; main.js re-renders on every state change.
import { datesBetween } from './ui.js';
import { DEFSET } from './geo.js';
import { cloud } from './cloud.js';

export const APP_NAME = 'Yatri';

export const st = {
  user: null, authReady: false,
  trips: [], tripsReady: false,
  tripId: null, trip: null, tripMissing: false, pending: false,
  msgs: [], expenses: [], packing: [],
  view: 'plan', day: null,
  // view-only share link mode
  shareId: null, shared: null, sharedGone: false, sharedLoaded: false, sharedOwner: '',
  joinCode: null, joining: false,
  legacy: null,
};

export const actions = {};
let renderFn = null;
export const setRender = (f) => { renderFn = f; };
export const rerender = () => { if (renderFn) renderFn(); };

/* ---------- helpers over the current trip ---------- */
export const myId = () => (st.user ? st.user.uid : null);
export const myName = () => (st.user ? st.user.displayName || st.user.email || 'Me' : 'Me');

// The data a view renders: the live trip, or the shared copy in view-only mode.
export const T = () => (st.shareId ? st.shared : st.trip) || {};
export const readOnly = () => !!st.shareId;

export function membersOf(trip) {
  trip = trip || T();
  const info = trip.memberInfo || {};
  return (trip.members || []).map((uid) => ({ uid, name: (info[uid] && info[uid].name) || 'Traveller', owner: uid === trip.ownerId }));
}
export const memberName = (uid) => { const m = membersOf().find((x) => x.uid === uid); return m ? m.name : 'Former member'; };
export const isGroup = (trip) => (trip || T()).members && (trip || T()).members.length > 1;

export const tripDays = (trip) => { trip = trip || T(); return datesBetween(trip.start, trip.end); };
export const settingsOf = (trip) => Object.assign({}, DEFSET, (trip || T()).settings || {});
export const trainsOf = (trip) => Object.entries((trip || T()).trains || {}).map(([id, v]) => ({ ...v, id }))
  .sort((a, b) => ((a.depDate || '9') + (a.depTime || '')).localeCompare((b.depDate || '9') + (b.depTime || '')));
export const staysOf = (trip) => Object.entries((trip || T()).stays || {}).map(([id, v]) => ({ ...v, id }))
  .sort((a, b) => (a.checkIn || '9').localeCompare(b.checkIn || '9'));
export const dayOf = (date, trip) => {
  const d = ((trip || T()).days || {})[date] || {};
  return { title: d.title || '', startId: d.startId || '', mode: d.mode || '', round: d.round !== false, startTime: d.startTime || '09:00', places: (d.places || []).slice() };
};
export function stayFor(date, trip) {
  const ss = staysOf(trip);
  return ss.find((x) => x.checkIn && x.checkOut && x.checkIn <= date && date < x.checkOut) || ss.find((x) => x.checkOut === date) || null;
}
export function startOf(date, trip) {
  const d = dayOf(date, trip);
  if (d.startId) { const s = staysOf(trip).find((x) => x.id === d.startId); if (s) return s; }
  return stayFor(date, trip);
}

// Apply a trip patch locally first (so rapid taps never read stale data), then sync.
export function patchTrip(pairs) {
  const t = st.trip;
  if (t) {
    for (const [path, v] of pairs) {
      const p = Array.isArray(path) ? path : [path]; let o = t;
      for (let i = 0; i < p.length - 1; i++) { if (o[p[i]] == null || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
      if (v === undefined) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = JSON.parse(JSON.stringify(v));
    }
  }
  cloud.patchTrip(st.tripId, pairs);
  rerender();
}
