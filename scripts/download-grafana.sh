#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -s)" in Linux) platform=linux ;; Darwin) platform=darwin ;; *) echo 'Use Docker on Windows, or run this script in WSL2.' >&2; exit 1 ;; esac
case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) echo 'Supported architectures: x86_64 and arm64.' >&2; exit 1 ;; esac
archive="grafana_13.1.0_28013217238_${platform}_${arch}.tar.gz"
url="https://dl.grafana.com/grafana/release/13.1.0/$archive"
destination="$ROOT_DIR/.runtime/grafana"
if [[ -x "$destination/bin/grafana" ]]; then echo "Already installed: $destination"; exit 0; fi
mkdir -p "$ROOT_DIR/.runtime/downloads" "$destination"
fetch() {
  if command -v wget >/dev/null; then wget -O "$2" "$1"; else curl --fail --location --output "$2" "$1"; fi
}
fetch "$url" "$ROOT_DIR/.runtime/downloads/$archive"
fetch "$url.sha256" "$ROOT_DIR/.runtime/downloads/$archive.sha256"
python3 - "$ROOT_DIR/.runtime/downloads/$archive" <<'PYVERIFY'
import hashlib,pathlib,sys
archive=pathlib.Path(sys.argv[1]);expected=pathlib.Path(str(archive)+'.sha256').read_text().split()[0]
actual=hashlib.sha256(archive.read_bytes()).hexdigest()
if actual!=expected: raise SystemExit('Grafana archive checksum mismatch')
print('Grafana archive SHA256 verified.')
PYVERIFY
tar -xzf "$ROOT_DIR/.runtime/downloads/$archive" --strip-components=1 -C "$destination"
printf 'Installed Grafana: %s\nNext: ./scripts/run-grafana.sh\n' "$destination"
