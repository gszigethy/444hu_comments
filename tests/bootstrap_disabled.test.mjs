import assert from "node:assert/strict";
import test from "node:test";

import { createExtensionHarness } from "./helpers/extension_harness.mjs";

test("membership.444.hu does not inject the extension", async () => {
  const harness = createExtensionHarness("membership.444.hu");

  await import("../444hu_comments.js");
  harness.fireDOMContentLoaded();

  assert.deepEqual(harness.appended, []);
});
