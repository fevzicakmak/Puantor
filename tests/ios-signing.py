import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


signing, archive = load("prepare-ios-signing"), load("verify-ios-archive")


class SigningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys = tempfile.TemporaryDirectory()
        path = Path(cls.keys.name) / "test-only.p8"
        subprocess.run(["openssl", "genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", str(path)], check=True, capture_output=True)
        cls.key = path.read_text()

    @classmethod
    def tearDownClass(cls):
        cls.keys.cleanup()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.root = self.base / "repo"
        self.runtime = self.root / "ios/App/App/capacitor.config.json"
        self.runtime.parent.mkdir(parents=True)
        self.runtime.write_text(json.dumps({"appId": "com.puantor.app", "appName": "Puantör"}))
        self.source = self.root / "capacitor.config.json"
        self.source.write_text(self.runtime.read_text())
        self.values = {"IOS_TEAM_ID": "TEAM123456", "IOS_BUNDLE_ID": "com.example.puantor", "IOS_VERSION": "1.0", "IOS_BUILD_NUMBER": "7", "APPLE_ASC_KEY_ID": "ABCDE12345", "APPLE_ASC_ISSUER_ID": "00000000-0000-0000-0000-000000000001", "APPLE_ASC_PRIVATE_KEY": self.key}

    def test_prepares_export_only_and_keeps_key_outside_repository(self):
        output = self.base / "signing"
        before = self.source.read_text()
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            signing.prepare(self.root, output, self.values)
        self.assertEqual(captured.getvalue(), "")
        self.assertEqual(self.source.read_text(), before)
        self.assertEqual(json.loads(self.runtime.read_text())["appId"], self.values["IOS_BUNDLE_ID"])
        self.assertEqual(list(self.root.rglob("*.p8")), [])
        key = output / "AuthKey_ABCDE12345.p8"
        self.assertEqual(os.stat(key).st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(output).st_mode & 0o777, 0o700)
        options = plistlib.loads((output / "ExportOptions.plist").read_bytes())
        self.assertEqual(options["destination"], "export")
        self.assertEqual(options["method"], "app-store-connect")
        self.assertFalse(options["manageAppVersionAndBuildNumber"])
        self.assertIn("DEVELOPMENT_TEAM = TEAM123456", (output / "Signing.xcconfig").read_text())

    def test_invalid_identity_or_secret_leaves_no_key_or_runtime_change(self):
        bad = {"IOS_TEAM_ID": "TEAM\nINJECT", "IOS_BUNDLE_ID": "com.example.*", "IOS_VERSION": "1.0; echo bad", "IOS_BUILD_NUMBER": "0", "APPLE_ASC_KEY_ID": "bad", "APPLE_ASC_ISSUER_ID": "not-a-uuid", "APPLE_ASC_PRIVATE_KEY": "not-a-private-key"}
        before = self.runtime.read_text()
        for name, value in bad.items():
            with self.subTest(field=name), self.assertRaises(ValueError):
                signing.prepare(self.root, self.base / "invalid", {**self.values, name: value})
            self.assertFalse((self.base / "invalid").exists())
            self.assertEqual(self.runtime.read_text(), before)

    def test_refuses_repository_and_existing_output(self):
        with self.assertRaises(ValueError):
            signing.prepare(self.root, self.root / "keys", self.values)
        existing = self.base / "existing"
        existing.mkdir()
        (existing / "keep.txt").write_text("keep")
        with self.assertRaises(ValueError):
            signing.prepare(self.root, existing, self.values)
        self.assertEqual((existing / "keep.txt").read_text(), "keep")

    def test_bad_pem_is_cleaned_without_revealing_content(self):
        broken = "-----BEGIN PRIVATE KEY-----\nNOT-A-KEY\n-----END PRIVATE KEY-----\n"
        with self.assertRaisesRegex(ValueError, "valid P-256"):
            signing.prepare(self.root, self.base / "broken", {**self.values, "APPLE_ASC_PRIVATE_KEY": broken})
        self.assertFalse((self.base / "broken").exists())


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "App.xcarchive"
        self.app = self.path / "Products/Applications/App.app"
        (self.app / "public").mkdir(parents=True)
        (self.app / "App").write_bytes(b"test executable fixture")
        (self.app / "public/index.html").write_text('<form id="login"></form>')
        (self.app / "public/hesap.html").write_text("Account screen")
        self.info = {"CFBundleSupportedPlatforms": ["iPhoneOS"], "DTPlatformName": "iphoneos", "CFBundleIdentifier": "com.example.puantor", "CFBundleExecutable": "App", "CFBundleShortVersionString": "1.0", "CFBundleVersion": "7", "MinimumOSVersion": "15.0", "DTSDKName": "iphoneos26.0"}
        self.write_info()

    def write_info(self):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(self.info))

    def test_report_does_not_claim_a_signature(self):
        result = archive.inspect(self.path, "com.example.puantor")
        self.assertEqual(result["platform"], "iPhoneOS")
        self.assertFalse(result["signingVerified"])

    def test_rejects_simulator_or_wrong_bundle(self):
        with self.assertRaises(ValueError):
            archive.inspect(self.path, "com.someoneelse.app")
        self.info.update(CFBundleSupportedPlatforms=["iPhoneSimulator"], DTPlatformName="iphonesimulator")
        self.write_info()
        with self.assertRaises(ValueError):
            archive.inspect(self.path)

    def test_rejects_development_tools_and_signing_keys(self):
        for name in ["test-sifirla.html", "AuthKey_TEST.p8"]:
            path = self.app / "public" / name
            path.write_text("test fixture")
            with self.assertRaises(ValueError):
                archive.inspect(self.path)
            path.unlink()


if __name__ == "__main__":
    unittest.main()
