# Founder brief: David Wings Ledger

A plan and draft for explaining the app to the founder of David's Wings and Cafe. Plain words, short answers, no tech. Facts come from the code and docs in this repo. Anything not verified is marked **(to confirm)**.

## 1. The 60-second pitch

"This is a cash register notebook on a tablet. Your cashier taps the order, picks the flavor, takes cash or GCash, and the app gives the customer a Card number and the next order number. At closing, the cashier counts the drawer and the app tells you right away if it is over or short. Every cancelled order stays on record with a written reason, so nothing quietly disappears. It works with no internet at all. You save a backup file once a week to your phone or Drive, so a lost tablet does not mean lost records. The menu and prices are already loaded with your real prices, and you can edit them yourself."

One line to end on: "It answers one question every night: did the money in the drawer match what we sold?"

## 2. Problems it solves

| Problem | What the app does |
|---|---|
| Drawer over or short, and nobody knows why | Cashier enters the opening float and the counted cash. App shows expected cash (float + cash sales) against counted, and the difference. GCash is left out because it is not in the drawer. |
| Orders cancelled or "voided" with no trail | A void needs a written reason. The order stays in the ledger (not deleted), is excluded from revenue, and frees its Card. A void after the day was closed marks that day "Amended". |
| Mixed-up customers and card numbers | Each order gets a numbered Card (default pool of 30). A Card cannot be given to two orders being prepared at the same time. Each order also gets a daily running number (#001, #002...) that restarts each day. |
| GCash payments you cannot check later | The cashier types the GCash reference number on the order. It is saved and appears in the sales export. Your GCash name and QR can be set in Settings. |
| Weak or no signal | The tablet app keeps everything on the device. No internet needed to sell. |
| Losing records | Settings > Back up now saves a file you can send to Drive, chat or USB. A "Due" tag shows after 7 days without a backup. Export sales as CSV opens in Excel or Sheets. |

### A peso example, real menu

A customer orders:

- D2 (4pcs + Rice): 139
- 16oz drink: 25 (note: D2 with drink is also on the menu at 159, which is 139 + 20)
- Garlic mayo dip: 10

Using the menu as loaded: D2 139 + Drink 16oz 25 + dip 10 = **174**. (If you use the "D2 + Drink" combo at 159 instead, 159 + 10 = **169**.)

Customer hands over 200 in cash. The app shows change **26** (200 - 174).

At the end of the day, suppose the opening float was 500 and the cash sales totalled 4,200. Expected cash is 4,700. If the cashier counts 4,650, the app shows **50 short** straight away. If one 174 order was voided with the reason "customer changed mind", it is not counted as a sale, and the reason is on file.

Menu drinks are 16oz at 25 and 22oz at 30. Use these figures in the demo.

## 3. 10-minute live demo on the tablet

Before the meeting: install the APK, make sure the opening float is blank for today, and have Honey Barbeque and Garlic Parmesan ready to show as best sellers. The party split-flavor sheet ships in v1.1; check it once on the installed tablet.

1. **(1 min) Orientation.** Open the app. Show the menu tiles (Rice Bowl, D1, D2, Ala-carte, Party, Dips, Drinks). "These are your real prices."
2. **(2 min) Take an order.** Tap D2 (4pcs + Rice), choose Salted Egg. Add a 16oz drink and a Garlic mayo dip. Show the total (174). Choose dine-in. Pick a free Card number.
3. **(1 min) Party pack, split flavors.** Tap Party 20pcs (680). Tick up to 3 flavors, for example Honey Barbeque + Garlic Parmesan, then "Add pack". Show that the pack is priced once at 680 with the flavors divided inside it.
4. **(1 min) Pay cash.** Choose cash, type 200 tendered on the first order, show change 26. Finish the order. Show Card and Ref (#001) in the queue.
5. **(1 min) Pay GCash.** Make a second order, choose GCash, type a sample reference number. Show that it is saved on the order.
6. **(1 min) Finish an order.** When the food is handed over, mark it Done. The Card becomes free again.
7. **(1 min) Void with reason.** Open an order, tap Void. Try it with no reason: the app refuses. Type "customer changed mind". Show it stays in the Sales list as void and is not counted in revenue.
8. **(1 min) Day close.** Open the Sales tab. Enter opening float 500 and counted cash. Show expected cash and over/short. Explain GCash is excluded.
9. **(1 min) Backup.** Settings > Back up now. Show the share sheet (Drive, chat, USB). Mention the "Due" tag after 7 days. Mention Export sales as CSV.

After the demo, delete the demo orders or restore from a clean backup so real opening day starts empty **(to confirm the cleanest way to reset the day)**.

## 4. Likely founder questions, honest answers

- **What if the tablet breaks or is lost?** The data lives only on the tablet. If you have a recent backup file, you install the app on a new tablet and use Settings > Restore. Without a backup, the records are gone. Uninstalling the app also erases the data. So: back up weekly at minimum, ideally every night.
- **Can I see sales from my own phone?** Not live. The tablet and the optional online copy do not sync, by design (see `docs/adr/0001`). You can receive the backup file or the CSV. A one-way upload of closed days is the likely future option, not built.
- **Can it print receipts?** Not yet. Receipt printing and a customer-facing "now serving" screen are not included. Printer support is on the roadmap.
- **Can I change prices or the menu?** Yes, the menu is editable in the app. Flavors and best-seller stars are settings. Past orders keep their old totals **(to confirm: price edits do not rewrite old orders)**.
- **Who owns the data?** You do. It is stored on your tablet, and on a backup file you keep. There is no company server collecting it in the tablet mode. The optional online mode stores it in a Cloudflare account, behind a login, that you control.
- **What does it cost?** No subscription is built in. The optional online mode runs on a free Cloudflare plan, per the README. The APK is debug-signed, so it is installed by hand rather than from the Play Store. Any fee for my time or setup: **to confirm / to decide**.
- **Does it need internet?** Not to sell or close the day. Only the optional online mode needs it.
- **What if two staff share it?** It is designed for one cashier and one tablet. Several tablets would each have separate, unsynced records.
- **Is it secure?** The tablet holds the data on the device. There is no login on the tablet itself **(to confirm: whether to add a PIN)**. The online option sits behind Cloudflare Access.
- **Will it work on my tablet?** Minimum Android 7. Tested on an Android 15 tablet emulator, not yet on your actual device **(to confirm)**.

## 5. What we need from the founder

1. **50-piece party price.** Menu seed says 1710. Another figure, 1770, is noted as possible. Which one is right?
2. **Flavors.** Current list: David's Classic Buffalo, Salted Egg, Salt and Pepper, Honey Barbeque, Garlic Parmesan. Any to add or drop?
3. **Best sellers.** Currently marked: Honey Barbeque and Garlic Parmesan. Confirm.
4. **Opening float habit.** How much cash do you start the drawer with, and who counts it? Is it the same every day?
5. **GCash name and QR.** The name defaults to "David Wings and Cafe". We need the exact name and a QR image to put in Settings.
6. **Tablet model.** Which tablet and Android version will the cashier use? Does it have enough storage and a screen lock?
7. **Dips and drinks.** Confirm the dip list (Barbecue sauce, Gravy, Garlic mayo at 10 each) and drink prices (16oz 25, 22oz 30).
8. **Card pool.** Default is 30 Cards. How many physical cards do you have?
9. **Who gets the weekly backup file,** and where should it go (Drive, chat, USB)?

## 6. Rollout checklist

- [ ] Build or copy the APK and install it on the tablet (allow "install unknown apps"). Open once so the database and menu are created.
- [ ] Set prices, flavors, best sellers, Card pool size, GCash name and QR in Settings. Check the 50pcs price against the founder's answer.
- [ ] Run the demo script once end to end, then clear the test orders so day one starts empty.
- [ ] Train the cashier (15 minutes): take an order, pay cash and GCash, mark Done, void with reason, enter the opening float at the start, count the drawer at close.
- [ ] Agree who backs up, when, and where the files go. Do the first backup together and test a Restore on a spare device if one is available.
- [ ] First week: check in at the end of each day. Review over/short, voids and their reasons, and any "Amended" days. Note menu or flow problems.
- [ ] End of week one: send the CSV export, review the numbers with the founder, adjust the menu, and decide on a PIN, receipt printer or remote view.
- [ ] Keep one spare copy of the APK and the latest backup file off the tablet.

## Taglish tone (suggestions)

Customer-facing words and pitch lines can mix Tagalog and English the way shop owners and customers talk. These are suggestions to review with the founder, not final copy.

- "Sulit!" (good value)
- "Salamat po!" (thank you)
- "Ano po ang flavor?" (what flavor?)
- "Dine-in po o take-out?" (dine in or take out?)
- "Ito na po ang sukli ninyo." (here is your change)
- "Kunin na po ang order, Card #7." (please collect your order)
- "Kuya/Ate, subukan natin sa phone mo, 2 minuto lang." (let's try it on your phone, 2 minutes)
- "Walang internet? Okay lang, gumagana pa rin." (no internet? still works)
