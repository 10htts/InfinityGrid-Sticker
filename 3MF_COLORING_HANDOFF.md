# 3MF Coloring Handoff (Unresolved)

## Goal
Export `.3mf` so:
- base/top layer is white (or base color),
- only icon/text regions are black,
- geometry stays correctly stacked in Z (icons/text not dropped to layer 0).

## Current user-reported failures
Observed across attempts:
1. Whole top face imports black instead of only icon/text.
2. In some variants, icon/text part appears on layer 0.

## Current implementation (where to look)

### SVG and mask generation
- `assets/js/app.js:1064` `generateSVGString(tagData, forceBlack = false)`
- `.3mf` path uses `generateSVGString(tagData, true)` (black on white mask)
- Rasterization: `assets/js/app.js:1412` `svgToImageData(...)`
- Mask extraction (luma+alpha threshold): `assets/js/app.js:1991` `extractContourGroupsFromImageData(...)`

### 3MF geometry build
- Constants:
  - `assets/js/app.js:1375` `CONTENT_LAYER_HEIGHT_MM = 0.2`
  - `assets/js/app.js:1378` `CONTENT_BASE_Z_MM = 0.8`
  - `assets/js/app.js:1381` `CONTENT_3MF_CONTOUR_CUT_WIDTH_MM = 0.02`
  - `assets/js/app.js:1382` `CONTENT_3MF_BASE_LAYER_HEIGHT_MM = 0.2`
  - `assets/js/app.js:1383` `CONTENT_3MF_ICON_EXTRA_HEIGHT_MM = 0.2`
- Contour helpers:
  - `assets/js/app.js:2047` `normalizeContentGroups(...)`
  - `assets/js/app.js:2068` `buildTopLayerWithContourCut(...)`
- Mesh builder:
  - `assets/js/app.js:2447` `buildTag3MFMeshData(...)`
  - Base top partition is extruded `0.8 -> 1.0`
  - Content (icons/text) is extruded `1.0 -> 1.2`

### 3MF writer
- `assets/js/app.js:2584` `build3MFObjectXml(...)`
  - object-level `pid/pindex`
  - triangle-level `pid/p1/p2/p3`
- `assets/js/app.js:2605` `build3MFModelXml(...)`
  - `<basematerials id="10">` with white+black
  - object `1 = Base`, object `2 = Content`, object `3 = assembly`
  - build currently contains `<item objectid="3" />`
- `assets/js/app.js:2624` `write3MF(...)`

### Server MIME
- `server.py:29` supports `.3mf` as `model/3mf`.

## What was tried so far (chronological)

1. **Initial 3MF export from STL mesh path**
   - Used `buildTagMeshData(...)` with forced `pocketMode: solid`.
   - Result: color/material separation unreliable.

2. **Split 3MF mesh pipeline**
   - Added dedicated `buildTag3MFMeshData(...)`.
   - Base keeps full top-layer geometry excluding black regions; content has black regions.

3. **Contour extraction robustness**
   - Added adaptive contour grouping by matching expected filled area.
   - Changed mask fill test from red-channel-only to luma+alpha.

4. **Contour cut approach**
   - Implemented `0.02mm` contour cut around black regions for base top layer.
   - Goal: avoid coplanar ambiguity and force clean separation.

5. **Material encoding hardening**
   - Added explicit base and content materials in `basematerials`.
   - Added per-object and per-triangle material tags.
   - Switched display colors to 6-digit hex (`#FFFFFF`, `#000000`).

6. **Build structure variants**
   - Tried dual build items (`objectid=1` + `objectid=2`) for importer compatibility.
   - User reported icon/text dropping to layer 0 in that variant.
   - Reverted to assembly build item (`objectid=3`) to preserve Z placement.

7. **Height separation**
   - Made content one extra layer above top base layer (`1.0 -> 1.2` vs base top `0.8 -> 1.0`).
   - Geometry became correct, but coloring remained wrong in user workflow.

## Why this is likely still failing
Slicer/importer behavior differs a lot for:
- assembly object material inheritance,
- component-level vs object-level material precedence,
- per-triangle material parsing on component objects.

The current file is valid enough to load, but importer may flatten color assignment across top faces.

## Repro steps used
1. Open app, create tag with at least one icon/text.
2. Export `.3mf` from main download flow.
3. Import into slicer.
4. Verify:
   - Z levels (content above base),
   - only icon/text faces get black filament.

## Suggested next experiments (priority order)

1. **Inspect generated `3D/3dmodel.model` from an exported file**
   - Confirm actual triangle counts in object 1 vs 2.
   - Confirm content object has non-zero Z (>= `1.0`).
   - Confirm `pid/pindex` and triangle `pid/p1/p2/p3` values.

2. **Set material on component entries (not just child objects)**
   - Keep assembly object `3`.
   - Add `pid/pindex` directly on `<component objectid="1"...>` and `<component objectid="2"...>`.
   - Some slicers prefer component-level property assignment for assemblies.

3. **Single-object, per-triangle material export**
   - Merge base+content triangles into one object.
   - Assign white/black per triangle using same `pid`.
   - Avoids assembly/component interpretation differences.

4. **Offer slicer-specific export mode**
   - Add selectable 3MF mode:
     - `Assembly (current)`
     - `Dual Build Items`
     - `Single Object + Triangle Materials`
   - Keep geometry generation identical; vary only XML structure.

5. **Add optional tiny XY shrink on content (e.g. 0.01mm)**
   - Reduces face-overlap ambiguity in importers that fuse touching shells.

## Data another AI should collect next
- One problematic exported `.3mf` file from user.
- User slicer + version (e.g. Bambu Studio x.y.z, OrcaSlicer x.y.z, PrusaSlicer x.y.z).
- Screenshot of object/material tree after import.
- Whether “split to parts/objects” import options are enabled.

## Important note
Geometry logic is now close to desired behavior. Remaining issue appears to be **3MF importer/material interpretation**, not contour generation alone.
