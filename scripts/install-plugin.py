#!/usr/bin/env python3
"""Copy the bundled plugin into a Grafana plugin directory; back up an existing copy."""
import argparse
import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ID = 'atharphy-cmsitinnertracker3d-panel'


def install(plugin_dir):
    source = ROOT / 'dist'
    info = json.loads((source / 'plugin.json').read_text())
    if info['id'] != PLUGIN_ID or not (source / 'module.js').is_file():
        raise ValueError('dist/ is incomplete; run npm ci && npm run build')
    plugin_dir = Path(plugin_dir).resolve()
    plugin_dir.mkdir(parents=True, exist_ok=True)
    target = plugin_dir / PLUGIN_ID
    stage = Path(tempfile.mkdtemp(prefix='.innertracker-stage-', dir=plugin_dir.parent))
    shutil.copytree(source, stage, dirs_exist_ok=True)
    if target.exists():
        backups = plugin_dir.parent / 'innertracker-plugin-backups'
        backups.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = backups / stamp
        target.rename(backup)
        print(f'Previous plugin: {backup}')
    stage.rename(target)
    print(f'Installed {PLUGIN_ID} {info["info"]["version"]} into {target}')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plugin_directory', help='e.g. /var/lib/grafana/plugins')
    install(parser.parse_args().plugin_directory)
