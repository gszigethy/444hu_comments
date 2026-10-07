// Content script for every site except 444.hu. The Disqus block arrives in a
// later change; for now this only confirms, in the console, that the site was
// switched on and matches the 444hsz.com list.
(function () {
  async function run() {
    var response = await fetch(chrome.runtime.getURL("sites.json"));
    var sites = (await response.json()).sites;
    var site = globalThis.Hsz444Sites.findSite(
      sites,
      location.hostname,
      location.pathname,
    );
    if (site)
      console.debug("%c[444hsz]", "color: #29af0a;", "Site: " + site.slug);
    return site;
  }
  var api = { run: run };
  globalThis.Hsz444Multisite = api;
  if (typeof module !== "undefined") module.exports = api;
  // sites.json is listed in web_accessible_resources, which a content script
  // needs to fetch it. Skipped where no extension runtime exists.
  if (typeof chrome !== "undefined" && chrome.runtime) {
    run().catch(function (error) {
      console.debug("[444hsz]", error);
    });
  }
})();
