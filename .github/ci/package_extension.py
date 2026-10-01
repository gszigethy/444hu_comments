"""Validate Manifest V3 resources and create an installable extension archive."""
import glob
import json
from pathlib import Path
import re
import zipfile

root = Path.cwd()
manifest = json.loads((root / "manifest.json").read_text())
assert manifest["manifest_version"] == 3, "Expected Manifest V3"
parts = manifest["version"].split(".")
assert 1 <= len(parts) <= 4 and all(re.fullmatch(r"0|[1-9][0-9]*", x) and int(x) <= 65535 for x in parts)
assert any(int(x) for x in parts), "Version must be nonzero"
resources = {"manifest.json"}
references = list(manifest.get("icons", {}).values())
for script in manifest.get("content_scripts", []):
    references += script.get("js", []) + script.get("css", [])
for group in manifest.get("web_accessible_resources", []):
    references += group.get("resources", [])
action = manifest.get("action", {})
icons = action.get("default_icon", {})
references += list(icons.values()) if isinstance(icons, dict) else [icons]
if action.get("default_popup"):
    references.append(action["default_popup"])
background = manifest.get("background", {})
if background.get("service_worker"):
    references.append(background["service_worker"])
for reference in references:
    assert not Path(reference).is_absolute() and ".." not in Path(reference).parts, reference
    matches = [Path(p) for p in glob.glob(reference) if Path(p).is_file()]
    assert matches, f"Missing manifest resource: {reference}"
    resources.update(str(p) for p in matches)
Path("dist").mkdir(exist_ok=True)
with zipfile.ZipFile("dist/444hu_comments.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(resources):
        archive.write(path, path)
print(f"Packaged {len(resources)} validated files")
