"""Build the public static site with only the app's runtime files."""
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
site = root / '_site'
files = {'index.html', 'styles.css'}
pending = ['bootstrap.js']
while pending:
    name = pending.pop()
    if name in files:
        continue
    if Path(name).name != name or not name.endswith('.js') or name.endswith('.test.js'):
        raise ValueError(f'Unexpected runtime module: {name}')
    source = (root / name).read_text()
    files.add(name)
    pending.extend(re.findall(r"['\"]\./([\w.-]+\.js)['\"]", source))
if site.exists():
    shutil.rmtree(site)
site.mkdir()
for name in sorted(files):
    shutil.copyfile(root / name, site / name)
(site / '.nojekyll').touch()
print(f'Built {len(files) + 1} public files in {site}; no tests, recovery notes, or development helpers included.')
