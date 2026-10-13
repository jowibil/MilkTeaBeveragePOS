/**
 * test-pos.js — headless verification of the AGENTS.md checklist plus the
 * ui-improvement.md checks (images, modals, toasts, full flow).
 *
 * Launches Chrome headless, opens index.html, and drives the REAL UI over the
 * Chrome DevTools Protocol. No dependencies — uses built-in fetch/WebSocket.
 *
 * Run:  node test-pos.js
 */
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
];
const chromeExe = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromeExe) {
  console.error("Chrome not found; cannot run headless tests.");
  process.exit(2);
}

const PORT = 9300 + Math.floor(Math.random() * 300);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-test-"));
const fileUrl =
  "file:///" + path.resolve(__dirname, "index.html").replace(/\\/g, "/");

const chrome = spawn(
  chromeExe,
  [
    "--remote-debugging-port=" + PORT,
    "--headless=new",
    "--user-data-dir=" + dataDir,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" }
);

/* ------------------------- CDP plumbing ------------------------- */

let msgId = 0;
const pending = new Map();
let ws = null;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(
      "Page eval failed: " + JSON.stringify(res.exceptionDetails).slice(0, 600)
    );
  }
  return res.result.value;
}

function click(selector) {
  return evaluate(
    '(() => { const el = document.querySelector(' +
      JSON.stringify(selector) +
      "); if (!el) return 'missing'; el.click(); return 'ok'; })()"
  );
}

/** Click the i-th "Add to Cart" product button (0-indexed, PRODUCTS order). */
function clickProduct(i) {
  return evaluate(
    "(() => { const b = document.querySelectorAll('#product-list button[data-add]')[" +
      i +
      ']; if (!b) return "missing"; b.click(); return "ok"; })()'
  );
}

/** Click the button inside #modal-actions with the given exact label. */
function clickModalAction(label) {
  return evaluate(
    "(() => { const b = [...document.querySelectorAll('#modal-actions button')]" +
      '.find(x => x.textContent.trim() === ' + JSON.stringify(label) + ");" +
      " if (!b) return 'missing'; b.click(); return 'ok'; })()"
  );
}

function modalIsOpen() {
  return evaluate(
    "!document.getElementById('modal-root').classList.contains('hidden')"
  );
}

function modalText() {
  return evaluate("document.getElementById('modal-card').textContent");
}

function pressEscape() {
  return evaluate(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 'ok'"
  );
}

/** Click the "Remove" button of a cart row (0-indexed). */
function clickRowRemove(i) {
  return evaluate(
    "(() => { const r = document.querySelectorAll('#cart-list > div')[" + i + "];" +
      "const b = [...r.querySelectorAll('button')].find(x => x.textContent.trim() === 'Remove'); if (!b) return 'missing'; b.click(); return 'ok'; })()"
  );
}

