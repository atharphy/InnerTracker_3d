#!/usr/bin/env python3

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise SystemExit(
        "PyYAML is required. Install it with: python3 -m pip install --user pyyaml"
    ) from exc


GEOMETRY_FILES = {
    "barrel_geometry.yaml": "TBPX",
    "forward_geometry.yaml": "TFPX",
    "endcap_geometry.yaml": "TEPX",
}


def value(row, *names):
    for name in names:
        candidate = row.get(name)
        if candidate is not None and str(candidate).strip():
            return str(candidate).strip()
    return ""


def load_lookup(filename):
    by_hardware = defaultdict(list)
    seen_efuses = {}

    with Path(filename).open(newline="", encoding="utf-8-sig") as stream:
        for line, row in enumerate(csv.DictReader(stream), start=2):
            board = value(row, "board")
            optical = value(row, "optical", "optical_group")
            hybrid = value(row, "hybrid")
            chip_text = value(row, "chip", "chip_id")
            efuse = value(row, "chip_efuse", "efuse", "efuse_code")
            module = value(row, "module_id", "module", "module_serial", "module_name")

            if not all((board, optical, hybrid, chip_text, efuse, module)):
                raise ValueError(f"Incomplete lookup row {line}: {row}")
            try:
                chip = int(chip_text)
            except ValueError as exc:
                raise ValueError(f"Invalid chip ID on lookup row {line}: {chip_text}") from exc
            if chip not in range(4):
                raise ValueError(f"Chip ID on row {line} must be between 0 and 3.")

            identity = (module, chip)
            previous = seen_efuses.get(efuse)
            if previous is not None and previous != identity:
                raise ValueError(f"eFuse {efuse} is assigned to both {previous} and {identity}.")
            seen_efuses[efuse] = identity
            by_hardware[(board, optical, hybrid)].append(
                {"module": module, "chip": chip, "efuse": efuse}
            )

    return by_hardware


def chip_map(records, source_key):
    modules = {record["module"] for record in records}
    if len(modules) != 1:
        raise ValueError(f"{source_key} resolves to multiple modules: {sorted(modules)}")

    chips = {}
    for record in records:
        chip = record["chip"]
        if chip in chips and chips[chip] != record["efuse"]:
            raise ValueError(f"{source_key} has conflicting eFuses for chip {chip}.")
        chips[chip] = record["efuse"]

    expected = {0, 1} if len(chips) == 2 else {0, 1, 2, 3}
    if set(chips) != expected:
        raise ValueError(
            f"{source_key} has chip IDs {sorted(chips)}; "
            "expected [0, 1] or [0, 1, 2, 3]."
        )
    return next(iter(modules)), dict(sorted(chips.items()))


def convert_geometry(data, by_hardware, filename):
    converted = {}
    for source_key, location in data.items():
        if not isinstance(location, dict):
            raise ValueError(f"Invalid geometry entry {source_key!r} in {filename}.")

        parts = str(source_key).split("/")
        if len(parts) != 3:
            raise ValueError(
                f"Geometry key {source_key!r} in {filename} must be board/optical/hybrid."
            )
        records = by_hardware.get(tuple(parts), [])
        if not records:
            raise ValueError(f"No lookup rows match {source_key!r} in {filename}.")

        module, chips = chip_map(records, source_key)
        if module in converted:
            raise ValueError(f"Module {module!r} occupies multiple positions in {filename}.")
        converted[module] = dict(location)
        converted[module]["chips"] = chips
    return converted


