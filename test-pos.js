/**
 * test-pos.js — headless verification of the AGENTS.md testing checklist.
 *
 * Launches Chrome headless, opens index.html, and drives the REAL UI
 * (clicking the same buttons the cashier would click) over the Chrome
 * DevTools Protocol. No dependencies — uses Node's built-in fetch/WebSocket.
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

/** Click an element by selector on the page (real UI event path). */
function click(selector) {
  return evaluate(
    '(() => { const el = document.querySelector(' +
      JSON.stringify(selector) +
      '); if (!el) return "missing"; el.click(); return "ok"; })()'
  );
}

/** Click the first product button (0-indexed, matches PRODUCTS order). */
function clickProduct(i) {
  return evaluate(
    "(() => { const b = document.querySelectorAll('#product-list > button')[" +
      i +
      ']; if (!b) return "missing"; b.click(); return "ok"; })()'
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

/* --------------------------- assertions -------------------------- */

let passCount = 0;
let failCount = 0;

function check(name, ok, detail) {
  if (ok) {
    passCount++;
    console.log("PASS  " + name);
  } else {
    failCount++;
    console.log("FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

/* ------------------------------ tests ---------------------------- */

async function main() {
  // Wait for the DevTools endpoint, open a tab on our file, attach WebSocket.
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

  await waitFor("document.readyState === 'complete' && document.querySelectorAll('#product-list > button').length >= 5");

  /* --- 1. Products render with names and prices --- */
  const productCount = await evaluate(
    "document.querySelectorAll('#product-list > button').length"
  );
  check("at least 5 products displayed", productCount >= 5, "got " + productCount);

  const productText = await evaluate(
    "Array.from(document.querySelectorAll('#product-list > button')).map(b => b.textContent)"
  );
  check(
    "products show prices in peso format",
    productText.some((t) => t.includes("Classic Milk Tea") && t.includes("₱59.00")) &&
      productText.some((t) => t.includes("Bottled Water") && t.includes("₱20.00")),
    JSON.stringify(productText)
  );

  /* --- 2. Empty cart: payment blocked --- */
  const initialDisabled = await evaluate("document.getElementById('pay-btn').disabled");
  check("payment disabled when cart is empty", initialDisabled === true);

  /* --- 3. Add to cart; repeated adds increase quantity --- */
  await clickProduct(0); // Classic Milk Tea
  await clickProduct(0); // again → qty should be 2
  let rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  let qty = await evaluate(
    "document.querySelector('#cart-list > div .w-6').textContent"
  );
  let total = await evaluate("document.getElementById('cart-total').textContent");
  check("repeated add increases quantity (stays 1 row)", rows === 1, "rows=" + rows);
  check("quantity is 2 after double add", qty === "2", "qty=" + qty);
  check("total = 2 × ₱59.00 = ₱118.00", total === "₱118.00", "total=" + total);

  /* --- 4. + / − buttons --- */
  await clickProduct(5); // Bottled Water ₱20
  const plusSecond =
    "(() => { const r = document.querySelectorAll('#cart-list > div')[1];" +
    "const b = r.querySelector('[title=\"Increase quantity\"]'); b.click(); return b; })()";
  await evaluate(plusSecond);
  qty = await evaluate(
    "document.querySelectorAll('#cart-list > div')[1].querySelector('.w-6').textContent"
  );
  check("+ button increases quantity", qty === "2", "qty=" + qty);

  const minusSecond =
    "(() => { const r = document.querySelectorAll('#cart-list > div')[1];" +
    "const b = r.querySelector('[title=\"Decrease quantity (min 1)\"]'); b.click(); return b; })()";
  await evaluate(minusSecond);
  qty = await evaluate(
    "document.querySelectorAll('#cart-list > div')[1].querySelector('.w-6').textContent"
  );
  check("− button decreases quantity", qty === "1", "qty=" + qty);

  // Clamp at 1 per spec choice: − on a qty-1 item must NOT remove it.
  await evaluate(minusSecond);
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  qty = await evaluate(
    "document.querySelectorAll('#cart-list > div')[1].querySelector('.w-6').textContent"
  );
  check("quantity clamps at 1 (item not removed by −)", rows === 2 && qty === "1", "rows=" + rows + " qty=" + qty);

  /* --- 5. Totals recompute automatically --- */
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("total updates to ₱138.00 (118+20)", total === "₱138.00", "total=" + total);

  /* --- 6. Remove item --- */
  const removeSecond =
    "(() => { const r = document.querySelectorAll('#cart-list > div')[1];" +
    "const b = Array.from(r.querySelectorAll('button')).find(x => x.textContent === 'Remove');" +
    "b.click(); return b; })()";
  await evaluate(removeSecond);
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("remove drops the row and updates total", rows === 1 && total === "₱118.00", "rows=" + rows + " total=" + total);

  /* --- 7. Payment validation: each invalid case shows its own message --- */
  const payClick = "document.getElementById('pay-btn').click(); 'ok'";
  const errText = "document.getElementById('payment-error').textContent";
  const errShown = "document.getElementById('payment-error').classList.contains('hidden') === false";

  await evaluate("document.getElementById('cash-input').value = ''");
  await evaluate(payClick);
  let err = await evaluate(errText);
  let shown = await evaluate(errShown);
  check("blank payment rejected with clear message", shown && /cash amount/i.test(err), err);

  await evaluate("document.getElementById('cash-input').value = 'abc'");
  await evaluate(payClick);
  err = await evaluate(errText);
  check("non-numeric payment rejected", shown && /not a number/i.test(err), err);

  await evaluate("document.getElementById('cash-input').value = '-5'");
  await evaluate(payClick);
  err = await evaluate(errText);
  check("negative payment rejected", shown && /negative/i.test(err), err);

  await evaluate("document.getElementById('cash-input').value = '50'");
  await evaluate(payClick);
  err = await evaluate(errText);
  shown = await evaluate(errShown);
  check(
    "insufficient payment rejected with total guide",
    shown && /insufficient/i.test(err) && /₱118\.00/.test(err),
    err
  );

  /* --- 8. Exact payment: success + ₱0.00 change + receipt --- */
  await evaluate("document.getElementById('cash-input').value = '118'");
  await evaluate(payClick);
  const success = await evaluate(
    "document.getElementById('payment-success').textContent"
  );
  check(
    "exact payment succeeds with ₱0.00 change",
    /payment successful/i.test(success) && /₱0\.00/.test(success),
    success
  );

  const receipt = await evaluate(
    "document.getElementById('receipt-content').textContent"
  );
  check(
    "receipt shows txn ref, item, qty, total, paid, change",
    /TXN-0001/.test(receipt) &&
      /Classic Milk Tea/.test(receipt) &&
      /2/.test(receipt) &&
      /₱118\.00/.test(receipt) &&
      /₱0\.00/.test(receipt),
    receipt.split("\n").join(" | ")
  );
  const receiptVisible = await evaluate(
    "document.getElementById('receipt-section').classList.contains('hidden') === false"
  );
  check("receipt panel is visible after payment", receiptVisible);

  /* --- 9. New transaction resets everything --- */
  await click("#new-txn-btn");
  rows = await evaluate("document.querySelectorAll('#cart-list > div').length");
  const cashVal = await evaluate("document.getElementById('cash-input').value");
  const receiptHidden = await evaluate(
    "document.getElementById('receipt-section').classList.contains('hidden')"
  );
  const label = await evaluate("document.getElementById('txn-label').textContent");
  check("new transaction empties cart", rows === 0, "rows=" + rows);
  check("new transaction clears cash input", cashVal === "");
  check("new transaction hides receipt", receiptHidden === true);
  check("transaction number advances to TXN-0002", /TXN-0002/.test(label), label);
  const disabledAgain = await evaluate("document.getElementById('pay-btn').disabled");
  check("payment disabled again on empty cart", disabledAgain === true);

  /* --- 10. Overpayment gives correct change (new txn, Enter key submits) --- */
  await clickProduct(2); // Taro ₱65
  await clickProduct(4); // Brown Sugar ₱69 → total ₱134
  total = await evaluate("document.getElementById('cart-total').textContent");
  check("second cart total = ₱134.00", total === "₱134.00", "total=" + total);

  await evaluate(
    "const i = document.getElementById('cash-input'); i.value = '150';" +
      "i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); 'ok'"
  );
  const overpayChange = await evaluate(
    "document.getElementById('payment-success').textContent"
  );
  check(
    "overpayment via Enter key gives ₱16.00 change",
    /₱16\.00/.test(overpayChange),
    overpayChange
  );
  const overpayReceipt = await evaluate(
    "document.getElementById('receipt-content').textContent"
  );
  check(
    "overpayment receipt reference is TXN-0002",
    /Ref: TXN-0002/.test(overpayReceipt) && /₱16\.00/.test(overpayReceipt),
    overpayReceipt.split("\n").join(" | ")
  );

  /* --- 11. Mobile-first responsive smoke test --- *
   * Resize the page through CDP and assert the CSS grid tracks:
   *   390px (phone)  → 1 column
   *   800px (tablet) → 2 columns (products span 2 rows in the left column)
   *   1280px (desktop) → 3 columns
   * Also confirm the enlargened touch targets h-11 (44px) apply on mobile.
   */
  await send("Page.enable");
  const gridTracks = "getComputedStyle(document.querySelector('main')).gridTemplateColumns";

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await send("Page.reload");
  await waitFor("document.readyState === 'complete' && document.querySelectorAll('#product-list > button').length >= 5");
  const mobileTracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("phone (390px): single-column stack", mobileTracks.length === 1, "tracks=" + JSON.stringify(mobileTracks));
  const payHeight = await evaluate(
    "getComputedStyle(document.getElementById('pay-btn')).height"
  );
  check("phone: Pay button meets 44px touch target", payHeight === "44px", "height=" + payHeight);
  await clickProduct(0); // add an item so qty buttons exist in the cart row
  const plusSize = await evaluate(
    "const b = document.querySelector('button[title=\"Increase quantity\"]');" +
      "getComputedStyle(b).width"
  );
  check("phone: +/− buttons enlarged to 40px", plusSize === "40px", "size=" + plusSize);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 800, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.reload");
  await waitFor("document.readyState === 'complete' && document.querySelectorAll('#product-list > button').length >= 5");
  await clickProduct(0); // add an item; qty buttons should be compact at tablet+ widths
  const tabletTracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("tablet (800px): two columns", tabletTracks.length === 2, "tracks=" + JSON.stringify(tabletTracks));
  const compactPlus = await evaluate(
    "const b = document.querySelector('button[title=\"Increase quantity\"]');" +
      "getComputedStyle(b).width"
  );
  check("tablet: qty buttons back to compact 28px", compactPlus === "28px", "size=" + compactPlus);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.reload");
  await waitFor("document.readyState === 'complete' && document.querySelectorAll('#product-list > button').length >= 5");
  const desktopTracks = (await evaluate(gridTracks)).trim().split(/\s+/);
  check("desktop (1280px): three columns", desktopTracks.length === 3, "tracks=" + JSON.stringify(desktopTracks));

  // Restore the default desktop viewport and start a clean state.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  });

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
