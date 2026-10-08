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
async function openPage(
  t,
  {
    html,
    url,
    storage = {},
    placements = {},
    rects = {},
    resizeObserver = false,
  },
) {
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
  const observers = [];
  // jsdom has no layout: tests give elements fake rectangles by selector.
  for (const [selector, rect] of Object.entries(rects)) {
    window.document.querySelectorAll(selector).forEach((node) => {
      node.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 0,
        ...rect,
      });
    });
  }
  const location = new URL(url);
  const context = createContext({
    window,
    document: window.document,
    localStorage: window.localStorage,
    CustomEvent: window.CustomEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    MutationObserver: window.MutationObserver,
    location,
    chrome: createChromeStub().chrome,
    fetch: fetchSites(placements),
    ResizeObserver: resizeObserver
      ? class {
          constructor(callback) {
            observers.push(callback);
          }
          observe() {}
        }
      : undefined,
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
    observers,
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

const nuxtLike =
  '<!doctype html><meta property="og:type" content="article"><body><main><div class="sub-container"><h1>x</h1></div></main></body>';

test("a block thrown away by the page's renderer is put back, then moved to a safe spot", async (t) => {
  const page = await openPage(t, {
    html: nuxtLike,
    url: "https://telex.hu/gazdasag/2026/10/07/x",
  });
  assert.equal(page.block().parentElement.tagName, "MAIN");
  page.block().remove();
  await page.settle();
  await page.drainRetries();
  assert.ok(page.block(), "restored after the first removal");
  assert.equal(page.block().parentElement.tagName, "MAIN");
  page.block().remove();
  await page.settle();
  await page.drainRetries();
  assert.equal(
    page.block().parentElement.tagName,
    "BODY",
    "second removal moves it out of the app",
  );
});

test("a block that was loading is restored loading, not as a dead button", async (t) => {
  const page = await openPage(t, {
    html: nuxtLike,
    url: "https://telex.hu/gazdasag/2026/10/07/x",
  });
  page.block().querySelector(".hsz444-show").click();
  await page.settle();
  assert.equal(page.events.length, 1);
  page.block().remove();
  await page.settle();
  await page.drainRetries();
  assert.equal(
    page.events.length,
    2,
    "Disqus is asked to load again for the new container",
  );
});

test("a page that keeps removing the block cannot make us loop", async (t) => {
  const page = await openPage(t, {
    html: nuxtLike,
    url: "https://telex.hu/gazdasag/2026/10/07/x",
  });
  for (let i = 0; i < 15; i++) {
    page.block()?.remove();
    await page.settle();
    await page.drainRetries();
  }
  assert.equal(page.block(), null, "gave up after the limit");
});

test("navigation to a section while the block is gone does not bring it back", async (t) => {
  const page = await openPage(t, {
    html: nuxtLike,
    url: "https://www.klubradio.hu/hirek/egy-1",
  });
  page.location.href = "https://www.klubradio.hu/musor";
  page.location.pathname = "/musor";
  page.intervals.forEach((callback) => callback());
  await page.settle();
  await page.drainRetries();
  assert.equal(page.block(), null);
});

// --- per-site placement rules ---

const articlePage = (body) =>
  `<!doctype html><meta property="og:type" content="article"><body>${body}</body>`;
const column =
  '<main><div class="wrap"><div class="text">Szöveg</div><ul class="tags"><li>címke</li></ul></div></main>';
const telexUrl = "https://telex.hu/belfold/2026/10/07/x";

test("'after' puts the block right behind the text, ahead of the tags", async (t) => {
  const page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { after: [".text"] } },
  });
  assert.equal(page.block().previousElementSibling.className, "text");
  assert.equal(page.block().nextElementSibling.className, "tags");
});

test("'before' and 'append' place the block as asked", async (t) => {
  let page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { before: [".tags"] } },
  });
  assert.equal(page.block().nextElementSibling.className, "tags");
  page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { append: [".text"] } },
  });
  assert.equal(page.block().parentElement.className, "text");
  assert.equal(page.block().nextElementSibling, null);
});

