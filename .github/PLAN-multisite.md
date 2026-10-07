# Work instruction: support every 444hsz.com site in the extension

Status: approved 2026-10-07, implementation in progress (one PR per step
below). Sources: the live 444hsz.com bundle (`main.2543029d8e7294de.js`),
`https://444hsz.com/assets/config/app-settings.json`, and the read-only
`/api/GetArticleFeed` and `/api/SearchArticle` endpoints.

## Goal

On any article from a site that 444hsz.com accepts, and only on sites the
user has switched on, the extension shows the 444hsz Disqus thread for that
article. The first comment creates the thread if it doesn't exist yet. The
existing 444.hu behavior is unchanged.

## Decisions (agreed 2026-10-07)

| # | Decision |
| --- | --- |
| 1 | **Per-site opt-in for every site, 444.hu included**: optional host permissions, switched on and off on an **options page** modeled on the 444hsz.com site filter. |
| 2 | **Bundled copy** of the site list, plus a scheduled GitHub Action that opens an issue when the live list changes. |
| 3 | One "444hsz" Disqus block on other sites, with no official-forum tab, reusing the current UI. |
| 4 | **No test posting** by Claude, including to `444hsz-teszt`. Live checks by Claude are read-only. |
| 5 | Distribution stays **GitHub releases only**. The owner runs manual tests on the CI ZIP before any release. |
| — | Every change goes in through a PR with a full description. The code is commented in the existing style. |

## Facts established from 444hsz.com

### Supported sites (`disqus.allowedSites.444hsz`, 26 entries)

The host is matched with `new RegExp("^" + regex + "$")`. The optional
`regexPath` is matched against the start of the pathname. `noSubmit: true`
means new threads are not allowed.

| Site | Host regex | Extra |
| --- | --- | --- |
| 444.hu és blogjai | `(\w+\.)?444\.hu` | transform drops `?appview`; already supported, becomes opt-in like the others (excluding `kor.` and `membership.`) |
| Qubit | `qubit\.hu` | |
| Telex | `telex\.hu` | addPostfix |
| Transtelex | `transtelex\.ro` | addPostfix |
| 24 | `(\w+\.)?24\.hu` | subdomains e.g. `ng.24.hu`, `sokszinuvidek.24.hu` |
| Szabad Európa | `www\.szabadeuropa\.hu` | addPostfix |
| RTL | `rtl\.hu` | addPostfix |
| Lakmusz | `www\.lakmusz\.hu` | |
| Mérce | `(\w+\.)?merce\.hu` | |
| Forbes | `(\w+\.)?forbes\.hu` | |
| Media1 | `(\w+\.)?media1\.hu` | `useScraper: false` |
| The Guardian | `(\w+\.)?theguardian\.com` | addPostfix |
| Magyar Hang | `(\w+\.)?hang\.hu` | addPostfix |
| Magyar Narancs | `(\w+\.)?magyarnarancs\.hu` | addPostfix |
| Rakéta | `(\w+\.)?raketa\.hu` | addPostfix |
| G7 | `(\w+\.)?g7\.hu` | |
| Válasz Online | `www\.valaszonline\.hu` | |
| Klubrádió | `www\.klubradio\.hu` | regexPath `/adasok/\|/hirek/\|/szabadsag-klub/`, addPostfix |
| Népszava | `nepszava\.hu` | addPostfix |
| Menedzsment Fórum | `mfor\.hu` | addPostfix |
| Átlátszó | `atlatszo\.hu` | |
| Kontroll | `kontroll\.hu` | |
| Amerikai Népszava | `nepszava\.us` | addPostfix |
| hvg | `(\w+\.)?hvg\.hu` | **noSubmit**: excluded after a copyright complaint to Disqus |
| Eduline | `(\w+\.)?eduline\.hu` | **noSubmit**: same complaint |
| 444hsz | `444hsz\.com` | the hub, noSubmit, excluded |

That is 23 opt-in sites: 444.hu plus 22 new ones. Every `noSubmit` entry is excluded,
and this rule is applied by code, not by hand-editing the list.

### Disqus parameters that 444hsz.com uses

