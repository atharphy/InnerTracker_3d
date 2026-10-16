#!/usr/bin/env python3
"""Verify the provisioned dashboard, plugin, and end-to-end demo metrics."""
import argparse
import base64
import json
import os
import time
import urllib.request


def verify(base):
    credentials = ':'.join([os.getenv('GRAFANA_ADMIN_USER', os.getenv('GF_SECURITY_ADMIN_USER', 'admin')),
                            os.getenv('GRAFANA_ADMIN_PASSWORD', os.getenv('GF_SECURITY_ADMIN_PASSWORD', 'change-this-password'))])
    authorization = 'Basic ' + base64.b64encode(credentials.encode()).decode()

    def get(path):
        request = urllib.request.Request(base + path, headers={'Authorization': authorization})
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    assert get('/api/health')['database'] == 'ok', 'Grafana database unavailable'
    plugin = get('/public/plugins/atharphy-cmsitinnertracker3d-panel/plugin.json')
    assert plugin['info']['version'] == '0.2.0', 'Unexpected plugin version'
    dashboard = get('/api/dashboards/uid/cmsit-inner-tracker-3d')['dashboard']
    assert any(p['type'] == plugin['id'] for p in dashboard['panels']), '3D panel missing'
    get('/api/datasources/uid/innertracker-prometheus')
    result = get('/api/datasources/proxy/uid/innertracker-prometheus/api/v1/query?query=cmsit_monitor_value')
    assert result['status'] == 'success', 'Prometheus query failed'
    assert len(result['data']['result']) == 6, 'Expected six demo metric series'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:' + os.getenv('GRAFANA_PORT', '3300'))
    parser.add_argument('--timeout', type=int, default=120)
    args = parser.parse_args()
    deadline = time.monotonic() + args.timeout
    while True:
        try:
            verify(args.url.rstrip('/'))
            print('PASS: Grafana, plugin, dashboard, datasource and six demo series.')
            break
        except Exception as exc:
            if time.monotonic() >= deadline:
                raise SystemExit(f'Smoke test failed: {exc}')
            time.sleep(3)
