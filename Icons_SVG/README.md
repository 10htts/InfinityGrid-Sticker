# Icons_SVG

This folder contains raster-to-vector conversions of the PNG files in `Icons/` as flat `*.svg` files.

These SVGs are used by `sticker_generator.py` for much faster OpenSCAD STL exports (vs PNG `surface()` heightmaps), with crisp 90° walls.

## Auto-generation

SVGs are generated with `tools/convert_icons_to_svg.py` (OpenCV contour tracing).

Generate missing SVGs only:

```powershell
python tools/convert_icons_to_svg.py --icons-dir Icons --out-dir Icons_SVG --missing-only
```

Re-generate everything:

```powershell
python tools/convert_icons_to_svg.py --icons-dir Icons --out-dir Icons_SVG --force
```

`python cli.py` also keeps `Icons_SVG/` in sync automatically (it generates SVGs if you add new PNGs to `Icons/`).

## Benchmark

```powershell
python tools/benchmark_svg_vs_png.py --icon mechanical_spring.png --text Bench --y-units 1
```

