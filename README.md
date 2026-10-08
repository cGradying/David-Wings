# David Wings Ledger

Cashier ledger for David's Wings and Cafe (boneless wings): one cashier, one tablet, portrait or landscape. Menu and sales are mock data.

One codebase, three ways to run it. All share the same rules (`core/`) and the same UI (`public/`).

| Mode | Where the data lives | Needs |
|---|---|---|
| **Android tablet** (main) | SQLite inside the app, no server | the APK |
| **Dev / desktop** | `data/ledger.db` | Node 22+ |
| **Online** (optional) | Cloudflare D1, behind a login | free Cloudflare account |

The tablet and online copies are independent; move data between them with Back up / Restore (see `docs/adr/0001`). Vocabulary (Order, Sale, Void, Card, Ref, Day close) is in `CONTEXT.md`.

## 1. Android tablet, fully offline

Build once on a Mac with JDK 21 and the Android SDK:

```
npm install
npm run android:build            # -> android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the tablet and open it (allow "install unknown apps"). First launch creates the database and the demo menu. Tested on an Android 15 tablet emulator: orders survive force-stop, backup opens the share sheet. Minimum Android 7 (API 24).

**Back up the tablet.** The database lives inside the app, so uninstalling the app erases it. Settings > Back up now sends a `.json` file through the share sheet (Drive, USB, chat). Settings > Restore replaces everything from such a file. A dot on the gear and a "Due" tag appear after 7 days without a backup.

## 2. Dev / desktop

```
node server.js     # http://localhost:3000, installable as a PWA
node test.js       # pricing, Card pool, void, day close, backup round-trip
```

## 3. Online, free and secure (Cloudflare Workers + D1 + Access)

D1 free tier is far larger than this app needs, and nothing sleeps. Security: HTTPS by default; **Cloudflare Access** does the login; the Worker also verifies the Access token itself and answers 401 to everything if Access is not configured, so the data is never public by accident.

```
npx wrangler login
npx wrangler d1 create david-wings-ledger        # paste database_id into wrangler.toml
npm run sql                                      # writes worker/schema.sql + seed.sql  (add -- --demo for fake sales)
npx wrangler d1 execute david-wings-ledger --remote --file worker/schema.sql
npx wrangler d1 execute david-wings-ledger --remote --file worker/seed.sql
npm run deploy
```

Then in the Cloudflare dashboard: Zero Trust > Access > Applications > add a self-hosted app for your Worker URL, allow only your email(s), copy its **Application Audience (AUD)** tag, and set `ACCESS_TEAM` (your team name) and `ACCESS_AUD` in `wrangler.toml`; deploy again. Local test of the Worker: `npx wrangler dev --var DEV:1` (the `DEV` flag disables the check; never set it in production).

## Layout

- `core/` rules over a tiny SQL adapter; `routes.js` is the `/api` surface
- `adapters/` node:sqlite, Capacitor SQLite, D1
- `public/` UI (vanilla JS, no build step); `android-app/` + `scripts/build-android.mjs` wrap it for Android
- `worker/` Cloudflare entry and Access check
- `store-preview/` screenshots for a store listing

Not included: Play Store listing/signing (the APK is debug-signed), receipt printing, a customer-facing "now serving" screen, sync between tablet and online.
