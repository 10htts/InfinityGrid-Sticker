# Icons_SVG

This folder contains the SVG icon library used by the InfinityGrid Sticker Designer icon picker.

## Naming Convention
The frontend groups icons by filename:

`category_subcategory_name.svg`

Examples:
- `mechanical_screw_pan_head.svg`
- `electrical_connector_xt60.svg`

## Guidelines
- Keep icons vector-only (no embedded raster data).
- Prefer monochrome paths/shapes.
- Keep naming lowercase with underscores.
- Keep symbols centered and consistently scaled.

## Usage
- The app loads this directory via `GET /api/icons`.
- Existing PNG assets in `Icons/` are legacy sources; active UI icon selection is SVG-based.
