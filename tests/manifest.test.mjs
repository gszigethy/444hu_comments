import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sites from "../444hsz_sites.js";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const list = JSON.parse(readFileSync("sites.json", "utf8")).sites;
const expected = sites.supportedSites(list).map(sites.originPattern).sort();
const hint = `Expected patterns (copy into manifest.json):\n${JSON.stringify(expected, null, 2)}`;

test("optional host permissions are exactly the supported sites", () => {
  assert.deepEqual(
    [...manifest.optional_host_permissions].sort(),
    expected,
    hint,
  );
});

test("nothing is granted at install time", () => {
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions, ["scripting"]);
});

test("page resources are web accessible on the same sites, including the site list", () => {
  const [group] = manifest.web_accessible_resources;
  assert.deepEqual([...group.matches].sort(), expected, hint);
  assert.ok(group.resources.includes("sites.json"));
});

test("the options page and both background styles are declared", () => {
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.options_ui.open_in_tab, true);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.deepEqual(manifest.background.scripts, [
    "444hsz_sites.js",
    "background.js",
  ]);
});
