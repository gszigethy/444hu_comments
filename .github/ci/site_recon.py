"""Read-only reconnaissance of the supported sites: article signals, anchors and CSP.

Fetches one home page and one article per site (GET only, one request at a
time) and prints a JSON report. Used to decide how the generic frontend finds
the article and where it inserts the comments. Nothing is posted anywhere.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".github/ci"))
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0 (444hu_comments recon)"


def get(url, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "hu,en;q=0.8"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(3_000_000).decode(response.headers.get_content_charset() or "utf-8", "replace")
            return response.status, dict(response.headers), body, response.geturl()
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), "", url
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return 0, {}, "", f"{url} ({error})"


class Collector(HTMLParser):
    """Collects links, meta tags, JSON-LD types and the tags that decide the insertion point."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.meta, self.canonical, self.jsonld = [], {}, None, []
        self.tags, self._ld, self.title = {}, False, ""
        self._title = False
        self.ids, self.article_classes = set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags[tag] = self.tags.get(tag, 0) + 1
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "meta":
            key = a.get("property") or a.get("name")
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._ld = True
        elif tag == "title":
            self._title = True
        if tag == "article" and a.get("class"):
            self.article_classes.append(a["class"].split()[0])
        if a.get("id"):
            self.ids.add(a["id"])

    def handle_endtag(self, tag):
        self._ld = self._ld and tag != "script"
        self._title = self._title and tag != "title"

    def handle_data(self, data):
        if self._ld:
            try:
                node = json.loads(data)
            except ValueError:
                return
            for item in node if isinstance(node, list) else node.get("@graph", [node]) if isinstance(node, dict) else []:
                kind = item.get("@type") if isinstance(item, dict) else None
                self.jsonld += kind if isinstance(kind, list) else [kind] if kind else []
        elif self._title:
            self.title += data


LANDMARKS = {"header", "nav", "main", "article", "section", "aside", "footer", "h1", "time"}


class Skeleton(HTMLParser):
    """Keeps only landmark tags (with id/class) and the meta that identifies an article.

    Text, scripts and plain divs are dropped, which keeps the fixture small and free
    of site content while preserving where an <article>, <main> or <footer> sits.
    """

    def __init__(self, url, ld_types=()):
        super().__init__(convert_charrefs=True)
        self.url, self.out, self.stack, self.head = url, [], [], []
        # JSON-LD is kept as its @type values only: it is the article signal on some sites.
        if ld_types:
            self.head.append('<script type="application/ld+json">' + json.dumps({"@graph": [{"@type": t} for t in ld_types]}) + "</script>")

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and (a.get("property") == "og:type"):
            self.head.append(f'<meta property="{a.get("property") or a.get("name")}" content="{(a.get("content") or "")[:80]}">')
        elif tag == "link" and a.get("rel") == "canonical":
            self.head.append(f'<link rel="canonical" href="{a.get("href", "")}">')
        elif tag in LANDMARKS:
            attrs_text = "".join(f' {k}="{a[k].split()[0] if k == "class" and a[k] else a[k]}"' for k in ("id", "class") if a.get(k))
            self.out.append(f"<{tag}{attrs_text}>")
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack:
                top = self.stack.pop()
                self.out.append(f"</{top}>")
                if top == tag:
                    break

    def render(self):
        self.out += [f"</{t}>" for t in reversed(self.stack)]
        return (
            "<!doctype html>\n<!-- Simplified from " + self.url + ": landmarks only, no text. -->\n<html><head>\n"
            + "\n".join(self.head)
            + "\n</head><body>\n"
            + "\n".join(self.out)
            + "\n</body></html>\n"
        )


def analyse(url, status, headers, body, final):
    c = Collector()
    c.feed(body)
    csp = headers.get("Content-Security-Policy") or headers.get("content-security-policy") or ""
    directives = {d.split()[0]: d for d in (x.strip() for x in csp.split(";")) if d}
    script_src = directives.get("script-src") or directives.get("default-src") or ""
    lowered = body.lower()
    return {
        "url": url,
        "status": status,
        "finalUrl": final,
        "bytes": len(body),
        "ogType": c.meta.get("og:type"),
        "jsonLdTypes": sorted(set(c.jsonld)),
        "canonical": c.canonical,
        "canonicalMatchesUrl": bool(c.canonical) and c.canonical.rstrip("/") == final.split("?")[0].rstrip("/"),
        "tags": {t: c.tags.get(t, 0) for t in ("article", "main", "footer", "h1", "time")},
        "articleClasses": c.article_classes[:3],
        "hasCommentsContainer": bool(re.search(r'id="(comments|disqus_thread|commentsSection)"', lowered)),
        "cspPresent": bool(csp),
        "cspScriptSrc": script_src[:300],
        "cspBlocksDisqus": bool(script_src) and not re.search(r"disqus\.com|\*\.disqus|https:\s|https:$|\*(?:\s|;|$)", script_src),
        "poweredBy": headers.get("X-Powered-By") or headers.get("Server"),
        "consentOrPaywall": [w for w in ("cookiebot", "onetrust", "didomi", "sourcepoint", "quantcast", "paywall", "piano", "premium") if w in lowered],
        "frameworks": [w for w in ("__next_data__", "ng-version", "data-reactroot", "__nuxt__", "wp-content", "drupal") if w in lowered],
        "title": c.title.strip()[:120],
    }


