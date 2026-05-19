import FreeCAD as App
import Part
import math

doc = App.newDocument("BYB_MetaSX_V5")

# ========================
# PARAMETRI (REALISTICI)
# ========================

# Base supporto frame
base_length = 70
base_width = 25
base_thickness = 6

hole_diameter = 6.2
hole_spacing = 45

# Sensore
sensor_diameter = 12
sensor_holder_wall = 3
sensor_length = 80

# Inclinazione sensore (importante)
angle_deg = 15

# ========================
# BASE FRAME
# ========================
base = Part.makeBox(base_length, base_width, base_thickness)

# Fori montaggio
hole1 = Part.makeCylinder(hole_diameter/2, base_thickness)
hole1.translate(App.Vector(10, base_width/2, 0))

hole2 = Part.makeCylinder(hole_diameter/2, base_thickness)
hole2.translate(App.Vector(10 + hole_spacing, base_width/2, 0))

base = base.cut(hole1).cut(hole2)

# ========================
# SUPPORTO SENSORE (CLAMP)
# ========================
outer_d = sensor_diameter + 2 * sensor_holder_wall

clamp = Part.makeCylinder(outer_d/2, sensor_length)
sensor_hole = Part.makeCylinder(sensor_diameter/2, sensor_length)

clamp = clamp.cut(sensor_hole)

# Rotazione (allineamento sospensione)
rotation = App.Rotation(App.Vector(0,1,0), angle_deg)
clamp.Placement = App.Placement(
    App.Vector(base_length/2, base_width/2, base_thickness),
    rotation
)

# ========================
# TAGLIO PER CLAMP (tipo BYB)
# ========================
cut_slot = Part.makeBox(outer_d, 3, sensor_length)
cut_slot.translate(App.Vector(
    base_length/2 - outer_d/2,
    base_width/2 - 1.5,
    base_thickness
))

clamp = clamp.cut(cut_slot)

# ========================
# UNIONE
# ========================
final = base.fuse(clamp)

Part.show(final)
doc.recompute()
