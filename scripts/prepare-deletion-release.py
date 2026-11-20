"""Enable destructive completion only after the selected rules are active."""
import json
import os
from pathlib import Path
import sys


def prepare(root, ruleset_path, enabled):
    root = Path(root)
    target = root / "functions" / ".env.puantor-live"
    if target.exists():
        raise ValueError("Existing live runtime configuration must not be overwritten")
    if enabled:
        ruleset = json.loads(Path(ruleset_path).read_text())
        if not ruleset.get("name", "").startswith("projects/puantor-live/rulesets/"):
            raise ValueError("Rules snapshot is not from puantor-live")
        files = ruleset.get("source", {}).get("files", [])
        if len(files) != 1 or files[0].get("name") != "firestore.rules":
            raise ValueError("Unexpected active Firestore rules source")
        if files[0].get("content") != (root / "firestore.rules").read_text():
            raise ValueError("Live rules differ from this release: deploy and verify rules before enabling deletion")
    target.write_text("PUANTOR_ENABLE_ACCOUNT_DELETION=" + str(enabled).lower() + "\n")


if __name__ == "__main__":
    value = os.environ.get("PUANTOR_ENABLE_ACCOUNT_DELETION", "false")
    if value not in ("true", "false"):
        raise SystemExit("PUANTOR_ENABLE_ACCOUNT_DELETION must be true or false")
    root = Path(__file__).resolve().parent.parent
    try:
        prepare(root, sys.argv[1], value == "true")
    except (ValueError, OSError, IndexError) as error:
        raise SystemExit(str(error))
    print("Live account-deletion completion: " + ("enabled after exact active-rules verification" if value == "true" else "disabled"))
