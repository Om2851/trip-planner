// PackYourBag: a smart packing checklist.
// - "Everyone packs" items: each member ticks their own copy.
// - "Shared" items: one person brings it for the group (claim it, tick it).
import { st, actions, rerender, T, myId, membersOf, isGroup, memberName, tripDays, patchTrip } from '../store.js';
import { cloud } from '../cloud.js';
import { esc, form, modal, closeModal, toast, confirmTap, firstName, avatar } from '../ui.js';
import { sceneSvg, sceneFor } from '../art.js';

export const VIBES = [
  ['beach', '🏖️ Beach'], ['mountains', '🏔️ Hills / cold'], ['trek', '🥾 Trekking'], ['city', '🏙️ City'],
  ['monsoon', '🌧️ Rainy season'], ['roadtrip', '🛵 Bike / road trip'], ['nightlife', '🎉 Nightlife'],
  ['train', '🚆 Long train ride'], ['flight', '✈️ Flying'], ['abroad', '🌍 International'], ['work', '💻 Work'], ['camping', '⛺ Camping'],
];
const CATS = ['Documents & money', 'Clothes', 'Toiletries', 'Health', 'Electronics', 'Travel comfort', 'Activity gear', 'Group gear', 'Other'];
const CAT_IC = { 'Documents & money': '🪪', Clothes: '👕', Toiletries: '🧴', Health: '💊', Electronics: '🔌', 'Travel comfort': '🎒', 'Activity gear': '🧭', 'Group gear': '🤝', Other: '📦' };

const BASE = {
  'Documents & money': ['ID proof', 'Tickets & bookings (offline copy)', 'Cash', 'Debit / credit card', 'Emergency contact details'],
  Clothes: ['T-shirts / tops:N', 'Shorts / trousers:H', 'Innerwear:N', 'Socks:N', 'Sleepwear', 'Comfortable walking shoes', 'Slippers / flip-flops'],
  Toiletries: ['Toothbrush & toothpaste', 'Deodorant', 'Face wash / soap', 'Shampoo (travel size)', 'Towel', 'Lip balm', 'Comb'],
  Health: ['Personal medicines', 'Paracetamol', 'ORS sachets', 'Band-aids', 'Hand sanitiser', 'Mosquito repellent'],
  Electronics: ['Phone charger', 'Power bank', 'Earphones'],
  'Travel comfort': ['Water bottle', 'Day backpack', 'Padlock for locker', 'Sunglasses'],
};
const BY_VIBE = {
  beach: { Clothes: ['Swimwear', 'Cap / hat'], Toiletries: ['Sunscreen SPF 50', 'Aloe vera gel'], 'Activity gear': ['Beach towel / sarong', 'Waterproof phone pouch'] },
  mountains: { Clothes: ['Warm jacket', 'Thermals', 'Woollen cap & gloves'], Toiletries: ['Moisturiser', 'Cold cream'] },
  trek: { Clothes: ['Trekking shoes', 'Quick-dry T-shirts'], 'Activity gear': ['Rain jacket / poncho', 'Headlamp', 'Energy bars', 'Trekking pole'] },
  city: { 'Travel comfort': ['Metro / transit card', 'Small crossbody bag'] },
  monsoon: { Clothes: ['Raincoat / umbrella', 'Extra footwear'], 'Travel comfort': ['Ziplock bags for phone & docs', 'Quick-dry towel'] },
  roadtrip: { 'Documents & money': ['Driving licence'], 'Activity gear': ['Helmet (or rent one)', 'Scarf / buff for dust', 'Phone mount'] },
  nightlife: { Clothes: ['Going-out outfit', 'Going-out shoes'] },
  train: { 'Travel comfort': ['Chain lock for luggage', 'Travel pillow', 'Bedsheet / light blanket', 'Snacks for the journey', 'Wet wipes'] },
  flight: { 'Travel comfort': ['Liquids bag (100 ml bottles)', 'Neck pillow', 'Pen (for forms)'] },
  abroad: { 'Documents & money': ['Passport', 'Visa printout', 'Travel insurance', 'Forex card / foreign cash'], Electronics: ['Universal travel adapter', 'International SIM / eSIM'] },
  work: { Electronics: ['Laptop + charger', 'Mouse'] },
  camping: { 'Activity gear': ['Tent', 'Sleeping bag', 'Torch', 'Matchbox / lighter', 'Multi-tool'] },
};
const GROUP = ['First-aid kit', 'Extension board / multi-plug', 'Bluetooth speaker', 'Playing cards / games', 'Bin bags & tissues'];

