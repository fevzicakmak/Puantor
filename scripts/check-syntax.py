from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and "src" not in dict(attrs):
            self.active = True
            self.parts = []

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            self.scripts.append("".join(self.parts))
            self.active = False


for path in sorted(Path(".").glob("*.html")):
    parser = Scripts()
    parser.feed(path.read_text(encoding="utf-8"))
    for code in parser.scripts:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".mjs") as script:
            script.write(code)
            script.flush()
            subprocess.run(["node", "--check", script.name], check=True)
    print(f"{path}: PASS ({len(parser.scripts)} scripts)")

for pattern in ("*.js", "*.mjs", "functions/*.js", "tests/*.cjs", "tests/*.mjs"):
    for path in sorted(Path(".").glob(pattern)):
        subprocess.run(["node", "--check", str(path)], check=True)
        print(f"{path}: PASS")
