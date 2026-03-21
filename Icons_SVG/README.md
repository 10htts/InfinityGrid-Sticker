# Icons_SVG

This folder contains the SVG icon library used by the InfinityGrid Sticker Designer icon picker.

## Naming Convention
The frontend groups icons by filename:

`category_subcategory_step_step_step.svg`

Examples:
- `mechanical_screw_pan_head.svg`
- `mechanical_screw_socket_head_low.svg`
- `electrical_connector_xt60.svg`

Notes:
- Use `_` between picker hierarchy steps whenever possible.
- Existing filenames that still use `-` inside the leaf name are tolerated for compatibility, but `_` is the preferred separator for new icons.

## Guidelines
- Keep icons vector-only (no embedded raster data).
- Prefer monochrome paths/shapes.
- Keep naming lowercase with underscores.
- Keep symbols centered and consistently scaled.

## Usage
- The app loads this directory via `GET /api/icons`.
- Existing PNG assets in `Icons/` are legacy sources; active UI icon selection is SVG-based.
