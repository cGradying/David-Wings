# Digital receipt and printer: concept (not built)

Status: concept only. No code changes. Ships in phases, starting with a view-only receipt in v1.2.

## 1. Receipt JSON schema

Every field comes from an existing column in `core/core.js` (`orders`, `order_items`, `settings`, `day_close`). Nothing new is stored; a receipt is a read-only view of one order.

```json
{
  "shop": "<settings.gcash_name>",
  "day": "2026-10-16",
  "ref": 12,
  "card": 7,
  "type": "dine-in",
  "status": "done",
  "created_at": 1760600000000,
  "items": [
    { "name": "D2 (4pcs + Rice)", "flavor": "Salted Egg", "qty": 1, "price": 139 }
  ],
  "total": 174,
  "method": "cash",
  "tendered": 200,
  "change": 26,
  "gcash_ref": null,
  "void_reason": null
}
```

| Receipt field | Source |
|---|---|
| shop | `settings.gcash_name` (to confirm: use as the shop name, or add a separate shop-name setting later) |
| day, ref, card, type, status, total, method, tendered, change, gcash_ref, void_reason, created_at | `orders` columns of the same name |
| items[].name, flavor, qty, price | `order_items` columns (`price` is the unit price) |
| line total | computed: `qty * price` |

Not on the receipt: `uid`, internal `id`, `item_id`, `category`, `done_at`. Order number is shown as `#` plus `ref` padded to 3 digits (like the queue does).

## 2. On-screen receipt (v1.2, view only)

- Opens from an order in the Sales list or queue ("Receipt" button) and from the pay-success screen.
- Shows the fields above in a narrow, receipt-shaped card: shop, date/time, `#ref`, Card, dine-in/take-out, item lines, total, cash tendered and change (or GCash ref), "Salamat po!" footer.
- A void order shows a VOID stamp and the reason (section 5).
- View only: no sharing, no printing, no edits.

## 3. Later options

### Share as image
Render the receipt card to an image and open the share sheet (the same path backup already uses). Useful for GCash customers who want proof. To evaluate: html-to-canvas in the WebView vs. a native view capture.

### ESC/POS 58mm thermal printer over Bluetooth
- Build an ESC/POS byte string from the receipt JSON: 32 characters per line at 58mm, text only, no logo at first.
- Send over Bluetooth Classic (SPP) from the Capacitor app. A Capacitor plugin is needed. Candidates, all **to evaluate** (maintenance, Android 12+ Bluetooth permissions, Capacitor version fit): `@capacitor-community/bluetooth-le` (BLE printers only), community Bluetooth-serial plugins, a thin custom plugin around Android's `BluetoothSocket`.
- Keep a "Print" button that fails soft: if the printer is off or out of range, show a message and the on-screen receipt still works. A sale never depends on the printer.
- Fallback without a printer: share-as-image or PDF.

## 4. Reprint rules

- Reprint is allowed any time from the order, and prints the same data as the original.
- Reprints carry a "REPRINT" line and the reprint time, so a copy cannot pass as the original.
- Reprint count is not stored in v1.2 to avoid a schema change. Decide with the founder whether a count or log is wanted (would need a new column, so a migration).

## 5. VOID stamp rules

- Status `void` renders "VOID" in large text plus `void_reason`, on screen and in print.
- A void order never prints as a normal receipt, even if reprinted later.
- The original receipt a customer already holds cannot be recalled; the void reason is on file in the ledger. Staff compare by `#ref`.
- Voids are excluded from sales totals, as today.

## 6. Day-close tie-in

- Cash method receipts feed the same expected-cash figure (`float + cash sales`) the day close already uses; no new math.
- Optional later: print a day-close slip (float, cash sales, GCash sales, expected, counted, over/short, voided count) from `ledger()`'s summary. Marked "AMENDED" when `day_close.amended = 1`.
- Receipts are never the source of truth; the `orders` rows are.

## 7. Privacy

- The data has no customer personal data and the receipt adds none: no name, phone or address.
- GCash ref is a transaction reference only; the customer's GCash number is never captured.
- A shared image or printed slip contains only the fields in section 1.
- Backups already include all orders; receipts add nothing to them.

## 8. Hardware to confirm with the founder

1. Does the shop want printed receipts at all, or is on-screen / shared image enough?
2. Does the shop already own a thermal printer? Brand and model.
3. Paper width (58mm assumed; 80mm possible) and who buys rolls.
4. Connection: Bluetooth (assumed), USB or Wi-Fi.
5. Tablet model and Android version (Bluetooth permissions differ from Android 12).
6. Cash drawer that opens via the printer (RJ11 kick)? Not assumed.
7. Receipt wording: shop name, address, TIN or permit text, if the founder wants any (legal requirements to confirm).

## 9. Phased roadmap

| Phase | Scope |
|---|---|
| v1.2 | On-screen receipt, view only, with VOID stamp |
| v1.3 | Share as image; day-close slip on screen |
| v1.4 | ESC/POS 58mm Bluetooth printing, reprint marker, printer pairing in Settings (after plugin evaluation and a real-printer test) |
| Later | Day-close slip printing; optional reprint log |

## 10. Risks

- Bluetooth plugin maturity and Android 12+ permission changes may block the plan; test on the real tablet and printer early.
- Cheap 58mm printers vary in code page and line width; Peso sign and Filipino characters may not print, so use "P" or "PHP" in print.
- Printing adds a failure point at the counter; must never block payment.
- Reprint without a log can be abused; mitigated by the REPRINT marker only.
- Official receipt rules (BIR) may apply to the shop; this is a customer slip, not a legal receipt. Confirm with the founder or an accountant.
