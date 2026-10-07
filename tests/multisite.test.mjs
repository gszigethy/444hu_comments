import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";

import { JSDOM } from "../.github/ci/node-tools/node_modules/jsdom/lib/api.js";
import { createChromeStub, fetchSites } from "./helpers/chrome_stub.mjs";

const report = JSON.parse(
  readFileSync("tests/fixtures/sites/report.json", "utf8"),
);
const fixtureUrl = (slug) =>
  report.find((entry) => entry.slug === slug).article.url;
const fixtureHtml = (slug) =>
  readFileSync(`tests/fixtures/sites/${slug}.html`, "utf8");

// Loads the content script into a jsdom page, with the timers captured so a
// test can run retries and the navigation watcher by hand.
async function openPage(t, { html, url, storage = {} }) {
  const dom = new JSDOM(html, { url });
  t.after(() => dom.window.close());
  const { window } = dom;
  for (const [key, value] of Object.entries(storage))
    window.localStorage.setItem(key, value);
  const events = [];
  window.document.addEventListener("444hsz:load", (event) =>
    events.push(JSON.parse(event.detail)),
  );
  const injected = [];
  const head = window.document.head;
  const append = head.appendChild.bind(head);
  head.appendChild = (node) => {
    append(node);
    if (node.tagName === "SCRIPT") {
      injected.push(node.src);
      node.onload();
    }
    return node;
  };
  const timeouts = [];
  const intervals = [];
  const location = new URL(url);
  const context = createContext({
    window,
    document: window.document,
    localStorage: window.localStorage,
    CustomEvent: window.CustomEvent,
    location,
    chrome: createChromeStub().chrome,
    fetch: fetchSites(),
    setTimeout: (callback) => timeouts.push(callback),
    setInterval: (callback) => intervals.push(callback),
    console: { debug() {} },
  });
  for (const file of ["444hsz_sites.js", "444hsz_multisite.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  const settle = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
  };
  await settle();
  return {
    window,
    document: window.document,
    events,
    injected,
    intervals,
    location,
    settle,
    block: () => window.document.getElementById("hsz444-comments"),
    // Runs every queued retry until none is left.
    async drainRetries() {
      while (timeouts.length) timeouts.shift()();
      await settle();
    },
  };
}

const articleSlugs = report
  .filter(
    (entry) =>
      entry.article?.bytes && entry.article.finalUrl === entry.article.url,
  )
  .map((entry) => entry.slug)
  .filter((slug) => slug !== "444");

test("every fixture gets one block, inside the body, with a thread container", async (t) => {
  assert.ok(articleSlugs.length >= 17);
  for (const slug of articleSlugs) {
    const page = await openPage(t, {
      html: fixtureHtml(slug),
      url: fixtureUrl(slug),
    });
    const blocks = page.document.querySelectorAll("#hsz444-comments");
    assert.equal(blocks.length, 1, slug);
    assert.ok(page.document.body.contains(blocks[0]), slug);
    assert.ok(blocks[0].querySelector("#disqus_thread"), slug);
  }
});

test("insertion follows the recon rules", async (t) => {
  // article that holds the h1, before its footer when it has one
  let page = await openPage(t, {
    html: fixtureHtml("qubit"),
    url: fixtureUrl("qubit"),
  });
  assert.ok(page.block().closest("article").querySelector("h1"));
  // main with a footer: just before that footer
  page = await openPage(t, {
    html: fixtureHtml("telex"),
    url: fixtureUrl("telex"),
  });
  assert.equal(page.block().nextElementSibling.tagName, "FOOTER");
  assert.equal(page.block().parentElement.tagName, "MAIN");
  // no article or main: before the page footer
  page = await openPage(t, {
    html: fixtureHtml("raketa"),
    url: fixtureUrl("raketa"),
  });
  assert.equal(page.block().nextElementSibling.tagName, "FOOTER");
  // no landmarks at all: end of the body
  page = await openPage(t, {
    html: fixtureHtml("nepszava"),
    url: fixtureUrl("nepszava"),
  });
  assert.equal(page.block().parentElement.tagName, "BODY");
  assert.equal(page.block().nextElementSibling, null);
});

test("a section page is left alone, even after the retries", async (t) => {
  const html =
    '<!doctype html><meta property="og:type" content="website"><body><main><h1>Főoldal</h1></main></body>';
  const page = await openPage(t, { html, url: "https://telex.hu/" });
  await page.drainRetries();
  assert.equal(page.block(), null);
});

test("late article markup is picked up by the retries", async (t) => {
  const page = await openPage(t, {
    html: "<!doctype html><body><main></main></body>",
    url: "https://telex.hu/belfold/2026/10/07/x",
  });
  assert.equal(page.block(), null);
  const meta = page.document.createElement("meta");
  meta.setAttribute("property", "og:type");
  meta.setAttribute("content", "article");
  page.document.head.append(meta);
  await page.drainRetries();
  assert.ok(page.block());
});

test("RTL's video.other article is recognised through JSON-LD, and bad JSON-LD is skipped", async (t) => {
  const page = await openPage(t, {
    html: fixtureHtml("rtl"),
    url: fixtureUrl("rtl"),
  });
  assert.ok(page.block());
  const broken =
    '<!doctype html><meta property="og:type" content="video.other"><script type="application/ld+json">{not json</script><body><main></main></body>';
  const other = await openPage(t, { html: broken, url: fixtureUrl("rtl") });
  await other.drainRetries();
  assert.equal(other.block(), null);
});

test("a path-matched site (Klubrádió) counts as an article without markup", async (t) => {
  const page = await openPage(t, {
    html: fixtureHtml("klubradio"),
    url: fixtureUrl("klubradio"),
  });
  assert.ok(page.block());
});

test("outside the list, or on an excluded section, nothing happens", async (t) => {
  let page = await openPage(t, {
    html: fixtureHtml("telex"),
    url: "https://example.com/a/b",
  });
  assert.equal(page.block(), null);
  page = await openPage(t, {
    html: fixtureHtml("klubradio"),
    url: "https://www.klubradio.hu/musor",
  });
  assert.equal(page.block(), null);
});

test("the button loads the thread once, with the thread URL and the postfixed title", async (t) => {
  const url = "https://telex.hu/belfold/2026/10/07/x?utm_source=a#komment";
  const html = `<!doctype html><meta property="og:type" content="article"><meta property="og:title" content="Cím"><body><main><h1>x</h1></main></body>`;
  const page = await openPage(t, { html, url });
  assert.equal(page.events.length, 0, "nothing loads before the click");
  page.block().querySelector(".hsz444-show").click();
  page.block().querySelector(".hsz444-show").click();
  await page.settle();
  assert.deepEqual(page.events, [
    {
      shortname: "444hsz",
      url: "https://telex.hu/belfold/2026/10/07/x",
      title: "Cím | Telex",
    },
  ]);
  assert.deepEqual(page.injected, [
    "chrome-extension://test/444hsz_multisite_inject.js",
  ]);
  assert.equal(page.block().querySelector(".hsz444-show").hidden, true);
});

test("the title falls back to the page title, and the accent color comes from the site", async (t) => {
  const html = `<!doctype html><title>Oldalcím</title><meta property="og:type" content="article"><body><main></main></body>`;
  const page = await openPage(t, {
    html,
    url: "https://qubit.hu/2026/10/07/x",
  });
  assert.equal(
    page.block().style.getPropertyValue("--hsz444-accent"),
    "#c27cff",
  );
  page.block().querySelector(".hsz444-show").click();
  await page.settle();
  assert.equal(page.events[0].title, "Oldalcím");
});

test("autoload loads straight away, and the checkbox is remembered", async (t) => {
  const html =
    '<!doctype html><meta property="og:type" content="article"><body><main></main></body>';
  const url = "https://qubit.hu/2026/10/07/x";
  let page = await openPage(t, {
    html,
    url,
    storage: { _444hsz_autoload_comments: "1" },
  });
  await page.settle();
  assert.equal(page.events.length, 1);
  page = await openPage(t, { html, url });
  const box = page.block().querySelector('input[type="checkbox"]');
  assert.equal(box.checked, false);
  box.checked = true;
  box.dispatchEvent(new page.window.Event("change"));
  assert.equal(
    page.window.localStorage.getItem("_444hsz_autoload_comments"),
    "1",
  );
  box.checked = false;
  box.dispatchEvent(new page.window.Event("change"));
  assert.equal(
    page.window.localStorage.getItem("_444hsz_autoload_comments"),
    "0",
  );
});

test("blocked storage does not break the block", async (t) => {
  const html =
    '<!doctype html><meta property="og:type" content="article"><body><main></main></body>';
  const page = await openPage(t, {
    html,
    url: "https://qubit.hu/2026/10/07/x",
  });
  Object.defineProperty(page.window, "localStorage", { value: undefined });
  const box = page.block().querySelector('input[type="checkbox"]');
  box.dispatchEvent(new page.window.Event("change"));
  assert.ok(page.block());
});

test("single-page navigation rebuilds the block for the new article and drops it on a section", async (t) => {
  const html =
    '<!doctype html><meta property="og:type" content="article"><body><main><h1>x</h1></main></body>';
  const page = await openPage(t, {
    html,
    url: "https://www.klubradio.hu/hirek/egy-1",
  });
  assert.ok(page.block());
  const first = page.block();
  const tick = () => page.intervals.forEach((callback) => callback());
  tick();
  assert.equal(page.block(), first, "same address, nothing to do");
  page.location.href = "https://www.klubradio.hu/hirek/masik-2";
  page.location.pathname = "/hirek/masik-2";
  tick();
  await page.drainRetries();
  assert.ok(page.block());
  assert.notEqual(page.block(), first);
  page.location.href = "https://www.klubradio.hu/musor";
  page.location.pathname = "/musor";
  tick();
  await page.drainRetries();
  assert.equal(page.block(), null);
});

test("a failing site list fetch is logged, not left unhandled", async () => {
  const logged = [];
  const context = createContext({
    chrome: createChromeStub().chrome,
    fetch: async () => {
      throw new Error("offline");
    },
    location: new URL("https://telex.hu/a/b"),
    console: { debug: (...args) => logged.push(args) },
  });
  for (const file of ["444hsz_sites.js", "444hsz_multisite.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  for (let i = 0; i < 50; i++) await Promise.resolve();
  assert.equal(logged.length, 1);
});
