# Tablet and online deployments are independent, with no sync

The Android tablet app keeps its own on-device SQLite database. The online deployment (Cloudflare Workers + D1) has its own separate database. They do not synchronise; data moves between them only by exported file.

We considered tablet-primary with a cloud push, so an owner could watch sales remotely. Sync needs a retry queue, stable ids, conflict rules and an API credential stored on the tablet, which is far more than a one-cashier stall needs. Independent deployments keep each one simple and the tablet fully offline.

If remote viewing becomes a real need, the likely path is one-way upload of closed Days from the tablet, since Orders are immutable apart from Void.
