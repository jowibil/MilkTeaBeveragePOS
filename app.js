/**
 * Milk Tea POS — app.js
 *
 * Simple point-of-sale logic for a beverage stall.
 * All state is kept in memory; no backend or storage.
 *
 * Sections:
 *   1. Data       — product catalog
 *   2. State      — cart, transaction counter
 *   3. Helpers    — currency formatting (integer centavos)
 *   4. Cart ops   — add, increase, decrease, remove
 *   5. Payment    — validation and change computation
 *   6. Receipt    — transaction number and receipt text
 *   7. Rendering  — single render() called after every change
 *   8. Events     — button/input wiring
 */

/* ============================== 1. Data ============================== */

const PRODUCTS = [
  { id: 1, name: "Classic Milk Tea (Regular)",        price: 5900 }, // ₱59.00 in centavos
  { id: 2, name: "Wintermelon Milk Tea (Regular)",    price: 6500 },
  { id: 3, name: "Taro Milk Tea (Regular)",           price: 6500 },
  { id: 4, name: "Fruit Tea — Lychee (Regular)",      price: 5500 },
  { id: 5, name: "Brown Sugar Milk Tea (Regular)",    price: 6900 },
  { id: 6, name: "Bottled Water",                     price: 2000 },
];

/* ============================== 2. State ============================= */

let cart = [];        // array of { id, name, price, qty } — price in centavos
let txnNumber = 0;    // 0 = no transaction started yet
let currentTxn = "";  // reference for the current transaction, e.g. TXN-0001

/* ============================== 3. Helpers =========================== */

/** Format integer centavos as ₱ pesos. Converts money once at the display edge. */
function formatMoney(centavos) {
  return "₱" + (centavos / 100).toFixed(2);
}

/** Sum of all subtotals in the cart, in centavos. */
function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function findByID(id) {
  return PRODUCTS.find((p) => p.id === id);
}

/* ============================== 4. Cart ops ========================== */

/** Add a product; if it's already in the cart, just increase its quantity. */
function addToCart(id) {
  const product = findByID(id);
  if (!product) return;

  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  }
  render();
}

/** Increase quantity by one. */
function increaseQty(id) {
  const item = cart.find((i) => i.id === id);
  if (item) {
    item.qty += 1;
    render();
  }
}

/** Decrease quantity; quantity is clamped at 1 (spec choice).
 *  Items must be removed with the Remove button. */
function decreaseQty(id) {
  const item = cart.find((i) => i.id === id);
  if (item && item.qty > 1) {
    item.qty -= 1;
    render();
  }
}

/** Remove an item from the cart entirely. */
function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  render();
}

/* ============================== 5. Payment =========================== */

/**
 * Validate the raw cash input string against the cart total.
 * Returns { ok: true, change } or { ok: false, message }.
 * Checks in order: blank → non-numeric → negative → insufficient.
 */
function validatePayment(rawInput) {
  const input = rawInput.trim();

  if (input === "") {
    return { ok: false, message: "Please enter the cash amount received." };
  }

  const amount = Number(input);

  if (isNaN(amount)) {
    return { ok: false, message: "Invalid amount: '" + input + "' is not a number." };
  }

  // Round to centavos to tolerate tiny float artifacts from user input like 0.1+0.2
  const amountCentavos = Math.round(amount * 100);

  if (amountCentavos < 0) {
    return { ok: false, message: "Amount cannot be negative." };
  }

  const total = cartTotal();

  if (amountCentavos < total) {
    return {
      ok: false,
      message:
        "Insufficient payment. Total is " + formatMoney(total) +
        " but only " + formatMoney(amountCentavos) + " was received.",
    };
  }

  return { ok: true, change: amountCentavos - total };
}

/** Process a valid payment: lock it in as a confirmed transaction and show the receipt. */
function processPayment(amountPaidCentavos, changeCentavos) {
  txnNumber += 1;
  currentTxn = "TXN-" + String(txnNumber).padStart(4, "0");
  render(amountPaidCentavos, changeCentavos);
}

/* ============================== 6. Receipt =========================== */

/* ============================== 7. Rendering ========================= */

/**
 * Full UI render. Called after every cart change and after payment.
 * When payment is confirmed, paymentPaid/paymentChange (centavos) are passed
 * so the confirmation and receipt can be shown.
 */
