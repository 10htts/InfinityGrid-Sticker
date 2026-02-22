from build123d import *

# Simulated parameters
width = 34.5
height = 10.5
svg_width_val = float(width)
length = svg_width_val + 1.3
base_width_val = 11.5
base_thickness = 0.8
corner_radius = 0.9

with BuildPart() as base:
    with BuildSketch() as s:
        RectangleRounded(length, base_width_val, corner_radius)
        RectangleRounded(length + 2, 5.7, 0.2)
    extrude(amount=base_thickness)

print("Base bbox:", base.part.bounding_box())

svg_path = 'test_scale.svg'
svg_content = '<svg xmlns="http://www.w3.org/2000/svg" width="34.5mm" height="10.5mm" viewBox="0 0 34.5 10.5"><path fill-rule="evenodd" fill="black" d="M 0 0 L 34.5 0 L 34.5 10.5 L 0 10.5 Z"/></svg>'
with open(svg_path, 'w') as f:
    f.write(svg_content)

with BuildPart() as content:
    with BuildSketch(Plane.XY.offset(base_thickness)):
        with Locations((-svg_width_val / 2, float(height) / 2)):
            add(import_svg(svg_path))
    extrude(amount=0.2)
    
print("Content Y+H/2 bbox:", content.part.bounding_box())

with BuildPart() as content_minus:
    with BuildSketch(Plane.XY.offset(base_thickness)):
        with Locations((-svg_width_val / 2, -float(height) / 2)):
            add(import_svg(svg_path))
    extrude(amount=0.2)
print("Content Y-H/2 bbox:", content_minus.part.bounding_box())

with BuildPart() as content_zero:
    with BuildSketch(Plane.XY.offset(base_thickness)):
        with Locations((-svg_width_val / 2, 0)):
            add(import_svg(svg_path))
    extrude(amount=0.2)
print("Content Y=0 bbox:", content_zero.part.bounding_box())