test("the first selector that matches wins; hidden matches and bad selectors are skipped", async (t) => {
  const html = articlePage(
    '<main><div class="text" style="display:none">x</div><div class="text">y</div><div class="other">z</div></main>',
  );
  const placements = {
    telex: { after: ["div[", ".missing", ".text", ".other"] },
  };
  const page = await openPage(t, { html, url: telexUrl, placements });
  const visibleText = page.document.querySelectorAll(".text")[1];
  assert.equal(page.block().previousElementSibling, visibleText);
});

test("no rule for the site, or a rule that matches nothing, falls back to the generic placement", async (t) => {
  let page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { qubit: { after: [".text"] } },
  });
  assert.equal(
    page.block().parentElement.tagName,
    "MAIN",
    "generic: end of main",
  );
  page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { after: [".gone"] } },
  });
  assert.equal(page.block().parentElement.tagName, "MAIN");
});

test("a missing placements.json only loses the tuning", async (t) => {
  const page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: null,
  });
  assert.ok(page.block());
});

test("the block takes the width and left edge of the text column it follows", async (t) => {
  const page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { after: [".text"] } },
    rects: {
      ".text": { left: 283, width: 800 },
      ".wrap": { left: 0, width: 1366 },
    },
  });
  assert.equal(page.block().style.width, "800px");
  assert.equal(page.block().style.maxWidth, "100%");
  assert.equal(page.block().style.marginLeft, "283px");
});

test("'like' measures another element, and a column that already lines up is left alone", async (t) => {
  let page = await openPage(t, {
    html: articlePage(
      '<main><div class="wide"><p class="p">x</p></div></main>',
    ),
    url: telexUrl,
    placements: { telex: { after: [".wide"], like: ".p" } },
    rects: {
      ".p": { left: 100, width: 600 },
      ".wide": { left: 0, width: 1366 },
      main: { left: 0, width: 1366 },
    },
  });
  assert.equal(page.block().style.width, "600px");
  assert.equal(page.block().style.marginLeft, "100px");
  page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { after: [".text"] } },
    rects: { ".text": { left: 0, width: 0 } },
  });
  assert.equal(
    page.block().style.width,
    "",
    "an unmeasured reference changes nothing",
  );
});

test("the geometry is measured again when the reference resizes", async (t) => {
  const page = await openPage(t, {
    html: articlePage(column),
    url: telexUrl,
    placements: { telex: { after: [".text"] } },
    rects: { ".text": { left: 0, width: 0 } },
    resizeObserver: true,
  });
  assert.equal(page.block().style.width, "");
  page.document.querySelector(".text").getBoundingClientRect = () => ({
    left: 40,
    width: 500,
  });
  page.observers.forEach((callback) => callback());
  assert.equal(page.block().style.width, "500px");
  assert.equal(page.block().style.marginLeft, "40px");
});

// --- the shipped placements.json ---

const shipped = JSON.parse(readFileSync("placements.json", "utf8"));

test("every placement belongs to a supported site and has valid selectors", () => {
  const sites = JSON.parse(readFileSync("sites.json", "utf8")).sites;
  const supported = sites
    .filter((site) => !site.noSubmit)
    .map((site) => site.slug);
  const dom = new JSDOM("<body></body>");
  for (const [slug, rule] of Object.entries(shipped)) {
    assert.ok(
      supported.includes(slug) && slug !== "444",
      `${slug} is not a site this frontend serves`,
    );
    const kinds = Object.keys(rule).filter((key) => key !== "like");
    assert.ok(
      kinds.length &&
        kinds.every((key) => ["after", "before", "append"].includes(key)),
      slug,
    );
    for (const selector of [
      ...kinds.flatMap((key) => [].concat(rule[key])),
      rule.like,
    ].filter(Boolean)) {
      assert.doesNotThrow(
        () => dom.window.document.querySelector(selector),
        `${slug}: ${selector}`,
      );
    }
  }
  dom.window.close();
});

test("the placement file is web accessible", () => {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  assert.ok(
    manifest.web_accessible_resources[0].resources.includes("placements.json"),
  );
});
