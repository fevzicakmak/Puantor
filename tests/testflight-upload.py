import datetime
import hashlib
import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("verify_upload", Path(__file__).resolve().parent.parent / "scripts/verify-testflight-package.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UploadPackageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.ipa = self.root / "App.ipa"
        info = {"CFBundleIdentifier": "com.example.puantor", "CFBundleShortVersionString": "1.0", "CFBundleVersion": "73", "CFBundleSupportedPlatforms": ["iPhoneOS"]}
        with zipfile.ZipFile(self.ipa, "w") as archive:
            archive.writestr("Payload/App.app/Info.plist", plistlib.dumps(info))
            archive.writestr("Payload/App.app/_CodeSignature/CodeResources", "fixture")
            archive.writestr("Payload/App.app/embedded.mobileprovision", "fixture")
        self.digest = hashlib.sha256(self.ipa.read_bytes()).hexdigest()
        self.profile = {"TeamIdentifier": ["TEAM123456"], "ExpirationDate": datetime.datetime.now()+datetime.timedelta(days=30), "Entitlements": {"application-identifier": "TEAM123456.com.example.puantor", "get-task-allow": False}}

    def verify(self, **extra):
        values = {"directory": self.root, "expected_hash": self.digest, "bundle": "com.example.puantor", "version": "1.0", "build": "73", "team": "TEAM123456", "decoder": lambda _: self.profile}
        return module.verify(**{**values, **extra})

    def test_exact_approved_build(self):
        path, report = self.verify()
        self.assertEqual(path, self.ipa.resolve())
        self.assertEqual(report["build"], "73")
        self.assertEqual(report["ipaSHA256"], self.digest)

    def test_rejects_tampered_or_wrong_build(self):
        for key, value in [("expected_hash", "0"*64), ("bundle", "com.other.app"), ("version", "2.0"), ("build", "74"), ("team", "OTHER12345")]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.verify(**{key: value})

    def test_rejects_debug_device_or_expired_profile(self):
        self.profile["Entitlements"]["get-task-allow"] = True
        with self.assertRaises(ValueError):
            self.verify()
        self.profile["Entitlements"]["get-task-allow"] = False
        self.profile["ProvisionedDevices"] = ["test-device"]
        with self.assertRaises(ValueError):
            self.verify()
        del self.profile["ProvisionedDevices"]
        self.profile["ExpirationDate"] = datetime.datetime.now()-datetime.timedelta(days=1)
        with self.assertRaises(ValueError):
            self.verify()


if __name__ == "__main__":
    unittest.main()
