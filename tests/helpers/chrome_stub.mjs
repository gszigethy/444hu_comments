import { readFileSync } from "node:fs";

export const siteList = JSON.parse(readFileSync("sites.json", "utf8"));

// An in-memory stand-in for the extension APIs the worker and the options
// page use. `granted` holds origin patterns; `answer` decides what the
// browser prompt returns for permissions.request().
export function createChromeStub({
  granted = [],
  answer = true,
  openTabs = [],
  settingsData = null,
  loads = true,
} = {}) {
  const calls = [];
  const listeners = {};
  const state = {
    granted: new Set(granted),
    registered: [],
    answer,
    tabs: openTabs.map((url, index) => ({
      id: index + 1,
      url,
      status: "complete",
    })),
    settingsData,
    loads,
  };
  const updated = new Set();
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
      onUpdated: {
        addListener: (callback) => updated.add(callback),
        removeListener: (callback) => updated.delete(callback),
      },
      async create(options) {
        calls.push(["tabs.create", options.url]);
        const tab = {
          id: state.tabs.length + 1,
          url: options.url,
          status: "loading",
        };
        state.tabs.push(tab);
        // A background tab finishes loading a moment later.
        if (state.loads) {
          setTimeout(() => {
            tab.status = "complete";
            updated.forEach((callback) =>
              callback(tab.id, { status: "complete" }),
            );
          }, 0);
        }
        return tab;
      },
      async query({ url }) {
        calls.push(["tabs.query", url]);
        const prefix = url.replace("/*", "/");
        return state.tabs.filter((tab) => tab.url.startsWith(prefix));
      },
      async get(id) {
        return state.tabs.find((tab) => tab.id === id);
      },
      async remove(id) {
        calls.push(["tabs.remove", id]);
        state.tabs = state.tabs.filter((tab) => tab.id !== id);
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
      async executeScript({ target }) {
        calls.push(["executeScript", target.tabId]);
        return [{ result: state.settingsData }];
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
