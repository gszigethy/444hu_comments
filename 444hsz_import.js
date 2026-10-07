// Reads the site filter from 444hsz.com, to offer it as the starting
// selection on the options page. 444hsz.com keeps it in its own localStorage
// (key "settingsData"), so the only way to read it is to run a script in a
// 444hsz.com tab. The permission for that is requested for the import only
// and removed again straight after.
(function () {
  var ORIGIN = "https://444hsz.com/*";
  var HOME = "https://444hsz.com/";
  var LOAD_TIMEOUT = 15000;

  // settingsData.articleFeed.filters.sites lists the sites checked in the
  // 444hsz.com filter, and an empty list means "all sites". Returns the slugs
  // of our supported sites, or null when there is nothing usable. The format
  // is internal to 444hsz.com, so every step is checked.
  function parseSettings(raw, supported) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    var filters = data && data.articleFeed && data.articleFeed.filters;
    if (!filters || !Array.isArray(filters.sites)) return null;
    var known = supported.map(function (site) {
      return site.slug;
    });
    var chosen = filters.sites.length
      ? filters.sites
          .map(function (site) {
            return site && site.slug;
          })
          .filter(function (slug) {
            return known.indexOf(slug) !== -1;
          })
      : known;
    // A selection of only unsupported sites (hvg, say) gives nothing to switch on.
    var slugs = known.filter(function (slug) {
      return chosen.indexOf(slug) !== -1;
    });
    return slugs.length ? { slugs: slugs, all: !filters.sites.length } : null;
  }

  // Runs inside the 444hsz.com page; must not use anything from this file.
  function readLocalStorage() {
    return localStorage.getItem("settingsData");
  }

  function waitForLoad(tabId) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("A 444hsz.com nem töltődött be időben."));
      }, LOAD_TIMEOUT);
      function done() {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
      function listener(id, change) {
        if (id === tabId && change.status === "complete") done();
      }
      chrome.tabs.onUpdated.addListener(listener);
      // It may already be loaded (an open tab), so check once as well.
      chrome.tabs.get(tabId).then(function (tab) {
        if (tab.status === "complete") done();
      });
    });
  }

  // The 444hsz.com permission must already be granted. Uses an open tab if
  // there is one; otherwise opens one in the background and closes it again.
  // Always takes the permission back, also on failure.
  async function readSettings() {
    var openedTab = null;
    try {
      var tabs = await chrome.tabs.query({ url: ORIGIN });
      var tab = tabs[0];
      if (!tab) {
        tab = openedTab = await chrome.tabs.create({
          url: HOME,
          active: false,
        });
        await waitForLoad(tab.id);
      }
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readLocalStorage,
      });
      return (results[0] && results[0].result) || null;
    } finally {
      if (openedTab) await chrome.tabs.remove(openedTab.id);
      await chrome.permissions.remove({ origins: [ORIGIN] });
    }
  }

  var api = {
    ORIGIN: ORIGIN,
    parseSettings: parseSettings,
    readSettings: readSettings,
    readLocalStorage: readLocalStorage,
  };
  globalThis.Hsz444Import = api;
  if (typeof module !== "undefined") module.exports = api;
})();
