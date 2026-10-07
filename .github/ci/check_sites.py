"""Compare the live 444hsz.com site list with the bundled sites.json.

On a difference the script opens one GitHub issue (label sites-sync), or adds
a comment to the one that is already open. Run with --update to refresh
sites.json after reviewing the difference.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

CONFIG_URL = "https://444hsz.com/assets/config/app-settings.json"
LABEL = "sites-sync"
# Only fields that change what the extension does; style, defaultImage and
# the doodle colors are cosmetic and would only create noise.
RELEVANT = ("slug", "title", "label", "domain", "regex", "regexPath", "transforms", "addPostfix", "noSubmit")
MARKER = "<!-- sites-sync-diff:"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "444hu_comments-sites-sync"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def snapshot(raw, url=CONFIG_URL, now=None):
    """Build the sites.json document; refuse anything that doesn't look like the real config."""
    config = json.loads(raw)
    disqus = config["disqus"]
    sites = disqus["allowedSites"]["444hsz"]
    # A truncated or reshaped config must fail the run, not report "all sites removed".
    if not sites or not all(isinstance(s, dict) and s.get("slug") and s.get("regex") for s in sites):
        raise ValueError("allowedSites.444hsz is empty or malformed")
    now = now or datetime.datetime.now(datetime.timezone.utc)
    return {
        "source": url,
        "fetchedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "shortname": disqus["shortname"],
        "sites": sites,
    }


def relevant(site):
    return {key: site[key] for key in RELEVANT if key in site}


def compare(old, new):
    """Return {added, removed, changed, shortname}; an empty result means no relevant change."""
    before = {s["slug"]: relevant(s) for s in old["sites"]}
    after = {s["slug"]: relevant(s) for s in new["sites"]}
    diff = {
        "added": sorted(after.keys() - before.keys()),
        "removed": sorted(before.keys() - after.keys()),
        "changed": {},
    }
    for slug in sorted(before.keys() & after.keys()):
        fields = {}
        for key in sorted(before[slug].keys() | after[slug].keys()):
            if before[slug].get(key) != after[slug].get(key):
                fields[key] = [before[slug].get(key), after[slug].get(key)]
        if fields:
            diff["changed"][slug] = fields
    if old.get("shortname") != new.get("shortname"):
        diff["shortname"] = [old.get("shortname"), new.get("shortname")]
    if not (diff["added"] or diff["removed"] or diff["changed"] or "shortname" in diff):
        return {}
    return diff


def diff_hash(diff):
    return hashlib.sha256(json.dumps(diff, sort_keys=True).encode()).hexdigest()[:16]


def render(diff, new):
    """Markdown for the issue body or comment, ending with a hash marker used for deduplication."""
    lines = []
    if diff["added"]:
        lines.append("**New sites:** " + ", ".join(f"`{slug}`" for slug in diff["added"]))
    if diff["removed"]:
        lines.append("**Removed sites:** " + ", ".join(f"`{slug}`" for slug in diff["removed"]))
    for slug, fields in diff["changed"].items():
        lines.append(f"**Changed `{slug}`:**")
        for key, (before, after) in fields.items():
            lines.append(f"- `{key}`: `{json.dumps(before, ensure_ascii=False)}` → `{json.dumps(after, ensure_ascii=False)}`")
    if "shortname" in diff:
        before, after = diff["shortname"]
        lines.append(f"**Disqus forum shortname:** `{before}` → `{after}`")
    flagged = [s["slug"] for s in new["sites"] if s.get("noSubmit") and s["slug"] in diff["added"]]
    if any("noSubmit" in fields for fields in diff["changed"].values()) or flagged:
        lines.append("\n⚠️ **`noSubmit` changed.** Read the legal note in `docs/fejlesztoi-dokumentacio.md` before enabling a site.")
    lines.append(f"\nSource: {new['source']} (sha256 `{new['sourceSha256'][:12]}`)")
    lines.append(f"\n{MARKER} {diff_hash(diff)} -->")
    return "\n".join(lines)


CHECKLIST = """

### To do
- [ ] Review the difference above (legal: `noSubmit` sites stay excluded)
- [ ] `python .github/ci/check_sites.py --update`, then review the `sites.json` diff
- [ ] Check the origin patterns and per-site notes for new or changed sites
- [ ] Open a PR, run the manual tests, release
"""


def github(method, path, token, body=None):
    request = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": "444hu_comments-sites-sync"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read() or "null")


def report(diff, new, repo, token, api=github):
    """Create the issue, or comment on the open one unless it already shows this exact difference."""
    text = render(diff, new)
    issues = api("GET", f"/repos/{repo}/issues?labels={LABEL}&state=open&per_page=1", token)
    if not issues:
        api("POST", f"/repos/{repo}/issues", token, {"title": "444hsz.com site list changed", "body": text + CHECKLIST, "labels": [LABEL]})
        return "created"
    issue = issues[0]
    marker = f"{MARKER} {diff_hash(diff)} -->"
    comments = api("GET", f"/repos/{repo}/issues/{issue['number']}/comments?per_page=100", token)
    # The scheduled run repeats daily; say it once per distinct difference.
    if marker in (issue.get("body") or "") or any(marker in (c.get("body") or "") for c in comments):
        return "unchanged"
    api("POST", f"/repos/{repo}/issues/{issue['number']}/comments", token, {"body": text})
    return "commented"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sites", default="sites.json", help="bundled snapshot")
    parser.add_argument("--url", default=CONFIG_URL, help="live config URL")
    parser.add_argument("--config-file", help="read the config from a file instead of the network")
    parser.add_argument("--update", action="store_true", help="rewrite the snapshot when it differs")
    args = parser.parse_args(argv)

    try:
        raw = Path(args.config_file).read_bytes() if args.config_file else fetch(args.url)
        new = snapshot(raw, args.url)
    except (OSError, urllib.error.URLError, ValueError, KeyError) as error:
        # Outages and reshaped configs fail the run instead of opening a misleading issue.
        print(f"Could not read the live site list: {error}", file=sys.stderr)
        return 1

    if args.update and not Path(args.sites).exists():
        Path(args.sites).write_text(json.dumps(new, ensure_ascii=False, indent=2) + "\n")
        print(f"Created {args.sites}")
        return 0
    old = json.loads(Path(args.sites).read_text())
    diff = compare(old, new)
    if not diff:
        print("sites.json is up to date")
        return 0
    print(render(diff, new))

    if args.update:
        Path(args.sites).write_text(json.dumps(new, ensure_ascii=False, indent=2) + "\n")
        print(f"Updated {args.sites}")
        return 0
    token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if token and repo:
        print(f"Issue: {report(diff, new, repo, token)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
