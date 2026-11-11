"""Build a standalone HTML file with embedded CSS, JavaScript modules, and data."""
import base64
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
modules = {}
for path in sorted(root.glob('*.js')):
    if path.name.endswith('.test.js'):
        continue
    source = re.sub(r"(['\"])\./([\w.-]+\.js)\1", lambda match: match[1] + 'copay/' + match[2] + match[1], path.read_text())
    modules['copay/' + path.name] = 'data:text/javascript;base64,' + base64.b64encode(source.encode()).decode()
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + (root / 'styles.css').read_text() + '</style>')
html = html.replace('<script type="module" src="bootstrap.js"></script>', '<script type="importmap">' + json.dumps({'imports': modules}) + '</script><script type="module">import "copay/bootstrap.js";</script>')
dest = root / 'exports' / 'copay-simulator.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(html)
print(f'Wrote {dest} ({dest.stat().st_size:,} bytes). No server or network required.')
