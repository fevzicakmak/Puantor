"""Bind an upload to the exact signed IPA approved for TestFlight."""
import argparse
import datetime
import hashlib
import hmac
import json
from pathlib import Path
import plistlib
import re
import subprocess
import zipfile


def decode_profile(data):
    # Older macOS LibreSSL lacks the cms command, but supports PKCS#7 smime.
    for command in ["cms", "smime"]:
        result = subprocess.run(["openssl", command, "-verify", "-inform", "DER", "-noverify"], input=data, capture_output=True)
        if result.returncode == 0:
            return plistlib.loads(result.stdout)
    raise ValueError("Distribution profile CMS signature could not be verified")


def verify(directory, expected_hash, bundle, version, build, team, decoder=decode_profile):
    if not re.fullmatch(r"[a-f0-9]{64}", expected_hash):
        raise ValueError("Approved IPA SHA-256 is required")
    files = list(Path(directory).rglob("*.ipa"))
    if len(files) != 1 or any(c in str(files[0]) for c in "\r\n"):
        raise ValueError("Exactly one signed IPA is required")
    path = files[0].resolve()
    digest_state = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest_state.update(chunk)
    digest = digest_state.hexdigest()
    if not hmac.compare_digest(digest, expected_hash):
        raise ValueError("IPA differs from the approved signed package; upload stopped")
    with zipfile.ZipFile(path) as archive:
        infos = [name for name in archive.namelist() if name.startswith("Payload/") and name.count("/") == 2 and name.endswith("/Info.plist")]
        if len(infos) != 1:
            raise ValueError("IPA application metadata is ambiguous")
        root = infos[0][:-len("Info.plist")]
        info = plistlib.loads(archive.read(infos[0]))
        if (info.get("CFBundleIdentifier"), info.get("CFBundleShortVersionString"), info.get("CFBundleVersion")) != (bundle, version, build):
            raise ValueError("IPA identity/version differs from the approved build")
        if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
            raise ValueError("TestFlight requires a physical-device build")
        if root + "_CodeSignature/CodeResources" not in archive.namelist():
            raise ValueError("IPA code-signature resources are missing")
        if any(name.endswith((".p8", ".p12")) for name in archive.namelist()):
            raise ValueError("Signing credentials must not be embedded in an IPA")
        profile = decoder(archive.read(root + "embedded.mobileprovision"))
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [team] or not entitlements.get("application-identifier", "").endswith("." + bundle):
        raise ValueError("Distribution profile belongs to another Apple identity")
    if entitlements.get("get-task-allow") is not False or "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise ValueError("App Store distribution profile required")
    expiry = profile.get("ExpirationDate")
    if not isinstance(expiry, datetime.datetime) or expiry.replace(tzinfo=datetime.timezone.utc) <= datetime.datetime.now(datetime.timezone.utc):
        raise ValueError("Distribution profile expired")
    return path, {"bundleId": bundle, "version": version, "build": build, "teamId": team, "ipaSHA256": digest, "distribution": "App Store"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for name in ["directory", "sha256", "bundle", "version", "build", "team", "report"]:
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--github-output")
    args = parser.parse_args()
    try:
        path, report = verify(args.directory, args.sha256, args.bundle, args.version, args.build, args.team)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
        if args.github_output:
            with open(args.github_output, "a") as handle:
                handle.write("ipa_path=" + str(path) + "\n")
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error)) from None
    print("Approved signed IPA identity and distribution profile verified.")
