import assert from "node:assert/strict";
import test from "node:test";

import {
  appendedResources,
  createExtensionHarness,
} from "./helpers/extension_harness.mjs";

test("444.hu loads the modern frontend once", async () => {
  const harness = createExtensionHarness("444.hu");

  await import("../444hu_comments.js");
  harness.fireDOMContentLoaded();

  assert.deepEqual(appendedResources(harness.appended), [
    {
      tagName: "LINK",
      href: "chrome-extension://test/444hu_comments_legacy.css",
      src: undefined,
      name: undefined,
      content: undefined,
    },
    {
      tagName: "META",
      href: undefined,
      src: undefined,
      name: "444hsz-extension-baseurl",
      content: "chrome-extension://test/",
    },
    {
      tagName: "META",
      href: undefined,
      src: undefined,
      name: "444hsz-extension-version",
      content: "9.9.9",
    },
    {
      tagName: "LINK",
      href: "chrome-extension://test/444hu_comments.css",
      src: undefined,
      name: undefined,
      content: undefined,
    },
    {
      tagName: "SCRIPT",
      href: undefined,
      src: "chrome-extension://test/backburner.js",
      name: undefined,
      content: undefined,
    },
    {
      tagName: "SCRIPT",
      href: undefined,
      src: "chrome-extension://test/444hu_comments_inject.js",
      name: undefined,
      content: undefined,
    },
  ]);

  harness.fireDOMContentLoaded();
  assert.equal(harness.appended.length, 6);
});
