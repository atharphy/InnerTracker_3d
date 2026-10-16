#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAFANA_DIR="${1:-$ROOT_DIR/.runtime/grafana}"
if [[ ! -x "$GRAFANA_DIR/bin/grafana" ]]; then
  echo "Grafana executable not found: $GRAFANA_DIR/bin/grafana" >&2
  echo 'Run ./scripts/download-grafana.sh or pass an extracted Grafana directory.' >&2
  exit 1
fi
GRAFANA_DIR="$(cd "$GRAFANA_DIR" && pwd)"
RUNTIME_DIR="${INNERTRACKER_RUNTIME:-$ROOT_DIR/.runtime/local}"
mkdir -p "$RUNTIME_DIR"
RUNTIME_DIR="$(cd "$RUNTIME_DIR" && pwd)"
python3 "$ROOT_DIR/scripts/configure-local.py" --runtime "$RUNTIME_DIR" \
  --prometheus-url "${PROMETHEUS_URL:-http://127.0.0.1:9090}"
export GF_PATHS_DATA="$RUNTIME_DIR/data"
export GF_PATHS_LOGS="$RUNTIME_DIR/logs"
export GF_PATHS_PLUGINS="$RUNTIME_DIR/plugins"
export GF_PATHS_PROVISIONING="$RUNTIME_DIR/provisioning"
export GF_SERVER_HTTP_ADDR="${GRAFANA_BIND:-127.0.0.1}"
export GF_SERVER_HTTP_PORT="${GRAFANA_PORT:-3300}"
export GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=atharphy-cmsitinnertracker3d-panel
export GF_SECURITY_ADMIN_USER="${GRAFANA_ADMIN_USER:-admin}"
export GF_SECURITY_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-change-this-password}"
export GF_AUTH_ANONYMOUS_ENABLED=false
printf 'Dashboard: http://localhost:%s/d/cmsit-inner-tracker-3d\n' "$GF_SERVER_HTTP_PORT"
exec "$GRAFANA_DIR/bin/grafana" server --homepath="$GRAFANA_DIR"
