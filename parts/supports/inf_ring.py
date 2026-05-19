import FreeCAD as App
import Part

doc = App.newDocument("Clamp_Upper_FINAL")

# ======================
# PARAMETRI
# ======================
stanchion_d = 38
wall = 5
width = 12

gap = 4
bolt_d = 5

arm_len = 25

# ======================
# ANELLO
# ======================
outer_d = stanchion_d + 2*wall

ring = Part.makeCylinder(outer_d/2, width)
inner = Part.makeCylinder(stanchion_d/2, width)
ring = ring.cut(inner)

# apertura clamp
cut = Part.makeBox(outer_d, gap, width)
cut.translate(App.Vector(-outer_d/2, -gap/2, 0))
ring = ring.cut(cut)

# ======================
# ORECCHIE PER 2 VITI (asse X)
# ======================
ear_th = 6
ear_w = 12

ear1 = Part.makeBox(ear_th, ear_w, width)
ear1.translate(App.Vector(outer_d/2 - ear_th, -ear_w/2, 0))

ear2 = Part.makeBox(ear_th, ear_w, width)
ear2.translate(App.Vector(-outer_d/2, -ear_w/2, 0))

ears = ear1.fuse(ear2)

# due fori (uno sopra uno sotto)
for z in [width*0.3, width*0.7]:
    hole = Part.makeCylinder(bolt_d/2, outer_d)
    hole.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90)
    hole.translate(App.Vector(0, 0, z))
    ears = ears.cut(hole)

# ======================
# BRACCIO
# ======================
arm = Part.makeBox(6, arm_len, 6)
arm.translate(App.Vector(-3, outer_d/2, width/2 - 3))

# ======================
# OCCHIELLO RUOTATO 90°
# ======================
eye_outer = Part.makeCylinder(5, 6)
eye_inner = Part.makeCylinder(2.5, 6)

eye = eye_outer.cut(eye_inner)

# rotazione 90°
eye.rotate(App.Vector(0,0,0), App.Vector(0,1,0), 90)

eye.translate(App.Vector(0, outer_d/2 + arm_len, width/2 - 3))

arm = arm.fuse(eye)

# ======================
# UNIONE
# ======================
final = ring.fuse(ears).fuse(arm)

Part.show(final)
doc.recompute()
