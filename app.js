/**
 * Milk Tea POS — app.js
 *
 * Simple point-of-sale logic for a beverage stall. Vanilla JS, all state in
 * memory, no backend or storage.
 *
 * Sections:
 *   1. Data       — product catalog (with images)
 *   2. State      — cart, transaction counter
 *   3. Helpers    — currency formatting (integer centavos), image thumbs
 *   4. Toast      — brief auto-dismissing success feedback
 *   5. Modal      — reusable dialog component (focus, ESC, backdrop, scroll lock)
 *   6. Cart ops   — add, increase/decrease, confirm/close remove + clear cart
 *   7. Payment    — validation, confirmation modal, receipt modal, new txn
 *   8. Rendering  — single render() called after every change
 *   9. Events     — button/input wiring
 */

/* ============================== 1. Data ============================== */

const PRODUCTS = [
  { id: 1, name: "Classic Milk Tea (Regular)",      price: 5900, image: "assets/images/classic-milk-tea.jpg" },
  { id: 2, name: "Wintermelon Milk Tea (Regular)",  price: 6500, image: "assets/images/wintermelon-milk-tea.jpg" },
  { id: 3, name: "Taro Milk Tea (Regular)",         price: 6500, image: "assets/images/taro-milk-tea.jpg" },
  { id: 4, name: "Fruit Tea — Lychee (Regular)",    price: 5500, image: "assets/images/lychee-fruit-tea.jpg" },
  { id: 5, name: "Brown Sugar Milk Tea (Regular)",  price: 6900, image: "assets/images/brown-sugar-milk-tea.jpg" },
  { id: 6, name: "Bottled Water",                   price: 2000, image: "assets/images/bottled-water.jpg" },
];

/* ============================== 2. State ============================= */

let cart = [];        // array of { id, name, price, qty } — price in centavos
let txnNumber = 0;    // number of COMPLETED transactions
let currentTxn = "";  // reference of the transaction just completed, e.g. TXN-0001
let paid = false;     // has the current cart been paid? (blocks payment UI until reset)
let receiptData = null; // snapshot of the completed transaction for the receipt

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

/**
 * Build an <img> for a product with lazy loading and a descriptive alt.
 * onerror swaps the image for a neutral placeholder (gray block with the
 * product's initial) so a missing file never shows a broken icon.
 */
function createThumb(product, sizeClasses) {
  const img = document.createElement("img");
  img.src = product.image;
  img.alt = product.name;
  img.loading = "lazy";
  img.className = sizeClasses + " object-cover bg-amber-100";
  img.onerror = () => {
    const fallback = document.createElement("div");
    fallback.className =
      sizeClasses + " bg-slate-200 flex items-center justify-center font-bold text-2xl text-slate-500";
    fallback.setAttribute("aria-hidden", "true"); // alt text already names the product
    fallback.textContent = product.name.charAt(0);
    img.replaceWith(fallback);
  };
  return img;
}

/* ============================== 4. Toast ============================= */

/** Show a brief success toast that auto-dismisses after about 2 seconds. */
function showToast(message) {
  const toastRoot = document.getElementById("toast-root");
  const toast = document.createElement("div");
  toast.className =
    "bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg " +
    "transition-opacity duration-300 max-w-[90vw] truncate";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRoot.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; }, 1700);
  setTimeout(() => toast.remove(), 2000);
}

/* ============================== 5. Modal ============================= */

const modalRoot = document.getElementById("modal-root");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalCard = document.getElementById("modal-card");
const modalTitleEl = document.getElementById("modal-title");
const modalBodyEl = document.getElementById("modal-body");
const modalActionsEl = document.getElementById("modal-actions");
const modalCloseBtn = document.getElementById("modal-close");

let modalDismissible = false;   // payment-success / receipt modals close only via buttons
let modalTriggerElement = null; // element to restore focus to on close

