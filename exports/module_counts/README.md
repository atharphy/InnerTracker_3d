# Module count export

Generated with `node export_module_counts.cjs` from the current default geometry.

- module_counts_by_location.csv: mutually exclusive groups; sum module_count for the total. TBPX rows are per layer, signed ladder and Z side. Disk rows are per subdetector, Z side, disk, ring and spatial half.
- module_count_summary.csv: separate subtotal levels; filter aggregation before summing (do not sum all levels together).
- module_positions.csv: one row per module, with stable geometry ID and coordinates in mm. These are nominal geometry positions, not installed serial numbers.

Population: 3,892 = 756 TBPX + 1,728 TFPX + 1,408 TEPX. The restored two-sided Dee population matches the slides. It includes all positions in that model, not just YAML-installed modules. All original disk indices are restored.

Disk spatial_half right corresponds to the legacy YAML half 'upper'; left corresponds to 'lower'. Disk indices start at 0; barrel module indices start at 1. +z and -z disk numbers are separate physical disks. Coordinates use restored nominal ring radii and staggered Z planes.