def candidate_links(site, home_url, body, supported, sites_mod):
    """Article-looking links on the home page that the matcher accepts for this site."""
    collector = Collector()
    collector.feed(body)
    seen, found = set(), []
    for href in collector.links:
        url = urljoin(home_url, href).split("#")[0]
        parsed = urlparse(url)
        if url in seen or parsed.scheme not in ("http", "https"):
            continue
        seen.add(url)
        match = sites_mod.findSite(supported, parsed.hostname, parsed.path)
        slug_ok = match is not None and match["slug"] == site["slug"]
        segments = [p for p in parsed.path.split("/") if p]
        # Article links are either nested paths or a single long slug (raketa.hu).
        deep = (len(segments) >= 2 or parsed.path.count("-") >= 4) and len(parsed.path) > 25
        if slug_ok and deep and not re.search(r"/(tag|cimke|category|kategoria|author|szerzo|page|oldal|rovat|sorozat|felhasznalo|sport/uefa)/", parsed.path):
            found.append(url)
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="comma separated slugs")
    parser.add_argument("--known", default=str(ROOT / "tests/fixtures/feed_links.json"))
    parser.add_argument("--out", help="write the JSON report here")
    parser.add_argument("--fixtures", help="write simplified HTML skeletons of the articles here")
    parser.add_argument("--delay", type=float, default=1.5)
    args = parser.parse_args()

    # Reuse the matcher through node, so the python side never re-implements the rules.
    import subprocess

    def node_match(sites_json, host, path):
        code = "const S=require('./444hsz_sites.js');const l=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify(S.findSite(l,process.argv[2],process.argv[3])))"
        out = subprocess.run(["node", "-e", code, json.dumps(sites_json), host, path], capture_output=True, text=True, cwd=ROOT, check=True).stdout
        return json.loads(out)

    class Mod:
        @staticmethod
        def findSite(sites, host, path):
            return node_match(sites, host, path)

    data = json.loads((ROOT / "sites.json").read_text())["sites"]
    supported = [s for s in data if not s.get("noSubmit")]
    known = json.loads(Path(args.known).read_text())
    wanted = set(args.only.split(",")) if args.only else None
    report = []
    for site in supported:
        if wanted and site["slug"] not in wanted:
            continue
        home = f"https://{site['domain']}/" if not site["regex"].startswith("www") else f"https://www.{site['domain'].removeprefix('www.')}/"
        entry = {"slug": site["slug"], "title": site["title"], "home": home}
        status, headers, body, final = get(home)
        entry["homeStatus"], entry["homeFinal"] = status, final
        urls = [u for u in known if (urlparse(u).hostname or "").endswith(site["domain"].removeprefix("www."))]
        if not urls and body:
            urls = candidate_links(site, final if status else home, body, supported, Mod)
        entry["candidates"] = urls[:6]
        entry["article"] = None
        # Take the first link that really looks like an article (not a section or login page).
        for url in urls[:6]:
            time.sleep(args.delay)
            status, headers, body, final = get(url)
            if status == 200 and body:
                entry["article"] = analyse(url, status, headers, body, final)
                last_body = (url, body)
                signals = entry["article"]
                if signals["ogType"] == "article" or {"NewsArticle", "Article", "BlogPosting"} & set(signals["jsonLdTypes"]):
                    break
            else:
                entry["article"] = {"url": url, "status": status}
        # A redirect (login wall, section page) would give a misleading fixture.
        if args.fixtures and entry["article"] and entry["article"].get("bytes") and entry["article"]["finalUrl"] == entry["article"]["url"]:
            skeleton = Skeleton(entry["article"]["url"], entry["article"]["jsonLdTypes"])
            skeleton.feed(last_body[1])
            Path(args.fixtures).mkdir(parents=True, exist_ok=True)
            (Path(args.fixtures) / f"{site['slug']}.html").write_text(skeleton.render())
        report.append(entry)
        print(f"{site['slug']}: home {entry['homeStatus']}, article {(entry['article'] or {}).get('status')}", file=sys.stderr)
        time.sleep(args.delay)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n")
    else:
        print(text)


if __name__ == "__main__":
    main()
