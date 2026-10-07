"""Exercise CI utilities as subprocesses against isolated repositories."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = {"manifest_version": 3, "version": "1.2.3", "content_scripts": [{"js": ["loader.js"]}], "web_accessible_resources": [{"resources": ["images/*.svg"]}]}
        (self.root / "loader.js").write_text("// extension")
        (self.root / "images").mkdir()
        (self.root / "images/icon.svg").write_text("<svg/>")
        (self.root / "private.txt").write_text("not a release asset")

    def package(self):
        (self.root / "manifest.json").write_text(json.dumps(self.manifest))
        return subprocess.run([sys.executable, str(ROOT / ".github/ci/package_extension.py")], cwd=self.root, capture_output=True, text=True)

    def test_archive_contains_only_declared_resources(self):
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.root / "dist/444hu_comments.zip") as archive:
            self.assertEqual(set(archive.namelist()), {"manifest.json", "loader.js", "images/icon.svg"})
            self.assertIsNone(archive.testzip())

    def test_missing_asset_fails(self):
        (self.root / "loader.js").unlink()
        self.assertNotEqual(self.package().returncode, 0)

    def test_path_traversal_fails(self):
        self.manifest["content_scripts"][0]["js"] = ["../outside.js"]
        self.assertNotEqual(self.package().returncode, 0)

    def test_invalid_versions_fail(self):
        for version in ["0", "01.2", "65536", "1.2.3.4.5", "1.beta"]:
            with self.subTest(version=version):
                self.manifest["version"] = version
                self.assertNotEqual(self.package().returncode, 0)


class LintBaselineTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.git("init", "-q")
        self.write_findings([{"ruleId": "example-rule", "message": "Existing defect", "line": 1}])
        self.git("add", ".")
        self.git("-c", "user.name=CI test", "-c", "user.email=ci@example.invalid", "commit", "-qm", "baseline")
        self.base = self.git("rev-parse", "HEAD").stdout.strip()
        self.linter = self.root / "fake_linter.py"
        self.linter.write_text('import json\nfrom pathlib import Path\nprint(json.dumps([{"filePath": str(Path.cwd()/"app.js"), "messages": json.loads(Path("findings.json").read_text())}]))\n')

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True, text=True)

    def write_findings(self, messages):
        (self.root / "findings.json").write_text(json.dumps(messages))

    def lint(self):
        return subprocess.run([sys.executable, str(ROOT / ".github/ci/lint_baseline.py"), "eslint", sys.executable, str(self.linter)], cwd=self.root, env={**os.environ, "QUALITY_BASE": self.base}, capture_output=True, text=True)

    def test_line_shift_is_not_a_new_defect(self):
        self.write_findings([{"ruleId": "example-rule", "message": "Existing defect", "line": 99}])
        result = self.lint()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("new: 0", result.stdout)

    def test_additional_occurrence_fails(self):
        message = {"ruleId": "example-rule", "message": "Existing defect"}
        self.write_findings([message, message])
        self.assertEqual(self.lint().returncode, 1)
        self.assertEqual(len(self.git("worktree", "list", "--porcelain").stdout.split("worktree ")) - 1, 1)

    def test_removed_defect_passes(self):
        self.write_findings([])
        self.assertEqual(self.lint().returncode, 0)

    def test_linter_crash_fails_closed_and_removes_worktree(self):
        self.linter.write_text('import sys\nsys.exit(2)\n')
        self.assertNotEqual(self.lint().returncode, 0)