const BUTTON_VARIANTS = {
  primary:
    "bg-amber-700 text-amber-50 hover:bg-amber-800 active:bg-amber-900 focus:ring-amber-700",
  success:
    "bg-green-700 text-white hover:bg-green-800 active:bg-green-900 focus:ring-green-700",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-600",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-400",
};

/**
 * Open a modal.
 * cfg = { title, body?: Node, bodyText?: string,
 *         actions?: [{ label, variant, onClick, autofocus? }],
 *         dismissible?: boolean }
 * Behaviors: focus moves into the dialog; background scroll locks;
 * the close button hides for non-dismissible dialogs.
 */
function openModal(cfg) {
  modalTriggerElement = document.activeElement;
  modalDismissible = cfg.dismissible !== false;

  modalTitleEl.textContent = cfg.title;

  // Body: accept a prepared DOM node (receipt <pre>, summary list) or plain text.
  while (modalBodyEl.firstChild) modalBodyEl.removeChild(modalBodyEl.firstChild);
  if (cfg.body) {
    modalBodyEl.appendChild(cfg.body);
  } else if (cfg.bodyText) {
    modalBodyEl.textContent = cfg.bodyText;
  }

  // Action buttons.
  while (modalActionsEl.firstChild) modalActionsEl.removeChild(modalActionsEl.firstChild);
  const actions = cfg.actions || [];
  let focusTarget = modalDismissible ? modalCloseBtn : modalCard;
  for (const action of actions) {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    if (action.id) btn.id = action.id;
    btn.className =
      "min-h-[44px] px-4 py-2.5 rounded-lg font-semibold cursor-pointer " +
      "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
      (BUTTON_VARIANTS[action.variant || "primary"]);
    btn.addEventListener("click", () => {
      action.onClick ? action.onClick() : closeModal();
    });
    modalActionsEl.appendChild(btn);
    if (actions[0] === action) focusTarget = btn;
  }
  modalCloseBtn.classList.toggle("hidden", !modalDismissible);

  // A11y + scroll lock + show.
  modalCard.setAttribute("aria-modal", "true");
  modalRoot.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (focusTarget) focusTarget.focus();
}

/** Close the modal, restore background scroll, and refocus the trigger. */
function closeModal() {
  modalRoot.classList.add("hidden");
  document.body.style.overflow = "";
  if (modalTriggerElement && modalTriggerElement.isConnected) {
    modalTriggerElement.focus();
  }
  modalTriggerElement = null;
}

/* ============================== 6. Cart ops ========================== */

/** Add a product; if it's already in the cart, just increase its quantity. */
function addToCart(id) {
  const product = findByID(id);
  if (!product) return;

  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 });
  }
  render();
  showToast("Added " + product.name);
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
 *  Items must be removed with the Remove button (with confirmation). */
function decreaseQty(id) {
  const item = cart.find((i) => i.id === id);
  if (item && item.qty > 1) {
    item.qty -= 1;
    render();
  }
}

/** Remove an item from the cart entirely (after the modal confirms). */
function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  render();
}

/** Modal: "Remove [item] from the cart?" with Cancel and Remove. */
function requestRemoveItem(id) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  openModal({
    title: "Remove item",
    bodyText: `Remove “${item.name}” from the cart?`,
    dismissible: true,
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Remove",
        variant: "danger",
        onClick: () => {
          closeModal();
          removeFromCart(id);
          showToast(item.name + " removed");
        },
      },
    ],
  });
}

/** Modal: clear-cart confirmation with Cancel and Clear. */
function requestClearCart() {
  if (cart.length === 0 || paid) return;
  openModal({
    title: "Clear cart",
    bodyText: "Clear all items from the cart? This cannot be undone.",
    dismissible: true,
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Clear",
        variant: "danger",
        onClick: () => {
          closeModal();
          cart = [];
          render();
          showToast("Cart cleared");
        },
      },
    ],
  });
}

/* ============================== 7. Payment =========================== */

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
        " but only " + formatMoney(amountCentavos) + " was received — " +
        "you are short " + formatMoney(total - amountCentavos) + ".",
    };
  }

  return { ok: true, change: amountCentavos - total };
}

