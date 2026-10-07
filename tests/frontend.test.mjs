import assert from "node:assert/strict";
import test from "node:test";
import { domHarness } from "./helpers/dom_harness.mjs";
const modern = "444hu_comments_inject.js";
async function ready(t, options) {
  const h = domHarness(t, options);
  await h.load(modern);
  await h.tick(1000);
  return h;
}

test("router registers one observer and inserts one comments section", async (t) => {
  const h = await ready(t);
  assert.equal(h.observers.length, 1);
  assert.equal(h.document.querySelectorAll("#comments_wrapper").length, 1);
  assert.equal(h.document.querySelectorAll(".comments-toggle-top").length, 1);
  assert.equal(
    h.document
      .querySelector("#comments_wrapper")
      .classList.contains("user-forum"),
    true,
  );
});
for (const failure of [
  "loader missing",
  "application missing",
  "container throws",
  "router missing",
  "route pending",
]) {
  test(`startup retries when ${failure}`, async (t) => {
    const h = domHarness(t);
    const loader = h.context.requirejs;
    if (failure === "loader missing") delete h.context.requirejs;
    if (failure === "application missing")
      h.context.requirejs = function () {
        return { default: { NAMESPACES: [] } };
      };
    if (failure === "container throws")
      h.context.requirejs = function () {
        throw new Error("not ready");
      };
    if (failure === "router missing")
      h.context.requirejs = function () {
        return {
          default: {
            NAMESPACES: [{ name: "n3", __container__: { lookup: () => null } }],
          },
        };
      };
    if (failure === "route pending") h.router.currentRouteName = null;
    await h.load(modern);
    assert.equal(h.timers.size, 1);
    h.context.requirejs = loader;
    h.router.currentRouteName = "main--reader.post";
    await h.tick(200);
    await h.tick(1000);
    assert.equal(h.observers.length, 1);
    assert.ok(h.document.getElementById("comments_wrapper"));
  });
}
test("index pages do not receive comments", async (t) => {
  const h = await ready(t, { route: "main--reader.index" });
  assert.equal(h.document.getElementById("comments_wrapper"), null);
});
test("missing insertion targets exhaust bounded retries", async (t) => {
  const h = await ready(t, { html: "<main></main>" });
  for (let i = 0; i < 11; i++) await h.tick(500);
  assert.equal(h.timers.size, 0);
  assert.equal(h.document.getElementById("comments_wrapper"), null);
});
test("comment hash opens and scrolls new layouts without a comments container", async (t) => {
  const h = await ready(t, {
    html: '<div id="ap-article-top-001"></div><div id="ap-article-bottom-001"></div>',
    hash: "#comment-123",
  });
  assert.equal(h.document.getElementById("comments_wrapper").scrolled, true);
  assert.equal(h.window.disqus_url, "https://444.hu/2026/10/07/article");
});
test("loading comments once and switching forums replaces the script", async (t) => {
  const h = await ready(t);
  const button = h.document.querySelector(".comments-toggle");
  button.click();
  button.click();
  assert.equal(
    h.document.querySelectorAll('script[src$="/embed.js"]').length,
    1,
  );
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hsz.disqus.com/embed.js",
  );
  h.document.getElementById("tab-444hu").click();
  assert.equal(
    h.document.querySelectorAll('script[src$="/embed.js"]').length,
    1,
  );
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hu.disqus.com/embed.js",
  );
  h.document.getElementById("tab-user").click();
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hsz.disqus.com/embed.js",
  );
});
for (const shortname of [
  "evil.example/#",
  "evil.example/path",
  "user@evil.example",
  "",
  " Custom-Forum ",
]) {
  test(`stored forum name stays on Disqus: ${JSON.stringify(shortname)}`, async (t) => {
    const h = await ready(t, {
      settings: {
        _444hsz_user_forum_shortname: shortname,
        _444hsz_autoload_comments: "1",
      },
    });
    const expected = shortname === " Custom-Forum " ? "custom-forum" : "444hsz";
    assert.equal(
      h.document.querySelector('script[src$="/embed.js"]').src,
      `https://${expected}.disqus.com/embed.js`,
    );
  });
}
test("pasted forum input is validated before it is stored", async (t) => {
  const h = await ready(t);
  const input = h.document.querySelector("#userForumShortName");
  input.value = "evil.example/#";
  input.dispatchEvent(new h.window.Event("change"));
  assert.equal(
    h.window.localStorage.getItem("_444hsz_user_forum_shortname"),
    "444hsz",
  );
});
test("navigation replaces the section and preserves settings", async (t) => {
  const h = await ready(t, {
    settings: {
      _444hsz_sidebar: "1",
      _444hsz_announcement_read: "1",
      _444hsz_show_disqus_recommendations: "1",
    },
  });
  const first = h.document.getElementById("comments_wrapper");
  await h.navigate("/next");
  assert.notEqual(h.document.getElementById("comments_wrapper"), first);
  assert.equal(h.document.querySelectorAll("#comments_wrapper").length, 1);
  assert.ok(h.document.querySelector("#comments_wrapper.sidebar"));
  assert.ok(h.document.querySelector(".forum-rules.hide"));
  assert.equal(h.document.getElementById("recommendationsToggleStyle"), null);
});
test("temporary outage forum returns to default on the next article", async (t) => {
  const h = await ready(t, {
    html: '<meta property="article:published_time" content="2022-08-05T12:00:00+02:00"><main><div id="comments"></div></main>',
    settings: { _444hsz_autoload_comments: "1" },
  });
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hsz3.disqus.com/embed.js",
  );
  await h.navigate("/another-outage-article");
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hsz3.disqus.com/embed.js",
  );
  h.document.querySelector('meta[property="article:published_time"]').content =
    "2026-10-07T12:00:00+02:00";
  await h.navigate("/next");
  assert.equal(
    h.document.querySelector('script[src$="/embed.js"]').src,
    "https://444hsz.disqus.com/embed.js",
  );
});
for (const [hostname, date, forum] of [
  ["jo.444.hu", null, "444hsz"],
  ["geekz.444.hu", "2015-01-01", "444hsz"],
  ["geekz.444.hu", "2026-10-07", "geekzblog"],
]) {
  test(`legacy article initializes ${hostname} ${date}`, async (t) => {
    const h = domHarness(t, {
      hostname,
      html: `${date ? `<meta itemprop="dateCreated" content="${date}">` : ""}<article><div class="byline"></div><footer class="hide-print"></footer></article>`,
    });
    let initialized = 0;
    h.context.require = () => ({
      default() {
        assert.equal(h.window.disqus_shortname, forum);
        initialized++;
      },
    });
    await h.load("444hu_comments_inject_legacy.js");
    assert.equal(h.window.disqus_shortname, forum);
    assert.equal(initialized, 1);
    assert.ok(h.document.getElementById("disqus_thread"));
    h.document.querySelector(".comments-docked-open>button").click();
    assert.ok(h.document.querySelector("#comments.docked-comments"));
    h.document.querySelector(".comments-toggle-top").click();
    assert.ok(h.document.getElementById("comments").scrolled);
  });
}
test("legacy index skips comment initialization", async (t) => {
  const h = domHarness(t, { hostname: "jo.444.hu", html: "<main></main>" });
  await h.load("444hu_comments_inject_legacy.js");
  assert.equal(h.document.getElementById("comments"), null);
});
for (const [name, html] of [
  [
    "sidebar",
    "<header></header><div><h1>Title</h1><p></p><p></p></div><main><div>Article</div></main><aside></aside>",
  ],
  ["live report", "<article><div><footer></footer></div></article>"],
  ["footer fallback", "<main><h1>Title</h1><footer></footer></main>"],
  [
    "new live report",
    '<div id="ap-site-header-bottom"></div><div><div><div>Article</div></div></div>',
  ],
  [
    "new article",
    '<div id="ap-site-header-bottom"></div><div></div><div><div><div><p>Article</p></div></div></div>',
  ],
]) {
  test(`supports insertion layout: ${name}`, async (t) => {
    const h = await ready(t, { html });
    assert.ok(h.document.getElementById("comments_wrapper"));
  });
}
test("settings controls persist changes and sidebar resizing cleans up", async (t) => {
  const h = await ready(t);
  h.document.querySelector(".button-settings").click();
  assert.equal(
    h.document
      .querySelector(".comments-settings")
      .classList.contains("collapse"),
    false,
  );
  h.document.querySelector("#autoloadToggle").click();
  assert.equal(h.window.localStorage.getItem("_444hsz_autoload_comments"), "1");
  h.document.querySelector(".forum-rules .close-button").click();
  assert.equal(h.window.localStorage.getItem("_444hsz_announcement_read"), "1");
  h.document.querySelector("#rulesToggle").click();
  assert.equal(h.window.localStorage.getItem("_444hsz_announcement_read"), "0");
  h.document.querySelector("#recommendationsToggle").click();
  assert.equal(
    h.window.localStorage.getItem("_444hsz_show_disqus_recommendations"),
    "1",
  );
  h.document.querySelector("#recommendationsToggle").click();
  assert.equal(
    h.window.localStorage.getItem("_444hsz_show_disqus_recommendations"),
    "0",
  );
  h.document.querySelector(".comments-toggle-top").click();
  Object.defineProperty(h.document.body, "clientWidth", { value: 1000 });
  h.document
    .querySelector(".comments-resizer")
    .dispatchEvent(new h.window.MouseEvent("mousedown", { cancelable: true }));
  h.window.dispatchEvent(
    new h.window.MouseEvent("mousemove", { clientX: 500, cancelable: true }),
  );
  assert.equal(
    h.document.getElementById("comments_wrapper").style.width,
    "500px",
  );
  h.window.dispatchEvent(
    new h.window.MouseEvent("mousemove", { clientX: 900, cancelable: true }),
  );
  assert.equal(
    h.document.getElementById("comments_wrapper").style.width,
    "500px",
  );
  h.window.dispatchEvent(
    new h.window.MouseEvent("mouseup", { cancelable: true }),
  );
  assert.equal(h.document.body.style.pointerEvents, "");
});
for (const theme of ["dark", "light", "system"]) {
  test(`honors ${theme} theme`, async (t) => {
    const h = domHarness(t);
    if (theme !== "system") h.document.cookie = `jeti-theme=${theme}`;
    h.window.matchMedia = () => ({ matches: true });
    await h.load(modern);
    await h.tick(1000);
    assert.equal(
      h.document
        .getElementById("comments_wrapper")
        .style.getPropertyValue("--comments-bgcolor"),
      `var(--comments-bgcolor-${theme === "light" ? "light" : "dark"})`,
    );
  });
}
test("legacy replaces existing site comments and supports resizing", async (t) => {
  const h = domHarness(t, {
    hostname: "jo.444.hu",
    html: '<article><div class="byline"></div><footer class="hide-print"></footer><section id="comments"><div id="disqus_thread">Old content</div></section></article>',
  });
  await h.load("444hu_comments_inject_legacy.js");
  assert.equal(h.document.querySelectorAll("#comments").length, 1);
  assert.equal(h.document.getElementById("disqus_thread").textContent, "");
  Object.defineProperty(h.document.body, "clientWidth", { value: 1000 });
  h.document
    .querySelector(".comments-docked-resizer")
    .dispatchEvent(new h.window.MouseEvent("mousedown", { cancelable: true }));
  h.document.dispatchEvent(
    new h.window.MouseEvent("mousemove", { clientX: 500, cancelable: true }),
  );
  assert.equal(h.document.getElementById("comments").style.width, "500px");
  h.document.dispatchEvent(
    new h.window.MouseEvent("mousemove", { clientX: 900, cancelable: true }),
  );
  assert.equal(h.document.getElementById("comments").style.width, "500px");
  h.document.dispatchEvent(
    new h.window.MouseEvent("mouseup", { cancelable: true }),
  );
  assert.equal(h.document.body.style.pointerEvents, "");
});

test("rapid navigation cancels pending initialization", async (t) => {
  const h = domHarness(t);
  await h.load(modern);
  h.router.url = "/first";
  h.observers[0]();
  h.router.url = "/second";
  h.observers[0]();
  assert.equal(h.timers.size, 1);
  await h.tick(1000);
  assert.equal(h.document.querySelectorAll("#comments_wrapper").length, 1);
});
