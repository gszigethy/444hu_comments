import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sites from "../444hsz_sites.js";

const list = JSON.parse(readFileSync("sites.json", "utf8")).sites;
// Article links taken from the live 444hsz.com feed: each is the identifier of
// a thread that 444hsz.com created for that article.
const feedLinks = JSON.parse(
  readFileSync("tests/fixtures/feed_links.json", "utf8"),
);

const find = (url) => {
  const { host, pathname } = new URL(url);
  return sites.findSite(list, host, pathname);
};

test("every real feed link is supported and keeps its thread URL", () => {
  assert.ok(feedLinks.length > 10);
  for (const link of feedLinks) {
    const site = find(link);
    assert.ok(site, `no site for ${link}`);
    assert.equal(sites.threadUrl(site, link), link);
  }
});

test("noSubmit sites and excluded 444.hu hosts are not matched", () => {
  assert.equal(find("https://hvg.hu/itthon/20261007_cikk"), null);
  assert.equal(find("https://eduline.hu/kozoktatas/cikk"), null);
  assert.equal(find("https://444hsz.com/"), null);
  assert.equal(find("https://kor.444.hu/2026/10/07/x"), null);
  assert.equal(find("https://membership.444.hu/"), null);
  assert.equal(sites.supportedSites(list).length, 23);
});

test("hosts match the whole host, including subdomains where allowed", () => {
  assert.equal(find("https://ng.24.hu/foto/x/").slug, "24");
  assert.equal(find("https://24.hu/tech/x/").slug, "24");
  assert.equal(find("https://szabadsag.444.hu/2026/10/07/x").slug, "444");
  assert.equal(find("https://www.telex.hu/x"), null);
  assert.equal(find("https://telex.hu.evil.example/x"), null);
  assert.equal(find("https://eviltelex.hu/x"), null);
});

test("regexPath limits Klubrádió to its article sections", () => {
  assert.equal(
    find("https://www.klubradio.hu/hirek/valami-1").slug,
    "klubradio",
  );
  assert.equal(
    find("https://www.klubradio.hu/adasok/valami").slug,
    "klubradio",
  );
  assert.equal(find("https://www.klubradio.hu/musor"), null);
  assert.equal(find("https://www.klubradio.hu/"), null);
});

test("thread URL applies transforms and drops query and fragment", () => {
  const site = find("https://444.hu/2026/10/07/x");
  assert.equal(
    sites.threadUrl(site, "https://444.hu/2026/10/07/x?appview"),
    "https://444.hu/2026/10/07/x",
  );
  assert.equal(
    sites.threadUrl(site, "https://444.hu/2026/10/07/x?utm_source=a#komment"),
    "https://444.hu/2026/10/07/x",
  );
  const noTransforms = find("https://telex.hu/a/b");
  assert.equal(
    sites.threadUrl(noTransforms, "https://telex.hu/a/b#c"),
    "https://telex.hu/a/b",
  );
});

test("title postfix follows addPostfix", () => {
  assert.equal(
    sites.threadTitle(find("https://telex.hu/a"), "Cím"),
    "Cím | Telex",
  );
  assert.equal(sites.threadTitle(find("https://qubit.hu/a"), "Cím"), "Cím");
});

// Minimal model of a browser match pattern, to prove the generated origins
// grant exactly the hosts the 444hsz.com regex accepts (plus extra
// subdomain depth for "(\w+\.)?", which findSite() re-checks at runtime).
function patternMatchesHost(pattern, host) {
  const [, hostPattern] = /^\*:\/\/([^/]+)\/\*$/.exec(pattern);
  if (hostPattern.startsWith("*.")) {
    const base = hostPattern.slice(2);
    return host === base || host.endsWith("." + base);
  }
  return host === hostPattern;
}

test("origin patterns cover every host the regex accepts and nothing unrelated", () => {
  const samples = {
    "(\\w+\\.)?telex\\.hu": ["telex.hu", "x.telex.hu"],
    "www\\.lakmusz\\.hu": ["www.lakmusz.hu"],
    "qubit\\.hu": ["qubit.hu"],
  };
  for (const [regex, hosts] of Object.entries(samples)) {
    const pattern = sites.originPattern({ regex });
    for (const host of hosts) assert.ok(patternMatchesHost(pattern, host));
    for (const host of [
      "evil.example",
      "telex.hu.evil.example",
      "nottelex.hu",
    ]) {
      assert.equal(
        patternMatchesHost(pattern, host),
        false,
        `${pattern} ${host}`,
      );
    }
  }
  assert.equal(
    sites.originPattern({ regex: "(\\w+\\.)?444\\.hu" }),
    "*://*.444.hu/*",
  );
  assert.equal(
    sites.originPattern({ regex: "www\\.lakmusz\\.hu" }),
    "*://www.lakmusz.hu/*",
  );
});

test("every supported site in sites.json converts to a pattern", () => {
  for (const site of sites.supportedSites(list)) {
    const pattern = sites.originPattern(site);
    assert.match(pattern, /^\*:\/\/(\*\.)?[a-z0-9.-]+\/\*$/);
    // The site's real host (its domain, with www. where the regex needs it)
    // must be inside the granted origin.
    const host = new RegExp("^" + site.regex + "$").test(site.domain)
      ? site.domain
      : "www." + site.domain;
    assert.ok(patternMatchesHost(pattern, host), site.slug);
  }
});

test("an unknown regex style is rejected instead of guessed", () => {
  for (const regex of ["(a|b)\\.hu", "foo.*\\.hu", ""]) {
    assert.throws(
      () => sites.originPattern({ regex }),
      /Unsupported host regex/,
    );
  }
});