export function suggestions(trip, vibes) {
  const nights = Math.max(1, tripDays(trip).length - 1);
  const N = Math.min(nights + 1, 7), H = Math.max(1, Math.ceil(N / 2));
  const out = [];
  const add = (cat, spec, shared) => { const [name, q] = spec.split(':'); out.push({ name, cat, qty: q === 'N' ? N : q === 'H' ? H : 1, shared: !!shared }); };
  Object.entries(BASE).forEach(([c, list]) => list.forEach((x) => add(c, x)));
  (vibes || []).forEach((v) => Object.entries(BY_VIBE[v] || {}).forEach(([c, list]) => list.forEach((x) => add(c, x))));
  if (isGroup(trip)) GROUP.forEach((x) => add('Group gear', x, true));
  const seen = new Set(); return out.filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const isMine = (it) => !it.shared || it.assignee === myId();
const isPacked = (it) => { const p = it.packed || {}; return it.shared ? !!(it.assignee && p[it.assignee]) : !!p[myId()]; };

let filter = 'mine';
export function vBag() {
  const items = st.packing.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const group = isGroup();
  if (!items.length) {
    return `<div class="card empty-hero"><div class="eh-art">${sceneSvg(sceneFor(T()))}</div><div style="font-size:40px;margin-top:-30px;position:relative">🎒</div><h2 style="margin-top:4px">PackYourBag</h2><p class="muted">Get a ready-made checklist for this trip — based on how many days you’re away and what kind of trip it is. ${group ? 'Shared things (first-aid kit, speaker…) can be claimed by one person so nobody doubles up.' : ''}</p><button class="btn sun" data-act="suggestBag">✨ Build my packing list</button><div style="margin-top:10px;padding-bottom:4px"><button class="btn line sm" data-act="addBagItem">Or add items yourself</button></div></div>`;
  }
  const mine = items.filter(isMine); const done = mine.filter(isPacked).length;
  const pct = mine.length ? Math.round(done / mine.length * 100) : 0;
  const shown = filter === 'shared' ? items.filter((i) => i.shared) : filter === 'all' ? items : mine;
  let h = `<div class="card"><div class="row" style="justify-content:space-between"><div><div class="tiny muted">MY BAG</div><div class="big" style="font-size:28px">${done} / ${mine.length}</div><div class="small muted">${pct === 100 ? 'All packed — have a great trip! 🎉' : 'items packed'}</div></div><div class="ring" style="--p:${pct}"><span>${pct}%</span></div></div>
    <div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div></div>`;
  if (group) {
    h += '<div class="card"><div class="tiny muted" style="margin-bottom:8px">WHO’S READY</div>' + membersOf().map((m) => {
      const theirs = items.filter((i) => !i.shared || i.assignee === m.uid);
      const n = theirs.filter((i) => (i.packed || {})[m.uid]).length; const p = theirs.length ? Math.round(n / theirs.length * 100) : 0;
      return `<div class="row" style="margin:6px 0;flex-wrap:nowrap">${avatar(m, 26)}<div style="flex:1"><div class="small"><b>${esc(firstName(m.name))}</b> <span class="muted">${n}/${theirs.length}</span></div><div class="bar thin"><i style="width:${p}%"></i></div></div></div>`;
    }).join('') + '</div>';
  }
  h += `<div class="row" style="margin:6px 0 10px"><div class="seg">${[['mine', 'My bag'], ...(group ? [['shared', 'Shared']] : []), ['all', 'Everything']].map(([k, l]) => `<button data-act="bagFilter" data-f="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  const byCat = {}; shown.forEach((i) => { (byCat[i.cat] = byCat[i.cat] || []).push(i); });
  h += '<div class="bag-cols">';
  CATS.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !CATS.includes(c))).forEach((c) => {
    const list = byCat[c]; const dn = list.filter(isPacked).length;
    h += `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:4px"><b>${CAT_IC[c] || '📦'} ${esc(c)}</b><span class="tiny muted">${dn}/${list.length}</span></div>`;
    list.forEach((it) => {
      const packed = isPacked(it); const canTick = !it.shared || it.assignee === myId();
      let who = '';
      if (it.shared) who = it.assignee ? `<span class="tiny muted">🙋 ${it.assignee === myId() ? 'You bring' : esc(firstName(memberName(it.assignee))) + ' brings'}</span>` : `<button class="btn sm ghost" data-act="claimItem" data-id="${it.id}" style="padding:3px 8px;font-size:12px">I’ll bring it</button>`;
      h += `<div class="check ${packed ? 'done' : ''}"><button class="box ${packed ? 'on' : ''}${st.flash === 'bag:' + it.id ? ' pop' : ''}" ${canTick ? `data-act="tickItem" data-id="${it.id}"` : 'disabled'} aria-label="Packed">${packed ? '✓' : ''}</button><div class="lbl" data-act="editBagItem" data-id="${it.id}">${esc(it.name)}${it.qty > 1 ? ` <span class="muted">× ${it.qty}</span>` : ''}${it.shared ? ' <span class="pill" style="font-size:10px;padding:1px 6px">shared</span>' : ''}</div>${who}</div>`;
    });
    h += '</div>';
  });
  h += '</div>';
  if (!shown.length) h += '<div class="card empty">Nothing here.</div>';
  h += `<div class="row" style="margin-top:6px"><button class="btn" data-act="addBagItem">＋ Add item</button><button class="btn ghost" data-act="suggestBag">✨ Suggest more</button><button class="btn line" data-act="unpackAll">↺ Untick my bag</button></div>
    <div class="tiny muted" style="margin-top:8px">“Untick my bag” is handy for repacking before the journey home.</div>`;
  return h;
}

