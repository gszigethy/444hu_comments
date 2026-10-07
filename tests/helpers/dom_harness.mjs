import { readFile } from "node:fs/promises";
import { createContext, Script, SourceTextModule } from "node:vm";
import { JSDOM } from "../../.github/ci/node-tools/node_modules/jsdom/lib/api.js";

export function domHarness(
  t,
  {
    html = '<main><div id="comments"></div></main>',
    hostname = "444.hu",
    hash = "",
    settings = {},
    route = "main--reader.post",
  } = {},
) {
  const dom = new JSDOM(
    `<head><meta name="444hsz-extension-baseurl" content="chrome-extension://test/"><meta name="444hsz-extension-version" content="test"></head><body>${html}</body>`,
    { url: `https://${hostname}/2026/10/07/article${hash}` },
  );
  const { window } = dom;
  window.scroll = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () {
    this.scrolled = true;
  };
  for (const [key, value] of Object.entries(settings))
    window.localStorage.setItem(key, value);
  const timers = new Map();
  let timerId = 0;
  const observers = [];
  const router = {
    currentRouteName: route,
    url: "/2026/10/07/article",
    get(key) {
      if (key === "currentURL") return this.url;
      return {
        "currentRoute.params.slug": "article",
        "currentRoute.params.year": "2026",
        "currentRoute.params.month": "10",
        "currentRoute.params.day": "07",
      }[key];
    },
    addObserver(key, target, method) {
      observers.push(() => target[method](this, key));
    },
  };
  const globals = {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    XPathResult: window.XPathResult,
    localStorage: window.localStorage,
    requirejs: function () {
      return {
        default: {
          NAMESPACES: [{ name: "n3", __container__: { lookup: () => router } }],
        },
      };
    },
    require: () => ({ default() {} }),
    setTimeout: (callback, delay) => {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const context = createContext({ ...globals, console });
  t.after(() => window.close());
  async function moduleFrom(path) {
    const module = new SourceTextModule(await readFile(path, "utf8"), {
      context,
      identifier: path.pathname,
    });
    await module.link((specifier) => moduleFrom(new URL(specifier, path)));
    return module;
  }
  return {
    window,
    document: window.document,
    router,
    timers,
    observers,
    context,
    async load(file) {
      const path = new URL(`../../${file}`, import.meta.url);
      if (file.endsWith("_legacy.js"))
        new Script(await readFile(path, "utf8"), {
          filename: path.pathname,
        }).runInContext(context);
      else await (await moduleFrom(path)).evaluate();
      await this.settle();
    },
    async settle() {
      for (let i = 0; i < 12; i++) await Promise.resolve();
    },
    async tick(delay) {
      const due = [...timers].filter(([, timer]) => timer.delay === delay);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
        await this.settle();
      }
    },
    async navigate(url) {
      router.url = url;
      for (const notify of observers) notify();
      await this.tick(1000);
    },
  };
}
