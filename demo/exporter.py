#!/usr/bin/env python3
"""Fictional module data for the quick start; no connection to detector hardware."""
import argparse
import math
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def metrics(now=None):
    now = time.time() if now is None else now
    lines = ['# HELP cmsit_monitor_value Fictional InnerTracker demonstration values.',
             '# TYPE cmsit_monitor_value gauge']
    for module, first, count in [('DEMO-TBPX-QUAD', 900001, 4), ('DEMO-TBPX-DOUBLE', 900005, 2)]:
        for chip in range(count):
            value = 19 + chip + math.sin(now / 20 + chip)
            labels = f'module_id="{module}",chip_efuse="{first+chip}",chip="{chip}",register="INTERNAL_NTC_REL",unit="C",demo="true"'
            lines.append(f'cmsit_monitor_value{{{labels}}} {value:.3f}')
    return '\n'.join(lines) + '\n'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ('/metrics', '/health'):
            self.send_error(404)
            return
        body = (metrics() if self.path == '/metrics' else 'ok\n').encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=9108)
    args = parser.parse_args()
    print(f'DEMO exporter: http://{args.host}:{args.port}/metrics', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
