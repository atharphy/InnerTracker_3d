# Hardware placements and live measurements

The panel always has a complete nominal detector. Installed status comes from valid
module placements; a selected time range controls measurement availability separately.
The compiled example contains two fictional TBPX modules. No real portcards are
configured. Clear those mappings or replace them for your installation.

## Generate the mappings

Install the optional Python dependency in a virtual environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

Edit these placement templates:

- `hardware_geometry/barrel_geometry.yaml` — TBPX
- `hardware_geometry/forward_geometry.yaml` — TFPX
- `hardware_geometry/endcap_geometry.yaml` — TEPX
- `hardware_geometry/portcards.yaml` — explicit portcard IDs/connections

Keys in the first three files are `board/optical/hybrid` strings. The lookup CSV
connects that hardware address to a module serial and its chip/eFuse IDs. Example:

```csv
board,optical,hybrid,chip,chip_efuse,module_id
0,0,0,0,900001,DEMO-TBPX-QUAD
0,0,0,1,900002,DEMO-TBPX-QUAD
0,0,0,2,900003,DEMO-TBPX-QUAD
0,0,0,3,900004,DEMO-TBPX-QUAD
```

`module` and `efuse` are also accepted as legacy column names. Use two records
(chip 0–1) for a double module and four (0–3) for a quad module. Avoid duplicate
module positions or eFuse assignments. Here is a TBPX placement:

```yaml
"0/0/0":
  layer: 3
  signed_ladder: 1
  z_side: "z+"
  module_index: 1
```

A disk placement uses a different set of fields:

```yaml
"1/0/0":
  detector_side: "+z"
  disk: 1
  ring: 1
  half: upper
  module_index: 0
```

Disk `half: upper` is the legacy mapping name for the **right (+X)** spatial half;
`lower` means **left (−X)**. Disk module indices start at 0; barrel indices start
at 1. The module's Dee and face are derived from the nominal geometry. These are
visualization IDs, not CMS DetIds. Use `npm run counts` and the generated
`exports/module_counts/module_positions.csv` to inspect all valid positions.

Run the generator from the repository root:

```bash
python prepare_module_geometry.py /absolute/path/to/your_lookup.csv --dry-run
python prepare_module_geometry.py /absolute/path/to/your_lookup.csv
npm ci
npm run build
```

For a reproducible example, substitute `demo/efuse_lookup.csv`. This reproduces
the bundled demo placements. The generator writes `src/generatedModuleMapping.json`,
`src/generatedPortcardMapping.json` and root-level converted geometry YAML. Rebuild
and redeploy afterward: Grafana does not watch the input YAML directly.

Alternatively, paste a placement JSON object into the Grafana panel's hardware
mapping option, which overrides the bundled defaults. A module entry looks like:

```json
{
  "YOUR-MODULE-ID": {
    "subdetector": "TBPX",
    "layer": 3,
    "signed_ladder": 1,
    "z_side": "z+",
    "module_index": 1,
    "chips": {"0": "10001", "1": "10002", "2": "10003", "3": "10004"}
  }
}
```

A valid placement means installed; `installed: true` is unnecessary. Entries
with invalid or duplicate positions appear as issues in the inventory.

## Portcards

Portcards require actual IDs and verified mounting slots. For example:

```yaml
PC-YOUR-ID:
  slot: "TBPX:+z:right:W1:R1:C1"
  connections:
    - module: "YOUR-MODULE-ID"
      lpgbt: 0
```

The module must exist in your generated mapping and match the portcard subsystem.
Bank indices are 0, 1, 2; they are not pin numbers. Slot definitions are in
`src/geometry/connectionAnchors.ts` and `componentLayout.ts`. Check them against
your mounting map before assigning boards. Nominal illustrative slots do not
establish an as-built portcard count or cable netlist.

```bash
python prepare_module_geometry.py --portcards-only --dry-run
python prepare_module_geometry.py --portcards-only
npm run build
```

The **Connected portcards only** filter uses these explicit associations. Empty
mapping `{}` means none are connected. Full assembly can still show nominal
illustrative portcard locations. No board assignment is inferred from measurements.

## Prometheus metric contract

The supplied dashboard queries `cmsit_monitor_value{register=~"$register"}`. Example:

```text
cmsit_monitor_value{module_id="YOUR-MODULE-ID",chip_efuse="10001",chip="0",register="INTERNAL_NTC_REL",unit="C"} 19.5
```

The panel accepts `module_id`/`module`/`module_serial`,
`chip_efuse`/`efuse`/`efuse_code`, and `chip`/`chip_id`. Prefer the first name in each
list. Keep the module/eFuse labels consistent with your mapping. The dashboard
variables expect register and unit labels. If your metric names differ, edit the
panel query **and** the variable queries in the dashboard JSON/UI.

Data controls module/chip colors; it does not establish installation or cabling.
The default sample exporter sets `demo="true"` on every series. Do not scrape it
into an operational detector datasource unless those series are intentionally isolated.

For Docker, run `docker compose up -d --build` after mapping changes. For the native
helper, stop Grafana and rerun `scripts/run-grafana.sh`; for an existing server,
reinstall the whole `dist/` plugin directory and restart Grafana.
