export function createExtensionHarness(hostname) {
  let domContentLoaded;
  const appended = [];

  globalThis.window = {
    location: { hostname },
  };

  globalThis.document = {
    head: {
      appendChild(element) {
        appended.push(element);
        return element;
      },
    },
    addEventListener(eventName, callback) {
      if (eventName === "DOMContentLoaded") {
        domContentLoaded = callback;
      }
    },
    createElement(tagName) {
      return { tagName: tagName.toUpperCase() };
    },
  };

  globalThis.chrome = {
    runtime: {
      getURL(path) {
        return `chrome-extension://test/${path}`;
      },
      getManifest() {
        return { version: "9.9.9" };
      },
    },
  };

  return {
    appended,
    fireDOMContentLoaded() {
      if (!domContentLoaded) {
        throw new Error("DOMContentLoaded handler was not registered");
      }
      domContentLoaded();
    },
  };
}

export function appendedResources(appended) {
  return appended.map((item) => ({
    tagName: item.tagName,
    href: item.href,
    src: item.src,
    name: item.name,
    content: item.content,
  }));
}
