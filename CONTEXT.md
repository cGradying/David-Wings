# David Wings Ledger

A cashier's ledger for a small wings-and-cafe stall. One cashier, one tablet.

## Language

**Order**:
One customer's purchase. Paid upfront, given a Card and a daily Ref, then prepared and handed over.
_Avoid_: Ticket, transaction

**Sale**:
An Order that is not void. Only Sales count toward revenue.
_Avoid_: Using "sale" for a void Order

**Void**:
An Order cancelled with a written reason. It stays in the ledger for audit and frees its Card.
_Avoid_: Delete, refund

**Card**:
The physical numbered card handed to the customer so the cashier can call them. Reused through the day; unique among Orders being prepared.
_Avoid_: Table number, buzzer

**Ref**:
The daily running number of an Order (#001, #002...). Restarts each day; identifies an Order in the ledger, unlike a Card.
_Avoid_: Order number (ambiguous with Card)

**Tendered**:
Cash handed over by the customer. Change is Tendered minus the total.

**Day close**:
The end-of-day cash count: the cashier enters the opening float and the counted cash; the app shows over or short against expected cash.

**Expected cash**:
Opening float plus the day's cash Sales. GCash Sales are excluded because they are not in the drawer.

**Amended**:
A closed day whose Sales changed after closing (for example a late Void). Its close is recomputed and flagged.

## Relationships

- An **Order** has exactly one **Card** while being prepared, and one **Ref** for life.
- A **Sale** is an **Order** that is not **Void**.
- A **Day close** summarises one day's **Sales** and can become **Amended**.

## Flagged ambiguities

- "Sales" was used for both the screen and for Orders; resolved: the screen lists Orders, and the money counts Sales.
- "Order number" could mean Card or Ref; resolved: always say Card or Ref.
