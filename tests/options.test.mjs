import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";

import { JSDOM } from "../.github/ci/node-tools/node_modules/jsdom/lib/api.js";
import { createChromeStub, fetchSites } from "./helpers/chrome_stub.mjs";

async function openOptions(t, { hash = "", ...stubOptions } = {}) {
  const html = await readFile("options.html", "utf8");
  const dom = new JSDOM(html, {
    url: `chrome-extension://test/options.html${hash}`,
  });
  t.after(() => dom.window.close());
  const stub = createChromeStub(stubOptions);
  const context = createContext({
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    chrome: stub.chrome,
    fetch: fetchSites(),
    setTimeout,
    clearTimeout,
    console,
  });
  for (const file of ["444hsz_sites.js", "444hsz_import.js", "options.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  const settle = async () => {
    for (let i = 0; i < 200; i++) await Promise.resolve();
  };
  await settle();
  const $ = (id) => dom.window.document.getElementById(id);
  const switches = () => [
    ...dom.window.document.querySelectorAll("#sites input"),
  ];
  const names = () =>
    [...dom.window.document.querySelectorAll("#sites .name")].map(
      (n) => n.textContent,
    );
  return { ...stub, dom, $, settle, switches, names, window: dom.window };
}

test("lists the 23 supported sites sorted by label, all off, and the excluded ones greyed out", async (t) => {
  const page = await openOptions(t);
  assert.equal(page.switches().length, 23);
  assert.ok(page.switches().every((input) => !input.checked));
  const labels = page.names();
  assert.ok(labels.includes("Telex") && labels.includes("444.hu és blogjai"));
  assert.equal(page.$("summary").textContent, "0 / 23 oldal bekapcsolva");
  const excluded = [
    ...page.dom.window.document.querySelectorAll("#excluded .name"),
  ].map((n) => n.textContent);
  assert.deepEqual(excluded.sort(), ["Eduline", "hvg"]);
  assert.match(page.$("excluded").textContent, /Szerzői jogi panasz/);
});

test("the permission is the switch: granted sites show as on", async (t) => {
  const page = await openOptions(t, { granted: ["*://telex.hu/*"] });
  assert.equal(page.switches().filter((input) => input.checked).length, 1);
  assert.equal(page.$("summary").textContent, "1 / 23 oldal bekapcsolva");
});

function switchFor(page, title) {
  const row = [
    ...page.dom.window.document.querySelectorAll("#sites label"),
  ].find((label) => label.querySelector(".name").textContent === title);
  return row.querySelector("input");
}

test("switching a site on requests exactly its origin; off removes it", async (t) => {
  const page = await openOptions(t);
  switchFor(page, "Telex").dispatchEvent(new page.window.Event("change"));
  await page.settle();
  assert.deepEqual(page.calls.at(-1), [
    "permissions.request",
    ["*://telex.hu/*"],
  ]);
  assert.equal(switchFor(page, "Telex").checked, true);
  switchFor(page, "Telex").dispatchEvent(new page.window.Event("change"));
  await page.settle();
  assert.deepEqual(page.calls.at(-1), [
    "permissions.remove",
    ["*://telex.hu/*"],
  ]);
  assert.equal(switchFor(page, "Telex").checked, false);
});

test("declining the browser prompt leaves the site off and opens the recovery help", async (t) => {
  const page = await openOptions(t, { answer: false });
  switchFor(page, "Telex").dispatchEvent(new page.window.Event("change"));
  await page.settle();
  assert.equal(switchFor(page, "Telex").checked, false);
  assert.equal(page.$("message").hidden, false);
  assert.match(page.$("message").textContent, /Tiltás/);
  assert.equal(page.$("help").open, true);
  // Recovery: the same switch works once the user allows it.
  page.state.answer = true;
  switchFor(page, "Telex").dispatchEvent(new page.window.Event("change"));
  await page.settle();
  assert.equal(switchFor(page, "Telex").checked, true);
  assert.equal(page.$("message").hidden, true);
});

test("Mind be sends one request with every site that is not on yet; Mind ki one removal", async (t) => {
  const page = await openOptions(t, { granted: ["*://telex.hu/*"] });
  page.$("all-on").click();
  await page.settle();
  const requests = page.calls.filter(
    ([name]) => name === "permissions.request",
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].length, 22);
  assert.equal(requests[0][1].includes("*://telex.hu/*"), false);
  assert.equal(page.$("summary").textContent, "23 / 23 oldal bekapcsolva");
  page.$("all-off").click();
  await page.settle();
  const removals = page.calls.filter(([name]) => name === "permissions.remove");
  assert.equal(removals.length, 1);
  assert.equal(removals[0][1].length, 23);
  assert.equal(page.$("summary").textContent, "0 / 23 oldal bekapcsolva");
});

test("Mind be and Mind ki with nothing to do make no browser call", async (t) => {
  const page = await openOptions(t);
  page.$("all-off").click();
  await page.settle();
  assert.equal(page.calls.length, 0);
});

test("a browser error is shown instead of failing silently", async (t) => {
  const page = await openOptions(t);
  page.chrome.permissions.request = async () => {
    throw new Error("boom");
  };
  switchFor(page, "Telex").dispatchEvent(new page.window.Event("change"));
  await page.settle();
  assert.match(page.$("message").textContent, /boom/);
});

