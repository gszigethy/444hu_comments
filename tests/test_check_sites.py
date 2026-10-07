"""Exercise the site-list sync logic offline: diffing, rendering and issue deduplication."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".github/ci"))
import check_sites  # noqa: E402

SITES = json.loads((ROOT / "sites.json").read_text())


def config_bytes(sites, shortname="444hsz"):
    return json.dumps({"disqus": {"shortname": shortname, "allowedSites": {"444hsz": sites}}}).encode()


class CompareTests(unittest.TestCase):
    def setUp(self):
        self.new = copy.deepcopy(SITES)

    def test_identical_lists_have_no_difference(self):
        self.assertEqual(check_sites.compare(SITES, self.new), {})

    def test_cosmetic_changes_are_ignored(self):
        self.new["sites"][2]["style"] = {"accentColor": "#000"}
        self.new["sites"][2]["defaultImage"] = "https://example.invalid/x.png"
        self.assertEqual(check_sites.compare(SITES, self.new), {})

    def test_added_removed_and_changed_sites(self):
        removed = self.new["sites"].pop(2)
        self.new["sites"].append({"slug": "uj", "title": "Új", "regex": "uj\\.hu", "domain": "uj.hu", "label": "Új"})
        self.new["sites"][3]["regex"] = "changed\\.hu"
        diff = check_sites.compare(SITES, self.new)
        self.assertEqual(diff["removed"], [removed["slug"]])
        self.assertEqual(diff["added"], ["uj"])
        slug = self.new["sites"][3]["slug"]
        self.assertEqual(diff["changed"][slug]["regex"][1], "changed\\.hu")

    def test_shortname_change_is_reported(self):
        self.new["shortname"] = "other"
        self.assertEqual(check_sites.compare(SITES, self.new)["shortname"], ["444hsz", "other"])

    def test_nosubmit_change_is_flagged_in_the_text(self):
        self.new["sites"][2]["noSubmit"] = True
        text = check_sites.render(check_sites.compare(SITES, self.new), self.new)
        self.assertIn("noSubmit", text)
        self.assertIn("legal", text)

    def test_render_ends_with_the_dedupe_marker(self):
        self.new["shortname"] = "other"
        diff = check_sites.compare(SITES, self.new)
        self.assertIn(f"{check_sites.MARKER} {check_sites.diff_hash(diff)} -->", check_sites.render(diff, self.new))


class SnapshotTests(unittest.TestCase):
    def test_snapshot_keeps_sites_and_records_the_source_hash(self):
        raw = config_bytes(SITES["sites"])
        snap = check_sites.snapshot(raw)
        self.assertEqual(snap["sites"], SITES["sites"])
        self.assertEqual(len(snap["sourceSha256"]), 64)

    def test_malformed_config_is_rejected(self):
        for raw in [config_bytes([]), config_bytes([{"slug": "x"}]), b'{"disqus": {}}', b"not json"]:
            with self.subTest(raw=raw[:20]):
                with self.assertRaises((ValueError, KeyError)):
                    check_sites.snapshot(raw)


class FakeGitHub:
    """Records API calls and answers from a small in-memory issue list."""

    def __init__(self, issues=(), comments=()):
        self.issues, self.comments, self.calls = list(issues), list(comments), []

    def __call__(self, method, path, token, body=None):
        self.calls.append((method, path, body))
        if method == "GET" and "/comments" in path:
            return self.comments
        if method == "GET":
            return self.issues
        return {}


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.new = copy.deepcopy(SITES)
        self.new["shortname"] = "other"
        self.diff = check_sites.compare(SITES, self.new)

    def report(self, api):
        return check_sites.report(self.diff, self.new, "o/r", "token", api=api)

    def test_creates_an_issue_with_the_label_when_none_is_open(self):
        api = FakeGitHub()
        self.assertEqual(self.report(api), "created")
        method, path, body = api.calls[-1]
        self.assertEqual((method, path), ("POST", "/repos/o/r/issues"))
        self.assertEqual(body["labels"], ["sites-sync"])
        self.assertIn("To do", body["body"])

    def test_comments_on_the_open_issue_when_the_difference_is_new(self):
        api = FakeGitHub(issues=[{"number": 7, "body": "older difference"}])
        self.assertEqual(self.report(api), "commented")
        self.assertEqual(api.calls[-1][1], "/repos/o/r/issues/7/comments")

    def test_repeating_the_same_difference_does_nothing(self):
        marker = f"{check_sites.MARKER} {check_sites.diff_hash(self.diff)} -->"
        for api in (
            FakeGitHub(issues=[{"number": 7, "body": "x " + marker}]),
            FakeGitHub(issues=[{"number": 7, "body": "x"}], comments=[{"body": marker}]),
        ):
            self.assertEqual(self.report(api), "unchanged")
            self.assertTrue(all(call[0] == "GET" for call in api.calls))


class CommandLineTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.sites = self.root / "sites.json"
        self.config = self.root / "config.json"

    def run_script(self, *args):
        return subprocess.run(
            [sys.executable, str(ROOT / ".github/ci/check_sites.py"), "--sites", str(self.sites), "--config-file", str(self.config), *args],
            capture_output=True,
            text=True,
        )

    def test_up_to_date_run_changes_nothing(self):
        self.sites.write_text(json.dumps(SITES))
        self.config.write_bytes(config_bytes(SITES["sites"]))
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("up to date", result.stdout)

    def test_update_creates_and_then_rewrites_the_snapshot(self):
        self.config.write_bytes(config_bytes(SITES["sites"]))
        self.assertEqual(self.run_script("--update").returncode, 0)
        self.assertEqual(json.loads(self.sites.read_text())["sites"], SITES["sites"])
        changed = copy.deepcopy(SITES["sites"])
        changed[2]["title"] = "Átnevezve"
        self.config.write_bytes(config_bytes(changed))
        self.assertEqual(self.run_script("--update").returncode, 0)
        self.assertEqual(json.loads(self.sites.read_text())["sites"][2]["title"], "Átnevezve")

    def test_unreadable_config_fails_the_run(self):
        self.sites.write_text(json.dumps(SITES))
        self.config.write_bytes(b"<html>maintenance</html>")
        result = self.run_script()
        self.assertEqual(result.returncode, 1)
        self.assertIn("Could not read", result.stderr)


if __name__ == "__main__":
    unittest.main()