/**
 * Process a valid payment: snapshot the receipt, mark the transaction paid,
 * update the UI, and show the payment-confirmation modal.
 */
function processPayment(amountPaidCentavos, changeCentavos) {
  txnNumber += 1;
  currentTxn = "TXN-" + String(txnNumber).padStart(4, "0");
  paid = true;
  receiptData = {
    ref: currentTxn,
    date: new Date().toLocaleString(),
    items: cart.map((i) => ({ ...i })),
    total: cartTotal(),
    paid: amountPaidCentavos,
    change: changeCentavos,
  };
  render();
  openPaymentConfirmationModal();
}

/** Modal: payment confirmation with transaction details + View Receipt. */
function openPaymentConfirmationModal() {
  const summary = document.createElement("div");
  summary.className = "space-y-1";

  function row(term, value, extraClass) {
    const line = document.createElement("div");
    line.className = "flex justify-between gap-4";
    const dt = document.createElement("dt");
    dt.className = "text-slate-500";
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.className = "font-semibold " + (extraClass || "");
    dd.textContent = value;
    line.appendChild(dt);
    line.appendChild(dd);
    return line;
  }

  summary.appendChild(row("Transaction number", receiptData.ref));
  summary.appendChild(row("Total", formatMoney(receiptData.total)));
  summary.appendChild(row("Amount paid", formatMoney(receiptData.paid)));
  summary.appendChild(row("Change due", formatMoney(receiptData.change), "text-green-800 text-base"));

  openModal({
    title: "✓ Payment successful",
    body: summary,
    dismissible: false, // closes only through its buttons
    actions: [
      { label: "View Receipt", variant: "success", onClick: openReceiptModal },
    ],
  });
}

/** Modal: the digital receipt with a New Transaction button. */
function openReceiptModal() {
  const pre = document.createElement("pre");
  pre.id = "receipt-content";
  pre.className =
    "bg-[#FDF6EC] border border-amber-200 rounded-lg p-3 text-xs font-mono whitespace-pre-line max-h-72 overflow-auto";
  pre.textContent = buildReceiptText(receiptData);

  openModal({
    title: "Receipt",
    body: pre,
    dismissible: false, // closes only through its buttons
    actions: [
      { label: "New Transaction", variant: "success", id: "new-txn-btn", onClick: doNewTransaction },
    ],
  });
}

/* ============================== 8. Rendering ========================= */

/**
 * Full UI render. Called after every cart change and after payment.
 * The payment-confirmation modal is opened by processPayment, not here,
 * so it is not re-opened by later renders.
 */
function render() {
  renderProducts();
  renderCart();
  renderCheckout();

  // Header shows the NEXT transaction reference; it advances after each
  // completed payment ("New Transaction" clears all prior data).
  document.getElementById("txn-label").textContent =
    "Transaction: TXN-" + String(txnNumber + 1).padStart(4, "0");

  // Cart empty (or already paid) → block payment entry.
  const empty = cart.length === 0 || paid;
  document.getElementById("pay-btn").disabled = empty;
  document.getElementById("cash-input").disabled = empty;
}

/** Render product cards: image, name, price, Add to Cart button. */
function renderProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = "";

  for (const product of PRODUCTS) {
    const card = document.createElement("div");
    card.className =
      "flex flex-col bg-white border border-amber-100 rounded-xl p-3 shadow-sm " +
      "hover:shadow-md hover:border-amber-300 transition";

    card.appendChild(createThumb(product, "w-full h-40 rounded-lg"));

    const name = document.createElement("div");
    name.className = "mt-2 font-medium text-sm leading-snug";
    name.textContent = product.name;

    const price = document.createElement("div");
    price.className = "text-amber-800 font-bold";
    price.textContent = formatMoney(product.price);

    card.appendChild(name);
    card.appendChild(price);

    const addBtn = document.createElement("button");
    addBtn.setAttribute("data-add", String(product.id));
    addBtn.textContent = "Add to Cart";
    addBtn.className =
      "mt-2 w-full min-h-[44px] bg-amber-700 text-amber-50 rounded-lg text-sm font-semibold " +
      "hover:bg-amber-800 active:bg-amber-900 cursor-pointer focus:outline-none " +
      "focus:ring-2 focus:ring-amber-700 focus:ring-offset-2";
    addBtn.onclick = () => addToCart(product.id);

    card.appendChild(addBtn);
    list.appendChild(card);
  }
}