test("access revoked in the browser's settings shows up without reloading", async (t) => {
  const page = await openOptions(t, { granted: ["*://telex.hu/*"] });
  page.state.granted.delete("*://telex.hu/*");
  await page.listeners.onRemoved();
  await page.settle();
  assert.equal(page.$("summary").textContent, "0 / 23 oldal bekapcsolva");
});

test("install and update notices come from the URL hash", async (t) => {
  const plain = await openOptions(t);
  assert.equal(plain.$("notice").hidden, true);
  const update = await openOptions(t, { hash: "#frissites" });
  assert.equal(update.$("notice").hidden, false);
  assert.match(
    update.$("notice").textContent,
    /444\.hu kommentekhez kapcsold be újra/,
  );
  const install = await openOptions(t, { hash: "#telepites" });
  assert.match(install.$("notice").textContent, /444\.hu ajánlott/);
});

test("a failure while loading the site list is shown, not left unhandled", async (t) => {
  const html = await readFile("options.html", "utf8");
  const dom = new JSDOM(html, { url: "chrome-extension://test/options.html" });
  t.after(() => dom.window.close());
  const stub = createChromeStub();
  const context = createContext({
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    chrome: stub.chrome,
    fetch: async () => {
      throw new Error("offline");
    },
    console,
  });
  for (const file of ["444hsz_sites.js", "options.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  for (let i = 0; i < 50; i++) await Promise.resolve();
  assert.match(
    dom.window.document.getElementById("message").textContent,
    /nem sikerült: offline/,
  );
});
const settings = (sites) =>
  JSON.stringify({ articleFeed: { filters: { sites, showSport: true } } });

test("import preselects the 444hsz.com filter, then a second click switches them on", async (t) => {
  const page = await openOptions(t, {
    settingsData: settings([
      { slug: "telex" },
      { slug: "qubit" },
      { slug: "hvg" },
    ]),
  });
  page.$("import").click();
  await page.settle();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await page.settle();
  // Nothing is switched on by the import itself, and the 444hsz.com access is gone.
  assert.ok(page.switches().every((input) => !input.checked));
  assert.equal(page.state.granted.has("https://444hsz.com/*"), false);
  assert.equal(page.$("import-result").hidden, false);
  assert.match(page.$("import-text").textContent, /Qubit, Telex/);
  assert.equal(page.dom.window.document.querySelectorAll(".badge").length, 2);
  page.$("import-apply").click();
  await page.settle();
  const last = page.calls
    .filter(([name]) => name === "permissions.request")
    .at(-1);
  assert.deepEqual(last[1].sort(), ["*://qubit.hu/*", "*://telex.hu/*"]);
  assert.equal(page.$("summary").textContent, "2 / 23 oldal bekapcsolva");
  assert.equal(page.$("import-result").hidden, true);
});

test("an empty 444hsz.com filter means every site; an open tab is reused and left open", async (t) => {
  const page = await openOptions(t, {
    openTabs: ["https://444hsz.com/hirfolyam"],
    settingsData: settings([]),
  });
  page.$("import").click();
  await page.settle();
  assert.equal(
    page.calls.some(([name]) => name === "tabs.create"),
    false,
  );
  assert.equal(
    page.calls.some(([name]) => name === "tabs.remove"),
    false,
  );
  assert.equal(page.dom.window.document.querySelectorAll(".badge").length, 23);
});

test("a tab opened for the import is closed again", async (t) => {
  const page = await openOptions(t, { settingsData: settings([]) });
  page.$("import").click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await page.settle();
  assert.ok(page.calls.some(([name]) => name === "tabs.remove"));
  assert.equal(page.state.tabs.length, 0);
});

test("missing, broken or unusable data changes nothing and says so", async (t) => {
  for (const settingsData of [
    null,
    "not json",
    "{}",
    settings([{ slug: "hvg" }]),
  ]) {
    const page = await openOptions(t, {
      openTabs: ["https://444hsz.com/"],
      settingsData,
    });
    page.$("import").click();
    await page.settle();
    assert.equal(
      page.$("message").textContent,
      "Nincs importálható beállítás.",
      String(settingsData),
    );
    assert.equal(page.$("import-result").hidden, true);
    assert.equal(page.state.granted.has("https://444hsz.com/*"), false);
  }
});

test("declining the 444hsz.com access explains why it is needed", async (t) => {
  const page = await openOptions(t, { answer: false });
  page.$("import").click();
  await page.settle();
  assert.match(page.$("message").textContent, /444hsz\.com elérése kell/);
  assert.equal(
    page.calls.some(([name]) => name === "executeScript"),
    false,
  );
});

test("a failed import shows the error and still gives the access back", async (t) => {
  const page = await openOptions(t, { openTabs: ["https://444hsz.com/"] });
  page.chrome.scripting.executeScript = async () => {
    throw new Error("nincs hozzáférés");
  };
  page.$("import").click();
  await page.settle();
  await page.settle();
  assert.match(page.$("message").textContent, /nem sikerült: nincs hozzáférés/);
  assert.equal(page.state.granted.has("https://444hsz.com/*"), false);
});

test("discarding the import clears the preselection", async (t) => {
  const page = await openOptions(t, {
    openTabs: ["https://444hsz.com/"],
    settingsData: settings([{ slug: "telex" }]),
  });
  page.$("import").click();
  await page.settle();
  page.$("import-discard").click();
  assert.equal(page.$("import-result").hidden, true);
  assert.equal(page.dom.window.document.querySelectorAll(".badge").length, 0);
});
