// Group chat for a trip. Messages live in trips/{id}/messages.
import { st, actions, myId, myName, membersOf, isGroup } from '../store.js';
import { cloud } from '../cloud.js';
import { esc, toDate, hm, fd, iso, todayIso, colorFor, firstName, modal, closeModal } from '../ui.js';

const seenKey = () => 'yatri.seen.' + st.tripId;
export function unreadCount() {
  let seen = 0; try { seen = +localStorage.getItem(seenKey()) || 0; } catch (e) { /* */ }
  return st.msgs.filter((m) => m.uid !== myId() && (toDate(m.at) || new Date()).getTime() > seen).length;
}
function markSeen() { try { localStorage.setItem(seenKey(), String(Date.now())); } catch (e) { /* */ } }

export function vChat() {
  const msgs = st.msgs.slice().reverse();
  const me = myId();
  let h = '<div class="chat" id="chatlog">';
  if (!msgs.length) {
    h += isGroup()
      ? '<div class="empty" style="padding:40px 12px">No messages yet.<br>Say hi 👋 — everyone on this trip sees what you post here.</div>'
      : '<div class="empty" style="padding:40px 12px">Chat is for group trips.<br><br><button class="btn sun" data-act="openSettings">Invite friends</button></div>';
  }
  let lastDay = '', lastUid = '', lastT = 0;
  msgs.forEach((m) => {
    const d = toDate(m.at) || new Date(); const day = iso(d);
    if (day !== lastDay) { h += `<div class="chat-day">${day === todayIso() ? 'Today' : esc(fd(day))}</div>`; lastDay = day; lastUid = ''; }
    const mine = m.uid === me; const cont = m.uid === lastUid && d.getTime() - lastT < 5 * 60e3;
    h += `<div class="msg ${mine ? 'me' : ''} ${cont ? 'cont' : ''}">${!mine && !cont ? `<div class="who" style="color:${colorFor(m.uid)}">${esc(firstName(m.name))}</div>` : ''}<div class="bubble" ${mine ? `data-act="msgMenu" data-id="${m.id}"` : ''}>${esc(m.text).replace(/\n/g, '<br>')}<span class="t">${hm(d)}</span></div></div>`;
    lastUid = m.uid; lastT = d.getTime();
  });
  h += '</div>';
  if (isGroup() || msgs.length) h += '<form class="composer" data-chatform><textarea id="chatInput" rows="1" placeholder="Message the group…" maxlength="2000"></textarea><button class="btn sun" aria-label="Send">➤</button></form>';
  return h;
}

let lastCount = 0;
export function chatAfterRender(firstOpen) {
  markSeen();
  const log = document.getElementById('chatlog'); if (!log) return;
  if (firstOpen || st.msgs.length !== lastCount) window.scrollTo(0, document.body.scrollHeight);
  lastCount = st.msgs.length;
  const f = document.querySelector('[data-chatform]'); const ta = document.getElementById('chatInput');
  if (!f || f.dataset.bound) return; f.dataset.bound = 1;
  const send = () => {
    const text = ta.value.trim(); if (!text) return;
    cloud.addSub(st.tripId, 'messages', { uid: myId(), name: myName(), text });
    ta.value = ''; ta.style.height = '';
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); send(); ta.focus(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
}

actions.msgMenu = (el) => {
  modal('<h3>Your message</h3><div class="row" style="justify-content:flex-end"><button class="btn line" data-x>Cancel</button><button class="btn danger" data-del>Delete message</button></div>', (bg) => {
    bg.querySelector('[data-x]').onclick = closeModal;
    bg.querySelector('[data-del]').onclick = () => { closeModal(); cloud.delSub(st.tripId, 'messages', el.dataset.id); };
  });
};
export const chatMembersLine = () => membersOf().map((m) => firstName(m.name)).join(', ');
