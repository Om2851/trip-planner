# 🌅 Goa Trip Planner

A mobile-first travel planner for a solo trip: trains, hostels and a day-by-day itinerary that **orders each day's places into the shortest loop from your hostel**, with travel time and cost by scooty, cab or bus.

Static site on **GitHub Pages**, data in **Firebase Firestore**, sign-in with **Google**. Works offline and installs on your phone like an app.

---

## Features

- **Itinerary per day.** Add places from about 50 built-in Goa spots or your own Google Maps pin. Tap a place to edit it or move it to another day.
- **Route optimisation.** Exact search (branch-and-bound) for up to 8 stops; nearest-neighbour + 2-opt for more. The start point is the hostel booked for that night.
- **Transport modes.** 🛵 Scooty (rent + petrol), 🚕 Cab (per km + minimum fare), 🚌 Bus. Short hops under ~1 km are suggested as walks. Each leg has an "exact ↗" link to Google Maps directions.
- **Trains & hostels.** PNR, seat, check-in/out dates. Warns about nights with no stay booked.
- **Cloud sync.** One Firestore document per user. Changes from your laptop show up live on your phone.
- **Offline.** Firestore's offline cache plus a service worker, so the plan opens and is editable with no signal and syncs when you're back online.
- **Share my trip.** A view-only link (`?share=<random id>`) that anyone can open without signing in. It updates live, hides PNRs, booking refs and notes by default, and can be turned off at any time.
- **Safety checks.** Pins outside Goa are rejected (catches "copied my current location" mistakes).

## Architecture

```
index.html            → shell, loads app.js as an ES module, registers the service worker
style.css             → all styling
app.js                → UI, state, route optimiser, cost model (no Firebase code)
cloud.js              → the ONLY file that talks to Firebase (auth + Firestore)
firebase-config.js    → your project's public config
firestore.rules       → security rules: private planners/{uid}; public-by-id, owner-write shares/{id}
sw.js                 → offline cache for the app shell
manifest.webmanifest  → "Add to Home Screen" metadata
```

**Sharing model:** when sharing is on, every save also writes a cleaned copy of the plan (no notes, and no PNRs or booking refs unless you turn them on) to `shares/{randomId}`. The rules allow anyone to `get` that one document by its 20-character id, but not to `list` other shares, and only the owner can write or delete it. Turning sharing off deletes the document and rotates the id, so the old link stops working.

**Sync model:** the whole plan is one JSON object with a `savedAt` timestamp. Every edit is saved to `localStorage` straight away, then written to `planners/{uid}` in Firestore after a short pause (600 ms). A live `onSnapshot` listener pulls changes from other devices, and the copy with the newer `savedAt` wins. Because `cloud.js` is a small interface (`onAuth`, `signIn`, `signOut`, `save`, `watch`), you could swap Firebase for Supabase or your own API by rewriting that one file.

---

## Setup (about 15 minutes, all free)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com>, click **Add project**, and name it (e.g. `goa-trip-planner`). You can turn Google Analytics off.
2. **Turn on Google sign-in:** **Build → Authentication → Get started → Sign-in method → Google → Enable**. Pick your support email, then **Save**.
3. **Create the database:** **Build → Firestore Database → Create database**.
   - Location: `asia-south1 (Mumbai)`. This can't be changed later.
   - Start in **production mode**.
4. **Add the security rules:** in Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. **Connect the web app:** **Project settings (⚙️) → Your apps → `</>` Web**. Register the app (no hosting needed) and copy the `firebaseConfig` object into `firebase-config.js`.

> The config values are not secrets. They only identify your project. Your data is protected by the security rules from step 4.

### 2. Put it on GitHub Pages
1. Create a new **public** repo on GitHub, e.g. `goa-trip-planner`.
2. Upload all the files, keeping the `icons/` folder. Either drag them in on github.com, or run:
   ```bash
   git init && git add . && git commit -m "Goa trip planner"
   git branch -M main
   git remote add origin https://github.com/<your-username>/goa-trip-planner.git
   git push -u origin main
   ```
3. In the repo, open **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main / (root)**, then **Save**.
4. After about a minute the site is live at `https://<your-username>.github.io/goa-trip-planner/`.

### 3. Allow sign-in from your GitHub Pages domain
In Firebase, go to **Authentication → Settings → Authorized domains → Add domain** and add `<your-username>.github.io`.
(`localhost` is already allowed for local testing.)

### 4. Move your existing plan across
1. In the old planner (the Claude link or the Desktop file), go to **Notes → Copy backup**.
2. In the new site, click **Sign in with Google**, then go to **Notes → Restore from backup** and paste.

### 5. Install it on your phone
Open the site on your phone, then:
- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ → **Install app**

Sign in once. After that it opens like an app and works offline.

---

## Run locally

ES modules don't load from `file://`, so serve the folder:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```
If `firebase-config.js` still has the placeholder config, the app runs in **local-only mode**: it saves to this browser and shows a banner.

## Deploying changes
1. Edit the files.
2. Bump `VERSION` in `sw.js` (e.g. `v1` → `v2`) so installed phones fetch the new version.
3. Commit and push.

Pages redeploys automatically. Phones pick up the update after one or two app opens.

## Costs
Firebase **Spark (free) plan**. One user with one small document is far below the free limits (50k reads and 20k writes a day). GitHub Pages is free for public repos.

## Ideas to extend it (portfolio-worthy)
- Real road distances via a routing API (e.g. OpenRouteService), proxied through a Firebase Cloud Function
- Time windows in the optimiser (e.g. "Chapora Fort at sunset") as a TSP with time windows
- Expense tracker per day, compared against the cost estimates
- Share a read-only trip link with family
