Improve the UI of the existing Milk Tea POS (HTML, Tailwind CSS via CDN, vanilla JavaScript). Do not break any required feature or the transaction flow.

## 1. Product images
- Show an image on every product card (all 6 products).
- Store images in `assets/images/` and add an `image` field to each product in the products array in `app.js`, for example `image: "assets/images/classic-milk-tea.jpg"`.
- Use `object-cover` with a fixed aspect ratio (e.g., `aspect-square` or `h-40`) so all cards are uniform.
- Add `loading="lazy"` and a descriptive `alt` text.
- Add an `onerror` fallback so a missing image shows a neutral placeholder (an emoji or a gray block with the product initial) instead of a broken icon.
- If I haven't supplied image files, create simple placeholder images (SVG or emoji-based) for each product and tell me which file names to replace with real photos.

## 2. Layout and visual polish
- Use a clean desktop layout: a header with the shop name, a product grid on the left (about 2/3), and a sticky cart/order summary panel on the right (about 1/3).
- Product cards show the image, name, price in ₱ with 2 decimals, and an "Add to Cart" button. Add a hover state and a subtle shadow and rounded corners.
- Use a cohesive milk tea palette (e.g., warm cream, brown, and a soft accent color) with sufficient text contrast.
- Show an empty-cart state ("Your cart is empty — add a drink to start") with a clear icon or illustration.
- In the cart, show a small thumbnail, name, quantity controls (− qty +), subtotal, a remove button, and a prominent total.
- Make all buttons keyboard-focusable with visible focus rings (`focus:ring`), and support Enter to submit payment.
- Use a toast or inline banner for brief success feedback (e.g., "Added Classic Milk Tea") that auto-dismisses after about 2 seconds.

## 3. Modals
Build one reusable modal component (overlay, centered card, title, body, action buttons) in plain HTML/JS/Tailwind, with these behaviors:
- Closes with the Escape key, the close button, or a click on the backdrop (except the payment-success and receipt modals, which should close only through their buttons).
- Focus moves into the modal when it opens and returns to the trigger when it closes. Use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Background scroll is locked while a modal is open.

Modals to implement:
1. **Remove item confirmation** — "Remove [item] from the cart?" with Cancel and Remove.
2. **Clear cart confirmation** — add a "Clear Cart" button, confirmed with Cancel and Clear.
3. **Payment error modal** (or an inline error under the input plus a modal for serious cases) — a distinct, clear message for each case: blank, non-numeric, negative, and insufficient (show the amount still short).
4. **Payment confirmation modal** — after a valid payment, show the transaction number, total, amount paid, change, and a "View Receipt" button.
5. **Receipt modal** — a digital receipt with shop name, transaction reference, date/time, items, quantities, subtotals, total, amount paid, and change, plus a "New Transaction" button.
6. **New transaction confirmation** — if the user starts a new transaction while the cart is not empty and unpaid, ask "Discard the current order?" with Cancel and Discard.

"New Transaction" must still reset the cart, payment input, messages, and receipt.

## 4. Constraints
- Keep it HTML + Tailwind CDN + vanilla JS only. No frameworks, build tools, backend, or database.
- Keep the code readable and commented, with the modal logic, cart logic, payment validation, and rendering in separate functions.
- Do not add features outside the required scope.

## 6. When finished
Run through the Testing Checklist in AGENTS.md, plus these checks:
- every product shows an image or a fallback
- every modal opens and closes correctly with mouse and keyboard
- the full flow works from browse to receipt to new transaction
Then summarize what changed in a few lines.