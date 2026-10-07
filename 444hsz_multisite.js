// Content script for every switched-on site except 444.hu: detects an article
// page, inserts the 444hsz comments block and loads the Disqus thread for it.
// Detection and insertion rules come from the site recon (docs/oldalak-felderites.md).
(function () {
  var Sites = globalThis.Hsz444Sites;
  var BLOCK_ID = "hsz444-comments";
  var LOAD_EVENT = "444hsz:load";
  var AUTOLOAD_KEY = "_444hsz_autoload_comments";
  var ARTICLE_LD = ["NewsArticle", "Article", "BlogPosting"];
  var RETRIES = 10;
  var MAX_RESTORES = 10;

  function log(msg) {
    console.debug("%c[444hsz]", "color: #29af0a;", msg);
  }

  // JSON-LD @type values of the page, e.g. ["NewsArticle", "BreadcrumbList"].
  function jsonLdTypes(doc) {
    var types = [];
    doc
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach(function (node) {
        try {
          var data = JSON.parse(node.textContent);
          [].concat(data["@graph"] || data).forEach(function (item) {
            types = types.concat((item && item["@type"]) || []);
          });
        } catch (error) {
          // Invalid JSON-LD is common; the other signals still apply.
        }
      });
    return types;
  }

  // RTL marks real articles og:type=video.other, so og:type alone is not
  // enough. Sites with a regexPath (Klubrádió) render client-side and have no
  // markup to read, so the matched path is the signal there.
  function isArticle(doc, site) {
    var og = doc.querySelector('meta[property="og:type"]');
    if (og && og.getAttribute("content") === "article") return true;
    var types = jsonLdTypes(doc);
    if (
      ARTICLE_LD.some(function (type) {
        return types.indexOf(type) !== -1;
      })
    ) {
      return true;
    }
    return !!site.regexPath;
  }

  // Where the block goes: the article that holds the page's h1 (listing pages
  // and sidebars have other <article>s), else <main>, else the page's footer.
  // Inside a container the block goes before its last footer, else at its end.
  // It always ends up inside <body>.
  function findInsertion(doc) {
    var h1 = doc.querySelector("h1");
    var container = null;
    var articles = [].slice.call(doc.querySelectorAll("article"));
    if (h1) {
      container = articles.filter(function (article) {
        return article.contains(h1);
      })[0];
    }
    container = container || (articles.length === 1 ? articles[0] : null);
    container = container || doc.querySelector("main");
    var scope = container || doc.body;
    var footers = scope.querySelectorAll("footer");
    var footer = footers[footers.length - 1];
    if (footer && footer.parentNode) {
      return { parent: footer.parentNode, before: footer };
    }
    return { parent: scope, before: null };
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function pageTitle(doc) {
    var og = doc.querySelector('meta[property="og:title"]');
    return (og && og.getAttribute("content")) || doc.title || "";
  }

  function storedAutoload() {
    try {
      return localStorage.getItem(AUTOLOAD_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function storeAutoload(on) {
    try {
      localStorage.setItem(AUTOLOAD_KEY, on ? "1" : "0");
    } catch (error) {
      // Private mode: the setting then lasts only for this page.
    }
  }

  // Loads the page-world helper once. Disqus reads its settings from page
  // globals, which a content script cannot set, so a script file from the
  // extension (exempt from the page's CSP) does it on our event.
  var helperReady = null;
  function ensureHelper() {
    if (!helperReady) {
      helperReady = new Promise(function (resolve) {
        var script = document.createElement("script");
        script.src = chrome.runtime.getURL("444hsz_multisite_inject.js");
        script.onload = resolve;
        script.onerror = resolve;
        (document.head || document.documentElement).appendChild(script);
      });
    }
    return helperReady;
  }

  async function loadComments(site, shortname) {
    await ensureHelper();
    // The detail is a JSON string: objects do not cross the isolated world.
    document.dispatchEvent(
      new CustomEvent(LOAD_EVENT, {
        detail: JSON.stringify({
          shortname: shortname,
          url: Sites.threadUrl(site, location.href),
          title: Sites.threadTitle(site, pageTitle(document)),
        }),
      }),
    );
  }

  function buildBlock(site, shortname) {
    var block = element("section", "hsz444-comments");
    block.id = BLOCK_ID;
    var accent = site.style && site.style.accentColor;
    if (accent) block.style.setProperty("--hsz444-accent", accent);
    var title = element("div", "hsz444-title");
    title.append(
      element("strong", "", "Hozzászólások"),
      element("span", "hsz444-forum", "444hsz"),
    );
    var show = element("button", "hsz444-show", "Kommentek mutatása");
    show.type = "button";
    var auto = element("label", "hsz444-auto");
    var check = element("input");
    check.type = "checkbox";
    check.checked = storedAutoload();
    auto.append(check, " Kommentek automatikus betöltése");
    var thread = element("div");
    thread.id = "disqus_thread";
    var loaded = false;
    function start() {
      if (loaded) return;
      loaded = true;
      show.hidden = true;
      loadComments(site, shortname).catch(function (error) {
        log("Comments could not be loaded: " + error.message);
      });
    }
    show.addEventListener("click", start);
    check.addEventListener("change", function () {
      storeAutoload(check.checked);
    });
    block.append(title, show, auto, thread);
    return {
      block: block,
      start: start,
      autoload: check,
      started: function () {
        return loaded;
      },
    };
  }

  // The block we want on the page right now, or null on pages without one.
  var current = null;
  var restores = 0;
  var safeSpot = false;

  function removeBlock() {
    current = null;
    var old = document.getElementById(BLOCK_ID);
    if (old) old.remove();
  }

  // Inserts the block if this is an article page. Returns true once handled.
  // `resume` starts loading at once, for a block that replaces one already in use.
  function mount(site, shortname, resume) {
    removeBlock();
    if (!isArticle(document, site)) return false;
    // After the page has thrown the block away twice, stop fighting its
    // renderer and use the end of <body>, which no framework manages.
    var where = safeSpot
      ? { parent: document.body, before: null }
      : findInsertion(document);
    var built = buildBlock(site, shortname);
    where.parent.insertBefore(built.block, where.before);
    current = { site: site, shortname: shortname, built: built };
    log("Comments block inserted for " + site.slug);
    if (resume || built.autoload.checked) built.start();
    return true;
  }

  // Vue/Nuxt sites (Telex) rebuild their page after our first run and drop
  // nodes they do not know. Put the block back when that happens, a limited
  // number of times, so a page that keeps removing it cannot loop us.
  var restoreTimer = null;
  function watchRemoval() {
    if (typeof MutationObserver === "undefined") return;
    new MutationObserver(function () {
      if (!current || current.built.block.isConnected || restoreTimer) return;
      restoreTimer = setTimeout(function () {
        restoreTimer = null;
        if (!current || current.built.block.isConnected) return;
        if (++restores > MAX_RESTORES) return;
        if (restores >= 2) safeSpot = true;
        log("Comments block was removed by the page, inserting it again");
        mount(current.site, current.shortname, current.built.started());
      }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Article markup often arrives after the first run (client rendering), so
  // retry briefly before concluding that this is not an article.
  function mountWithRetries(site, shortname, attempt) {
    if (mount(site, shortname) || attempt >= RETRIES) return;
    setTimeout(function () {
      mountWithRetries(site, shortname, attempt + 1);
    }, 500);
  }

  // Single-page sites change the address without a reload: watch it, and
  // build the block again for the new article.
  function watchNavigation(site, shortname) {
    var last = location.href;
    setInterval(function () {
      if (location.href === last) return;
      last = location.href;
      removeBlock();
      // The path may now belong to a section the site's rules do not accept.
      if (Sites.findSite([site], location.hostname, location.pathname)) {
        mountWithRetries(site, shortname, 0);
      }
    }, 1000);
  }

  async function run() {
    var response = await fetch(chrome.runtime.getURL("sites.json"));
    var data = await response.json();
    var site = Sites.findSite(data.sites, location.hostname, location.pathname);
    if (!site) return null;
    log("Site: " + site.slug);
    mountWithRetries(site, data.shortname, 0);
    watchNavigation(site, data.shortname);
    watchRemoval();
    return site;
  }

  var api = { run: run, isArticle: isArticle, findInsertion: findInsertion };
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
