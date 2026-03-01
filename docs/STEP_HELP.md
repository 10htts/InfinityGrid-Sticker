# STEP Export Notes

## Purpose
STEP export provides CAD-friendly multi-body geometry for downstream editing and CAM workflows.

## Current Behavior
- Backend receives SVG + dimensions from the frontend.
- Build123d constructs base/content solids.
- Export uses Build123d STEP exporter.

## Expected Result
- Valid `.step` file
- Distinct solids for base and content regions
- Geometry scaled to selected label dimensions

## Troubleshooting
- If export fails, check backend logs for Build123d import/extrude errors.
- If geometry is missing:
  - verify SVG contains visible filled paths,
  - verify label has at least one icon or text region.
- If slicer/CAD shows extra tiny bodies, inspect source SVG for artifacts.

## Build123d Reference
Primary API used: `build123d.export_step(...)`
