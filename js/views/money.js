// Expenses: record spending, split it between members, and settle up.
// Each expense stores exactly how much each person owes: split = { uid: amount }.
import { st, actions, T, myId, membersOf, isGroup, memberName, patchTrip } from '../store.js';
import { cloud } from '../cloud.js';
import { esc, fd, fdShort, todayIso, money, round2, modal, closeModal, form, toast, firstName, avatar } from '../ui.js';

export const ECOL = { food: '#ff8f6b', drinks: '#b49be0', stay: '#13707a', travel: '#f4bd55', activities: '#7fc29b', shopping: '#ff6f91', other: '#9fb3bd' };
export const ECATS = { food: ['🍽️', 'Food'], drinks: ['🍹', 'Drinks'], stay: ['🛏️', 'Stay'], travel: ['🚕', 'Transport'], activities: ['🎟️', 'Activities'], shopping: ['🛍️', 'Shopping'], other: ['📦', 'Other'] };
const cur = () => T().currency || 'INR';
const M = (n) => money(n, cur());

export function balances(expenses, members) {
  const net = {}; members.forEach((m) => { net[m.uid] = 0; });
  expenses.forEach((e) => {
    if (e.type === 'settle') { net[e.paidBy] = (net[e.paidBy] || 0) + e.amount; net[e.to] = (net[e.to] || 0) - e.amount; return; }
    net[e.paidBy] = (net[e.paidBy] || 0) + e.amount;
    Object.entries(e.split || {}).forEach(([u, a]) => { net[u] = (net[u] || 0) - a; });
  });
  Object.keys(net).forEach((k) => { net[k] = round2(net[k]); });
  return net;
}
// Greedy: biggest debtor pays biggest creditor until everyone is square.
export function settlePlan(net) {
  const deb = [], cre = [];
  Object.entries(net).forEach(([u, v]) => { if (v < -0.009) deb.push([u, -v]); else if (v > 0.009) cre.push([u, v]); });
  deb.sort((a, b) => b[1] - a[1]); cre.sort((a, b) => b[1] - a[1]);
  const out = []; let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const amt = round2(Math.min(deb[i][1], cre[j][1]));
    if (amt > 0) out.push({ from: deb[i][0], to: cre[j][0], amount: amt });
    deb[i][1] = round2(deb[i][1] - amt); cre[j][1] = round2(cre[j][1] - amt);
    if (deb[i][1] <= 0.009) i++; if (cre[j][1] <= 0.009) j++;
  }
  return out;
}
export function equalSplit(amount, uids) {
  const cents = Math.round(amount * 100); const n = uids.length; if (!n) return {};
  const base = Math.floor(cents / n); let rem = cents - base * n; const out = {};
  uids.forEach((u) => { out[u] = (base + (rem-- > 0 ? 1 : 0)) / 100; });
  return out;
}

