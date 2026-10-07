// Loose deepEqual: results come from another vm realm, so prototypes differ.
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";

import { createChromeStub, fetchSites } from "./helpers/chrome_stub.mjs";

const TELEX = "*://telex.hu/*";
const FOUR = "*://*.444.hu/*";

// Each test gets a fresh context, so listener registration runs again and
// nothing leaks between tests. Filenames keep the coverage attributed.
async function loadBackground(options) {
  const stub = createChromeStub(options);
  const context = createContext({
    chrome: stub.chrome,
    fetch: fetchSites(),
    console,
  });
  for (const file of ["444hsz_sites.js", "background.js"]) {
    const path = new URL(`../${file}`, import.meta.url);
    new Script(await readFile(path, "utf8"), {
      filename: path.pathname,
    }).runInContext(context);
  }
  return { ...stub, background: context.Hsz444Background };
}

test("nothing granted registers nothing", async () => {
  const { background, state } = await loadBackground();
  assert.deepEqual(await background.sync(), []);
  assert.deepEqual(state.registered, []);
});

test("444.hu gets its bootstrap with the excluded hosts, other sites the generic script", async () => {
  const { background, state } = await loadBackground({
    granted: [FOUR, TELEX],
  });
  await background.sync();
  const byId = Object.fromEntries(state.registered.map((s) => [s.id, s]));
  assert.deepEqual(byId["444hu-comments"].matches, [FOUR]);
  assert.deepEqual(byId["444hu-comments"].excludeMatches, [
    "*://kor.444.hu/*",
    "*://membership.444.hu/*",
  ]);
  assert.deepEqual(byId["444hu-comments"].js, ["444hu_comments.js"]);
  assert.equal(byId["444hu-comments"].runAt, "document_start");
  assert.deepEqual(byId["444hsz-multisite"].matches, [TELEX]);
  assert.deepEqual(byId["444hsz-multisite"].js, [
    "444hsz_sites.js",
    "444hsz_multisite.js",
  ]);
});

test("sync replaces old registrations instead of stacking them", async () => {
  const { background, state, calls } = await loadBackground({
    granted: [TELEX],
  });
  await background.sync();
  state.granted.delete(TELEX);
  state.granted.add(FOUR);
  await background.sync();
  assert.deepEqual(
    state.registered.map((s) => s.id),
    ["444hu-comments"],
  );
  assert.ok(calls.some(([name]) => name === "unregister"));
});

test("revoking everything unregisters everything", async () => {
  const { background, state } = await loadBackground({ granted: [TELEX] });
  await background.sync();
  state.granted.clear();
  await background.sync();
  assert.deepEqual(state.registered, []);
});

test("a fresh install opens the options page", async () => {
  const { background, calls } = await loadBackground();
  await background.onInstalled({ reason: "install" });
  assert.deepEqual(calls.at(-1), [
    "tabs.create",
    "chrome-extension://test/options.html#telepites",
  ]);
});

test("update from 1.4.x keeps a carried-over 444.hu permission working, silently", async () => {
  const { background, calls, state } = await loadBackground({
    granted: [FOUR],
  });
  await background.onInstalled({
    reason: "update",
    previousVersion: "1.4.0.27",
  });
  assert.deepEqual(
    state.registered.map((s) => s.id),
    ["444hu-comments"],
  );
  assert.equal(
    calls.some(([name]) => name === "tabs.create"),
    false,
  );
});

test("update from 1.4.x without the permission sends the user to switch it on", async () => {
  const { background, calls } = await loadBackground();
  await background.onInstalled({
    reason: "update",
    previousVersion: "1.4.0.27",
  });
  assert.deepEqual(calls.at(-1), [
    "tabs.create",
    "chrome-extension://test/options.html#frissites",
  ]);
});

test("updates from 1.5+ and browser updates do not open the page", async () => {
  const { background, calls } = await loadBackground();
  await background.onInstalled({
    reason: "update",
    previousVersion: "1.5.0.0",
  });
  await background.onInstalled({ reason: "chrome_update" });
  assert.equal(
    calls.some(([name]) => name === "tabs.create"),
    false,
  );
});

test("version check", async () => {
  const { background } = await loadBackground();
  assert.equal(background.isBeforeMultisite("1.4.0.26"), true);
  assert.equal(background.isBeforeMultisite("1.5.0.0"), false);
  assert.equal(background.isBeforeMultisite("2.0"), false);
  assert.equal(background.isBeforeMultisite(undefined), false);
});

test("listeners are wired: permission changes and startup re-sync, icon opens options", async () => {
  const { listeners, state, calls } = await loadBackground({
    granted: [TELEX],
  });
  for (const name of [
    "onInstalled",
    "onStartup",
    "onAdded",
    "onRemoved",
    "onClicked",
  ]) {
    assert.equal(typeof listeners[name], "function", name);
  }
  await listeners.onAdded();
  assert.equal(state.registered.length, 1);
  await listeners.onClicked();
  assert.deepEqual(calls.at(-1), [
    "tabs.create",
    "chrome-extension://test/options.html",
  ]);
});
