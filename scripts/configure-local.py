#!/usr/bin/env python3
"""Prepare an isolated local Grafana runtime; no third-party Python dependencies."""
import argparse
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def configure(runtime, prometheus_url):
    parsed = urlparse(prometheus_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('PROMETHEUS_URL must be an absolute HTTP(S) URL')
    runtime = Path(runtime).resolve()
    spec = importlib.util.spec_from_file_location('installer', ROOT / 'scripts/install-plugin.py')
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    installer.install(runtime / 'plugins')
    dashboard = json.loads((ROOT / 'provisioning/dashboards/cmsit-inner-tracker-3d.json').read_text())
    dashboard_dir = runtime / 'dashboards'
    files = {
        dashboard_dir / 'cmsit-inner-tracker-3d.json': dashboard,
        runtime / 'provisioning/dashboards/innertracker.yaml': {
            'apiVersion': 1, 'providers': [{'name': 'InnerTracker 3D', 'orgId': 1,
                'folder': 'CMSIT', 'type': 'file', 'disableDeletion': True,
                'updateIntervalSeconds': 10, 'allowUiUpdates': True,
                'options': {'path': str(dashboard_dir)}}]},
        runtime / 'provisioning/datasources/innertracker.yaml': {
            'apiVersion': 1, 'datasources': [{'name': 'InnerTracker Prometheus',
                'type': 'prometheus', 'uid': 'innertracker-prometheus',
                'access': 'proxy', 'url': prometheus_url, 'editable': True}]},
    }
    for path, value in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        # JSON is a YAML subset, so quoting is safe even for paths containing spaces.
        path.write_text(json.dumps(value, indent=2) + '\n')
    for folder in ['data', 'logs']:
        (runtime / folder).mkdir(exist_ok=True)
    print(f'Runtime prepared at {runtime}')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--runtime', default=str(ROOT / '.runtime/local'))
    p.add_argument('--prometheus-url', default='http://127.0.0.1:9090')
    args = p.parse_args()
    configure(args.runtime, args.prometheus_url)
