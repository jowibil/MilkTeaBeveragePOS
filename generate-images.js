/**
 * generate-images.js — renders photo-style product images for the POS.
 *
 * Renders each drink (realistic CSS/SVG-rendered cup: gradient liquids, ice,
 * pearls, lids, straws, labels, shadows) in headless Chrome at 600×600 and
 * captures it as a JPEG into assets/images/ using Page.captureScreenshot.
 * No dependencies.
 *
 * Run:  node generate-images.js
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
  console.error("Chrome not found; cannot generate images.");
  process.exit(2);
}

const PORT = 9700 + Math.floor(Math.random() * 200);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-imggen-"));
const OUT_DIR = path.resolve(__dirname, "assets", "images");
fs.mkdirSync(OUT_DIR, { recursive: true });

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
  { stdio: ["ignore", "pipe", "pipe"] }
);

/* ---------------------- product render recipes ---------------------- */

/** studded beads cluster */
function pearls(count) {
  let html = "";
  for (let k = 0; k < count; k++) {
    const x = 5 + ((k * 23) % 86);
    const y = 70 + ((k * 13) % 24);
    const d = 15 + (k % 3) * 3;
    html +=
      `<span style="position:absolute;left:${x}%;top:${y}%;width:${d}px;height:${d}px;` +
      `background:radial-gradient(circle at 35% 30%, #8a5a44, #332018);border-radius:50%;` +
      `box-shadow:0 1px 2px rgba(0,0,0,.35);"></span>`;
  }
  return html;
}

function ice(count) {
  let html = "";
  for (let k = 0; k < count; k++) {
    const x = 8 + ((k * 31) % 62);
    const y = 6 + ((k * 19) % 40);
    const s = 24 + ((k * 13) % 16);
    html +=
      `<div style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;` +
      `background:rgba(255,255,255,.32);border:1px solid rgba(255,255,255,.6);` +
      `border-radius:7px;transform:rotate(${((k * 29) % 44) - 22}deg);"></div>`;
  }
  return html;
}

function fruitBits(count) {
  let html = "";
  for (let k = 0; k < count; k++) {
    const x = 10 + ((k * 27) % 70);
    const y = 24 + ((k * 17) % 46);
    const d = 12 + (k % 2) * 6;
    html +=
      `<span style="position:absolute;left:${x}%;top:${y}%;width:${d}px;height:${d}px;` +
      `background:radial-gradient(circle at 40% 32%, #e2556e, #a92946);border-radius:38%;` +
      `box-shadow:0 1px 2px rgba(0,0,0,.25);"></span>`;
  }
  return html;
}

