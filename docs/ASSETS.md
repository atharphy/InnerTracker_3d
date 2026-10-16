# Asset attribution

Hardware image assets in `src/img/components/` are visual derivatives of reference
photos and drawings used during development, including CMS Phase-2 Inner Tracker
construction and system-test presentations by Giulio Bardelli and collaborators.
They illustrate modules, TBPX/TFPX portcards and TEPX portcards; they are not CAD
textures with surveyed dimensions. Presentation PDF files are not bundled here.

The repository's Apache-2.0 license applies to its original software. Underlying
CMS/reference photographs and logos retain their original ownership; this file does
not grant additional rights in third-party source images or imply CMS endorsement.
For reuse requiring specific image permissions, confirm those with the original
rights holders or replace the component images with assets you can redistribute.

Image imports are centralized in `src/geometry/componentPhotos.ts`; normalized
connector anchors and opaque image bounds are in `connectionAnchors.ts`. If replacing
an image, update its bounds and anchors as well so visible boards and cables align.