function render(paymentPaid = null, paymentChange = null) {
  renderProducts();
  renderCart();
  renderCheckout(paymentPaid, paymentChange);

  // Header shows the NEXT transaction reference. Before any payment this is
  // TXN-0001; after each completed payment it advances (all prior data
  // including the receipt is cleared by "New Transaction").
  const label = "TXN-" + String(txnNumber + 1).padStart(4, "0");
  document.getElementById("txn-label").textContent = "Transaction: " + label;

  // Cart is empty → disable payment entry.
  const empty = cart.length === 0;
  document.getElementById("pay-btn").disabled = empty;
  document.getElementById("cash-input").disabled = empty;
}

function renderProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  for (const product of PRODUCTS) {
    const card = document.createElement("button");
    card.className =
      "w-full text-left border rounded p-3 hover:bg-blue-50 hover:border-blue-400 " +
      "flex justify-between items-center gap-2 cursor-pointer";
    card.onclick = () => addToCart(product.id);

    const name = document.createElement("span");
    name.className = "font-medium";
    name.textContent = product.name;

    const price = document.createElement("span");
    price.className = "text-slate-600";
    price.textContent = formatMoney(product.price);

    card.appendChild(name);
    card.appendChild(price);
    list.appendChild(card);
  }
}

/**
 * Build one cart row with name, subtotal, quantity controls (+ / −) and Remove.
 * Quantity decreases clamp at 1; Remove deletes the row.
 */
function cartRow(item) {
  const row = document.createElement("div");
  row.className = "border rounded p-2 flex items-center justify-between gap-2";

  // Left: name + "qty × price"
  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "font-medium text-sm";
  name.textContent = item.name;
  const meta = document.createElement("div");
  meta.className = "text-xs text-slate-500";
  meta.textContent = item.qty + " × " + formatMoney(item.price);
  info.appendChild(name);
  info.appendChild(meta);

  // Middle: quantity buttons
  const controls = document.createElement("div");
  controls.className = "flex items-center gap-1";

  const minus = document.createElement("button");
  minus.textContent = "−";
  minus.className = "w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 font-bold cursor-pointer";
  minus.title = "Decrease quantity (min 1)";
  minus.onclick = () => decreaseQty(item.id);

  const qty = document.createElement("span");
  qty.className = "w-6 text-center text-sm font-semibold";
  qty.textContent = item.qty;

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.className = "w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 font-bold cursor-pointer";
  plus.title = "Increase quantity";
  plus.onclick = () => increaseQty(item.id);

  const remove = document.createElement("button");
  remove.textContent = "Remove";
  remove.className =
    "ml-2 text-xs text-red-600 hover:text-red-800 hover:underline cursor-pointer";
  remove.onclick = () => removeFromCart(item.id);

  controls.appendChild(minus);
  controls.appendChild(qty);
  controls.appendChild(plus);
  controls.appendChild(remove);

  // Right: line subtotal
  const subtotal = document.createElement("span");
  subtotal.className = "font-semibold text-sm";
  subtotal.textContent = formatMoney(item.price * item.qty);

  row.appendChild(info);
  row.appendChild(controls);
  row.appendChild(subtotal);
  return row;
}

function renderCart() {
  const list = document.getElementById("cart-list");
  const emptyMsg = document.getElementById("cart-empty-msg");

  list.innerHTML = "";
  emptyMsg.classList.toggle("hidden", cart.length > 0);
  list.classList.toggle("hidden", cart.length === 0);

  for (const item of cart) {
    list.appendChild(cartRow(item));
  }
  document.getElementById("cart-total").textContent = formatMoney(cartTotal());
}

/**
 * Render the payment panel. On a confirmed transaction this shows the success
 * message and the full receipt; otherwise it shows live change preview and
 * clears stale success state after a cart edit.
 */
