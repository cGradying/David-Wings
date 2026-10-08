# One async core over a small SQL adapter per runtime

All Order, Card, stats and Day close rules live in `core/` and talk to the database only through `{ get, all, run, batch }`. Three adapters implement it: `node:sqlite` (dev server and tests), Capacitor native SQLite (tablet) and Cloudflare D1 (online).

The alternative was one implementation per runtime. Three copies of money and Card-pool rules would drift, and the test suite could cover only one. The cost is that everything is async, and that D1 has no interactive transactions, so the core relies on unique indexes and single-statement or batched writes instead of BEGIN/COMMIT.