- Forum shortname `444hsz`.
- **New threads.** When an article is submitted on the site, the app sets
  `url` to the URL after `transforms`, cut at `?`. `identifier` falls back
  to that URL. `title` is the article title, plus ` | {site.title}` when
  `addPostfix` is set.
- **Existing threads.** The feed shows 444hsz.com threads with
  `identifiers == [link]`. 444.hu threads created by this extension have
  `identifiers == []`, because the extension sends only `disqus_url`.
- **Rule: send `url` only, with no identifier.** That matches both kinds of
  thread. Sending an identifier risks duplicate threads.
- The owner's bookmarklet sends `identifier = btoa(last path segment)`. That
  matches neither kind, so we report it to the owner and don't copy it.
- The API sends no CORS headers, and the extension does not need it.

## Decision 1 in detail: every site opt-in, options page

### How it works in Manifest V3

- **No required host permissions.** All 23 sites, 444.hu included, go in
  `optional_host_permissions`. There are no static `content_scripts`; Chrome
  treats static matches as required permissions.
- A **background service worker** registers and unregisters the per-site
  content scripts with `chrome.scripting.registerContentScripts`, driven by
  `chrome.permissions.onAdded` and `onRemoved`. It re-syncs on
  `runtime.onInstalled` and `onStartup`. 444.hu keeps its current bootstrap
  and its `kor.`/`membership.` exclusions (`excludeMatches`). The other sites
  get the generic one.
- New manifest entries: `scripting` (no install warning), `storage`,
  `background.service_worker`, and `options_ui` (`open_in_tab: true`).
  Clicking the toolbar icon opens the options page as well.
- **Options page** (Hungarian), modeled on the 444hsz.com site filter
  ("N oldal kikapcsolva"):
  - one switch or chip per site, with name, accent color and domain, sorted
    by label like 444hsz.com;
  - "Mind be" / "Mind ki" buttons;
  - a short note on what switching on means: the extension can read that
    site's pages, and Disqus loads there;
  - the excluded sites (hvg, Eduline) are shown greyed out, with the reason.
- Switching on calls `chrome.permissions.request` for that site's origins
  from the click handler. The browser shows its own prompt. Switching off
  calls `chrome.permissions.remove`.
- "Mind be" makes **one** `permissions.request` call with every origin not
  yet granted, so the browser shows a **single prompt** listing the sites,
  and Chrome may summarise a long list. "Mind ki" makes one
  `permissions.remove` call, which **shows no prompt**. The prompt wording in
  each browser is checked in the owner's manual test.
- **The permission is the switch.** The page reads `chrome.permissions.getAll`,
  so access revoked in the browser's own settings also shows as off. There is
  no second on/off flag that could drift.
- **Origins per site** come from the regex. `(\w+\.)?telex\.hu` becomes
  `*://*.telex.hu/*`, which in a browser match pattern also covers the bare
  host `telex.hu`. `www\.lakmusz\.hu` becomes `*://www.lakmusz.hu/*`. A
  unit-tested converter produces them, with a test that each pattern covers
  the hosts the regex accepts. `*.` allows several subdomain levels where the
  regex allows one, so content scripts re-check the host with the real regex.

### First install and upgrading existing users

- **New install:** nothing is on. `onInstalled` (reason `install`) opens the
  options page, so the user picks their sites. The page suggests 444.hu.
- **Upgrade from ≤1.4.x:** these users have 444.hu as a required, already
  granted permission. Whether Chrome and Firefox keep that grant when it
  moves to the optional list is **not verified**. The plan handles both
  cases:
  - on `onInstalled` (reason `update`), check
    `chrome.permissions.contains` for 444.hu;
  - if it's still granted, register the 444.hu script, so the user keeps
    working comments with no action needed;
  - if it isn't granted, open the options page with a Hungarian notice
    ("A 444.hu kommentekhez kapcsold be újra az oldalt").

  This is a mandatory item in the owner's manual test: install 1.4.0.27,
  then update to the new ZIP in place, in both browsers.

### Import the starting selection from 444hsz.com (agreed)

