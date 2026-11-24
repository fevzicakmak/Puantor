"""Verify a device archive before it is handed to signing/export steps."""
import argparse
import json
from pathlib import Path
import plistlib
import re


def inspect(archive, bundle_id=None):
    app = Path(archive) / "Products/Applications/App.app"
    info = plistlib.loads((app / "Info.plist").read_bytes())
    if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"] or info.get("DTPlatformName") != "iphoneos":
        raise ValueError("A physical-device iPhoneOS archive is required, not a Simulator build")
    if bundle_id and info.get("CFBundleIdentifier") != bundle_id:
        raise ValueError("Archive Bundle ID does not match the selected Apple identity")
    executable = info.get("CFBundleExecutable", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", executable) or not (app / executable).is_file():
        raise ValueError("Archive executable is missing or invalid")
    public = app / "public"
    if 'id="login"' not in (public / "index.html").read_text() or not (public / "hesap.html").is_file():
        raise ValueError("Archive must contain the current login and account screens")
    for forbidden in ["test-sifirla.html", "functions", ".git"]:
        if (public / forbidden).exists():
            raise ValueError("Development or repository files found in public application assets")
    if any(app.rglob("*.p8")) or any(app.rglob("*.p12")):
        raise ValueError("Signing credentials must not be present in application assets")
    return {"platform": "iPhoneOS", "bundleId": info.get("CFBundleIdentifier"), "version": info.get("CFBundleShortVersionString"), "build": info.get("CFBundleVersion"), "minimumOSVersion": info.get("MinimumOSVersion"), "sdk": info.get("DTSDKName"), "xcodeBuild": info.get("DTXcodeBuild"), "signingVerified": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    parser.add_argument("--bundle-id")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    try:
        report = inspect(args.archive, args.bundle_id)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    except (ValueError, OSError, plistlib.InvalidFileException) as error:
        raise SystemExit(str(error)) from None
    print("iPhoneOS archive assets and identity verified; report written.")
