# Browser extension CI checks

The workflow runs on pushes, pull requests and manual requests with read-only
repository permissions. GitHub Actions are pinned to immutable commits;
Dependabot checks Action and CI npm dependency updates weekly.

Blocking checks:

- ESLint defect findings compared with the PR base (or previous push commit).
- JavaScript syntax validation for the root extension scripts.
- Bootstrap unit and frontend DOM module tests with per-file coverage thresholds.
- Python regression tests for manifest packaging and lint-baseline behavior.
- Prettier formatting for extension JavaScript, CSS and the manifest.
- SonarQube Cloud quality gate when the analysis token is available.
- Manifest V3 version and referenced-resource validation.
- Creation of an extension ZIP containing the manifest and its referenced files.

The lint comparison counts findings by file, rule and message, ignoring line
shifts. It uses the same explicit ESLint configuration on both revisions.
Existing findings remain visible; new findings fail CI. Manual requests and
new branches without a valid previous commit report the current baseline.
The vendored `backburner.js` is excluded from ESLint, but syntax-checked.

Coverage uses c8 with all three application JavaScript files included, even if
a file is never loaded. Each file must meet 85% line, 80% function and 75% branch
coverage. The vendored Backburner library is exercised by the modern frontend
tests but excluded from application coverage and static analysis.

The DOM harness runs the actual application sources in isolated VM contexts
with jsdom, a stub page router and controlled timers. It does not fetch Disqus,
use credentials or modify a live browser. These checks do not replace testing
the extension in Chrome on 444.hu.

LCOV and HTML reports are uploaded separately from the installable ZIP. Sonar
imports LCOV and waits for the quality gate, so scanner upload success alone
cannot make a failing gate green. Fork PRs cannot access the token; the skip
is reported explicitly. Configure SONAR_TOKEN in repository Actions secrets
and disable Sonar automatic analysis when using this CI scan. Analysis runs
on PRs and the default branch: this organization does not permit access to
quality-gate data for non-main branches. Feature-branch pushes still run all
tests, coverage checks and packaging.

## CI tools and package artifacts

`.github/ci/node-tools/package.json` pins the direct analyzer versions. The npm
lock file pins their transitive dependencies and integrity hashes. CI uses
`npm ci --ignore-scripts` to verify the lock file and avoid package setup scripts.
These tools are not browser-extension dependencies and are not included in the
extension ZIP. To update them locally, edit the CI package versions and run:

```sh
npm install --prefix .github/ci/node-tools --package-lock-only --ignore-scripts
```

Actions uploads `chrome-extension` as a review artifact. It does not publish a
Chrome Web Store release or change the manifest version.

## Local validation (Node 24 and Python 3.13)

```sh
npm ci --prefix .github/ci/node-tools --ignore-scripts --no-audit --no-fund
.github/ci/node-tools/node_modules/.bin/c8 \
  --all --include='444hu_comments*.js' \
  --check-coverage --per-file --lines=85 --functions=80 --branches=75 \
  --reporter=text --reporter=lcov \
  node --experimental-vm-modules --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 .github/ci/package_extension.py
```
