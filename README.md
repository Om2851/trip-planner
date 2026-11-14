# 🌅 Yatri — plan together, pack smart, split fair

**Yatri** (यात्री, "traveller") is a trip planner for solo travellers and groups. You get:

- **Day plans** for any destination, ordered into the shortest loop from where you're staying, with **real road distances**
- **PackYourBag**: a packing checklist built for the trip's length and type
- **Group chat** inside each trip
- **Expenses** with equal or exact splits and settle-up suggestions
- **Bookings** (trains, buses, flights, stays) and a **view-only link** for family

It's a static site (GitHub Pages) with Firebase Auth + Firestore. There is no build step: vanilla ES modules only. It installs on a phone and works offline.

---

## Features

| | |
|---|---|
| 🗺️ **Itinerary** | Places for each day, from worldwide place search (OpenStreetMap / Photon) or a pasted Google Maps pin. The route is ordered by an exact search (≤ 8 stops) or nearest-neighbour + 2-opt, using a real road-distance matrix (OSRM). Shows time and cost by scooty, cab or public transport, plus per-leg Google Maps directions. |
| 🎒 **PackYourBag** | One tap builds a checklist from the trip length (nights → clothes quantities) and trip type (beach, hills, trek, rainy season, flying, international…). Each member ticks their own bag. Shared items (first-aid kit, speaker…) are claimed by one person. Shows a "Who's ready" progress view and "untick all" for the journey home. |
| 💬 **Group chat** | Real-time messages per trip, with an unread badge. |
| 💸 **Expenses** | Solo: totals, categories and a budget. Group: anyone records what they paid, split equally or by exact amounts. Balances plus a minimal settle-up plan (greedy), with "Mark paid". |
| 👥 **Groups** | Invite link (secret code). Everyone in the trip can edit the plan. The organiser can remove members, and anyone can leave. |
| 🔗 **View-only link** | Public, read-only, live copy of the itinerary and bookings. PNRs and booking refs are hidden by default. Chat, money and packing are never shared. |
| 📴 **Offline** | Firestore persistent cache plus a network-first service worker. |

## Architecture

```
index.html
style.css
firebase-config.js        your Firebase web config (public identifiers, not secrets)
firestore.rules           security rules — paste into Firebase console
sw.js                     offline support (network-first)
manifest.webmanifest      installable app metadata
js/
  main.js                 boot, auth, routing (#/trip/{id}/{view}), subscriptions, page shell
  store.js                app state, action registry, optimistic trip patches
  cloud.js                the ONLY Firebase module (swap it to change backend)
  geo.js                  place search, OSRM distance matrix, optimiser, legs & costs, mini map
  ui.js                   formatting, modal/form helpers, avatars, toast
  views/
    trips.js              home (trip list), create/edit trip, legacy import
    plan.js               itinerary
    bookings.js           journeys & stays
    bag.js                PackYourBag
    money.js              expenses, balances, settle-up
    chat.js               group chat
    settings.js           trip settings: members, invites, share link, costs, notes
```

### Data model (Firestore)

```
trips/{tripId}
  name, destination{name,lat,lng}, start, end, currency, vibes[], budget
  ownerId, members[uid], memberInfo{uid:{name}}
  trains{id:{…}}, stays{id:{…}}, days{date:{title,startId,mode,round,places[]}}
  settings{mode,rent,fuel,cabKm,…}, notes, inviteCode, share{id,on,showRefs}
trips/{tripId}/messages/{id}   { uid, name, text, at }
trips/{tripId}/expenses/{id}   { type:'expense', title, amount, cat, date, paidBy, split{uid:amount} }
                               { type:'settle', amount, paidBy, to, date }
trips/{tripId}/packing/{id}    { name, qty, cat, shared, assignee, packed{uid:bool} }
invites/{code}                 { tripId, by }
shares/{shareId}               { tripId, ownerName, state(JSON) }
```

Trains, stays and days are **maps keyed by id/date**. Each edit updates only its own field path (e.g. `days.2026-11-20`), so two people editing different days at the same time don't overwrite each other.

### Security rules (summary)
- **Trips:** only members can read or write. Members can't change the member list, except to remove themselves. The owner can manage members.
- **Joining:** a non-member can add **only themselves**, and only by supplying a valid invite code (checked against `invites/{code}`).
- **Chat:** you can only post as yourself, and only edit or delete your own messages.
- **Invites and shares:** readable by exact id (the id is the secret) but never listable.

### External services (free, no keys)
- **Place search:** [Photon](https://photon.komoot.io) (OpenStreetMap), with Nominatim as a fallback
- **Road distances:** [OSRM](https://project-osrm.org) public demo server (`/table` service, one request per day plan, cached)

These are community servers with fair-use limits, which is fine for personal use and a portfolio. For heavy traffic, self-host them or swap in a paid API in `geo.js`. Everything falls back to straight-line estimates if they're unreachable.

---

## Setup

1. **Firebase.** Create a project, then:
   - enable **Authentication → Google**
   - create **Firestore** (production mode)
   - paste `firestore.rules` into Firestore → Rules → **Publish**
   - copy the web config into `firebase-config.js`
2. **GitHub Pages.** Push the files to a public repo, then go to Settings → Pages → Deploy from branch `main` / root.
3. **Authorized domain.** In Firebase, go to Authentication → Settings → Authorized domains and add `<username>.github.io`.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
ES modules don't load from `file://`. `localhost` is authorised in Firebase by default.

## Deploying changes
Edit, bump `VERSION` in `sw.js`, then commit and push. Pages redeploys in about a minute.

## Ideas to extend
- Push notifications for chat (Firebase Cloud Messaging)
- Receipt photo upload for expenses (Firebase Storage)
- Time windows in the optimiser (TSP with time windows)
- Multi-currency expenses with live exchange rates
