# Milk Tea POS 🧋

A simple, desktop-friendly **Point-of-Sale (POS) web app** for a milk tea and
beverage stall near campus. Built for a cashier using mouse and keyboard only —
no framework, no database, no backend. All state lives in memory.

## Technologies

- **HTML** — single-page structure (`index.html`)
- **Tailwind CSS** — styling, loaded via CDN
- **JavaScript** — vanilla JS with no dependencies (`app.js`)

## How to Run

Open `index.html` directly in a browser (double-click, or use
*File → Open File*), or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Features

- **Product catalog** — 6 hard-coded drinks with prices shown in ₱ (peso),
  two decimal places.
- **Cart management** — one-click add, `+` / `−` quantity buttons
  (minimum quantity is 1), and a Remove button per row. Adding an item that is
  already in the cart increases its quantity rather than duplicating it.
- **Automatic totals** — item subtotals and the overall total recompute after
  every cart change. All math is done in integer centavos to avoid
  floating-point errors.
- **Cash payment** — a numeric input with a live change preview.
- **Payment validation** with clear, distinct error messages for:
  blank input, non-numeric input (e.g. `abc`), negative amounts,
  and insufficient cash. Pressing **Enter** also submits.
- **Payment confirmation** — a green success banner shows the change due.
- **Digital receipt** — transaction reference (`TXN-0001`, `TXN-0002`, …),
  items with quantities and subtotals, total, amount paid, and change.
- **New Transaction** — resets the cart, cash input, messages, and receipt
  and advances the transaction number.

## Transaction Flow

1. **Browse products** → 2. **Add to cart** → 3. **Review order summary** →
4. **Enter cash** → 5. **Validate & compute change** → 6. **Confirm payment** →
7. **Receipt / start a new transaction**.

## Product List

| Product                          | Price  |
| -------------------------------- | ------ |
| Classic Milk Tea (Regular)       | ₱59.00 |
| Wintermelon Milk Tea (Regular)   | ₱65.00 |
| Taro Milk Tea (Regular)          | ₱65.00 |
| Fruit Tea — Lychee (Regular)     | ₱55.00 |
| Brown Sugar Milk Tea (Regular)   | ₱69.00 |
| Bottled Water                    | ₱20.00 |
