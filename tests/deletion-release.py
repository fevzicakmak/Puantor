import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("release_guard", Path(__file__).resolve().parent.parent / "scripts/prepare-deletion-release.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class ReleaseGuardTests(unittest.TestCase):
    def test_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "functions").mkdir()
            (root / "firestore.rules").write_text("verified source\n")
            snapshot = root / "active.json"
            output = root / "functions" / ".env.puantor-live"
            for name, source in [("projects/puantor-staging/rulesets/a", "verified source\n"), ("projects/puantor-live/rulesets/a", "old source\n")]:
                snapshot.write_text(json.dumps({"name": name, "source": {"files": [{"name": "firestore.rules", "content": source}]}}))
                with self.assertRaises(ValueError):
                    guard.prepare(root, snapshot, True)
                self.assertFalse(output.exists())
            snapshot.write_text(json.dumps({"name": "projects/puantor-live/rulesets/a", "source": {"files": [{"name": "firestore.rules", "content": "verified source\n"}]}}))
            guard.prepare(root, snapshot, True)
            self.assertEqual(output.read_text(), "PUANTOR_ENABLE_ACCOUNT_DELETION=true\n")
            with self.assertRaises(ValueError):
                guard.prepare(root, snapshot, False)
            output.unlink()
            guard.prepare(root, root / "missing.json", False)
            self.assertEqual(output.read_text(), "PUANTOR_ENABLE_ACCOUNT_DELETION=false\n")


if __name__ == "__main__":
    unittest.main()
