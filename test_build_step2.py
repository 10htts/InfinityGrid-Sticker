from build123d import *

# As parts
with BuildPart() as base_part:
    Box(11.5, 11.5, 0.8)

with BuildPart() as content_part:
    with BuildSketch(Plane.XY.offset(0.8)):
        Circle(radius=2)
    extrude(amount=0.2)

# Color solids explicitly
base_solids = base_part.part.solids()
for s in base_solids:
    s.color = Color("Black")

content_solids = content_part.part.solids()
for s in content_solids:
    s.color = Color("White")

all_solids = base_solids + content_solids
my_compound = Compound(children=all_solids)
export_step(my_compound, "test_compound2.step")
