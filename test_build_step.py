from build123d import *

# As parts
with BuildPart() as base_part:
    Box(11.5, 11.5, 0.8)
    base_part.part.color = Color("Black")

with BuildPart() as content_part:
    with BuildSketch(Plane.XY.offset(0.8)):
        Circle(radius=2)
    extrude(amount=0.2)
    content_part.part.color = Color("White")

my_assembly = Compound(children=[base_part.part, content_part.part])
export_step(my_assembly, "test_assembly.step")

# As solids
b_solid = base_part.part.solids()[0]
b_solid.color = Color("Black")
c_solid = content_part.part.solids()[0]
c_solid.color = Color("White")

my_compound = Compound(children=[b_solid, c_solid])
export_step(my_compound, "test_compound.step")
