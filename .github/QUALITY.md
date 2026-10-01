# Browser extension CI checks

The workflow runs on pushes, pull requests and manual requests with read-only
repository permissions. GitHub Actions are pinned to immutable commits;
Dependabot checks Action and CI npm dependency updates weekly.

Blocking checks:
- ESLint defect findings compared with the PR base (or previous push commit).
- JavaScript syntax validation for the root extension scripts.
- Manifest V3 version and referenced-resource validation.
- Creation of an extension ZIP containing the manifest and its referenced files.

The lint comparison counts findings by file, rule and message, ignoring line
shifts. It uses the same explicit ESLint configuration on both revisions.
Existing findings remain visible; new findings fail CI. Manual requests and
new branches without a valid previous commit report the current baseline.
The vendored `backburner.js` is excluded from ESLint, but syntax-checked.

Prettier starts as a nonblocking diagnostic. Findings appear in Actions logs;
a green workflow does not mean all existing formatting matches Prettier.
These checks do not replace testing the extension in Chrome on 444.hu.

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
