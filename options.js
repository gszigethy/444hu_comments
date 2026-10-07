// Options page: one switch per site, backed by the browser's optional host
// permissions. The permission is the switch, so access revoked in the browser's
// own settings shows up here as off, and nothing is stored by this page.
(function () {
  var Sites = globalThis.Hsz444Sites;
  var Import = globalThis.Hsz444Import;
  // pending: slugs preselected by the import, not yet switched on.
  var state = { sites: [], excluded: [], granted: {}, pending: [] };

  var NOTICES = {
    "#telepites":
      "Üdv! Válaszd ki az oldalakat, ahol látni szeretnéd a 444hsz kommenteket. Kezdésnek a 444.hu ajánlott.",
    "#frissites":
      "A 444.hu kommentekhez kapcsold be újra az oldalt: az új verzió minden oldalt külön engedélyhez köt.",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function patterns(sites) {
    return sites.map(Sites.originPattern);
  }

  function showMessage(text) {
    var message = $("message");
    message.textContent = text;
    message.hidden = !text;
  }

  // Shown when the browser prompt was declined, with the recovery help opened.
  function showDenied() {
    showMessage(
      "A böngésző nem engedélyezte az oldalt. Ha véletlenül a „Tiltás” gombra kattintottál, kapcsold be újra, vagy lásd az alábbi súgót.",
    );
    $("help").open = true;
  }

  function render() {
    var list = $("sites");
    list.textContent = "";
    var on = 0;
    state.sites.forEach(function (site) {
      var granted = !!state.granted[site.slug];
      if (granted) on++;
      var item = element("li");
      var label = element("label", "site");
      var input = element("input");
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.checked = granted;
      input.addEventListener("change", function () {
        toggle(site);
      });
      var swatch = element("span", "swatch");
      var marked = !granted && state.pending.indexOf(site.slug) !== -1;
      swatch.style.background =
        (site.style && site.style.accentColor) || "#29af0a";
      label.append(
        input,
        swatch,
        element("span", "name", site.title),
        element("span", "domain", site.domain),
      );
      if (marked) label.appendChild(element("span", "badge", "kijelölve"));
      item.appendChild(label);
      list.appendChild(item);
    });
    $("summary").textContent =
      on + " / " + state.sites.length + " oldal bekapcsolva";

    var excluded = $("excluded");
    excluded.textContent = "";
    state.excluded.forEach(function (site) {
      var item = element("li", "site off");
      item.append(
        element("span", "name", site.title),
        element("span", "domain", site.domain),
        element(
          "span",
          "reason",
          "Szerzői jogi panasz miatt a 444hsz sem engedi itt új szál létrehozását.",
        ),
      );
      excluded.appendChild(item);
    });
    $("excluded").previousElementSibling.hidden = !state.excluded.length;
    renderImport();
  }

  // Imported slugs that are not switched on yet.
  function pendingSites() {
    return state.sites.filter(function (site) {
      return (
        state.pending.indexOf(site.slug) !== -1 && !state.granted[site.slug]
      );
    });
  }

  function renderImport() {
    var sites = pendingSites();
    $("import-result").hidden = !sites.length;
    $("import-text").textContent = sites.length
      ? "Importált kijelölés: " +
        sites
          .map(function (site) {
            return site.title;
          })
          .join(", ") +
        ". Ezek még nincsenek bekapcsolva."
      : "";
  }

  function importFailed(text) {
    showMessage(text);
    return Promise.resolve();
  }

  // The import only preselects. Switching on is a second click, because the
  // user gesture of this click does not survive the tab round trip.
  function importSettings() {
    showMessage("");
    return chrome.permissions
      .request({ origins: [Import.ORIGIN] })
      .then(function (ok) {
        if (!ok) {
          return importFailed(
            "Az importáláshoz a 444hsz.com elérése kell. A bővítmény csak a beállítás kiolvasásáig használja, utána visszavonja.",
          );
        }
        return Import.readSettings().then(function (raw) {
          var found = raw && Import.parseSettings(raw, state.sites);
          if (!found) return importFailed("Nincs importálható beállítás.");
          state.pending = found.slugs;
          render();
        });
      })
      .catch(function (error) {
        return importFailed("Az importálás nem sikerült: " + error.message);
      });
  }

  function applyImport() {
    var sites = pendingSites();
    state.pending = [];
    return request(sites);
  }

  function discardImport() {
    state.pending = [];
    render();
  }

  async function refresh() {
    for (var i = 0; i < state.sites.length; i++) {
      var site = state.sites[i];
      state.granted[site.slug] = await chrome.permissions.contains({
        origins: [Sites.originPattern(site)],
      });
    }
    render();
  }

  // permissions.request() must be called straight from the click, so the
  // origins come from the state already loaded, with no awaits before it.
  function request(sites) {
    showMessage("");
    if (!sites.length) return Promise.resolve();
    return chrome.permissions.request({ origins: patterns(sites) }).then(
      function (ok) {
        if (!ok) showDenied();
        return refresh();
      },
      function (error) {
        showMessage("Nem sikerült módosítani az engedélyt: " + error.message);
        return refresh();
      },
    );
  }

  function remove(sites) {
    showMessage("");
    if (!sites.length) return Promise.resolve();
    return chrome.permissions
      .remove({ origins: patterns(sites) })
      .then(refresh);
  }

  function toggle(site) {
    return state.granted[site.slug] ? remove([site]) : request([site]);
  }

  function allOn() {
    return request(
      state.sites.filter(function (site) {
        return !state.granted[site.slug];
      }),
    );
  }

  function allOff() {
    return remove(
      state.sites.filter(function (site) {
        return state.granted[site.slug];
      }),
    );
  }

  async function init() {
    var response = await fetch(chrome.runtime.getURL("sites.json"));
    var all = (await response.json()).sites;
    state.sites = Sites.supportedSites(all).sort(function (a, b) {
      return a.label.localeCompare(b.label, "hu");
    });
    state.excluded = all.filter(function (site) {
      return site.noSubmit && site.slug !== "444hsz";
    });
    var notice = NOTICES[location.hash];
    $("notice").textContent = notice || "";
    $("notice").hidden = !notice;
    $("all-on").addEventListener("click", allOn);
    $("all-off").addEventListener("click", allOff);
    $("import").addEventListener("click", importSettings);
    $("import-apply").addEventListener("click", applyImport);
    $("import-discard").addEventListener("click", discardImport);
    chrome.permissions.onAdded.addListener(refresh);
    chrome.permissions.onRemoved.addListener(refresh);
    await refresh();
  }

  var api = { init: init, state: state, toggle: toggle };
  globalThis.Hsz444Options = api;
  if (typeof module !== "undefined") module.exports = api;
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    document.getElementById("sites")
  ) {
    init().catch(function (error) {
      showMessage("A beállítások betöltése nem sikerült: " + error.message);
    });
  }
})();