- 444hsz.com keeps its feed site filter in **localStorage, not cookies**. The
  key is `settingsData`, and the filter is at `articleFeed.filters.sites`, an
  array of site objects with `slug`. An empty array means "all sites". It's
  per browser and per profile, and only exists if the user has visited
  444hsz.com.
- An extension can read another site's localStorage only by running a script
  on that site. It needs host access to `444hsz.com`, which is also requested
  as an optional permission, and an open 444hsz.com tab to run in.
- Flow, triggered by an "Importálás a 444hsz.com-ról" button on the options
  page:
  1. request the `444hsz.com` permission from the click;
  2. reuse an open 444hsz.com tab, or open one in the background;
  3. run `chrome.scripting.executeScript` there to read and parse
     `settingsData`;
  4. close the tab if we opened it, and remove the `444hsz.com` permission
     again;
  5. map the slugs to our sites. An empty filter means all sites; `noSubmit`
     sites are ignored.
- The import only **preselects** the switches. The user then clicks
  "Kiválasztottak bekapcsolása", which calls `permissions.request`. A second
  click is needed because the user gesture from the first click doesn't
  survive the asynchronous tab round trip.
- Semantics caveat: the 444hsz.com filter means "which sites' articles
  appear in my feed", not "where to show comments". It's a reasonable
  starting point, but the page says so.
- If the data is missing, unparseable or in an unknown format, the page
  shows "Nincs importálható beállítás" and changes nothing. The format is
  internal to 444hsz.com, so the sync Action can't detect format changes.
  The parser is defensive and unit-tested.

### Advantages

- The user is fully in control. The extension touches only the sites the
  user switched on, 444.hu included.
- A clean install has no permission warnings. Adding future sites from the
  444hsz list prompts nobody.
- It matches how Firefox MV3 already treats host access: users can grant
  and revoke per site.

### Drawbacks and costs

1. **Works only after setup.** A new user sees nothing until they switch on
   a site. Opening the options page on install, the toolbar icon and the
   README cover this.
2. **Upgrade risk for 444.hu users**, described above. In the worst case,
   existing users must switch 444.hu on once.
3. **More moving parts.** The extension gains a service worker, an options
   page and dynamic registration, which means more code and browser-API
   stubs in the test harness. The 444.hu bootstrap moves from a static to a
   registered content script. Its own logic is unchanged and stays covered
   by the existing tests.
4. **Registration drift** after browser updates, extension reloads or a
   revoke in browser settings. We re-sync on every start, and the content
   script checks its host against the bundled list.
5. **Browser differences.** Firefox supports `optional_host_permissions`
   and `scripting.registerContentScripts`; `persistAcrossSessions` and the
   options-page behavior are checked in the owner's Firefox test.
6. **Settings per site.** The Disqus UI settings (autoload, sidebar) stay
   per site in page `localStorage`. Sharing them across sites through
   `chrome.storage` is a separate follow-up PR.
7. **Revoked mid-session.** If access is revoked, already-open tabs keep the
   block until they're reloaded.

## Decision 2 in detail: config sync Action

Yes. Design:

- `sites.json` in the repo holds a copy of `allowedSites`, plus a recorded
  `sourceSha256` and `fetchedAt`.
- `.github/workflows/sites-sync.yml` runs on `schedule` (daily) and on
  `workflow_dispatch`. Permissions: `contents: read`, `issues: write`.
- Script `.github/ci/check_sites.py`:
  - fetches the live config;
  - compares the fields that matter (`regex`, `regexPath`, `transforms`,
    `addPostfix`, `noSubmit`, `title`, `slug`, the list of entries, and
    `disqus.shortname`), ignoring cosmetic fields such as `style` and
    `defaultImage`;
  - reports added, removed and changed sites.
- On a difference, it searches for an open issue labeled `sites-sync`. If one
  exists it adds a comment with the new diff; otherwise it creates an issue
  with the diff and a checklist (update `sites.json`, update the origin
  mapping, review legal/noSubmit changes, release). There is one issue at a
  time and no duplicates.
- Fetch errors only fail the run, so temporary outages don't produce issues.
- Unit tests for the diff/dedupe logic with recorded configs, in the
  existing Python test suite.
