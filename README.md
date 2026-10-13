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

- **Product images** — every product card shows a photo of the drink
  (`assets/images/*.jpg`, lazy-loaded with descriptive alt text and a
  fallback placeholder if a file is missing). The photos come from
  Wikimedia Commons (free licenses) and are fetched by `fetch-images.js`,
  which pins/downloads an 800px-wide version under these filenames:
  `classic-milk-tea.jpg`, `wintermelon-milk-tea.jpg`, `taro-milk-tea.jpg`,
  `lychee-fruit-tea.jpg`, `brown-sugar-milk-tea.jpg`, `bottled-water.jpg` —
  `generate-images.js` remains as a fallback renderer. Swap in your own
  photos with the same filenames; no code changes needed.
- **Toast feedback** — brief "Added Classic Milk Tea…" confirmations that
  auto-dismiss after ~2 seconds.
- **Modals** — one reusable, accessible dialog component (`role="dialog"`,
  focus move/restore, scroll lock) for: remove-item and clear-cart
  confirmations, payment errors (blank / non-numeric / negative /
  insufficient, with the short amount shown), payment confirmation, digital
  receipt, and discard-order confirmation. Escape / backdrop / close button
  dismiss every modal except payment confirmation and receipt, which close
  only via their buttons.
- **Mobile-first responsive layout** — one column on phones, two columns on
  tablets (`md`), and the three-panel cashier layout on desktops (`lg`), with
  enlarged touch targets (44px+ buttons, 16px input text) for phones.
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

## Image Credits

Photos from [Wikimedia Commons](https://commons.wikimedia.org/) (free licenses):

| File in `assets/images/` | Source (author, license) |
| ------------------------ | ------------------------ |
| `classic-milk-tea.jpg` | [Home-Brewed Thai Tea with Tapioca — Rosa's Thai](https://commons.wikimedia.org/wiki/File:Home-Brewed_Thai_Tea_with_Tapioca_-_Rosa%27s_Thai_2025-07-22.jpg) by Andy Li, CC0 |
| `wintermelon-milk-tea.jpg` | [Wintermelon Milk Tea, Apr 2025](https://commons.wikimedia.org/wiki/File:Wintermelon_Milk_Tea,_Apr_2025.jpg) by Ralff Nestor Nacor, CC BY-SA 4.0 |
| `taro-milk-tea.jpg` | [Taro flavored milk tea](https://commons.wikimedia.org/wiki/File:Taro_flavored_milk_tea.jpg) by Fumikas Sagisavas, CC0 |
| `lychee-fruit-tea.jpg` | [Lychee with basil seame cold drink from thailand](https://commons.wikimedia.org/wiki/File:Lychee_with_basil_seame_cold_drink_from_thailand.jpg) by Peachyeung316, CC BY-SA 4.0 |
| `brown-sugar-milk-tea.jpg` | [Brown sugar boba tea at Boba Heaven, downtown Evanston, IL](https://commons.wikimedia.org/wiki/File:Brown_sugar_boba_tea_at_Boba_Heaven,_downtown_Evanston,_IL.jpg) by ~delta, CC BY-SA 4.0 |
| `bottled-water.jpg` | [PET Bottle Water](https://commons.wikimedia.org/wiki/File:PET_Bottle_Water.jpg) by Ravitave, CC BY-SA 4.0 |
