// Loads real article pages in a remote browser (CDP, PLAYWRIGHT_DRIVER_URL),
// runs the extension's content script on them with a stubbed chrome API, and
// reports where the block landed, with a screenshot around it. Read-only.
//   npm i playwright-core
//   PLAYWRIGHT_DRIVER_URL=ws://host:3000/ node .github/ci/placement_preview.mjs [slug,slug] [width]
// Not part of CI: it needs a browser and the live sites.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const R = new URL("../../", import.meta.url).pathname;
const report = JSON.parse(readFileSync(R + "tests/fixtures/sites/report.json"));
const files = { sites: readFileSync(R + "sites.json", "utf8"), placements: readFileSync(R + "placements.json", "utf8") };
const sitesJs = readFileSync(R + "444hsz_sites.js", "utf8"), msJs = readFileSync(R + "444hsz_multisite.js", "utf8"), css = readFileSync(R + "444hsz_multisite.css", "utf8");
const browser = await chromium.connectOverCDP(process.env.PLAYWRIGHT_DRIVER_URL);
const slugs = process.argv[2] ? process.argv[2].split(",") : report.filter((e) => e.article?.bytes && e.article.finalUrl === e.article.url && e.slug !== "444").map((e) => e.slug);
const width = Number(process.argv[3] || 1366);
for (const slug of slugs) {
  const e = report.find((r) => r.slug === slug);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "hu-HU" });
  const page = await ctx.newPage();
  await page.addInitScript(({ files }) => {
    window.chrome = { runtime: { getURL: (p) => "https://ext.invalid/" + p } };
    const real = window.fetch.bind(window);
    window.fetch = (u, o) => {
      if (String(u).startsWith("https://ext.invalid/")) {
        const key = String(u).includes("placements") ? "placements" : "sites";
        return Promise.resolve(new Response(files[key], { headers: { "content-type": "application/json" } }));
      }
      return real(u, o);
    };
  }, { files });
  try {
    await page.goto(e.article.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: sitesJs });
    await page.addScriptTag({ content: msJs });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const b = document.getElementById("hsz444-comments");
      if (!b) return { block: false };
      const d = (el) => el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "") : null;
      const r = b.getBoundingClientRect();
      return { block: true, top: Math.round(r.top + scrollY), h: Math.round(r.height), x: Math.round(r.left), w: Math.round(r.width), parent: d(b.parentElement), prev: d(b.previousElementSibling), next: d(b.nextElementSibling), style: b.getAttribute("style") };
    });
    console.log(slug, JSON.stringify(info));
    if (info.block) await page.screenshot({ path: `${process.env.SHOTS_DIR || "."}/${slug}-${width}.png`, fullPage: true, clip: { x: 0, y: Math.max(0, info.top - 420), width, height: 900 } });
  } catch (err) { console.log(slug, "ERR", String(err).slice(0, 100)); }
  await ctx.close();
}
await browser.close();
