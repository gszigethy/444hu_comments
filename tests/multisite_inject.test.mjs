import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";

import { JSDOM } from "../.github/ci/node-tools/node_modules/jsdom/lib/api.js";

async function openPage(t) {
  const dom = new JSDOM("<!doctype html><head></head><body></body>", {
    url: "https://telex.hu/a",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const context = createContext({ window, document: window.document, console });
  const path = new URL("../444hsz_multisite_inject.js", import.meta.url);
  new Script(await readFile(path, "utf8"), {
    filename: path.pathname,
  }).runInContext(context);
  const send = (detail) =>
    window.document.dispatchEvent(
      new window.CustomEvent("444hsz:load", { detail }),
    );
  const embeds = () =>
    [...window.document.querySelectorAll("script")].map((script) => script.src);
  return { window, send, embeds };
}

const detail = (extra = {}) =>
  JSON.stringify({
    shortname: "444hsz",
    url: "https://telex.hu/a",
    title: "Cím | Telex",
    ...extra,
  });

test("the first load sets the Disqus globals and adds embed.js", async (t) => {
  const { window, send, embeds } = await openPage(t);
  send(detail());
  assert.equal(window.disqus_shortname, "444hsz");
  assert.equal(window.disqus_url, "https://telex.hu/a");
  assert.deepEqual(embeds(), ["https://444hsz.disqus.com/embed.js"]);
});

test("the config sets url and title but no identifier", async (t) => {
  const { window, send } = await openPage(t);
  send(detail());
  const self = { page: {} };
  window.disqus_config.call(self);
  assert.equal(self.page.url, "https://telex.hu/a");
  assert.equal(self.page.title, "Cím | Telex");
  assert.equal("identifier" in self.page, false);
});

test("a later load on a loaded page resets Disqus instead of adding another embed", async (t) => {
  const { window, send, embeds } = await openPage(t);
  send(detail());
  const resets = [];
  window.DISQUS = { reset: (options) => resets.push(options) };
  send(detail({ url: "https://telex.hu/b" }));
  assert.equal(embeds().length, 1);
  assert.equal(resets.length, 1);
  assert.equal(resets[0].reload, true);
  assert.equal(window.disqus_url, "https://telex.hu/b");
});

test("a bad payload or forum name is ignored", async (t) => {
  const { send, embeds } = await openPage(t);
  send("{not json");
  send(detail({ shortname: "x.evil.example/" }));
  send(detail({ shortname: "Evil" }));
  assert.deepEqual(embeds(), []);
});
