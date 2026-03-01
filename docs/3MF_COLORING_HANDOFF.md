# 3MF Coloring Notes

This document captures the current 3MF strategy and known slicer variability.

## Goal
Produce a 3MF that imports with:
- a base body (typically white),
- content body for icon/text (typically black),
- correct Z stacking for multi-material printing.

## Current Approach
- Frontend generates SVG content/mask from tag data.
- Mesh data is generated for separate base/content geometry.
- 3MF writer emits:
  - base/material resources,
  - object meshes for base/content,
  - build items for slicer import.

## Known Variability
Different slicers interpret material assignment differently, especially for:
- assemblies vs direct build items,
- object-level vs component-level property references,
- triangle-level property metadata.

Because of that, the same 3MF can look correct in one slicer and partially flattened/recolored in another.

## Recommended Debug Process
1. Export a minimal label (single icon + one text line).
2. Open the 3MF as a zip and inspect `3D/3dmodel.model`.
3. Verify:
   - base/content objects both exist,
   - content triangles are above base Z,
   - material/property references are present where expected.
4. Compare import behavior in at least two slicers.

## Practical Next Improvements
- Add explicit export mode toggle:
  - Assembly model
  - Split build items
  - Single object with per-triangle materials
- Add slicer profile presets once cross-slicer behavior is validated.