- Caveat: GitHub disables scheduled workflows in a public repository after
  60 days without activity, and you get an email when that happens. Re-enable
  with one click or by pushing.

## Implementation steps, one PR each

Each PR has a description of the change, its tests, its validation results
and its limits. Code is commented in the existing style: comments explain
why, and briefly. Merge follows a green `quality` check.

1. **PR A: site list and sync Action.** `sites.json`, the shared
   matcher/normalizer (`444hsz_sites.js`: host and path matching,
   `transforms`, the cut at `?`/`#`, the title postfix, origin patterns),
   `check_sites.py`, the workflow, and tests. URL normalization is tested
   against real feed links, where the result must equal
   `thread.identifiers[0]`. No behavior change for users.
2. **PR B: per-site recon (docs and fixtures only).** For each site: article
   detection signals, insertion anchor, SPA or not, CSP `script-src` (does
   it allow `*.disqus.com`?), consent/paywall notes, and canonical URL versus
   the served URL. Trimmed HTML fixtures go under `tests/fixtures/sites/`,
   with a results table in the developer doc. Sites whose CSP blocks Disqus
   are marked unsupported.
3. **PR C: permissions and options page.** Manifest (all sites in
   `optional_host_permissions`, no static content scripts, `scripting`,
   `storage`, service worker, `options_ui`, Gecko id), service-worker
   registration sync, the 444.hu bootstrap moved to dynamic registration
   with its exclusions, the upgrade path for ≤1.4.x users, the Hungarian
   options page, and tests with chrome-API stubs. 444.hu works as before
   once it is switched on. The generic content script is a no-op stub in
   this PR.
3b. **PR C2: import from 444hsz.com.** The flow described in
   Decision 1, plus parser tests against recorded `settingsData` samples.
4. **PR D: generic frontend.** `444hsz_multisite_inject.js`:
   - article detection (per-site selector, otherwise `og:type`/JSON-LD);
   - insertion at the anchor, otherwise the end of `<article>`, otherwise
     before `<footer>`, always inside `<body>`;
   - Disqus with `url` only, the `444hsz` forum (or the user's custom
     forum), and the title with postfix;
   - SPA navigation handling (watch `location.href`, then `DISQUS.reset` or
     re-insert);
   - reused styling with the site accent color.

   jsdom tests per fixture: detection, insertion, SPA re-navigation and a
   no-op on homepages. The coverage thresholds apply to the new files.
5. **PR E: docs.** The Hungarian README and docs get the supported-site list,
   how to switch sites on, privacy notes (Disqus loads only on enabled
   sites), and the excluded sites with the reason.
6. **Review build and owner manual tests.** CI uploads the
   `chrome-extension` ZIP for the PR or `master` build. Claude provides a
   Hungarian/English test checklist covering:
   - a clean install: the options page opens and no site is on;
   - an in-place upgrade from 1.4.0.27: does 444.hu keep working, or does the
     re-enable notice appear;

   and, per site:
   - switch on and off on the options page, plus revoke in browser settings;
   - the block appears on an article and not on the homepage;
   - the comment count equals the 444hsz.com feed (`thread.posts`);
   - a new thread is created correctly on a first comment;
   - CSP, dark mode and the sidebar;
   - the same on Firefox.

   Claude's own live checks are read-only: page structure and comparing the
   computed thread URL with feed links. No comments are posted.
7. **Release** `1.5.0.0` through a version-bump PR, then the tag and the
   GitHub release with the ZIP. This happens only after the owner confirms
   the manual tests.

## Open items

- **Disqus trusted domains.** If the 444hsz forum's trusted-domains list
  doesn't include a host, Disqus refuses to load there. Only the 444hsz
  admins can fix it, so the owner's tests report any failing site.
- **Duplicate threads** if our URL normalization differs from 444hsz.com's.
  This is mitigated by the feed-identifier tests and confirmed in the
  owner's manual test.
- **Legal.** `noSubmit` sites stay excluded automatically, and the sync
  issue flags any change to `noSubmit`.
- **Bookmarklet.** Tell the 444hsz owner about the identifier mismatch and
  the crash on URLs that end in `/`. This is outside this repo.
