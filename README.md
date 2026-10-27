# Pantry Pal

Mobile-first PWA for logging groceries, tracking their freshness, and planning meals around what's about to expire. The full spec is in `Pantry Pal MVP Specs.pdf`.

Stack: Next.js 16 (App Router) + TypeScript · Tailwind v4 + shadcn/ui · Firebase Auth (Google) + Firestore (offline persistence) + Storage · Anthropic API (server-only) · Vercel.

## Setup

1. **Create a Firebase project** at <https://console.firebase.google.com>.
   - **Authentication** → Sign-in method → enable **Google**.
   - **Firestore Database** → create (production mode).
   - **Storage** → get started.
   - Project settings → **Your apps** → add a **Web app** and copy its config.
   - Project settings → **Service accounts** → **Generate new private key** (for the Admin SDK).
2. `cp .env.example .env.local` and fill in the values.
3. Deploy the security rules (one-time; requires `npm i -g firebase-tools` and `firebase login`):
   ```sh
   firebase deploy --only firestore:rules,storage --project <your-project-id>
   ```
   Or paste `firestore.rules` / `storage.rules` into the console's Rules tabs.
4. `npm install`, then `npm run dev` and open <http://localhost:3000>.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (service worker disabled in dev) |
| `npm run build && npm start` | Production build — use this to test offline/PWA behavior |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |

## Project layout

```
src/app/(app)/        Signed-in screens (Pantry, Plan, Shop, Stats, Recipes, Settings)
src/app/api/          Route handlers — the only place secrets/AI calls live
src/app/manifest.ts   PWA manifest
public/sw.js          Service worker: app-shell caching + push handlers
src/lib/firebase/     client.ts (browser SDK) · admin.ts (server-only Admin SDK)
src/lib/server/       Server helpers (ID-token verification, error responses)
src/components/ui/    shadcn/ui primitives
firestore.rules       Users can only touch users/{uid}/**
```

## Notes

- **Secrets**: only `NEXT_PUBLIC_*` values reach the browser. The Anthropic key and Firebase Admin credentials are read only in `server-only` modules.
- **Google sign-in in the installed iOS PWA**: Safari blocks the third-party storage Firebase's default auth flow relies on. In production set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to your app's own domain and add that domain under Firebase Auth → Settings → Authorized domains; `next.config.ts` proxies `/__/auth/*` to Firebase.
- **OneDrive**: this folder is inside OneDrive. If syncing `node_modules`/`.next` gets slow, pause sync or exclude those folders.
