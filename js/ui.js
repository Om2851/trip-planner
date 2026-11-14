// Small UI + formatting helpers shared by every view.

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ALPH = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randId(n = 12) {
  const r = new Uint8Array(n); crypto.getRandomValues(r);
  let out = ''; for (let i = 0; i < n; i++) out += ALPH[r[i] % ALPH.length];
  return out;
}

/* ---------- dates ---------- */
const pad = (n) => (n < 10 ? '0' : '') + n;
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const pd = (s) => { const p = (s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
export const todayIso = () => iso(new Date());
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fd(s, long) { if (!s) return ''; const d = pd(s); return WD[d.getDay()] + ', ' + d.getDate() + ' ' + MO[d.getMonth()] + (long ? ' ' + d.getFullYear() : ''); }
export function fdShort(s) { if (!s) return ''; const d = pd(s); return d.getDate() + ' ' + MO[d.getMonth()]; }
export function ft(t) { if (!t) return ''; const p = t.split(':'); const h = +p[0]; return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' am' : ' pm'); }
export const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
export function datesBetween(a, b) {
  if (!a || !b || b < a) return [];
  const out = []; const d = pd(a); const e = pd(b);
  while (d <= e && out.length < 90) { out.push(iso(d)); d.setDate(d.getDate() + 1); }
  return out;
}
export function toDate(ts) { if (!ts) return null; if (ts.toDate) return ts.toDate(); if (ts.seconds) return new Date(ts.seconds * 1000); return new Date(ts); }
export function hm(date) { return date ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : ''; }

/* ---------- money ---------- */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'THB', 'SGD', 'JPY', 'AUD', 'CAD', 'IDR', 'LKR', 'NPR', 'VND', 'MYR', 'CHF'];
export function money(n, cur) {
  n = +n || 0;
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur || 'INR', maximumFractionDigits: Math.round(n * 100) % 100 ? 2 : 0 }).format(n); }
  catch (e) { return (cur || '') + ' ' + n.toFixed(2); }
}
export const round2 = (n) => Math.round((+n || 0) * 100) / 100;

/* ---------- people ---------- */
const COLORS = ['#e2622b', '#0f5b66', '#7a4fd0', '#2f8f5b', '#c0397a', '#2d6cdf', '#b8860b', '#555f6d'];
export function initials(name) { const p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
export function colorFor(id) { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]; }
export function avatar(m, size = 28) {
  return `<span class="av" title="${esc(m.name)}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:${colorFor(m.uid)}">${esc(initials(m.name))}</span>`;
}
export const firstName = (n) => String(n || 'Someone').split(' ')[0];

/* ---------- toast ---------- */
let tt = null;
export function toast(m) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = m; el.style.display = 'block';
  clearTimeout(tt); tt = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ---------- modal + generic form ---------- */
export function closeModal() { const m = $('.modal-bg'); if (m) m.remove(); }
export function modal(html, bind) {
  closeModal();
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal">' + html + '</div>';
  bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  if (bind) bind(bg);
  const f = bg.querySelector('input:not([type=hidden]),textarea'); if (f && window.innerWidth > 640) f.focus();
  return bg;
}

// fields: [{k,label,type,ph,full,opts,help}] ; type: text|date|time|number|select|textarea|tel|chips
export function form(title, fields, vals, onSave, onDelete, opts = {}) {
  const fieldHtml = (f) => {
    const v = vals[f.k] == null ? '' : vals[f.k];
    let input;
    if (f.type === 'textarea') input = `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
    else if (f.type === 'select') input = `<select name="${f.k}">${f.opts.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else if (f.type === 'chips') input = `<div class="chips" data-chips="${f.k}">${f.opts.map((o) => `<button type="button" data-v="${esc(o[0])}" class="${(v || []).includes(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
    else input = `<input name="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    return `<div class="${f.full ? 'full' : ''}"><label>${esc(f.label)}</label>${input}${f.help ? `<div class="tiny muted" style="margin-top:4px">${f.help}</div>` : ''}</div>`;
  };
  const html = `<h3>${esc(title)}</h3><form><div class="grid2">${fields.map(fieldHtml).join('')}</div>
    <div class="form-msg tiny" style="color:#b3261e;margin-top:10px"></div>
    <div class="row" style="margin-top:14px;justify-content:space-between"><div>${onDelete ? '<button type="button" class="btn danger" data-del>' + esc(opts.deleteLabel || 'Delete') + '</button>' : ''}</div>
    <div class="row"><button type="button" class="btn line" data-cancel>Cancel</button><button class="btn sun" data-save>${esc(opts.saveLabel || 'Save')}</button></div></div></form>`;
  return modal(html, (bg) => {
    const fm = bg.querySelector('form');
    bg.querySelector('[data-cancel]').onclick = closeModal;
    bg.querySelectorAll('[data-chips] button').forEach((b) => { b.onclick = () => b.classList.toggle('on'); });
    const del = bg.querySelector('[data-del]');
    if (del) del.onclick = () => { if (del.dataset.sure) { closeModal(); onDelete(); } else { del.dataset.sure = 1; del.textContent = 'Tap again to confirm'; } };
    fm.onsubmit = async (e) => {
      e.preventDefault();
      const o = {};
      fields.forEach((f) => {
        if (f.type === 'chips') o[f.k] = [...bg.querySelectorAll(`[data-chips="${f.k}"] button.on`)].map((b) => b.dataset.v);
        else o[f.k] = fm.elements[f.k].value.trim();
      });
      const msg = (t) => { bg.querySelector('.form-msg').textContent = t || ''; };
      const r = await onSave(o, { msg, form: fm, bg });
      if (r !== false) closeModal();
    };
    if (opts.bind) opts.bind(bg);
  });
}

// two-tap confirm for destructive buttons rendered in the page
export function confirmTap(btn, label = 'Tap again to confirm') {
  if (btn.dataset.sure) return true;
  btn.dataset.sure = 1; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; } }, 4000);
  return false;
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch (e) { modal(`<h3>Copy this</h3><textarea style="min-height:120px">${esc(t)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-x>Close</button></div>`, (bg) => { bg.querySelector('[data-x]').onclick = closeModal; const ta = bg.querySelector('textarea'); ta.focus(); ta.select(); }); }
}
