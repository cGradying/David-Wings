# Production plan

## Current state
Offline Android cashier ledger for David's Wings & Cafe. One core (`core/`) over SQL adapters (`adapters/`), one UI (`public/`). Runs on an Android tablet (Capacitor + SQLite), a dev/PWA Node server (`node:sqlite`), or optionally Cloudflare (Worker + D1 + Access). Copies never sync; a backup JSON file is the only bridge (`docs/adr/`). Diagram: `docs/architecture.html`. The APK is debug-signed.

## What changed: real menu
`core/seed.js` now holds the real menu. The production seed has the menu only, no fake orders.

| Item | Price |
|---|---|
| Rice Bowl | 65 |
| D1 / D2 combo | 75 / 139 (+20 for drink variants) |
| Ala carte 6 / 8 / 12 pcs | 205 / 270 / 408 |
| Party 20 / 30 / 50 pcs | 680 / 1025 / 1710 (50 pcs may be 1770, unconfirmed) |
| Dips | +10 |
| Drinks 16oz / 22oz | 25 / 30 (22oz is 30) |

Flavors: David's Classic Buffalo, Salted Egg, Salt and Pepper, Honey Barbeque*, Garlic Parmesan* (*best seller).

## Roadmap
1. **Release signing + install**: release keystore, signed APK/AAB, Play Store or sideloaded APK.
2. **Receipt printing**: Bluetooth/USB thermal printer or share-as-PDF.
3. **Scheduled backup reminder**: a notification on a timer; today there is only a "Due" tag after 7 days.
4. **Party-pack split-flavor handling**: the flavor sheet adds a quantity per flavor, which multiplies the price. It needs a per-pack split so a 20/30/50 pc pack is priced once, with flavors divided inside it.
5. **D1 `database_id` setup**: create the D1 database and paste the id into `wrangler.toml`, then configure Access (`ACCESS_TEAM`, `ACCESS_AUD`).
6. **Confirm the 50 pc party price** (1710 vs 1770) with the shop.
7. **Pitch other shops**: see `docs/research/`.
