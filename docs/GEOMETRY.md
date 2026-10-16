# Geometry and scope

The model uses equal X/Y/Z scale: one scene unit is 500 mm. It is a nominal
visualization, not surveyed as-built CAD. Active geometry follows the
[CMS IT711 geometry definition](https://github.com/cms-sw/cmssw/blob/master/Geometry/TrackerCommonData/data/PhaseII/Tracker_DD4hep_compatible_IT711_2023_05/pixel.xml),
checked against the construction layout in Giulio Bardelli's PSD14 CMS Inner
Tracker presentation. Modules retain rectangular dimensions rather than expanding
to fill a ring's angular wedge.

| Subsystem | Modules | Layout |
|---|---:|---|
| TBPX | 756 | 4 layers; 108 / 216 / 180 / 252 modules |
| TFPX | 1,728 | 8 disks per Z side; 108 modules per disk |
| TEPX | 1,408 | 4 disks per Z side; 176 modules per disk |
| Total | 3,892 | Both Z sides included |

TFPX full-disk ring populations: 20, 32, 24, 32. TEPX: 20, 28, 36, 44, 48.

| Quantity | mm |
|---|---|
| TBPX layer radii | 30, 61.5, 104.5, 146.5 |
| TBPX axial module pitch | 44.4 (L1), 44.75 (L2–L4) |
| TFPX ring centers | 52.725, 70.725, 104.925, 138.265 |
| TEPX ring centers | 84.625, 122.275, 159.575, 196.175, 232.225 |
| Disk module radial length | 44.45 |
| Double / quad tangential width | 18.8 / 35.85 |
| Maximum active absolute Z | 2,650 |

Ring envelopes overlap in XY while modules are staggered in Z. Each spatial half
has two Dee supports with populated faces. In the implemented nominal placement,
TFPX ring parity selects the support and azimuthal parity selects its face; TEPX
azimuthal parity selects the support and ring parity selects its face. Dee 1/2 in
the UI mean nearer/farther from the interaction point, independently of Z side.

The model includes barrel ladder mechanics, disk support layers, beam pipe,
service cylinder, antlers, nominal portcards and cable representations. Support
thicknesses, service envelopes, connector widths, antler detail and cable routing
remain reconstructions. The copper cooling finish follows the visualization's
requested appearance; it is not a material certification for every CMS subsystem.
Electrical routes are illustrative unless associated through explicit YAML mapping;
a final physical wiring map is still needed for actual routing and pin-level connectivity.

Hiding supports enables two-sided image viewing for inspection, without duplicating
module instances. Images may occlude one another in projection; rotate the model
or isolate a Dee to inspect overlapping rings. Rendering fixes include clean Dee
beam openings and removal of hidden-Dee chip outlines from Modules mode.

Run `npm run counts` for CSVs with populations by layer, ladder, disk, ring, half and
individual module ID. Counts refer to nominal positions, not installed serials.
