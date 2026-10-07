// Runs in the page, not in the extension's isolated world: Disqus reads its
// settings from page globals. Waits for the content script's load event.
(function () {
  var LOAD_EVENT = "444hsz:load";

  function configure(settings) {
    window.disqus_shortname = settings.shortname;
    window.disqus_url = settings.url;
    // Only url and title: no identifier, so threads made by 444hsz.com
    // (identifier = URL) and by this extension (none) are both found.
    window.disqus_config = function () {
      this.page.url = settings.url;
      this.page.title = settings.title;
    };
  }

  function load(settings) {
    configure(settings);
    if (window.DISQUS && window.DISQUS.reset) {
      // A single-page site moved to another article: reuse the loaded embed.
      window.DISQUS.reset({ reload: true, config: window.disqus_config });
      return;
    }
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://" + settings.shortname + ".disqus.com/embed.js";
    script.setAttribute("data-timestamp", String(+new Date()));
    (document.head || document.body).appendChild(script);
  }

  document.addEventListener(LOAD_EVENT, function (event) {
    var settings;
    try {
      settings = JSON.parse(event.detail);
    } catch (error) {
      return;
    }
    // The forum name ends up in a script URL, so it must stay a single subdomain.
    if (/^[a-z0-9-]+$/.test(settings.shortname)) load(settings);
  });

  var api = { load: load };
  globalThis.Hsz444MultisiteInject = api;
  if (typeof module !== "undefined") module.exports = api;
})();
