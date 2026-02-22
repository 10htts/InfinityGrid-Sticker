import json
import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, Form, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from build123d import BuildPart, Box, BuildSketch, import_svg, extrude, Compound, export_step, Color, Plane, add
import uvicorn

PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
BASE_DIR = Path(__file__).parent.resolve()
ICONS_FOLDER = BASE_DIR / "Icons_SVG"

app = FastAPI(title="InfinityGrid Sticker Designer API")

def build_step_worker(svg_text, w, h, sty, queue):
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            svg_path = temp_dir_path / "label_content.svg"
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(svg_text)

            base_thickness = 0.8
            with BuildPart() as base:
                svg_width_val = float(w)
                length = svg_width_val + 1.3
                base_width_val = 11.5
                chamfer_val = 0.2
                corner_radius = 0.9
                with BuildSketch() as s:
                    from build123d import RectangleRounded, chamfer, Axis
                    RectangleRounded(length, base_width_val, corner_radius)
                    RectangleRounded(length + 2, 5.7, 0.2)
                extrude(amount=base_thickness)
                top_edges = base.faces().sort_by(Axis.Z)[-1].outer_wire().edges()
                bottom_edges = base.faces().sort_by(Axis.Z)[0].outer_wire().edges()
                try:
                    chamfer(top_edges + bottom_edges, length=chamfer_val)
                except Exception as e:
                    print(f"Warning: Chamfer failed on base: {e}")
                base.part.color = Color("Black")

            from build123d import Locations

            def build_svg_part(z_offset: float, depth: float):
                with BuildPart() as p:
                    with BuildSketch(Plane.XY.offset(z_offset)):
                        with Locations((-svg_width_val / 2, -float(h) / 2)):
                            add(import_svg(str(svg_path)))
                    extrude(amount=depth)
                return p.part

            if sty == "flush":
                # Create a slightly deeper pocket cutter so the inlay is a separate body
                # with tiny clearance (prevents coplanar-body ambiguity in viewers/slicers).
                pocket_depth = 0.22
                inlay_depth = 0.2
                cutter_part = build_svg_part(base_thickness - pocket_depth, pocket_depth)
                content_part = build_svg_part(base_thickness - inlay_depth, inlay_depth)
                base.part -= cutter_part
            else:
                content_part = build_svg_part(base_thickness, 0.2)

            content_part.color = Color("White")

            base_solids = base.part.solids()
            for s in base_solids:
                s.color = Color("Black")
            content_solids = content_part.solids()
            for s in content_solids:
                s.color = Color("White")

            my_assembly = Compound(children=base_solids + content_solids)
            step_path = temp_dir_path / "multicolor_label.step"
            export_step(my_assembly, str(step_path))
            with open(step_path, "rb") as f:
                queue.put(("ok", f.read()))
    except Exception as e:
        queue.put(("err", str(e)))

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_icon_files():
    """Get all SVG files from Icons_SVG folder."""
    if not ICONS_FOLDER.exists():
        print(f"Icons folder not found: {ICONS_FOLDER}")
        return []
    files = [f.name for f in ICONS_FOLDER.iterdir() if f.suffix.lower() == ".svg"]
    return sorted(files)

@app.get("/api/icons")
async def list_icons():
    """API endpoint to list available icons."""
    icons = get_icon_files()
    return JSONResponse(content={"files": icons})

@app.post("/api/export_step")
async def export_step_endpoint(
    svg_file: UploadFile = File(...),
    width: float = Form(...),
    height: float = Form(...),
    style: str = Form("raised")
):
    """
    Receives SVG File and dimensions, uses Build123d to create a Multi-Body Assembly,
    and returns a downloadable .step file.
    """
    svg_content = ""
    try:
        # Read the uploaded file content bytes
        svg_content_bytes = await svg_file.read()
        svg_content = svg_content_bytes.decode('utf-8')
        
        class _Q:
            def __init__(self):
                self.items = []
            def put(self, value):
                self.items.append(value)

        q = _Q()
        build_step_worker(svg_content, width, height, style, q)
        if not q.items:
            raise HTTPException(status_code=500, detail="STEP export failed without details")
        status, payload = q.items[0]
        if status != "ok":
            raise HTTPException(status_code=500, detail=payload)
        step_data = payload
                
        # Return the STEP file as a downloadable response
        from fastapi import Response
        return Response(
            content=step_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=multicolor_label.step"}
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Save failed SVG for debugging
        if svg_content:
            failed_path = BASE_DIR / "failed.svg"
            with open(failed_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            print(f"Saved failed SVG to {failed_path}")
        raise HTTPException(status_code=500, detail=str(e))

# Serve the Icons directory
app.mount("/icons", StaticFiles(directory=str(ICONS_FOLDER)), name="icons")

# Serve the 'assets' directory properly
assets_dir = BASE_DIR / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

# Serve specific root files
@app.get("/{filename}")
async def serve_root_file(filename: str):
    file_path = BASE_DIR / filename
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/")
async def serve_index():
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Index.html not found")


if __name__ == "__main__":
    icons = get_icon_files()
    print()
    print("InfinityGrid Sticker Designer (FastAPI + Build123d)")
    print("-" * 50)
    print(f"Server running at: http://{HOST}:{PORT}")
    print(f"Icons folder: {ICONS_FOLDER}")
    print(f"Icons found: {len(icons)}")

    if len(icons) == 0:
        print()
        print("WARNING: No SVG files found in Icons_SVG folder.")

    print()
    print("Press Ctrl+C to stop.")
    print()

    uvicorn.run("server:app", host=HOST, port=PORT, reload=False)
