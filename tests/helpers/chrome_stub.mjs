import { readFileSync } from "node:fs";

export const siteList = JSON.parse(readFileSync("sites.json", "utf8"));

// An in-memory stand-in for the extension APIs the worker and the options
// page use. `granted` holds origin patterns; `answer` decides what the
// browser prompt returns for permissions.request().
export function createChromeStub({ granted = [], answer = true } = {}) {
  const calls = [];
  const listeners = {};
  const state = { granted: new Set(granted), registered: [], answer };
  const listener = (name) => ({
    addListener(callback) {
      listeners[name] = callback;
    },
  });
  const chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: listener("onInstalled"),
      onStartup: listener("onStartup"),
    },
    action: { onClicked: listener("onClicked") },
    tabs: {
      async create(options) {
        calls.push(["tabs.create", options.url]);
      },
    },
    permissions: {
      onAdded: listener("onAdded"),
      onRemoved: listener("onRemoved"),
      async contains({ origins }) {
        return origins.every((origin) => state.granted.has(origin));
      },
      async request({ origins }) {
        calls.push(["permissions.request", [...origins]]);
        if (state.answer)
          origins.forEach((origin) => state.granted.add(origin));
        return state.answer;
      },
      async remove({ origins }) {
        calls.push(["permissions.remove", [...origins]]);
        origins.forEach((origin) => state.granted.delete(origin));
        return true;
      },
    },
    scripting: {
      async getRegisteredContentScripts({ ids }) {
        return state.registered.filter((script) => ids.includes(script.id));
      },
      async unregisterContentScripts({ ids }) {
        calls.push(["unregister", ids]);
        state.registered = state.registered.filter((s) => !ids.includes(s.id));
      },
      async registerContentScripts(scripts) {
        calls.push(["register", scripts.map((script) => script.id)]);
        state.registered.push(...scripts);
      },
    },
  };
  return { chrome, calls, listeners, state };
}

export function fetchSites() {
  return async () => ({ json: async () => siteList });
}
