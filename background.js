// Background worker (service worker in Chrome, event page in Firefox).
// Sites are opt-in: the user grants each site's host permission on the options
// page, and this file registers the content scripts for the granted sites only.
// Registration is rebuilt from the real permissions every time, so there is no
// separate on/off flag that could drift from what the browser allows.
(function () {
  // Chrome loads the matcher here; Firefox lists it in manifest background.scripts.
  if (typeof importScripts === "function") importScripts("444hsz_sites.js");
  var Sites = globalThis.Hsz444Sites;

  var OPTIONS_PAGE = "options.html";
  var SCRIPT_444 = "444hu-comments";
  var SCRIPT_MULTISITE = "444hsz-multisite";

  async function loadSites() {
    var response = await fetch(chrome.runtime.getURL("sites.json"));
    return Sites.supportedSites((await response.json()).sites);
  }

  async function isGranted(pattern) {
    return chrome.permissions.contains({ origins: [pattern] });
  }

  // The content scripts to register for the sites that are switched on.
  // 444.hu keeps its own bootstrap and its excluded hosts; every other site
  // gets the generic one.
  async function plan(sites) {
    var granted = [];
    for (var i = 0; i < sites.length; i++) {
      var pattern = Sites.originPattern(sites[i]);
      if (await isGranted(pattern)) granted.push([sites[i], pattern]);
    }
    var scripts = [];
    var own = granted.filter(function (entry) {
      return entry[0].slug === "444";
    });
    var others = granted.filter(function (entry) {
      return entry[0].slug !== "444";
    });
    if (own.length) {
      scripts.push({
        id: SCRIPT_444,
        matches: own.map(function (entry) {
          return entry[1];
        }),
        excludeMatches: Sites.EXCLUDED_HOSTS.map(function (host) {
          return "*://" + host + "/*";
        }),
        js: ["444hu_comments.js"],
        runAt: "document_start",
      });
    }
    if (others.length) {
      scripts.push({
        id: SCRIPT_MULTISITE,
        matches: others.map(function (entry) {
          return entry[1];
        }),
        js: ["444hsz_sites.js", "444hsz_multisite.js"],
        runAt: "document_idle",
      });
    }
    return scripts;
  }

  // Replace our registrations with the current plan. Unregistering first keeps
  // the result identical no matter what state an update or a crash left behind.
  async function sync() {
    var scripts = await plan(await loadSites());
    var ours = [SCRIPT_444, SCRIPT_MULTISITE];
    var registered = await chrome.scripting.getRegisteredContentScripts({
      ids: ours,
    });
    if (registered.length) {
      await chrome.scripting.unregisterContentScripts({
        ids: registered.map(function (script) {
          return script.id;
        }),
      });
    }
    if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
    return scripts;
  }

  function openOptions(hash) {
    return chrome.tabs.create({
      url: chrome.runtime.getURL(OPTIONS_PAGE) + (hash || ""),
    });
  }

  // 1.4.x and older ran on 444.hu through a required host permission.
  function isBeforeMultisite(version) {
    var parts = String(version || "").split(".");
    return Number(parts[0]) === 1 && Number(parts[1]) < 5;
  }

  async function onInstalled(details) {
    var scripts = await sync();
    if (details.reason === "install") {
      await openOptions("#telepites");
    } else if (
      details.reason === "update" &&
      isBeforeMultisite(details.previousVersion) &&
      !scripts.some(function (script) {
        return script.id === SCRIPT_444;
      })
    ) {
      // The 444.hu permission did not carry over from the old version, so
      // comments would silently stop. Send the user to switch it on again.
      await openOptions("#frissites");
    }
  }

  var api = {
    plan: plan,
    sync: sync,
    onInstalled: onInstalled,
    isBeforeMultisite: isBeforeMultisite,
    openOptions: openOptions,
  };
  globalThis.Hsz444Background = api;
  if (typeof module !== "undefined") module.exports = api;

  // Listeners must be registered synchronously for the worker to wake for them.
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onInstalled
  ) {
    chrome.runtime.onInstalled.addListener(onInstalled);
    chrome.runtime.onStartup.addListener(sync);
    chrome.permissions.onAdded.addListener(sync);
    chrome.permissions.onRemoved.addListener(sync);
    chrome.action.onClicked.addListener(function () {
      openOptions("");
    });
  }
})();
