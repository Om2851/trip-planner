// The ONLY module that talks to Firebase. Views call these functions; swap this
// file to move to another backend.
//
// Data model (Firestore):
//   trips/{tripId}                      trip meta + plan (trains, stays, days as maps), members[], memberInfo{}
//   trips/{tripId}/messages/{id}        group chat
//   trips/{tripId}/expenses/{id}        expenses & settlements
//   trips/{tripId}/packing/{id}         PackYourBag items
//   invites/{code}                      { tripId } — secret code that lets a signed-in user join
//   shares/{id}                         public read-only copy of a plan (view-only link)
//   planners/{uid}                      legacy single-plan doc from the first version (import only)
import { firebaseConfig } from '../firebase-config.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
const [{ initializeApp }, A, F] = await Promise.all([
  import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`),
]);

const app = initializeApp(firebaseConfig);
const auth = A.getAuth(app);
let db;
try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
catch (e) { db = F.getFirestore(app); }

const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const now = () => F.serverTimestamp();
function pairsToArgs(pairs) {
  const args = [];
  for (const [path, v] of pairs) {
    args.push(Array.isArray(path) ? new F.FieldPath(...path) : path, v === undefined ? F.deleteField() : clean(v));
  }
  return args;
}

export const cloud = {
  onError: (e) => console.error(e),
};
// Writes are fire-and-forget: Firestore applies them locally at once (works offline)
// and syncs later. Errors (e.g. permission-denied) are reported through onError.
const w = (p) => { p.catch((e) => cloud.onError(e)); return p; };

Object.assign(cloud, {
  /* auth */
  onAuth: (cb) => A.onAuthStateChanged(auth, cb),
  async signIn() {
    const provider = new A.GoogleAuthProvider();
    try { return await A.signInWithPopup(auth, provider); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return A.signInWithRedirect(auth, provider);
      throw e;
    }
  },
  signOut: () => A.signOut(auth),

  /* trips */
  watchTrips(uid, cb, err) {
    const q = F.query(F.collection(db, 'trips'), F.where('members', 'array-contains', uid));
    return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), err);
  },
  watchTrip(id, cb, err) {
    return F.onSnapshot(F.doc(db, 'trips', id), { includeMetadataChanges: true },
      (s) => cb(s.exists() ? { id: s.id, ...s.data({ serverTimestamps: 'estimate' }) } : null, s.metadata.hasPendingWrites, s.metadata.fromCache), err);
  },
  createTrip(data) {
    const ref = F.doc(F.collection(db, 'trips'));
    w(F.setDoc(ref, { ...clean(data), createdAt: now(), updatedAt: now() }));
    return ref.id;
  },
  // pairs: [[['days','2026-11-20'], value], [['trains', id], undefined /* delete */], ['notes', 'text']]
  patchTrip(id, pairs) {
    return w(F.updateDoc(F.doc(db, 'trips', id), ...pairsToArgs(pairs), 'updatedAt', now()));
  },
  leaveTrip(id, uid) {
    return w(F.updateDoc(F.doc(db, 'trips', id), 'members', F.arrayRemove(uid), new F.FieldPath('memberInfo', uid), F.deleteField()));
  },
  async deleteTrip(id) {
    for (const sub of ['messages', 'expenses', 'packing']) {
      const s = await F.getDocs(F.collection(db, 'trips', id, sub));
      const b = F.writeBatch(db); s.docs.forEach((d) => b.delete(d.ref)); if (s.size) await b.commit();
    }
    await F.deleteDoc(F.doc(db, 'trips', id));
  },

  /* subcollections: messages | expenses | packing */
  watchSub(id, sub, cb, err) {
    let q = F.collection(db, 'trips', id, sub);
    if (sub === 'messages') q = F.query(q, F.orderBy('at', 'desc'), F.limit(300));
    return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), err);
  },
  addSub(id, sub, data) {
    const ref = F.doc(F.collection(db, 'trips', id, sub));
    w(F.setDoc(ref, { ...clean(data), at: now() }));
    return ref.id;
  },
  setSub(id, sub, docId, data) { return w(F.setDoc(F.doc(db, 'trips', id, sub, docId), clean(data), { merge: true })); },
  patchSub(id, sub, docId, pairs) { return w(F.updateDoc(F.doc(db, 'trips', id, sub, docId), ...pairsToArgs(pairs))); },
  delSub(id, sub, docId) { return w(F.deleteDoc(F.doc(db, 'trips', id, sub, docId))); },
  // ops: [{data}] add | [{id, patch: pairs}] update | [{id, del: true}] delete
  batchSub(id, sub, ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = F.writeBatch(db);
      ops.slice(i, i + 400).forEach((o) => {
        const ref = o.id ? F.doc(db, 'trips', id, sub, o.id) : F.doc(F.collection(db, 'trips', id, sub));
        if (o.del) b.delete(ref);
        else if (o.patch) b.update(ref, ...pairsToArgs(o.patch));
        else b.set(ref, { ...clean(o.data), at: now() });
      });
      w(b.commit());
    }
  },

  /* invites */
  createInvite(tripId, uid, code) {
    return w(F.setDoc(F.doc(db, 'invites', code), { tripId, by: uid, at: now() }));
  },
  deleteInvite(code) { return w(F.deleteDoc(F.doc(db, 'invites', code))); },
  async joinWithCode(code, user) {
    const s = await F.getDoc(F.doc(db, 'invites', code));
    if (!s.exists()) { const e = new Error('Invite not found'); e.code = 'invite/not-found'; throw e; }
    const tripId = s.data().tripId;
    await F.updateDoc(F.doc(db, 'trips', tripId),
      'members', F.arrayUnion(user.uid),
      new F.FieldPath('memberInfo', user.uid), { name: user.displayName || user.email || 'Traveller' },
      'joinCode', code);
    return tripId;
  },

  /* view-only share links */
  saveShare(shareId, tripId, ownerName, state) {
    return w(F.setDoc(F.doc(db, 'shares', shareId), { tripId, ownerName, state: JSON.stringify(state), updatedAt: now() }));
  },
  deleteShare(shareId) { return w(F.deleteDoc(F.doc(db, 'shares', shareId))); },
  watchShare(shareId, cb, err) {
    return F.onSnapshot(F.doc(db, 'shares', shareId), (s) => {
      if (!s.exists()) return cb(null);
      const d = s.data(); try { cb({ state: JSON.parse(d.state), ownerName: d.ownerName }); } catch (e) { cb(null); }
    }, err);
  },

  /* legacy import from the first single-trip version */
  async getLegacy(uid) {
    try { const s = await F.getDoc(F.doc(db, 'planners', uid)); return s.exists() ? JSON.parse(s.data().state) : null; }
    catch (e) { return null; }
  },
});