async function waitFor(pageReady) {
  for (let i = 0; i < 40; i++) {
    try {
      if (await evaluate(pageReady)) return;
    } catch (_) {
      /* page not ready yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Page never became ready: " + pageReady);
}

const READY = "document.readyState === 'complete' && document.querySelectorAll('#product-list button[data-add]').length >= 5";

/* --------------------------- assertions -------------------------- */

let passCount = 0;
let failCount = 0;

function check(name, ok, detail) {
  if (ok) {
    passCount++;
    console.log("PASS  " + name);
  } else {
    failCount++;
    console.log("FAIL  " + name + (detail ? "  -> " + String(detail).split("\n").join(" | ").slice(0, 300) : ""));
  }
}

/* ------------------------------ tests ---------------------------- */

async function main() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://127.0.0.1:" + PORT + "/json/version");
      break;
    } catch (_) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const tab = await fetch("http://127.0.0.1:" + PORT + "/json/new?" + fileUrl, {
    method: "PUT",
  }).then((r) => r.json());

  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  };
  await send("Runtime.enable");

  await waitFor(READY);

  /* --- 1. Products: images, alt text, lazy loading, names, prices --- */
  let value = await evaluate(
    "document.querySelectorAll('#product-list button[data-add]').length"
  );
  check("6 products displayed", value === 6, "got " + value);

  value = await evaluate(
    "[...document.querySelectorAll('#product-list img')].every(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)"
  );
  check("every product image loads (jpg files exist in assets/images/)", value === true);

  value = await evaluate(
    "[...document.querySelectorAll('#product-list img')].every(img => img.getAttribute('alt') && img.getAttribute('loading') === 'lazy')"
  );
  check("images have descriptive alt + loading=lazy", value === true);

  value = await evaluate(
    "Array.from(document.querySelectorAll('#product-list button[data-add]')).map(b => b.closest('div').textContent)"
  );
  check(
    "product cards show names and peso prices",
    value.some((t) => t.includes("Classic Milk Tea") && t.includes("₱59.00")) &&
      value.some((t) => t.includes("Bottled Water") && t.includes("₱20.00")),
    JSON.stringify(value && value[0])
  );

  /* --- 2. Empty cart --- */
  check("payment disabled when cart is empty", (await evaluate("document.getElementById('pay-btn').disabled")) === true);
  check("empty-cart state visible", (await evaluate("document.getElementById('cart-empty-msg').classList.contains('hidden')")) === false);
  check("Clear Cart disabled when cart is empty", (await evaluate("document.getElementById('clear-cart-btn').disabled")) === true);

  /* --- 3. Add to cart; repeated adds increase quantity + toast --- */
  await clickProduct(0); // Classic Milk Tea
  await clickProduct(0); // again → qty 2
  let rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  let qty = await evaluate("document.querySelector('#cart-list > div .w-6').textContent");
  let total = await evaluate("document.getElementById('cart-total').textContent");
  check("repeated add increases quantity (1 row, qty 2)", rows === 1 && qty === "2", "rows=" + rows + " qty=" + qty);
  check("total = 2 × ₱59.00 = ₱118.00", total === "₱118.00", "total=" + total);
  check("thumbnails visible in cart rows", (await evaluate(
    "document.querySelectorAll('#cart-list > div img').length"
  )) >= 1);
  const toastText = await evaluate("document.getElementById('toast-root').textContent");
  check("toast shows 'Added Classic Milk Tea…'", /Added Classic Milk Tea/.test(toastText), toastText);
  await evaluate("new Promise(res => setTimeout(res, 2300))");
  check("toast auto-dismisses after ~2s", (await evaluate(
    "document.getElementById('toast-root').children.length"
  )) === 0);

  /* --- 4. Quantity +/− controls, clamp at 1 --- */
  await clickProduct(5); // Bottled Water ₱20
  const plusRow = (i) =>
    evaluate(
      "(() => { const r = document.querySelectorAll('#cart-list > div')[" + i + "];" +
        "r.querySelector('[title=\"Increase quantity\"]').click(); return 'ok'; })()"
    );
  const minusRow = (i) =>
    evaluate(
      "(() => { const r = document.querySelectorAll('#cart-list > div')[" + i + "];" +
        "r.querySelector('[title=\"Decrease quantity (min 1)\"]').click(); return 'ok'; })()"
    );
  await plusRow(1);
  qty = await evaluate("document.querySelectorAll('#cart-list > div')[1].querySelector('.w-6').textContent");
  check("+ increases quantity", qty === "2", "qty=" + qty);
  await minusRow(1);
  await minusRow(1); // qty 1 → clamped, not removed
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  qty = await evaluate("document.querySelectorAll('#cart-list > div')[1].querySelector('.w-6').textContent");
  check("− clamps at 1 (item stays)", rows === 2 && qty === "1", "rows=" + rows + " qty=" + qty);
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("total updates to ₱138.00 (118+20)", total === "₱138.00", "total=" + total);

  /* --- 5. Remove item via confirmation modal (Cancel keeps it) --- */
  await clickRowRemove(1);
  check("remove opens confirmation modal", (await modalIsOpen()) === true);
  let mt = await modalText();
  check("remove modal names the item", mt.includes("Bottled Water") && /from the cart/.test(mt), mt);
  value = await evaluate("document.getElementById('modal-card').contains(document.activeElement)");
  check("focus moves into the confirm modal", value === true);
  value = await evaluate("document.body.style.overflow === 'hidden'");
  check("body scroll is locked while modal open", value === true);

  await clickModalAction("Cancel");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  check("Cancel keeps the item and closes modal", (await modalIsOpen()) === false && rows === 2, "rows=" + rows);
  value = await evaluate("document.body.style.overflow === ''");
  check("body scroll unlocks after close", value === true);

  await clickRowRemove(1);
  await clickModalAction("Remove");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("Remove confirms deletion and updates total", (await modalIsOpen()) === false && rows === 1 && total === "₱118.00", "rows=" + rows + " total=" + total);
  value = await evaluate("document.getElementById('modal-card').contains(document.activeElement)");
  check("focus left the (now closed) modal", value === false);

  /* --- 6. Clear Cart via confirmation modal --- */
  await clickProduct(5); // add water back → total ₱138
  await click("#clear-cart-btn");
  check("Clear Cart opens confirmation modal", (await modalIsOpen()) === true);
  mt = await modalText();
  check("clear modal asks to clear all items", /Clear all items/.test(mt), mt);
  await clickModalAction("Cancel");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  check("Cancel keeps the cart", rows === 2 && (await modalIsOpen()) === false);
  await click("#clear-cart-btn");
  await clickModalAction("Clear");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  check("Clear empties the cart", rows === 0 && (await evaluate(
    "document.getElementById('cart-empty-msg').classList.contains('hidden')"
  )) === false);

  /* --- 7. Payment validation: modal + inline message per case --- */
  await clickProduct(0);
  await clickProduct(0); // Classic ×2 → ₱118

  const payClick = "document.getElementById('pay-btn').click(); 'ok'";
  const inlineErr = "document.getElementById('payment-error').textContent";
  const inlineShown = "!document.getElementById('payment-error').classList.contains('hidden')";

  await evaluate("document.getElementById('cash-input').value = ''");
  await evaluate(payClick);
  mt = await modalText();
  let ie = await evaluate(inlineErr);
  check("blank payment rejected (modal + inline)", (await modalIsOpen()) && /cash amount/i.test(mt) && /cash amount/i.test(ie), mt + " || " + ie);
  await pressEscape();
  check("Escape closes the payment-error modal", (await modalIsOpen()) === false);

  await evaluate("document.getElementById('cash-input').value = 'abc'");
  await evaluate(payClick);
  mt = await modalText();
  ie = await evaluate(inlineErr);
  check("non-numeric payment rejected", (await modalIsOpen()) && /not a number/i.test(mt) && /not a number/i.test(ie), ie);
  await click("#modal-backdrop");
  check("backdrop click closes a dismissible modal", (await modalIsOpen()) === false);

  await evaluate("document.getElementById('cash-input').value = '-5'");
  await evaluate(payClick);
  mt = await modalText();
  check("negative payment rejected", /negative/i.test(mt), mt);
  await click("#modal-close");
  check("close button dismisses the modal", (await modalIsOpen()) === false);

  await evaluate("document.getElementById('cash-input').value = '50'");
  await evaluate(payClick);
  mt = await modalText();
  ie = await evaluate(inlineErr);
  check(
    "insufficient payment shows amount still short",
    /Insufficient/i.test(mt) && /₱68\.00/.test(mt) && /₱68\.00/.test(ie),
    mt
  );
  await clickModalAction("OK");
  check("OK action closes the error modal", (await modalIsOpen()) === false);

  /* --- 8. Exact payment → confirmation modal (non-dismissible) --- */
  await evaluate("document.getElementById('cash-input').value = '118'");
  await evaluate(payClick);
  const banner = await evaluate("document.getElementById('payment-success').textContent");
  check(
    "inline success banner with ₱0.00 change",
    /payment successful/i.test(banner) && /₱0\.00/.test(banner),
    banner
  );
  // The confirmation modal has replaced the error modal in the single modal slot.
  mt = await modalText();
  check(
    "confirmation modal shows TXN-0001, total, paid, change",
    /TXN-0001/.test(mt) && /₱118\.00/.test(mt) && /₱0\.00/.test(mt),
    mt
  );
  await pressEscape();
  check("confirmation modal ignores Escape", (await modalIsOpen()) === true);
  await click("#modal-backdrop");
  check("confirmation modal ignores backdrop click", (await modalIsOpen()) === true);

  /* --- 9. Receipt modal --- */
  await clickModalAction("View Receipt");
  mt = await modalText();
  check(
    "receipt shows shop name, ref, date, item, qty, total, paid, change",
    /MILK TEA POS/.test(mt) &&
      /Ref: TXN-0001/.test(mt) &&
      /Date:/.test(mt) &&
      /Classic Milk Tea/.test(mt) &&
      /₱118\.00/.test(mt),
    mt
  );
  await pressEscape();
  check("receipt modal ignores Escape", (await modalIsOpen()) === true);

  /* --- 10. New Transaction from receipt modal: full reset --- */
  await click("#new-txn-btn");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  const cashVal = await evaluate("document.getElementById('cash-input').value");
  const label = await evaluate("document.getElementById('txn-label').textContent");
  const bcashVisible = await evaluate(
    "!document.getElementById('cash-input').classList.contains('hidden')"
  );
  check("new transaction closes modal and empties cart", (await modalIsOpen()) === false && rows === 0, "rows=" + rows);
  check("new transaction clears cash input and restores form", cashVal === "" && bcashVisible === true);
  check("transaction reference advances to TXN-0002", /TXN-0002/.test(label), label);
  check("payment disabled again on empty cart", (await evaluate("document.getElementById('pay-btn').disabled")) === true);

  /* --- 11. Overpayment via Enter key: correct change --- */
  await clickProduct(2); // Taro ₱65
  await clickProduct(4); // Brown Sugar ₱69 → ₱134
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("second cart total = ₱134.00", total === "₱134.00", "total=" + total);
  await evaluate(
    "const i = document.getElementById('cash-input'); i.value = '150';" +
      "i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); 'ok'"
  );
  const banner2 = await evaluate("document.getElementById('payment-success').textContent");
  check("overpayment gives ₱16.00 change", /₱16\.00/.test(banner2), banner2);
  mt = await modalText();
  check("confirmation modal is TXN-0002 with correct change", /TXN-0002/.test(mt) && /₱16\.00/.test(mt) && /₱134\.00/.test(mt), mt);
  await clickModalAction("View Receipt");
  mt = await modalText();
  check("receipt reference is TXN-0002", /Ref: TXN-0002/.test(mt) && /₱16\.00/.test(mt), mt);
  await click("#new-txn-btn");
  value = await evaluate("document.getElementById('txn-label').textContent");
  check("next reference is TXN-0003", /TXN-0003/.test(value), value);

  /* --- 12. New-transaction confirmation while cart is unpaid --- */
  await clickProduct(0);
  await click("#header-new-txn-btn");
  mt = await modalText();
  check("unpaid cart triggers 'Discard the current order?' modal", /Discard the current order/.test(mt), mt);
  await clickModalAction("Cancel");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  check("Cancel keeps the current order", rows === 1 && (await modalIsOpen()) === false);
  await click("#header-new-txn-btn");
  await clickModalAction("Discard");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  value = await evaluate("document.getElementById('txn-label').textContent");
  check("Discard clears the cart (reference unchanged before payment)", rows === 0 && /TXN-0003/.test(value), value);

  /* --- 13. Responsive layout (mobile-first) --- *
   * Same expectations as before: 1 column on phones, 2 on tablets, 3 on
   * desktop; desktop product panel spans 2 of the 3 tracks.
   */
  await send("Page.enable");
  const gridTracks = "getComputedStyle(document.querySelector('main')).gridTemplateColumns";

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.reload");
  await waitFor(READY);
  let tracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("phone (390px): single-column stack", tracks.length === 1, "tracks=" + JSON.stringify(tracks));
  value = await evaluate("getComputedStyle(document.getElementById('pay-btn')).height");
  check("phone: Pay button meets 44px touch target", value === "44px", value);
  await clickProduct(0);
  value = await evaluate("getComputedStyle(document.querySelector('button[title=\"Increase quantity\"]')).width");
  check("phone: +/− buttons enlarged to 40px", value === "40px", value);

  await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload");
  await waitFor(READY);
  await clickProduct(0);
  tracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("tablet (800px): two columns", tracks.length === 2, "tracks=" + JSON.stringify(tracks));
  value = await evaluate("getComputedStyle(document.querySelector('button[title=\"Increase quantity\"]')).width");
  check("tablet: qty buttons back to compact 28px", value === "28px", value);

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload");
  await waitFor(READY);
  tracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("desktop (1280px): three columns", tracks.length === 3, "tracks=" + JSON.stringify(tracks));
  value = await evaluate(
    "document.querySelector('#product-list').parentElement.getBoundingClientRect().width > 600"
  );
  check("desktop: products span 2/3 of the width", value === true);

  /* --------------------------- summary --------------------------- */
  console.log("\n" + passCount + " passed, " + failCount + " failed");
  process.exitCode = failCount === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error("Test runner error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      chrome.kill();
      if (process.platform === "win32") {
        spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (_) {
      /* best-effort cleanup */
    }
  });