/**
 * Build one cart row: thumbnail, name + "qty × price", quantity controls
 * (− qty +, clamped at 1), line subtotal, and a Remove button (with modal).
 */
function cartRow(item) {
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 border border-amber-100 rounded-lg p-2";

  row.appendChild(createThumb(item, "w-12 h-12 rounded-md shrink-0"));

  const info = document.createElement("div");
  info.className = "min-w-0 flex-1";
  const name = document.createElement("div");
  name.className = "text-sm font-medium truncate";
  name.textContent = item.name;
  const meta = document.createElement("div");
  meta.className = "text-xs text-slate-500";
  meta.textContent = item.qty + " × " + formatMoney(item.price);
  info.appendChild(name);
  info.appendChild(meta);
  row.appendChild(info);

  const controls = document.createElement("div");
  controls.className = "flex items-center gap-1";

  const minus = document.createElement("button");
  minus.textContent = "−";
  minus.className =
    "w-10 h-10 sm:w-7 sm:h-7 rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 " +
    "font-bold text-lg sm:text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500";
  minus.title = "Decrease quantity (min 1)";
  minus.onclick = () => decreaseQty(item.id);

  const qty = document.createElement("span");
  qty.className = "w-6 text-center text-sm font-semibold";
  qty.textContent = item.qty;

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.className =
    "w-10 h-10 sm:w-7 sm:h-7 rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 " +
    "font-bold text-lg sm:text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500";
  plus.title = "Increase quantity";
  plus.onclick = () => increaseQty(item.id);

  controls.appendChild(minus);
  controls.appendChild(qty);
  controls.appendChild(plus);

  const remove = document.createElement("button");
  remove.textContent = "Remove";
  remove.className =
    "ml-1 py-2 px-1 text-xs text-red-700 hover:underline rounded cursor-pointer " +
    "focus:outline-none focus:ring-2 focus:ring-red-300";
  remove.onclick = () => requestRemoveItem(item.id);
  controls.appendChild(remove);

  row.appendChild(controls);

  const subtotal = document.createElement("span");
  subtotal.className = "font-semibold text-sm whitespace-nowrap";
  subtotal.textContent = formatMoney(item.price * item.qty);
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
  document.getElementById("clear-cart-btn").disabled = cart.length === 0 || paid;
}

/**
 * Render the payment panel. After a confirmed payment the cash form is
 * hidden and the success banner stays until "New Transaction" resets.
 */
function renderCheckout() {
  const errorBox = document.getElementById("payment-error");
  const successBox = document.getElementById("payment-success");
  const changePreview = document.getElementById("change-preview");
  const cashInput = document.getElementById("cash-input");
  const label = document.querySelector("label[for='cash-input']");
  const payBtn = document.getElementById("pay-btn");

  if (paid) {
    successBox.textContent =
      "✓ Payment successful! Change due: " + formatMoney(receiptData.change) +
      " (" + receiptData.ref + ")";
    successBox.classList.remove("hidden");
    errorBox.classList.add("hidden");
    changePreview.classList.add("hidden");
    cashInput.classList.add("hidden");
    label.classList.add("hidden");
    payBtn.classList.add("hidden");
  } else {
    successBox.classList.add("hidden");
    changePreview.classList.remove("hidden");
    cashInput.classList.remove("hidden");
    label.classList.remove("hidden");
    payBtn.classList.remove("hidden");
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
    preview.className = "text-sm text-green-700 font-medium mb-2";
  }
}

