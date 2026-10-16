# CMS Inner Tracker 3D dashboard

A standalone Grafana panel for exploring the CMS Phase-2 Inner Tracker: **756 TBPX,
1,728 TFPX and 1,408 TEPX modules (3,892 total)**, with module/chip views, two-sided
Dees, detector services, installation filters and optional live Prometheus data.

The full source and a prebuilt plugin are included. No access to CERN, any test setup,
or any sibling repository is mandatory. The bundled `DEMO-*` module IDs and sample
measurements are fictional. The geometry loads without measurement data.

## 1. Quick start: Docker Compose

Works on Linux, macOS with Docker Desktop, and Windows with Docker Desktop/WSL2.
Install [Docker Engine with Compose](https://docs.docker.com/engine/install/) or
[Docker Desktop](https://docs.docker.com/desktop/setup/install/), and Git first.
No separate Grafana, Node.js, Python or Prometheus installation is needed.

```bash
git clone https://github.com/atharphy/InnerTracker_3d.git
cd InnerTracker_3d
cp .env.example .env
# Edit .env and choose GRAFANA_ADMIN_PASSWORD before starting.
docker compose up -d --build
```

Open **http://localhost:3300/d/cmsit-inner-tracker-3d**. Sign in as `admin` with
`GRAFANA_ADMIN_PASSWORD` from `.env` (the example value is `change-this-password`).
The first build downloads dependencies; allow a few minutes. After startup,
allow 10–15 seconds for the first sample measurements. The dashboard is also under
**Dashboards → CMSIT → CMSIT Inner Tracker 3D**.

This starts three services:

| Service | Purpose |
|---|---|
| Grafana | Hosts the dashboard and bundled custom panel |
| Prometheus | Stores the sample measurements |
| Demo exporter | Generates six changing values for two fictional modules |

The panel plugin, datasource and dashboard are installed automatically. There is
**no additional plugin to install from Grafana's catalog**. Choose **Installed
modules only**, then **Installed close-up**, to inspect the sample modules.

```bash
docker compose ps
docker compose logs --tail=100 grafana
curl -fsS http://localhost:3300/api/health
docker compose down               # Stop; keep Grafana and metric data
```

If port 3300 is occupied, set `GRAFANA_PORT=3301` in `.env` and use port 3301 in
the browser. Password environment variables initialize a *new* Grafana database;
changing `.env` later does not reset an existing account's password. Use Grafana's
password-change UI. `docker compose down -v` deletes this project's saved data.

## 2. Native installation, including Grafana via wget

Use this path when Docker is unavailable. You need Git, Python 3.10+, `tar`, and
`wget` or `curl`. **Node.js is not needed to use the committed `dist/` plugin.**
The helpers support Linux x86_64/ARM64 and macOS Intel/Apple Silicon. On Windows,
use Docker or WSL2 for these shell commands.

```bash
git clone https://github.com/atharphy/InnerTracker_3d.git
cd InnerTracker_3d
./scripts/download-grafana.sh
export GRAFANA_ADMIN_PASSWORD='choose-your-local-password'
./scripts/run-grafana.sh
```

The download helper installs **Grafana OSS 13.1.0** under `.runtime/grafana`, using
`wget` when available and `curl` otherwise, and verifies the official SHA256 checksum. The launch helper runs in the foreground:
leave that terminal open; Ctrl+C stops Grafana. For an already extracted Grafana:

```bash
./scripts/run-grafana.sh /absolute/path/to/grafana
```

It uses a separate `.runtime/local` data directory and provisions the plugin and
dashboard there, without changing the existing Grafana installation's database or
provisioning files. Do not start two processes against the same runtime directory.
The browser URL and login are the same as in the Docker instructions.

### Manual wget installation: Linux x86_64

These are the equivalent explicit download commands, run from the repository root:

```bash
mkdir -p .runtime/downloads .runtime/grafana
wget -O .runtime/downloads/grafana.tar.gz \
  https://dl.grafana.com/grafana/release/13.1.0/grafana_13.1.0_28013217238_linux_amd64.tar.gz
wget -O .runtime/downloads/grafana.tar.gz.sha256 \
  https://dl.grafana.com/grafana/release/13.1.0/grafana_13.1.0_28013217238_linux_amd64.tar.gz.sha256
# Compare the SHA256 value below with the downloaded checksum file:
sha256sum .runtime/downloads/grafana.tar.gz
cat .runtime/downloads/grafana.tar.gz.sha256
tar -xzf .runtime/downloads/grafana.tar.gz --strip-components=1 -C .runtime/grafana
GRAFANA_ADMIN_PASSWORD='choose-your-local-password' ./scripts/run-grafana.sh
```

For Linux ARM64, replace `linux_amd64` with `linux_arm64` in both URLs. The automatic
helper selects the architecture for you. For a different release, copy its actual
URL and checksum from the [official Grafana download page](https://grafana.com/grafana/download).
Archive names may include a build number; do not assume the older URL format.
On Ubuntu/Debian, missing prerequisites can be installed with
`sudo apt-get update && sudo apt-get install -y git wget tar python3`.
On RHEL/AlmaLinux/Rocky, use `sudo dnf install -y git wget tar python3`.

### Native Prometheus: existing endpoint or sample data

The native launcher defaults to `http://127.0.0.1:9090`. To use an existing server:

```bash
PROMETHEUS_URL=http://your-prometheus-host:9090 ./scripts/run-grafana.sh
```

Without Prometheus, the detector still renders, but Grafana queries report connection
errors and no modules have measurements. For the same demo as Docker, open three
terminals, all initially in this repository:

**Terminal 1 — sample exporter**

```bash
python3 demo/exporter.py
# Serves http://127.0.0.1:9108/metrics
```

**Terminal 2 — Prometheus (Linux x86_64)**

```bash
mkdir -p .runtime/downloads .runtime/prometheus .runtime/prometheus-data
wget -O .runtime/downloads/prometheus.tar.gz \
  https://github.com/prometheus/prometheus/releases/download/v3.5.0/prometheus-3.5.0.linux-amd64.tar.gz
tar -xzf .runtime/downloads/prometheus.tar.gz --strip-components=1 -C .runtime/prometheus
.runtime/prometheus/prometheus \
  --config.file=demo/prometheus-local.yml \
  --storage.tsdb.path=.runtime/prometheus-data \
  --web.listen-address=127.0.0.1:9090
```

For ARM64/macOS choose the matching release archive from
[Prometheus downloads](https://prometheus.io/download/), e.g. `linux-arm64`,
`darwin-arm64`, or `darwin-amd64`. Do not start another Prometheus on a port already
in use. Its [release checksums](https://github.com/prometheus/prometheus/releases/tag/v3.5.0)
are supplied alongside the archives.

**Terminal 3 — Grafana**

```bash
GRAFANA_ADMIN_PASSWORD='choose-your-local-password' ./scripts/run-grafana.sh
```

Check `http://localhost:9090/targets` for the demo scrape target, then open Grafana.

### Run the native instance in the background

```bash
GRAFANA_ADMIN_PASSWORD='choose-your-local-password' \
  nohup ./scripts/run-grafana.sh > .runtime/grafana-console.log 2>&1 &
echo $! > .runtime/grafana.pid
# Later, stop only this instance:
kill "$(cat .runtime/grafana.pid)"
```

For a persistent system service, use your OS's service manager; see the
[official standalone installation guide](https://grafana.com/docs/grafana/latest/setup-grafana/installation/debian/#install-grafana-as-a-standalone-binary).

## 3. Add the plugin to an existing Grafana server

Use this when you want the dashboard inside an existing running Grafana rather
than a separate instance. The panel is a **custom unsigned plugin**, not a catalog
plugin. It does not need a separate Three.js installation: dependencies are bundled.
Grafana's built-in Prometheus datasource is sufficient.

1. Clone this repository on the server, as above.
2. Find the server's actual plugin directory. Package installations commonly use
   `/var/lib/grafana/plugins`; extracted installations commonly use `<grafana>/data/plugins`.
3. Stop the relevant Grafana instance and copy the plugin:

   ```bash
   # For a system-package installation:
   sudo systemctl stop grafana-server
   sudo python3 scripts/install-plugin.py /var/lib/grafana/plugins
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/atharphy-cmsitinnertracker3d-panel
   ```

   For an extracted installation owned by your user, omit `sudo` and use its plugin
   path. The installer backs up the previous copy outside the scanned plugin directory.

4. In the configuration file actually used by Grafana (usually `/etc/grafana/grafana.ini`
   for packages), add this entry to the existing `[plugins]` section:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = atharphy-cmsitinnertracker3d-panel
   ```

   Preserve other allowed IDs by appending this ID to the comma-separated list.
   Alternatively set the equivalent environment variable on the **Grafana service**:
   `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=atharphy-cmsitinnertracker3d-panel`.
   Exporting it in an unrelated shell does not change a systemd service.

5. Restart Grafana (`sudo systemctl start grafana-server`, or your normal standalone
   startup command). Check **Administration → Plugins and data → Plugins** for
   **CMSIT Inner Tracker 3D**. In older Grafana versions the menu location differs.
6. Add a Prometheus datasource under **Connections → Data sources**, using the URL
   reachable by the Grafana server. Use UID **`innertracker-prometheus`** for the supplied
   dashboard. If retaining an existing datasource with another UID, replace every
   `innertracker-prometheus` value in a copy of the dashboard JSON with that UID.
7. Under **Dashboards → New → Import**, upload
   `provisioning/dashboards/cmsit-inner-tracker-3d.json` and choose a folder. If a dashboard
   with UID `cmsit-inner-tracker-3d` exists, back it up before replacing it, or give the
   imported JSON a different UID.

For automatic provisioning instead of UI import, use the supplied datasource and
provider YAML files in the server's provisioning directories. Set `PROMETHEUS_URL`
on the service, and change the provider's `options.path` to an **absolute server
path** containing the dashboard JSON. The paths in the repository's provider are
Docker paths; the native helper generates appropriate host paths automatically.

Only the 3D panel is required. The optional chip-details navigation is disabled by
default because a separate details dashboard is not included. If you have one,
set its UID in the panel's **Details dashboard UID** option.

## 4. Connect your real hardware

The geometry is independent of measurements. Start with the full detector, then
replace the demo mapping and point the datasource at your actual exporter.

- Edit placements in `hardware_geometry/*.yaml` and prepare your module/eFuse CSV.
- Generate mapping JSON and rebuild; see [hardware mapping and metrics](docs/HARDWARE_MAPPING.md).
- A valid YAML module placement means **installed**. Data availability is separate.
- Explicit portcard IDs, mounting slots and lpGBT/module associations enable the
  **Connected portcards only** filter. No real connections are inferred from proximity.
- For Docker, change `PROMETHEUS_URL` in `.env`. To reach Prometheus on the Docker
  host, use `http://host.docker.internal:9090`, not `localhost:9090`.
- For native Grafana, use the server hostname or `http://127.0.0.1:9090` when co-located.
- With an external datasource, start only Grafana using
  `docker compose up -d --build --no-deps grafana`; stop existing demo services with
  `docker compose stop demo-exporter prometheus`.

The demo mappings are compiled defaults, not an indication that your two modules
are physically installed. Replace them before using installation counts operationally.

## 5. View controls

- **Subsystems only** is the default; **Full assembly** enables service components.
- **Modules / Chips** switches component images and measurement views.
- Expand **Subdetector → Disk → Z side → Half → Dee 1 / Dee 2** to isolate one Dee.
- Disable **Component controls → Disk / ladder supports** to see rear module images.
- Use **Installed modules only** and the module inventory for configured hardware.
- Rotate or pan by dragging, zoom with the wheel, and use the region close-up buttons.
- Geometry uses equal scale in X/Y/Z; the full detector is approximately 5.3 m long.

See [geometry and limitations](docs/GEOMETRY.md) for the model's scope.

## 6. Build, test, update

Use **Node.js 22 LTS (22.13 or newer)** and npm. Node 22.23.1 is used by the Docker
build and CI. Install it from [nodejs.org](https://nodejs.org/en/download) or your
normal version manager. The build does not require Python unless regenerating mappings.

```bash
npm ci
npm run typecheck
npm run test:ci -- --watch=false
npm run build
npm run counts
```

`dist/` contains the deployable plugin: `plugin.json`, `module.js`, image assets and
supporting files. Copy the **whole directory**, not just `module.js`. A prebuilt copy
is committed for native users without Node. Source changes require a rebuild.

To update a clone without local source changes:

```bash
git pull --ff-only
# Docker users:
docker compose up -d --build
# Native users: stop your instance, then rerun scripts/run-grafana.sh
# Existing-server users: repeat the plugin install and restart steps above.
```

Keep your own YAML/CSV and datasource configuration backed up. If you edit tracked
files, commit those edits to your own branch before pulling; do not discard hardware
configuration to resolve a Git conflict. File-provisioned dashboard edits in Grafana
can be overwritten on reprovisioning: export custom dashboards or edit the JSON source.

## Troubleshooting

| Symptom | Check / action |
|---|---|
| Plugin not found / unsigned plugin | Confirm the exact allowed ID, correct plugin path and restart; inspect Grafana logs. |
| Panel still looks old | Hard-refresh with Ctrl+Shift+R / Cmd+Shift+R; verify the served version at `/public/plugins/atharphy-cmsitinnertracker3d-panel/plugin.json`. |
| Datasource not found | Dashboard and datasource must both use UID `innertracker-prometheus`, or both your existing UID. |
| No measurements | Check Prometheus targets, metric name `cmsit_monitor_value`, labels and module/eFuse mapping; see the mapping guide. |
| Empty installed view | No valid configured module positions, or region/Dee checkboxes hide them. Enable all and check inventory issues. |
| Port 3300 already used | Set `GRAFANA_PORT` to a free port. |
| Native setup cannot download | Check network/proxy and use the exact archive URL from Grafana's download page. |
| Blank 3D canvas | Use a browser with WebGL enabled and hardware acceleration; inspect the browser console. |
| Double-click opens no details | This is intentional until an external details-dashboard UID is supplied. |

For a remote server bound to localhost, tunnel it rather than changing the bind address:

```bash
ssh -L 3300:127.0.0.1:3300 user@your-server
```

Then browse `http://localhost:3300`. Both supplied startup paths bind Grafana to
localhost by default and require a login. Configure your normal authentication,
HTTPS and network policy before exposing a server beyond your machine.

## Reference and compatibility

The underlying panel has been exercised on Grafana 13.1 and 13.2; the packaged
runtime pins 13.1.0 for reproducibility. Other versions/platforms are not a blanket
compatibility guarantee. Live telemetry requires your own functioning Prometheus
pipeline or the supplied demo stack. Grafana Cloud does not accept this local
unsigned-plugin installation path.

- [Grafana installation](https://grafana.com/docs/grafana/latest/setup-grafana/installation/)
- [Plugin signatures](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-sign/)
- [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Prometheus installation](https://prometheus.io/docs/prometheus/latest/installation/)

Code is Apache-2.0 licensed; see [LICENSE](LICENSE). Reference-derived hardware
imagery is described in [asset attribution](docs/ASSETS.md).

## Validation

The standalone native installation was checked with Grafana 13.1.0: plugin loading,
dashboard and datasource provisioning, and all six demo metric series passed.
The production build, 64 dashboard tests and 5 Python mapping tests passed.
GitHub Actions also builds and tests the Docker Compose stack on Linux; consult
the repository Actions tab for the result of your revision. Docker was not available
on the local packaging machine.
