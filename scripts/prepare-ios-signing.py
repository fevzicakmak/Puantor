"""Prepare an explicit, manual Apple signing run without changing source settings."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import uuid


def prepare(root, output, values):
    root, output = Path(root).resolve(), Path(output).resolve()
    required = ["IOS_TEAM_ID", "IOS_BUNDLE_ID", "IOS_VERSION", "IOS_BUILD_NUMBER", "APPLE_ASC_KEY_ID", "APPLE_ASC_ISSUER_ID", "APPLE_ASC_PRIVATE_KEY"]
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise ValueError("Missing signing fields (names only): " + ", ".join(missing))
    if not re.fullmatch(r"[A-Z0-9]{10}", values["IOS_TEAM_ID"]):
        raise ValueError("Team ID must contain 10 uppercase letters/digits")
    if not re.fullmatch(r"[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*\.[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*", values["IOS_BUNDLE_ID"]):
        raise ValueError("Enter the registered explicit Bundle ID, without wildcards or whitespace")
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,2}", values["IOS_VERSION"]):
        raise ValueError("App version must be numeric, for example 1.0 or 1.0.1")
    if not re.fullmatch(r"[1-9][0-9]{0,17}", values["IOS_BUILD_NUMBER"]):
        raise ValueError("Build number must be a positive integer of at most 18 digits")
    if not re.fullmatch(r"[A-Z0-9]{10}", values["APPLE_ASC_KEY_ID"]):
        raise ValueError("App Store Connect Key ID must contain 10 uppercase letters/digits")
    try:
        if not re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", values["APPLE_ASC_ISSUER_ID"]):
            raise ValueError()
        uuid.UUID(values["APPLE_ASC_ISSUER_ID"])
    except (ValueError, AttributeError):
        raise ValueError("App Store Connect team key Issuer ID must be a UUID") from None
    if output == root or root in output.parents or output.exists():
        raise ValueError("Signing output must be a new directory outside the repository")
    runtime_path = root / "ios/App/App/capacitor.config.json"
    runtime = json.loads(runtime_path.read_text())
    key = values["APPLE_ASC_PRIVATE_KEY"].strip() + "\n"
    if not key.startswith("-----BEGIN PRIVATE KEY-----\n") or not key.rstrip().endswith("-----END PRIVATE KEY-----"):
        raise ValueError("The private-key secret must contain the original multiline .p8 PEM text")
    output.mkdir(parents=True, mode=0o700)
    try:
        key_path = output / ("AuthKey_" + values["APPLE_ASC_KEY_ID"] + ".p8")
        with open(key_path, "x", opener=lambda name, flags: os.open(name, flags, 0o600)) as handle:
            handle.write(key)
        # Only public-key output is inspected; private-key content is never logged.
        public = subprocess.run(["openssl", "pkey", "-in", str(key_path), "-pubout"], capture_output=True)
        description = subprocess.run(["openssl", "pkey", "-pubin", "-text", "-noout"], input=public.stdout, capture_output=True)
        if public.returncode or description.returncode or b"ASN1 OID: prime256v1" not in description.stdout:
            raise ValueError("The App Store Connect private key must be a valid P-256 EC key")
        config = {"DEVELOPMENT_TEAM": values["IOS_TEAM_ID"], "PRODUCT_BUNDLE_IDENTIFIER": values["IOS_BUNDLE_ID"], "MARKETING_VERSION": values["IOS_VERSION"], "CURRENT_PROJECT_VERSION": values["IOS_BUILD_NUMBER"], "CODE_SIGN_STYLE": "Automatic"}
        (output / "Signing.xcconfig").write_text("".join(f"{name} = {value}\n" for name, value in config.items()))
        with (output / "ExportOptions.plist").open("wb") as handle:
            plistlib.dump({"method": "app-store-connect", "destination": "export", "teamID": values["IOS_TEAM_ID"], "signingStyle": "automatic", "manageAppVersionAndBuildNumber": False, "uploadSymbols": False}, handle)
        # The generated native config follows the selected identity. The checked-in
        # Capacitor config, Xcode project and web forms are intentionally untouched.
        runtime["appId"] = values["IOS_BUNDLE_ID"]
        runtime_path.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n")
    except Exception:
        shutil.rmtree(output)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        prepare(Path(__file__).resolve().parent.parent, args.output, os.environ)
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error)) from None
    print("Apple signing inputs prepared; source identity and web forms preserved.")