export function vMoney() {
  const trip = T(); const ex = st.expenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || ((b.at && b.at.seconds) || 0) - ((a.at && a.at.seconds) || 0));
  const group = isGroup(); const mem = membersOf(); const me = myId();
  const spend = ex.filter((e) => e.type !== 'settle');
  const total = round2(spend.reduce((s, e) => s + e.amount, 0));
  const mine = round2(spend.reduce((s, e) => s + ((e.split || {})[me] || 0), 0));
  const budget = +trip.budget || 0;
  let h = `<div class="money-grid"><div class="m-side"><div class="card money-hero"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="tiny muted">${group ? 'GROUP SPENT' : 'TOTAL SPENT'}</div><div class="big">${M(total)}</div>${group ? `<div class="small muted" style="margin-top:4px">Your share: <b>${M(mine)}</b></div>` : ''}</div><button class="btn sun" data-act="addExpense">＋ Expense</button></div>`;
  if (budget) {
    const used = group ? total : total; const p = Math.min(100, Math.round(used / budget * 100));
    h += `<div class="bar ${used > budget ? 'over' : ''}" style="margin-top:12px"><i style="width:${p}%"></i></div><div class="row tiny muted" style="justify-content:space-between;margin-top:4px"><span>Budget ${M(budget)}</span><span>${used > budget ? M(used - budget) + ' over' : M(budget - used) + ' left'}</span></div>`;
  } else h += '<div class="tiny" style="margin-top:8px"><a href="#" data-act="setBudget">Set a trip budget</a></div>';
  h += '</div>';

  if (group) {
    const net = balances(ex, mem); const plan = settlePlan(net);
    h += '<div class="sec"><h2>Balances</h2></div><div class="card">';
    h += mem.map((m) => { const v = net[m.uid] || 0; return `<div class="row" style="flex-wrap:nowrap;margin:6px 0">${avatar(m, 28)}<div style="flex:1"><b>${esc(m.uid === me ? 'You' : m.name)}</b></div><div class="${v > 0.009 ? 'pos' : v < -0.009 ? 'neg' : 'muted'}" style="font-weight:700">${v > 0.009 ? 'gets ' + M(v) : v < -0.009 ? 'owes ' + M(-v) : 'settled'}</div></div>`; }).join('');
    if (plan.length) {
      h += '<div class="tiny muted" style="margin:12px 0 4px">TO SETTLE UP</div>' + plan.map((s) => `<div class="settle"><span><b>${esc(s.from === me ? 'You' : firstName(memberName(s.from)))}</b> → <b>${esc(s.to === me ? 'you' : firstName(memberName(s.to)))}</b> ${M(s.amount)}</span><button class="btn sm ghost" data-act="markPaid" data-from="${s.from}" data-to="${s.to}" data-amt="${s.amount}">Mark paid</button></div>`).join('');
    } else if (spend.length) h += '<div class="small muted" style="margin-top:8px">Everyone’s square 🙌</div>';
    h += '</div>';
  }

  if (spend.length) {
    const byCat = {}; spend.forEach((e) => { byCat[e.cat || 'other'] = (byCat[e.cat || 'other'] || 0) + e.amount; });
    h += `<div class="sec"><h2>Where it went</h2></div><div class="card where">${donut(byCat, total)}<div class="legend">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="lg-row"><i style="background:${ECOL[c] || ECOL.other}"></i><span>${(ECATS[c] || ECATS.other)[0]} ${(ECATS[c] || ECATS.other)[1]}</span><b>${M(v)}</b><span class="tiny muted">${Math.round(v / total * 100)}%</span></div>`).join('')}</div></div>`;
  }
  h += '</div><div class="m-main">';
  h += '<div class="sec"><h2>Expenses</h2></div>';
  if (!ex.length) h += `<div class="card empty">No expenses yet. ${group ? 'Add what anyone pays — Yatri works out who owes whom.' : 'Track what you spend each day.'}</div>`;
  let lastDate = null;
  ex.forEach((e) => {
    if (e.date !== lastDate) { lastDate = e.date; h += `<div class="tiny muted" style="margin:12px 2px 6px;font-weight:700">${esc(fd(e.date) || 'No date')}</div>`; }
    if (e.type === 'settle') { h += `<div class="card exp settle-row" data-act="editExpense" data-id="${e.id}"><div class="eic">🤝</div><div style="flex:1"><b>${esc(e.paidBy === me ? 'You' : firstName(memberName(e.paidBy)))} paid ${esc(e.to === me ? 'you' : firstName(memberName(e.to)))}</b><div class="tiny muted">Settlement</div></div><b>${M(e.amount)}</b></div>`; return; }
    const n = Object.keys(e.split || {}).length; const my = (e.split || {})[me] || 0;
    h += `<div class="card exp" data-act="editExpense" data-id="${e.id}"><div class="eic" style="--c:${ECOL[e.cat] || ECOL.other}">${(ECATS[e.cat] || ECATS.other)[0]}</div><div style="flex:1;min-width:0"><b>${esc(e.title || 'Expense')}</b><div class="tiny muted">${group ? `${esc(e.paidBy === me ? 'You' : firstName(memberName(e.paidBy)))} paid · ${n === mem.length ? 'split equally' : 'split ' + n + ' way' + (n === 1 ? '' : 's')}` : esc((ECATS[e.cat] || ECATS.other)[1])}</div></div><div style="text-align:right"><b>${M(e.amount)}</b>${group ? `<div class="tiny muted">you: ${M(my)}</div>` : ''}</div></div>`;
  });
  h += '</div></div>';
  return h;
}

/* ---------- actions ---------- */
actions.setBudget = () => form('Trip budget', [{ k: 'budget', label: 'Total budget (' + cur() + ')', type: 'number', full: 1, help: isGroup() ? 'For the whole group.' : '' }], { budget: T().budget || '' }, (o) => { patchTrip([['budget', Math.max(0, parseFloat(o.budget) || 0)]]); });
actions.markPaid = (el) => {
  cloud.addSub(st.tripId, 'expenses', { type: 'settle', amount: +el.dataset.amt, paidBy: el.dataset.from, to: el.dataset.to, date: todayIso(), by: myId() });
  toast('Settlement recorded');
};
actions.addExpense = () => editExpense(null);
actions.editExpense = (el) => editExpense(st.expenses.find((x) => x.id === el.dataset.id));

function editExpense(e) {
  const group = isGroup(); const mem = membersOf(); const me = myId();
  if (e && e.type === 'settle') {
    return form('Settlement', [{ k: 'amount', label: 'Amount', type: 'number' }, { k: 'date', label: 'Date', type: 'date' }], e, (o) => { cloud.setSub(st.tripId, 'expenses', e.id, { amount: round2(parseFloat(o.amount) || 0), date: o.date }); }, () => cloud.delSub(st.tripId, 'expenses', e.id));
  }
  const v = e || { title: '', amount: '', cat: 'food', date: todayIso(), paidBy: me, split: null };
  const splitMode = e && e.split && !sameAsEqual(e) ? 'exact' : 'equal';
  const included = new Set(e && e.split ? Object.keys(e.split) : mem.map((m) => m.uid));
  const html = `<h3>${e ? 'Edit expense' : 'Add expense'}</h3>
    <div class="grid2">
      <div class="full"><label>What for?</label><input name="title" value="${esc(v.title)}" placeholder="Dinner at Thalassa"></div>
      <div><label>Amount (${esc(cur())})</label><input name="amount" type="number" step="any" inputmode="decimal" value="${esc(v.amount)}" placeholder="0"></div>
      <div><label>Date</label><input name="date" type="date" value="${esc(v.date || '')}"></div>
      <div class="full"><label>Category</label><div class="chips one" data-cat>${Object.entries(ECATS).map(([k, [ic, l]]) => `<button type="button" data-v="${k}" class="${v.cat === k ? 'on' : ''}">${ic} ${l}</button>`).join('')}</div></div>
      ${group ? `<div class="full"><label>Paid by</label><select name="paidBy">${mem.map((m) => `<option value="${m.uid}" ${m.uid === v.paidBy ? 'selected' : ''}>${esc(m.uid === me ? 'You (' + m.name + ')' : m.name)}</option>`).join('')}</select></div>
      <div class="full"><label>Split</label><div class="seg" style="margin-bottom:8px"><button type="button" data-sm="equal" class="${splitMode === 'equal' ? 'on' : ''}">Equally</button><button type="button" data-sm="exact" class="${splitMode === 'exact' ? 'on' : ''}">Exact amounts</button></div>
        <div data-members>${mem.map((m) => `<div class="row splitrow" style="flex-wrap:nowrap"><label class="cb"><input type="checkbox" data-u="${m.uid}" ${included.has(m.uid) ? 'checked' : ''}> ${esc(m.uid === me ? 'You' : m.name)}</label><input class="exact" data-x="${m.uid}" type="number" step="any" inputmode="decimal" value="${e && e.split && e.split[m.uid] != null ? e.split[m.uid] : ''}" placeholder="0"><span class="share tiny muted" data-s="${m.uid}"></span></div>`).join('')}</div>
        <div class="tiny" data-left style="margin-top:6px"></div></div>` : ''}
    </div>
    <div class="form-msg tiny" style="color:#b3261e;margin-top:10px"></div>
    <div class="row" style="margin-top:14px;justify-content:space-between"><div>${e ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}</div><div class="row"><button type="button" class="btn line" data-x>Cancel</button><button class="btn sun" data-save>Save</button></div></div>`;
  modal(html, (bg) => {
    let mode = splitMode;
    const q = (s) => bg.querySelector(s); const qa = (s) => [...bg.querySelectorAll(s)];
    qa('[data-cat] button').forEach((b) => { b.onclick = () => { qa('[data-cat] button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); }; });
    const amount = () => round2(parseFloat(q('[name=amount]').value) || 0);
    const refresh = () => {
      if (!group) return;
      bg.querySelector('[data-members]').className = 'mode-' + mode;
      qa('[data-sm]').forEach((b) => b.classList.toggle('on', b.dataset.sm === mode));
      const uids = qa('[data-u]').filter((c) => c.checked).map((c) => c.dataset.u);
      if (mode === 'equal') {
        const sp = equalSplit(amount(), uids);
        qa('[data-s]').forEach((s) => { s.textContent = sp[s.dataset.s] != null ? money(sp[s.dataset.s], cur()) : ''; });
        q('[data-left]').textContent = uids.length ? `${money(amount(), cur())} ÷ ${uids.length}` : 'Pick at least one person';
      } else {
        const sum = round2(qa('[data-x]').reduce((s, i) => s + (parseFloat(i.value) || 0), 0));
        const left = round2(amount() - sum);
        q('[data-left]').innerHTML = Math.abs(left) < 0.01 ? '<span class="pos">✓ Adds up</span>' : `<span class="neg">${left > 0 ? money(left, cur()) + ' left to assign' : money(-left, cur()) + ' too much'}</span>`;
      }
    };
    qa('[data-sm]').forEach((b) => { b.onclick = () => { mode = b.dataset.sm; refresh(); }; });
    bg.addEventListener('input', refresh); refresh();
    q('[data-x]').onclick = closeModal;
    const del = q('[data-del]'); if (del) del.onclick = () => { if (del.dataset.sure) { closeModal(); cloud.delSub(st.tripId, 'expenses', e.id); } else { del.dataset.sure = 1; del.textContent = 'Tap again to delete'; } };
    q('[data-save]').onclick = () => {
      const msg = (t) => { q('.form-msg').textContent = t; };
      const amt = amount(); const title = q('[name=title]').value.trim();
      if (!amt || amt <= 0) return msg('Enter the amount');
      const cat = (q('[data-cat] button.on') || {}).dataset?.v || 'other';
      let paidBy = me, split = { [me]: amt };
      if (group) {
        paidBy = q('[name=paidBy]').value;
        if (mode === 'equal') {
          const uids = qa('[data-u]').filter((c) => c.checked).map((c) => c.dataset.u);
          if (!uids.length) return msg('Pick who shares this expense');
          split = equalSplit(amt, uids);
        } else {
          split = {}; qa('[data-x]').forEach((i) => { const n = round2(parseFloat(i.value) || 0); if (n > 0) split[i.dataset.x] = n; });
          const sum = round2(Object.values(split).reduce((s, n) => s + n, 0));
          if (Math.abs(sum - amt) >= 0.01) return msg(`Exact amounts add up to ${money(sum, cur())}, not ${money(amt, cur())}`);
        }
      }
      const data = { type: 'expense', title: title || ECATS[cat][1], amount: amt, cat, date: q('[name=date]').value || todayIso(), paidBy, split };
      if (e) cloud.patchSub(st.tripId, 'expenses', e.id, Object.entries(data)); // update replaces `split` as a whole
      else cloud.addSub(st.tripId, 'expenses', { ...data, by: me });
      closeModal();
    };
  });
}
function donut(byCat, total) {
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const segs = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
    const len = total ? v / total * C : 0; const seg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${ECOL[c] || ECOL.other}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
    off += len; return seg;
  }).join('');
  return `<svg viewBox="0 0 140 140" class="donut"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--bg2)" stroke-width="18"/>${segs}<text x="70" y="66" text-anchor="middle" class="d-lbl">spent</text><text x="70" y="86" text-anchor="middle" class="d-val">${esc(M(total))}</text></svg>`;
}
function sameAsEqual(e) { const uids = Object.keys(e.split || {}); const eq = equalSplit(e.amount, uids); return uids.every((u) => Math.abs(eq[u] - e.split[u]) < 0.01); }