function showInlineError(message) {
  const box = document.getElementById("payment-error");
  box.textContent = "✗ " + message;
  box.classList.remove("hidden");
}

/**
 * Digital receipt (monospace, fixed-width): shop name, transaction reference,
 * date/time, items with quantities and subtotals, total, amount paid, change.
 */
function buildReceiptText(data) {
  const lines = [];
  const width = 34;
  const padRight = (str, len) => (str + " ".repeat(len)).slice(0, len);

  lines.push("MILK TEA POS");
  lines.push("OFFICIAL RECEIPT");
  lines.push("Ref: " + data.ref);
  lines.push("Date: " + data.date);
  lines.push("-".repeat(width));
  lines.push(padRight("Item", 22) + padRight("Qty", 5) + "Amount");

  for (const item of data.items) {
    const name = item.name.length > 21 ? item.name.slice(0, 20) + "…" : item.name;
    lines.push(padRight(name, 22) + padRight(String(item.qty), 5) + formatMoney(item.price * item.qty));
  }

  lines.push("-".repeat(width));
  lines.push(padRight("TOTAL", 27) + formatMoney(data.total));
  lines.push(padRight("AMOUNT PAID", 27) + formatMoney(data.paid));
  lines.push(padRight("CHANGE", 27) + formatMoney(data.change));
  lines.push("-".repeat(width));
  lines.push("Thank you, please come again!");
  lines.push("");
  lines.push("[New Transaction] to start over");

  return lines.join("\n");
}

/* ============================== 9. Events ============================ */

const payBtn = document.getElementById("pay-btn");
const cashInput = document.getElementById("cash-input");

/**
 * Pay button / Enter key handler.
 * Invalid → inline error under the input plus a modal with the same
 * case-specific message (short amount shown for insufficient payment).
 * Valid → clear past errors and confirm the payment.
 */
function attemptPayment() {
  const result = validatePayment(cashInput.value);

  if (!result.ok) {
    showInlineError(result.message);
    openModal({
      title: "Payment error",
      bodyText: result.message,
      dismissible: true,
      actions: [{ label: "OK", variant: "primary" }],
    });
    return;
  }

  document.getElementById("payment-error").classList.add("hidden");
  processPayment(Math.round(Number(cashInput.value) * 100), result.change);
}

payBtn.addEventListener("click", attemptPayment);

// Enter key submits payment.
cashInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") attemptPayment();
});

// Live change preview as the cashier types.
cashInput.addEventListener("input", updateChangePreview);

// Modal dismissal paths: Escape key, close button, backdrop click.
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !modalRoot.classList.contains("hidden") &&
    modalDismissible
  ) {
    closeModal();
  }
});
modalCloseBtn.addEventListener("click", () => {
  if (modalDismissible) closeModal();
});
modalBackdrop.addEventListener("click", () => {
  if (modalDismissible) closeModal();
});

/**
 * Start a new transaction. While the cart is unpaid and not empty, the
 * cashier must confirm discarding the current order first.
 * Reset: cart, cash input, inline messages, paid flag, receipt snapshot.
 */
function requestNewTransaction() {
  if (cart.length > 0 && !paid) {
    openModal({
      title: "New transaction",
      bodyText: "Discard the current order?",
      dismissible: true,
      actions: [
        { label: "Cancel", variant: "secondary" },
        {
          label: "Discard",
          variant: "danger",
          onClick: () => {
            closeModal();
            doNewTransaction();
          },
        },
      ],
    });
  } else {
    doNewTransaction();
  }
}

function doNewTransaction() {
  closeModal();
  cart = [];
  cashInput.value = "";
  paid = false;
  receiptData = null;
  render();
}

document.getElementById("header-new-txn-btn").addEventListener("click", requestNewTransaction);
document.getElementById("clear-cart-btn").addEventListener("click", requestClearCart);

/* Kick off the first render on page load. */
render();
