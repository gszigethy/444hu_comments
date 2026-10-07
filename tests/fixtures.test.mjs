import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import sites from "../444hsz_sites.js";

const supported = sites.supportedSites(
  JSON.parse(readFileSync("sites.json", "utf8")).sites,
);
const report = JSON.parse(
  readFileSync("tests/fixtures/sites/report.json", "utf8"),
);
const fixtures = readdirSync("tests/fixtures/sites").filter((name) =>
  name.endsWith(".html"),
);

test("the recon report covers every supported site", () => {
  assert.deepEqual(
    report.map((entry) => entry.slug).sort(),
    supported.map((site) => site.slug).sort(),
  );
});

test("each fixture belongs to a supported site and its recorded URL matches that site", () => {
  assert.ok(fixtures.length >= 18);
  for (const name of fixtures) {
    const slug = name.replace(".html", "");
    const entry = report.find((candidate) => candidate.slug === slug);
    assert.ok(entry, `${name} has no report entry`);
    const { host, pathname } = new URL(entry.article.url);
    assert.equal(sites.findSite(supported, host, pathname)?.slug, slug);
  }
});

test("fixtures are skeletons: no scripts, no inline text", () => {
  for (const name of fixtures) {
    const html = readFileSync(`tests/fixtures/sites/${name}`, "utf8");
    // Only JSON-LD @type values are kept, as a script block.
    assert.doesNotMatch(
      html.replace(/<script type="application\/ld\+json">[^<]*<\/script>/g, ""),
      /<script|<style|<img|<a /i,
      name,
    );
    const body = html.slice(html.indexOf("<body>"));
    assert.doesNotMatch(body.replace(/<[^>]*>/g, "").trim(), /\S/, name);
  }
});