def load_portcards(filename, modules):
    data = yaml.safe_load(Path(filename).read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError("Portcards YAML must be keyed by board ID.")
    occupied = set()
    connected = set()
    for board, entry in data.items():
        if not isinstance(board, str) or not isinstance(entry, dict):
            raise ValueError("Each portcard needs a board ID and placement object.")
        slot = entry.get("slot", "")
        if not isinstance(slot, str) or not re.fullmatch(r"(TBPX|TFPX|TEPX):[+-]z:(right|left):[WD][1-8]:R[1-3]:C[1-9]", slot):
            raise ValueError(f"{board}: invalid mounting slot.")
        owner, side, half, element, row, col = slot.split(":")
        n, r, c = int(element[1:]), int(row[1:]), int(col[1:])
        if owner == "TBPX":
            valid = element[0] == "W" and n in (1, 2)
            rows, columns = (2, 9) if n == 1 else (3, 6)
            population = (18 if side == "+z" else 17) if n == 1 else (17 if side == "+z" else 16)
        else:
            valid = element[0] == "D" and n <= (8 if owner == "TFPX" else 4)
            rows, columns, population = (1, 8, 8) if owner == "TFPX" else (2, 5, 10)
        if not valid or r > rows or c > columns or (r-1)*columns+c > population:
            raise ValueError(f"{board}: slot does not exist.")
        if slot in occupied:
            raise ValueError(f"{board}: duplicate slot {slot}.")
        occupied.add(slot)
        links = entry.get("connections")
        if not isinstance(links, list):
            raise ValueError(f"{board}: connections must be a list.")
        for link in links:
            if not isinstance(link, dict) or link.get("module") not in modules:
                raise ValueError(f"{board}: connection requires an installed module serial.")
            serial = link["module"]
            if type(link.get("lpgbt")) is not int or link["lpgbt"] not in (0, 1, 2):
                raise ValueError(f"{board}: lpGBT must be 0, 1 or 2.")
            if serial in connected:
                raise ValueError(f"{serial}: duplicate portcard connection.")
            connected.add(serial)
            placement = modules[serial]
            if placement.get("subdetector") != owner:
                raise ValueError(f"{board}: module belongs to another subsystem.")
    return data


def main():
    parser = argparse.ArgumentParser(
        description="Generate this 3D dashboard's module/eFuse geometry and JSON mapping."
    )
    parser.add_argument(
        "lookup_csv", nargs="?",
        help="CSV containing board,optical,hybrid,chip,chip_efuse,module_id",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--portcards-only", action="store_true", help="Regenerate portcard mapping using existing module JSON.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    templates = root / "hardware_geometry"
    if args.portcards_only:
        mapping = json.loads((root / "src/generatedModuleMapping.json").read_text())
        cards = load_portcards(templates / "portcards.yaml", mapping)
        output = root / "src/generatedPortcardMapping.json"
        if not args.dry_run:
            output.write_text(json.dumps(cards, indent=2) + "\n")
        print(f"{'Would write' if args.dry_run else 'Updated'} {output} ({len(cards)} portcard(s)).")
        return
    if not args.lookup_csv:
        parser.error("lookup_csv is required unless --portcards-only is used.")

    by_hardware = load_lookup(args.lookup_csv)
    mapping = {}

    for name, subdetector in GEOMETRY_FILES.items():
        source = templates / name
        output = root / name
        data = yaml.safe_load(source.read_text(encoding="utf-8")) or {}
        converted = convert_geometry(data, by_hardware, source)
        for module, placement in converted.items():
            mapping[module] = {"subdetector": subdetector, **placement}

        if args.dry_run:
            print(f"Would write {output} ({len(converted)} module(s)).")
        else:
            output.write_text(
                yaml.safe_dump(converted, sort_keys=False, allow_unicode=False),
                encoding="utf-8",
            )
            print(f"Updated {output} ({len(converted)} module(s)).")

    cards = load_portcards(templates / "portcards.yaml", mapping)
    if not args.dry_run:
        (root / "src/generatedPortcardMapping.json").write_text(json.dumps(cards, indent=2) + "\n", encoding="utf-8")
    generated = root / "src" / "generatedModuleMapping.json"
    if args.dry_run:
        print(f"Would write {generated} ({len(mapping)} module(s)).")
    else:
        generated.write_text(json.dumps(mapping, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {generated} ({len(mapping)} module(s)).")
        print("Run npm run build before deploying the 3D dashboard.")


if __name__ == "__main__":
    main()
