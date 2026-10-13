/**
 * fetch-images.js — grabs free-license drink photos from Wikimedia Commons.
 *
 * For each product it runs a Commons API search, picks the best JPEG match
 * (plain photo, reasonably large), downloads an 800px-wide thumbnail into
 * assets/images/ under the SAME filename the app already references, and
 * prints attribution (author + license) so credits can go in the README.
 *
 * If no suitable JPEG is found for a drink, the existing image is left
 * untouched and a warning is printed.
 *
 * Run:  node fetch-images.js
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.resolve(__dirname, "assets", "images");
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA =
  "MilkTeaPOS-demo/1.0 (educational POS project; contact: project maintainer)";

// One or more fallback search terms per product file.
const DRINKS = [
  { file: "classic-milk-tea.jpg", terms: ["classic bubble tea", "milk tea tapioca pearls", "bubble tea cup"] },
  { file: "wintermelon-milk-tea.jpg", terms: ["wintermelon milk tea", "winter melon tea", "green milk tea"] },
  { file: "taro-milk-tea.jpg", terms: ["taro milk tea", "taro bubble tea", "purple bubble tea"] },
  // Pinned: search picks were cluttered; these exact files are clean shots.
  { file: "lychee-fruit-tea.jpg", pinnedTitle: "File:Lychee with basil seame cold drink from thailand.jpg",
    terms: ["lychee juice glass", "lychee drink", "lychee juice"] },
  { file: "brown-sugar-milk-tea.jpg", terms: ["brown sugar boba", "brown sugar bubble tea"] },
  { file: "bottled-water.jpg", pinnedTitle: "File:PET Bottle Water.jpg",
    terms: ["plastic water bottle drinking water", "water bottle plastic", "bottled water"] },
];

const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;

/** Fetch image info for one exact Commons file title (pinned pick). */
async function commonsFile(title) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      titles: title,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "800",
    }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("Commons API HTTP " + res.status + " for: " + title);
  const json = await res.json();
  const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const page = pages[0];
  const info = page && page.imageinfo && page.imageinfo[0];
  if (!page || page.missing || !info || info.mime !== "image/jpeg") {
    throw new Error("Pinned file unavailable: " + title);
  }
  const meta = info.extmetadata || {};
  return {
    title: page.title,
    thumb: info.thumburl,
    width: info.width,
    height: info.height,
    artist: (meta.Artist && meta.Artist.value ? meta.Artist.value : "").replace(/<[^>]*>/g, "").trim(),
    license: (meta.LicenseShortName && meta.LicenseShortName.value) || "see source page",
    descriptionUrl: info.descriptionurl,
  };
}

async function commonsSearch(term) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: "filetype:bitmap " + term,
      gsrnamespace: "6",
      gsrlimit: "20",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "800",
    }).toString();

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("Commons API HTTP " + res.status + " for: " + term);
  const json = await res.json();

  const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const candidates = [];
  for (const page of pages) {
    const info = page.imageinfo && page.imageinfo[0];
    if (!info) continue;
    if (info.mime !== "image/jpeg") continue; // keep it simple: JPEG only
    if ((info.width || 0) < MIN_WIDTH || (info.height || 0) < MIN_HEIGHT) continue;
    const meta = info.extmetadata || {};
    candidates.push({
      title: page.title,
      thumb: info.thumburl,
      width: info.width,
      height: info.height,
      artist: (meta.Artist && meta.Artist.value ? meta.Artist.value : "").replace(/<[^>]*>/g, "").trim(),
      license: (meta.LicenseShortName && meta.LicenseShortName.value) || "see source page",
      descriptionUrl: info.descriptionurl,
    });
  }
  return candidates;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("Download HTTP " + res.status + " from " + url);
  const buf = Buffer.from(await res.arrayBuffer());
  // Must be a real JPEG (file starts with FFD8) — not an HTML error page.
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) {
    throw new Error("Downloaded file is not a JPEG: " + url);
  }
  if (buf.length < 20000) {
    throw new Error("Suspiciously small image (" + buf.length + " bytes): " + url);
  }
  fs.writeFileSync(dest, buf);
}

async function main() {
  const credits = [];

  for (const drink of DRINKS) {
    const dest = path.join(OUT_DIR, drink.file);
    let done = false;

    if (drink.pinnedTitle) {
      try {
        const c = await commonsFile(drink.pinnedTitle);
        await download(c.thumb, dest);
        console.log("wrote assets/images/" + drink.file + "  <- " + c.title + " (" + c.width + "x" + c.height + ", " + c.license + ") [pinned]");
        credits.push("- `" + drink.file + "` — " + c.title + " by " + (c.artist || "unknown") + ", " + c.license + ". Source: " + c.descriptionUrl);
        continue;
      } catch (e) {
        console.warn("  pinned fetch failed for " + drink.file + ", falling back to search: " + e.message);
      }
    }

    for (const term of drink.terms) {
      let candidates = [];
      try {
        candidates = await commonsSearch(term);
      } catch (e) {
        console.warn("  search failed for '" + term + "': " + e.message);
        continue;
      }
      // Prefer larger images; iterate until one downloads cleanly.
      candidates.sort((a, b) => b.width * b.height - a.width * a.height);
      for (const c of candidates) {
        try {
          await download(c.thumb, dest);
          console.log(
            "wrote assets/images/" + drink.file +
              "  <- " + c.title + " (" + c.width + "x" + c.height + ", " + c.license + ")"
          );
          credits.push("- `" + drink.file + "` — " + c.title + " by " +
            (c.artist || "unknown") + ", " + c.license +
            ". Source: " + c.descriptionUrl);
          done = true;
          break;
        } catch (e) {
          console.warn("  skip " + c.title + ": " + e.message);
          continue;
        }
      }
      if (done) break;
      await new Promise((r) => setTimeout(r, 400)); // be polite to the API
    }

    if (!done) {
      console.warn("NO MATCH for " + drink.file + " — keeping the existing image.");
      credits.push("- `" + drink.file + "` — (no Commons match found; kept rendered placeholder)");
    }
  }

  console.log("\nAttribution for the README:\n");
  console.log(credits.join("\n"));
}

main().catch((e) => {
  console.error("fetch-images error:", e.message);
  process.exit(1);
});
