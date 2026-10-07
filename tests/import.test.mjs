import assert from "node:assert/strict";
import test from "node:test";

import importer from "../444hsz_import.js";
import sites from "../444hsz_sites.js";
import { siteList } from "./helpers/chrome_stub.mjs";

const supported = sites.supportedSites(siteList.sites);
const wrap = (list) =>
  JSON.stringify({ articleFeed: { filters: { sites: list } } });

test("an empty filter means all supported sites", () => {
  const result = importer.parseSettings(wrap([]), supported);
  assert.equal(result.all, true);
  assert.equal(result.slugs.length, 23);
});

test("a filter selects its supported sites and drops the rest", () => {
  const result = importer.parseSettings(
    wrap([
      { slug: "telex" },
      { slug: "hvg" },
      { slug: "nincs-ilyen" },
      null,
      { name: "x" },
    ]),
    supported,
  );
  assert.deepEqual(result, { slugs: ["telex"], all: false });
});

test("slugs come back in site-list order without duplicates", () => {
  const result = importer.parseSettings(
    wrap([{ slug: "telex" }, { slug: "444" }, { slug: "telex" }]),
    supported,
  );
  assert.deepEqual(result.slugs, ["444", "telex"]);
});

test("anything unexpected gives null", () => {
  for (const raw of [
    null,
    "",
    "nem json",
    "[]",
    "{}",
    JSON.stringify({ articleFeed: {} }),
    JSON.stringify({ articleFeed: { filters: { sites: "x" } } }),
    wrap([{ slug: "hvg" }]),
  ]) {
    assert.equal(importer.parseSettings(raw, supported), null, String(raw));
  }
});

test("the injected reader returns the raw settingsData and uses nothing else", () => {
  globalThis.localStorage = {
    getItem: (key) => (key === "settingsData" ? "raw" : null),
  };
  assert.equal(importer.readLocalStorage(), "raw");
  delete globalThis.localStorage;
});

test("the injected reader has no free variables from this module", () => {
  // executeScript serialises the function, so it must stand alone.
  assert.doesNotMatch(
    importer.readLocalStorage.toString(),
    /ORIGIN|HOME|chrome|Hsz444/,
  );
});
