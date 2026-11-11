"""Publish the committed app to the gh-pages branch without changing the checkout."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent

def git(*args, env=None):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True, env=env).strip()

if git('status', '--porcelain', '--untracked-files=normal'):
    raise SystemExit('Commit your source changes before publishing the site.')
source_commit = git('rev-parse', 'HEAD')
subprocess.run([sys.executable, str(root / 'scripts/build-site.py')], check=True)
remote = git('ls-remote', 'origin', 'refs/heads/gh-pages')
parent = None
if remote:
    git('fetch', 'origin', 'refs/heads/gh-pages')
    parent = git('rev-parse', 'FETCH_HEAD')
with tempfile.TemporaryDirectory(prefix='copay-pages-index-') as directory:
    # An isolated Git index stages only the public build. The checkout and
    # its index stay intact, and a regular push protects concurrent updates.
    publish_env = os.environ.copy()
    publish_env['GIT_INDEX_FILE'] = str(Path(directory) / 'index')
    git('read-tree', '--empty', env=publish_env)
    git('--work-tree=' + str(root / '_site'), 'add', '--all', env=publish_env)
    tree = git('write-tree', env=publish_env)
    if parent and tree == git('rev-parse', parent + '^{tree}'):
        print('The published branch already contains this site.')
        raise SystemExit(0)
    args = ['commit-tree', tree]
    if parent:
        args.extend(['-p', parent])
    commit = git(*args, '-m', f'Publish copay simulator from {source_commit[:12]}')
    subprocess.run(['git', '-C', str(root), 'push', 'origin', f'{commit}:refs/heads/gh-pages'], check=True)
print(f'Site files pushed to gh-pages: {commit}')
print('One-time setup: Repository Settings > Pages > Deploy from a branch > gh-pages > / (root) > Save.')
print('Expected URL after GitHub Pages finishes deployment: https://mharrhayden.github.io/copay/')