/* ---------- actions ---------- */
const item = (id) => st.packing.find((x) => x.id === id);
actions.bagFilter = (el) => { filter = el.dataset.f; rerender(); };
actions.tickItem = (el) => {
  const it = item(el.dataset.id); if (!it) return;
  const who = it.shared ? it.assignee : myId(); if (!who) return;
  const v = !(it.packed || {})[who];
  it.packed = { ...(it.packed || {}), [who]: v }; // optimistic
  st.flash = 'bag:' + it.id; setTimeout(() => { if (st.flash === 'bag:' + it.id) st.flash = null; }, 700);
  cloud.patchSub(st.tripId, 'packing', it.id, [[['packed', who], v]]);
  rerender();
};
actions.claimItem = (el) => { const it = item(el.dataset.id); if (!it) return; it.assignee = myId(); cloud.patchSub(st.tripId, 'packing', it.id, [['assignee', myId()]]); rerender(); };
actions.unpackAll = (el) => {
  if (!confirmTap(el, 'Tap again to untick all')) return;
  const ops = st.packing.filter((it) => isMine(it) && isPacked(it)).map((it) => ({ id: it.id, patch: [[['packed', it.shared ? it.assignee : myId()], false]] }));
  if (ops.length) cloud.batchSub(st.tripId, 'packing', ops);
  toast('Unticked — ready to repack');
};

actions.addBagItem = () => editItem(null);
actions.editBagItem = (el) => editItem(item(el.dataset.id));
function editItem(it) {
  const group = isGroup();
  const fields = [
    { k: 'name', label: 'Item', full: 1, ph: 'Sunscreen' },
    { k: 'qty', label: 'Quantity', type: 'number' },
    { k: 'cat', label: 'Category', type: 'select', opts: CATS.map((c) => [c, (CAT_IC[c] || '') + ' ' + c]) },
  ];
  if (group) {
    fields.push({ k: 'shared', label: 'Who packs it?', type: 'select', full: 1, opts: [['0', 'Everyone packs their own'], ['1', 'Shared — one person brings it for the group']] });
    fields.push({ k: 'assignee', label: 'Brought by (for shared items)', type: 'select', full: 1, opts: [['', 'Nobody yet'], ...membersOf().map((m) => [m.uid, m.name])] });
  }
  form(it ? 'Edit item' : 'Add to the packing list', fields, it ? { ...it, shared: it.shared ? '1' : '0', assignee: it.assignee || '' } : { qty: 1, cat: 'Other', shared: '0' }, (o, ctx) => {
    if (!o.name) { ctx.msg('What’s the item?'); return false; }
    const data = { name: o.name, qty: Math.max(1, parseInt(o.qty, 10) || 1), cat: o.cat, shared: o.shared === '1', assignee: o.shared === '1' ? (o.assignee || null) : null };
    if (it) cloud.patchSub(st.tripId, 'packing', it.id, Object.entries(data).map(([k, v]) => [k, v]));
    else cloud.addSub(st.tripId, 'packing', { ...data, packed: {}, by: myId() });
  }, it ? () => cloud.delSub(st.tripId, 'packing', it.id) : null);
}

actions.suggestBag = () => {
  const trip = T(); const cur = trip.vibes || [];
  const render = (bg) => {
    const vibes = [...bg.querySelectorAll('[data-chips] button.on')].map((b) => b.dataset.v);
    const have = new Set(st.packing.map((x) => (x.name || '').toLowerCase()));
    const add = suggestions(trip, vibes).filter((x) => !have.has(x.name.toLowerCase()));
    bg.querySelector('[data-count]').textContent = add.length ? `${add.length} items will be added` : 'You already have everything we’d suggest 👍';
    bg.querySelector('[data-go]').disabled = !add.length;
    return { vibes, add };
  };
  modal(`<h3>✨ What kind of trip is it?</h3><p class="small muted" style="margin-top:0">Pick everything that applies. We’ll add the essentials plus extras for these, sized for ${Math.max(1, tripDays(trip).length - 1)} night(s).</p>
    <div class="chips" data-chips="v">${VIBES.map(([k, l]) => `<button type="button" data-v="${k}" class="${cur.includes(k) ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="small" style="margin-top:12px" data-count></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn line" data-x>Cancel</button><button class="btn sun" data-go>Add to list</button></div>`, (bg) => {
    bg.querySelectorAll('[data-chips] button').forEach((b) => { b.onclick = () => { b.classList.toggle('on'); render(bg); }; });
    render(bg);
    bg.querySelector('[data-x]').onclick = closeModal;
    bg.querySelector('[data-go]').onclick = () => {
      const { vibes, add } = render(bg);
      patchTrip([['vibes', vibes]]);
      cloud.batchSub(st.tripId, 'packing', add.map((x) => ({ data: { ...x, assignee: null, packed: {}, by: myId() } })));
      closeModal(); toast(`Added ${add.length} items`);
    };
  });
};
