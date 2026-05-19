import FreeCAD as App
import Part
import math

doc = App.newDocument("BYB_Frame_Pro")

# PARAMETRI REALI
base_thickness = 6
hole_d = 6.2
hole_spacing = 45

sensor_d = 12
clamp_wall = 3

offset_height = 25   # distanza dal telaio (BYB style)
angle = 15           # inclinazione

# BASE
base = Part.makeBox(70, 25, base_thickness)

h1 = Part.makeCylinder(hole_d/2, base_thickness)
h1.translate(App.Vector(10, 12.5, 0))

h2 = Part.makeCylinder(hole_d/2, base_thickness)
h2.translate(App.Vector(55, 12.5, 0))

base = base.cut(h1).cut(h2)

# BRACCIO OFFSET (fondamentale)
arm = Part.makeBox(10, 20, offset_height)
arm.translate(App.Vector(30, 2.5, base_thickness))

# CLAMP sensore
outer = sensor_d + 2*clamp_wall

clamp = Part.makeCylinder(outer/2, 50)
hole = Part.makeCylinder(sensor_d/2, 50)
clamp = clamp.cut(hole)

# slot clamp (vite serraggio)
slot = Part.makeBox(outer, 3, 50)
slot.translate(App.Vector(-outer/2, -1.5, 0))
clamp = clamp.cut(slot)

# rotazione
clamp.Placement = App.Placement(
    App.Vector(35, 12.5, base_thickness + offset_height),
    App.Rotation(App.Vector(0,1,0), angle)
)

final = base.fuse(arm).fuse(clamp)

Part.show(final)
doc.recompute()
