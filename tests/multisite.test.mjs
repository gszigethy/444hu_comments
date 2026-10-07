import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";

import { createChromeStub, fetchSites } from "./helpers/chrome_stub.mjs";

async function runOn(url, logs) {
  const context = createContext({
    chrome: createChromeStub().chrome,
    fetch: fetchSites(),
    location: new URL(url),
    console: { debug: (...args) => logs.push(args) },
  });
  for (const file of ["444hsz_sites.js", "444hsz_multisite.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  return context.Hsz444Multisite.run();
}

test("a switched-on site is recognised and logged", async () => {
  const logs = [];
  const site = await runOn("https://telex.hu/belfold/2026/10/07/cikk", logs);
  assert.equal(site.slug, "telex");
  // The script also runs itself on load, so the log appears more than once here.
  assert.ok(logs.length >= 1);
});

test("a host outside the list is ignored", async () => {
  const logs = [];
  assert.equal(await runOn("https://example.com/", logs), null);
  assert.equal(logs.length, 0);
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
