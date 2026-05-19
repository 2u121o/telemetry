import FreeCAD as App
import Part

doc = App.newDocument("Fork_Upper_Clamp")

# PARAMETRI
stanchion_d = 38
wall = 6
width = 12

bolt_d = 5
gap = 4  # apertura clamp

# corpo anello
outer_d = stanchion_d + 2*wall
ring = Part.makeCylinder(outer_d/2, width)

inner = Part.makeCylinder(stanchion_d/2, width)
ring = ring.cut(inner)

# taglio apertura (clamp)
cut = Part.makeBox(outer_d, gap, width)
cut.translate(App.Vector(-outer_d/2, -gap/2, 0))
ring = ring.cut(cut)

# foro vite serraggio
hole = Part.makeCylinder(bolt_d/2, width)
hole.translate(App.Vector(outer_d/2 - wall/2, 0, 0))
ring = ring.cut(hole)

Part.show(ring)
doc.recompute()