function renderCheckout(paymentPaid, paymentChange) {
  const paidConfirmed = paymentPaid !== null;

  const errorBox = document.getElementById("payment-error");
  const successBox = document.getElementById("payment-success");
  const changePreview = document.getElementById("change-preview");
  const receiptSection = document.getElementById("receipt-section");
  const displaySuccessPaid = paidConfirmed ? paymentPaid : null;
  const displaySuccessChange = paidConfirmed ? paymentChange : null;

  if (paidConfirmed) {
    // Confirmed transaction — show message + receipt, hide the input form.
    successBox.textContent =
      "✓ Payment successful! Change due: " + formatMoney(displaySuccessChange);
    successBox.classList.remove("hidden");
    errorBox.classList.add("hidden");
    changePreview.classList.add("hidden");
    document.getElementById("cash-input").classList.add("hidden");
    document.querySelector("label[for='cash-input']").classList.add("hidden");
    document.getElementById("pay-btn").classList.add("hidden");

    receiptSection.classList.remove("hidden");
    document.getElementById("receipt-content").textContent = buildReceipt(
      displaySuccessPaid,
      displaySuccessChange
    );
  } else {
    // Active / empty cart — show input form, hide the confirmed receipt.
    successBox.classList.add("hidden");
    receiptSection.classList.add("hidden");
    document.getElementById("cash-input").classList.remove("hidden");
    document.querySelector("label[for='cash-input']").classList.remove("hidden");
    document.getElementById("pay-btn").classList.remove("hidden");

    updateChangePreview();
  }
}

/**
 * Live change preview while the cashier types — informational only;
 * real validation happens on Pay.
 */
function updateChangePreview() {
  const input = document.getElementById("cash-input").value.trim();
  const preview = document.getElementById("change-preview");
  const amount = Number(input);
  const total = cartTotal();

  if (input === "" || isNaN(amount) || Math.round(amount * 100) < total) {
    preview.textContent = "Change: " + formatMoney(0);
    preview.className = "text-sm text-slate-500 mb-2";
  } else {
    preview.textContent = "Change: " + formatMoney(Math.round(amount * 100) - total);
    preview.className = "text-sm text-green-700 mb-2";
  }
}

/**
 * Build receipt text: items, quantities, subtotals, total, amount paid, change
 * and the transaction reference number.
 */
function buildReceipt(amountPaidCentavos, changeCentavos) {
  const lines = [];
  const width = 32;

  const padRight = (str, len) => (str + " ".repeat(len)).slice(0, len);

  lines.push("MILK TEA POS RECEIPT");
  lines.push("Ref: " + currentTxn);
  lines.push("Date: " + new Date().toLocaleString());
  lines.push("-".repeat(width));
  lines.push(padRight("Item", 20) + padRight("Qty", 5) + "Amount");

  for (const item of cart) {
    const amount = formatMoney(item.price * item.qty);
    // Shorten name so the right-aligned amount fits neatly
    const name = item.name.length > 19 ? item.name.slice(0, 18) + "…" : item.name;
    lines.push(padRight(name, 20) + padRight(String(item.qty), 5) + amount);
  }

  lines.push("-".repeat(width));
  lines.push(padRight("TOTAL", 25) + formatMoney(cartTotal()));
  lines.push(padRight("AMOUNT PAID", 25) + formatMoney(amountPaidCentavos));
  lines.push(padRight("CHANGE", 25) + formatMoney(changeCentavos));
  lines.push("-".repeat(width));
  lines.push("Thank you, please come again!");
  lines.push("");
  lines.push("[New Transaction] to start over");

  return lines.join("\n");
}

/* ============================== 8. Events ============================ */

const payBtn = document.getElementById("pay-btn");
const cashInput = document.getElementById("cash-input");

// Extract validation display from the button click so Enter key shares the path.
function attemptPayment() {
  const errorBox = document.getElementById("payment-error");
  const result = validatePayment(cashInput.value);

  if (!result.ok) {
    errorBox.textContent = "✗ " + result.message;
    errorBox.classList.remove("hidden");
    return;
  }

  // Valid — clear any previous error, then confirm the transaction.
  errorBox.classList.add("hidden");
  processPayment(Math.round(Number(cashInput.value) * 100), result.change);
}

payBtn.addEventListener("click", attemptPayment);

// Enter key submits payment.
cashInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") attemptPayment();
});

// Live change preview as the cashier types.
cashInput.addEventListener("input", updateChangePreview);

/** Start a new transaction: reset cart, payment input, messages, receipts. */
document.getElementById("new-txn-btn").addEventListener("click", () => {
  cart = [];
  cashInput.value = "";
  render();
});

/* Kick off the first render on page load. */
render();
