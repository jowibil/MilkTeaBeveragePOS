# AGENTS.md — Milk Tea and Beverage Shop POS

## Project Overview

A simple, desktop-friendly Point-of-Sale (POS) web app for a milk tea and beverage stall near campus. The cashier uses mouse and keyboard only (no touchscreen or kiosk gestures required). The goal is a **simple, functional, readable, and testable** app. A plain interface that works correctly is preferred over an elaborate one that is incomplete or broken.

## Tech Stack

- **HTML** — structure (single `index.html`)
- **Tailwind CSS** — styling (via CDN: `<script src="https://cdn.tailwindcss.com"></script>`)
- **JavaScript** — vanilla JS in `app.js` (no frameworks required)
- No database, backend, authentication, or deployment needed. Keep all state in memory (variables/objects).

## Suggested File Structure

```
/
├── AGENTS.md
├── README.md
├── index.html
└── app.js
```

## Product List (hard-coded)

| Product | Price |
| :--- | :--- |
| Classic Milk Tea (Regular) | ₱59.00 |
| Wintermelon Milk Tea (Regular) | ₱65.00 |
| Taro Milk Tea (Regular) | ₱65.00 |
| Fruit Tea — Lychee (Regular) | ₱55.00 |
| Brown Sugar Milk Tea (Regular) | ₱69.00 |
| Bottled Water | ₱20.00 |

Products and prices may be hard-coded in a JS array. No add/edit product feature is needed. Use the peso sign (₱) and two decimal places for all currency display.

## Required Transaction Flow

The app must support these stages, in order:

| Step | Stage | Description |
| :--- | :--- | :--- |
| 1 | Browse Products | Customer views available products with names and prices. |
| 2 | Add to Cart | Add one or more products and adjust quantities. |
| 3 | Review Order | Order summary with items, quantities, subtotals, and total. |
| 4 | Enter Payment | Cashier types the cash amount into a numeric input field. |
| 5 | Validate & Compute | System validates the amount and computes change, if any. |
| 6 | Confirm Payment | System displays a payment confirmation with transaction details. |
| 7 | Receipt / New Transaction | Digital receipt is shown; cashier can start a new transaction. |

## Required Features (all must be implemented)

1. Display at least five (5) products with names and prices.
2. Add products to the cart via on-screen buttons.
3. Increase and decrease quantity of items already in the cart.
4. Remove a product from the cart.
5. Automatically compute each item's subtotal and the overall total whenever the cart changes.
6. Display a clear order summary of all items currently in the cart.
7. Accept cash payment through a numeric input field.
8. Validate the payment amount. Reject each of the following with a **clear on-screen message**:
   - blank
   - non-numeric
   - negative
   - insufficient (less than total)
9. Compute change for a valid, sufficient payment: `Change = Amount Paid − Total Amount`.
10. Display a clear payment confirmation after successful payment.
11. Generate a simple digital receipt containing: items, quantities, subtotals, total amount, amount paid, change, and a transaction reference (e.g., transaction number).
12. Allow starting a new transaction that clears all prior data (cart, payment amount, receipt).

## Implementation Guidelines

### Logic
- Keep cart as an array of `{ id, name, price, qty }`; derive subtotals and total from it with a single `render()` function called after every change.
- Adding an already-carted product should increase its quantity, not duplicate the row.
- Decreasing quantity to 0 should remove the item (or clamp at 1 — choose one and be consistent).
- Disable or block payment when the cart is empty and show a message.
- Avoid floating-point errors: compute in centavos (integers) or round with `toFixed(2)` / `Math.round(x * 100) / 100`.
- Validate payment input explicitly: trim the string; check blank → check `isNaN`/non-numeric → check negative → check `< total`. Show a distinct message for each case.
- Generate transaction numbers incrementally (e.g., `TXN-0001`) or from a timestamp.
- "New Transaction" must reset: cart, payment input, error messages, confirmation, and receipt.

### Interface
- Desktop layout designed for mouse and keyboard on a standard laptop screen.
- Keep **product list**, **cart/order summary**, **payment entry**, and **receipt** clearly distinguishable (separate sections, panels, or tabs on one screen).
- Show readable feedback for successes (item added, payment successful) and errors (invalid payment). Use color-coded Tailwind classes (e.g., `text-red-600` / `bg-red-100` for errors, `text-green-700` / `bg-green-100` for success).
- Make buttons clearly labeled (Add, +, −, Remove, Pay, New Transaction). Support Enter key to submit payment.
- Do not invest time in replicating any sample UI; it is not graded.

### Code Quality
- Readable, commented, consistently formatted code with descriptive names.
- Separate concerns where practical: data, cart functions, payment/validation functions, rendering.
- Keep it simple. **Do not** build features outside the required scope.

## Out of Scope (do not implement)

- User authentication / login
- Inventory management
- Real payment gateway, QR payment, or card payment
- Database or persistent storage
- Product add/edit UI
- Deployment

## Git & GitHub Requirements

Use Git and GitHub throughout the work. The repository must show:

1. A GitHub repository created for this application.
2. **Initial commit** — project setup and basic interface.
3. **Second commit** — core ordering and computation (cart, totals, change computation).
4. **Third commit** — validation, debugging, and final improvements.
5. A successful push of all commits to GitHub.
6. Visible commit history and a brief `README.md` describing the application.

### Commit Conventions
- Use clear, descriptive messages, e.g.:
  - `Initial commit: project setup and basic POS interface`
  - `Add cart, quantity controls, totals, and change computation`
  - `Add payment validation, fix bugs, and polish UI`
- Commit in meaningful increments; don't squash everything into one commit.

## README Requirements

`README.md` should briefly include: application name and description, technologies used (HTML, Tailwind CSS, JavaScript), how to run it (open `index.html` in a browser), and a short list of features.

## Testing Checklist (verify before final commit)

- [ ] At least 5 products shown with names and prices
- [ ] Add to cart works; repeated adds increase quantity
- [ ] `+` / `−` quantity buttons work; remove works
- [ ] Subtotals and total update automatically
- [ ] Empty cart handled gracefully
- [ ] Payment rejects: blank, non-numeric (e.g., `abc`), negative, insufficient — each with a distinct clear message
- [ ] Exact payment gives ₱0.00 change
- [ ] Overpayment gives correct change
- [ ] Payment confirmation appears on success
- [ ] Receipt shows items, quantities, subtotals, total, amount paid, change, transaction reference
- [ ] New Transaction clears cart, payment field, messages, and receipt
- [ ] Transaction number changes on each new transaction