// Thin wrapper around Firebase Auth + Firestore.
// The rest of the app only talks to `cloud`, so you could swap Firebase for
// Supabase or your own API by rewriting just this file.
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

export const cloud = { ready: false };

const configured = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('PASTE');

if (configured) {
  try {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = A.getAuth(app);
    // Offline cache: the plan stays readable/editable with no signal and syncs later.
    let db;
    try {
      db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch (e) {
      db = F.getFirestore(app);
    }
    const ref = (uid) => F.doc(db, 'planners', uid);

    Object.assign(cloud, {
      ready: true,
      onAuth: (cb) => A.onAuthStateChanged(auth, cb),
      async signIn() {
        const provider = new A.GoogleAuthProvider();
        try {
          return await A.signInWithPopup(auth, provider);
        } catch (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
            return A.signInWithRedirect(auth, provider);
          }
          throw e;
        }
      },
      signOut: () => A.signOut(auth),
      // Resolves when the server confirms; while offline it stays pending but the
      // write is already in the local cache and shows up in watch() immediately.
      save: (uid, state) => F.setDoc(ref(uid), {
        state: JSON.stringify(state),
        savedAt: state.savedAt || Date.now(),
        updatedAt: F.serverTimestamp(),
      }),
      watch: (uid, onData, onError) => F.onSnapshot(ref(uid), { includeMetadataChanges: true }, (snap) => {
        let data = null;
        if (snap.exists()) {
          try { data = JSON.parse(snap.data().state); } catch (e) { console.error('Bad state in Firestore', e); }
        }
        onData(data, snap.metadata.hasPendingWrites);
      }, onError),
    });
    A.getRedirectResult(auth).catch((e) => console.warn('Redirect sign-in:', e && e.code));
  } catch (e) {
    console.error('Firebase failed to load — running in local-only mode', e);
  }
}
