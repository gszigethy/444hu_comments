// Site matching shared by the service worker, the options page and the
// content scripts. It mirrors how 444hsz.com itself decides which articles it
// accepts, so both use the same Disqus thread for the same article.
// The site list is passed in (sites.json) so this file holds logic only.
(function () {
  // 444.hu hosts where the extension never runs (members' area, forum).
  var EXCLUDED_HOSTS = ["kor.444.hu", "membership.444.hu"];

  // Sites marked noSubmit are not accepted by 444hsz.com (hvg and Eduline after
  // a copyright complaint to Disqus, and 444hsz.com itself). Skipped here too.
  function supportedSites(sites) {
    return sites.filter(function (site) {
      return !site.noSubmit;
    });
  }

  // Same rules as the 444hsz.com article form: the host regex must match the
  // whole host, and regexPath, when present, the start of the path.
  function findSite(sites, host, pathname) {
    if (EXCLUDED_HOSTS.indexOf(host) !== -1) return null;
    var candidates = supportedSites(sites);
    for (var i = 0; i < candidates.length; i++) {
      var site = candidates[i];
      if (!new RegExp("^" + site.regex + "$").test(host)) continue;
      if (!site.regexPath || new RegExp("^" + site.regexPath).test(pathname)) {
        return site;
      }
    }
    return null;
  }

  // The Disqus thread URL: site transforms first, then the query string and
  // fragment are cut off. No identifier is sent, which matches threads made by
  // 444hsz.com (identifier = URL) and by this extension (no identifier).
  function threadUrl(site, url) {
    (site.transforms || []).forEach(function (transform) {
      url = url.replace(new RegExp(transform.regex), transform.replace);
    });
    return url.split(/[?#]/)[0];
  }

  // Some sites name their threads "<title> | <site>", as 444hsz.com does.
  function threadTitle(site, title) {
    return site.addPostfix ? title + " | " + site.title : title;
  }

  // Browser match pattern for a site's host regex. Only the two shapes in the
  // list are understood: "(\w+\.)?host" and a literal host. "*.host" also
  // matches the bare host, and is slightly wider than "(\w+\.)?" (it allows
  // several labels), so content scripts re-check the host with findSite().
  // Anything else throws, so a new regex style fails loudly in tests instead
  // of silently granting the wrong access.
  function originPattern(site) {
    var match = /^(\(\\w\+\\\.\)\?)?((?:[a-z0-9-]+\\\.)*[a-z0-9-]+)$/.exec(
      site.regex,
    );
    if (!match) throw new Error("Unsupported host regex: " + site.regex);
    var host = match[2].replace(/\\\./g, ".");
    return "*://" + (match[1] ? "*." : "") + host + "/*";
  }

  var api = {
    EXCLUDED_HOSTS: EXCLUDED_HOSTS,
    supportedSites: supportedSites,
    findSite: findSite,
    threadUrl: threadUrl,
    threadTitle: threadTitle,
    originPattern: originPattern,
  };
  globalThis.Hsz444Sites = api;
  if (typeof module !== "undefined") module.exports = api;
})();
