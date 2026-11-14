"""Read-only checks and rules snapshot before the approved live release."""
import json
import os
from pathlib import Path
import urllib.request

PROJECT = "puantor-live"
OUTPUT = Path("live-release-evidence")
OUTPUT.mkdir(exist_ok=True)
token = os.environ["PUANTOR_LIVE_ACCESS_TOKEN"]


def api(url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json"
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


required = [
    "firebase.projects.get", "serviceusage.services.get",
    "cloudfunctions.functions.get", "cloudfunctions.functions.list",
    "cloudfunctions.functions.create", "cloudfunctions.functions.update",
    "run.services.getIamPolicy", "run.services.setIamPolicy",
    "firebaserules.rulesets.get", "firebaserules.rulesets.create",
    "firebaserules.releases.get", "firebaserules.releases.create",
    "firebaserules.releases.update"
]
granted = api("https://cloudresourcemanager.googleapis.com/v1/projects/" + PROJECT + ":testIamPermissions", {"permissions": required})
missing = sorted(set(required) - set(granted.get("permissions", [])))
(OUTPUT / "permissions.json").write_text(json.dumps({"project": PROJECT, "missing": missing}, indent=2))
if missing:
    raise SystemExit("Missing live deployment permissions: " + ", ".join(missing))

release = api("https://firebaserules.googleapis.com/v1/projects/" + PROJECT + "/releases/cloud.firestore")
name = release["rulesetName"]
if not name.startswith("projects/" + PROJECT + "/rulesets/"):
    raise SystemExit("Unexpected live ruleset project")
ruleset = api("https://firebaserules.googleapis.com/v1/" + name)
(OUTPUT / "previous-firestore-release.json").write_text(json.dumps(release, indent=2))
(OUTPUT / "previous-firestore-ruleset.json").write_text(json.dumps(ruleset, indent=2))
print("PASS: live permissions checked; existing Firestore release and source saved. No application data modified.")