/** A boba dome-lid cup. */
function cup(opts) {
  return `
  <div style="position:relative;width:250px;height:430px;filter:drop-shadow(0 16px 16px rgba(0,0,0,.20));">
    <!-- straw -->
    ${opts.straw === false ? "" :
      `<div style="position:absolute;top:-48px;left:62%;width:15px;height:150px;border-radius:8px;
        background:linear-gradient(90deg, ${opts.strawColor || "#d3566a"}, ${opts.strawColor2 || "#b83e52"});
        transform:rotate(7deg);"></div>`}
    <!-- dome lid -->
    <div style="position:absolute;top:16px;left:10px;width:230px;height:34px;border-radius:16px 16px 3px 3px;
      background:linear-gradient(180deg,#fdf9f2,#ded4c6);box-shadow:inset 0 -3px 4px rgba(0,0,0,.15);"></div>
    <!-- cup body (tapered) -->
    <div style="position:absolute;left:4px;top:46px;width:242px;height:368px;
      clip-path:polygon(0 0,100% 0,86% 100%,14% 100%);overflow:hidden;background:${opts.liquid};">
      ${ice(opts.iceCount || 0)}${pearls(opts.pearlCount || 0)}${fruitBits(opts.bitCount || 0)}
      <!-- glass highlight -->
      <div style="position:absolute;left:6%;top:0;bottom:0;width:24px;opacity:.5;
        background:linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.06));border-radius:10px;"></div>
    </div>
    <!-- label sticker -->
    <div style="position:absolute;left:38px;top:190px;width:174px;height:74px;border-radius:8px;
      background:rgba(255,253,247,.94);box-shadow:0 2px 5px rgba(0,0,0,.18);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
      <div style="font:700 17px Arial, sans-serif;color:#5b4232;letter-spacing:1px;">MILK TEA POS</div>
      <div style="font:600 13px Arial, sans-serif;color:#8a6a4e;">${opts.label}</div>
    </div>
  </div>`;
}

/** A PET water bottle (cap, neck, ridged body, label band). */
function bottle() {
  return `
  <div style="position:relative;width:230px;height:450px;filter:drop-shadow(0 16px 16px rgba(0,0,0,.20));">
    <!-- cap -->
    <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:56px;height:34px;border-radius:6px;
      background:linear-gradient(180deg,#3f79d4,#2c56a0);box-shadow:inset 0 -4px 5px rgba(0,0,0,.22);"></div>
    <!-- neck ring -->
    <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:70px;height:12px;border-radius:5px;
      background:rgba(255,255,255,.55);"></div>
    <!-- shoulder + body -->
    <div style="position:absolute;left:14px;top:40px;width:202px;height:394px;
      clip-path:polygon(28% 0,72% 0,92% 12%,92% 100%,8% 100%,8% 12%);overflow:hidden;
      background:linear-gradient(180deg,#dff0fa 6%,#cfe9f7 40%,#a9d3ec 100%);">
      <!-- ridge lines -->
      <div style="position:absolute;inset:0;opacity:.6;background:repeating-linear-gradient(180deg,
        transparent 0 20px, rgba(255,255,255,.5) 20px 26px);"></div>
      <!-- highlight -->
      <div style="position:absolute;left:10px;top:0;bottom:0;width:26px;opacity:.65;border-radius:12px;
        background:linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.08));"></div>
      <!-- label band -->
      <div style="position:absolute;left:2%;right:2%;top:44%;height:64px;border-left:9px solid #2e63b1;border-right:9px solid #2e63b1;
        background:rgba(255,255,255,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
        <div style="font:800 18px Arial, sans-serif;color:#2c56a0;">AQUA</div>
        <div style="font:600 12px Arial, sans-serif;color:#5b7f9a;">Bottled Water · 600 mL</div>
      </div>
    </div>
  </div>`;
}

const RECIPES = [
  { file: "classic-milk-tea.jpg", bg: "radial-gradient(circle at 50% 28%, #fdf6ec, #e8d5b5)", html: cup({
      liquid: "linear-gradient(180deg,#dfc39c 0%,#c8a165 34%,rgba(200,161,101,.0) 34%,#c8a165 35%,#a97b4f 100%)",
      pearlCount: 13, iceCount: 1, label: "Classic Milk Tea" }) },
  { file: "wintermelon-milk-tea.jpg", bg: "radial-gradient(circle at 50% 28%, #f4fae9, #d8e8c4)", html: cup({
      liquid: "linear-gradient(180deg,#e9f2c8 0%,#cfe0a6 40%,rgba(207,224,166,0) 40%,#cfe0a6 41%,#a8c176 100%)",
      pearlCount: 12, iceCount: 3, strawColor: "#68a15f", strawColor2: "#54854d", label: "Wintermelon Milk Tea" }) },
  { file: "taro-milk-tea.jpg", bg: "radial-gradient(circle at 50% 28%, #f7f0fb, #e2d0ea)", html: cup({
      liquid: "linear-gradient(180deg,#dccbea 0%,#b795d0 40%,rgba(183,149,208,0) 40%,#b795d0 41%,#8f68ad 100%)",
      pearlCount: 12, iceCount: 1, strawColor: "#9b6cc6", strawColor2: "#7f55a8", label: "Taro Milk Tea" }) },
  { file: "lychee-fruit-tea.jpg", bg: "radial-gradient(circle at 50% 28%, #fdf0f3, #f6d7de)", html: cup({
      liquid: "linear-gradient(180deg,#f3c6cd 0%,#eda2ae 46%,rgba(237,162,174,0) 46%,#eda2ae 47%,#d7727f 100%)",
      bitCount: 7, iceCount: 4, pearls: 0, straw: false, label: "Fruit Tea — Lychee" }) },
  { file: "brown-sugar-milk-tea.jpg", bg: "radial-gradient(circle at 50% 28%, #f7efe2, #e3d0b8)", html: cup({
      liquid:
        "repeating-linear-gradient(172deg, rgba(122,74,32,.85) 0 16px, rgba(246,236,222,.95) 16px 30px)," +
        "linear-gradient(180deg,#efe1cb,#dcc7a9)",
      backgroundBlendMode: "overlay, normal",
      pearlCount: 14, iceCount: 0, strawColor: "#8a5a3a", strawColor2: "#6e4630", label: "Brown Sugar Milk Tea" }) },
  { file: "bottled-water.jpg", bg: "radial-gradient(circle at 50% 28%, #f0f8fd, #d2e7f4)", html: bottle() },
];

/* --------------------------- CDP plumbing --------------------------- */

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- main ------------------------------- */

async function main() {
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin:0; }
    .stage { width:600px; height:600px; display:flex; align-items:center; justify-content:center; }
  </style></head><body>
    <div class="stage" id="stage"></div>
    <script>
      window.renderProduct = function (i) {
        const r = RECIPES[i];
        const stage = document.getElementById("stage");
        stage.style.background = r.bg;
        stage.innerHTML = r.html;
        document.title = r.file;
      };
    <\/script>
  </body></html>`;

  // Write the generator page to a temp file and open it via file:// —
  // /json/new with a very long data: URL is unreliable across Chrome builds.
  const recipesSource = "const RECIPES = " + JSON.stringify(RECIPES) + ";";
  const pageHtml = page.replace(
    "window.renderProduct = function (i) {",
    recipesSource + "\nwindow.renderProduct = function (i) {"
  );
  const pagePath = path.join(dataDir, "imggen.html");
  fs.writeFileSync(pagePath, pageHtml);
  const pageUrl = "file://" + pagePath.replace(/\\/g, "/");

  const chromeErrChunks = [];
  chrome.stderr && chrome.stderr.on("data", (d) => chromeErrChunks.push(String(d)));
  chrome.on("error", (e) => console.error("chrome spawn error:", e.message));
  let up = false;
  let lastProbeErr = null;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      if (r.ok) { up = true; break; }
    } catch (e) {
      lastProbeErr = e.message;
    }
    await sleep(250);
  }
  if (!up) {
    throw new Error(
      "CDP never came up on port " + PORT +
        "; last probe error: " + lastProbeErr +
        "; chrome stderr: " + chromeErrChunks.join("").slice(0, 800)
    );
  }
  const tab = await fetch(
    "http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(pageUrl),
    { method: "PUT" }
  ).then((r) => r.json());

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
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 600, height: 600, deviceScaleFactor: 1, mobile: false,
  });

  for (let i = 0; i < RECIPES.length; i++) {
    const recipe = RECIPES[i];
    await evaluate("renderProduct(" + i + ")");
    await sleep(300); // let gradients/filter paint settle
    const shot = await send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
      clip: { x: 0, y: 0, width: 600, height: 600, scale: 1 },
    });
    if (!shot || !shot.data) throw new Error("Empty screenshot for " + recipe.file);
    fs.writeFileSync(
      path.join(OUT_DIR, recipe.file),
      Buffer.from(shot.data, "base64")
    );
    console.log("wrote assets/images/" + recipe.file);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Image generation error:", e.message);
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
