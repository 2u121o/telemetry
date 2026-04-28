"""
FreeCAD Macro: Box telemetria + Coperchio + Staffa bici
========================================================

Genera TRE pezzi separati:

  1. BOX TELEMETRIA
     - 4 standoff per Nucleo-144 H755ZI-Q
     - 4 fori M4 passanti nel fondo (centrali) per avvitare alla staffa
     - Clip snap-fit per il coperchio

  2. COPERCHIO CON CLIP
     - Snap-fit clips + linguette di presa

  3. STAFFA BICI (si avvita al portaborraccia)
     - Piastra con 2 fori M5 (interasse 64mm portaborraccia standard)
     - 4 colonnine M4 che si incastrano nei fori del box
     - Il box si appoggia sulle colonnine e si avvita con 4 viti M4
     - STACCABILE: sviti 4 viti M4 → box libero, staffa resta sulla bici

  Vista laterale assemblato:

     DOWNTUBE
     ║║║║║║║║║║║║║║║║║║║║║
     ║║║╔════════════════╗║║
     ║║║║ STAFFA (M5)    ║║║  ← avvitata al portaborraccia
     ║║║║  ┌──┐    ┌──┐  ║║║
     ║║║╚══│  │════│  │══╝║║  ← colonnine M4
     ║║║   │  │    │  │   ║║
           └──┘    └──┘
        ┌──┤  ├────┤  ├──┐
        │  FONDO BOX (M4)  │  ← box avvitato alle colonnine
        │  ┌──────────────┐│
        │  │   Nucleo     ││
        │  │   H755ZI     ││
        │  └──────────────┘│
        └──────────────────┘
        ┌──────────────────┐
        │    COPERCHIO     │  ← snap-fit
        └──────────────────┘

Come usare:
  1. Apri FreeCAD (documento vuoto)
  2. Macro → Esegui macro → box_and_lid.py
  3. Verranno creati 3 oggetti nell'albero
  4. Esporta CIASCUNO come STL separato

Parametri modificabili nella sezione PARAMETRI.
"""

import FreeCAD as App
import Part
import math

# ============================================================
# PARAMETRI SCHEDA NUCLEO-144 H755ZI-Q
# ============================================================

NUCLEO_W = 69.90          # Larghezza board (mm)
NUCLEO_L = 133.49         # Lunghezza board (mm)
NUCLEO_HOLE_DX = 48.35    # Interasse fori asse X (mm)
NUCLEO_HOLE_DY = 73.19    # Interasse fori asse Y (mm)

_mx = (NUCLEO_W - NUCLEO_HOLE_DX) / 2
_my = (NUCLEO_L - NUCLEO_HOLE_DY) / 2
NUCLEO_HOLES = [
    (_mx,                  _my),
    (_mx + NUCLEO_HOLE_DX, _my),
    (_mx,                  _my + NUCLEO_HOLE_DY),
    (_mx + NUCLEO_HOLE_DX, _my + NUCLEO_HOLE_DY),
]

STANDOFF_D = 7.0
STANDOFF_H = 16.0
STANDOFF_HOLE_D = 2.5

NUCLEO_OFFSET_X = 0.0
NUCLEO_OFFSET_Y = 0.0

# ============================================================
# PARAMETRI BOX
# ============================================================

BOARD_MARGIN = 5.0        # Margine board-parete interna (mm/lato)
WALL_T = 2.0
BASE_T = 2.0
BOX_H = 50.0              # Altezza pareti (mm)

BOX_W = NUCLEO_W + 2 * BOARD_MARGIN + 2 * WALL_T
BOX_L = NUCLEO_L + 2 * BOARD_MARGIN + 2 * WALL_T
BOX_FILLET_R = 2.0

ADD_RIBS = True
RIB_T = 1.5
RIB_H = 15.0

# ============================================================
# PARAMETRI COPERCHIO
# ============================================================

LID_T = 2.0
LID_OVERLAP = 0.5
LIP_DEPTH = 5.0
LIP_T = 1.5
CLEARANCE = 0.30

# ============================================================
# PARAMETRI CLIP SNAP-FIT
# ============================================================

N_CLIPS_PER_SIDE = 2
CLIP_W = 8.0
CLIP_ARM_L = 10.0
CLIP_ARM_T = 1.2
CLIP_HOOK_D = 1.2
CLIP_HOOK_H = 1.8

SLOT_W = CLIP_W + 1.0
SLOT_H = CLIP_HOOK_H + 1.0
SLOT_DEPTH = WALL_T + 0.5

CATCH_T = 1.0
CATCH_H = CLIP_HOOK_H + 0.5
CATCH_W = CLIP_W + 2.0

# ============================================================
# PARAMETRI LINGUETTE DI PRESA
# ============================================================

TAB_W = 16.0
TAB_L = 7.0
TAB_T = 1.8

# ============================================================
# PARAMETRI FORI M4 NEL FONDO BOX (per staffa bici)
# ============================================================

BIKE_HOLE_D = 4.2             # Foro passante M4 (mm)
BIKE_HOLE_HEAD_D = 8.0        # Svasatura testa vite (mm)
BIKE_HOLE_HEAD_H = 2.5        # Profondità svasatura (mm)
BIKE_HOLE_BOSS_D = 12.0       # Rinforzo attorno al foro (mm)
BIKE_HOLE_BOSS_H = 4.0        # Altezza rinforzo (mm)

BIKE_HOLE_SPACING_X = 24.0    # Interasse X (mm)
BIKE_HOLE_SPACING_Y = 70.0    # Interasse Y (mm)

# ============================================================
# PARAMETRI STAFFA BICI (portaborraccia)
# ============================================================

# Fori portaborraccia standard
BOTTLE_HOLE_SPACING = 64.0    # Interasse 2 fori M5 (mm) — standard ISO
BOTTLE_HOLE_D = 5.2           # Foro passante M5 (mm)
BOTTLE_HEAD_D = 10.0          # Testa bullone M5 (mm)
BOTTLE_HEAD_H = 4.0           # Altezza testa bullone (mm)

# Piastra staffa
BRACKET_W = 50.0              # Larghezza (mm)
BRACKET_L = 96.0              # Lunghezza (mm) — copre fori M5 + M4
BRACKET_T = 4.0               # Spessore piastra (mm)
BRACKET_FILLET_R = 3.0        # Raccordo angoli (mm)

# Colonnine M4 (sporgono dalla staffa verso il box)
BOSS_D = 10.0                 # Diametro colonnina (mm)
BOSS_H = 8.0                  # Altezza colonnina (mm) — solleva il box
BOSS_HOLE_D = 4.2             # Foro passante M4 nella colonnina (mm)

# ============================================================
# CALCOLI DERIVATI
# ============================================================

INT_W = BOX_W - 2 * WALL_T
INT_L = BOX_L - 2 * WALL_T
CX = 0.0
CY = 0.0

def clip_positions_y():
    positions = []
    for i in range(N_CLIPS_PER_SIDE):
        frac = (i + 1) / (N_CLIPS_PER_SIDE + 1)
        y = CY - BOX_L / 2 + BOX_L * frac
        positions.append(y)
    return positions

Z_TOP = BOX_H
CLIP_Z_BASE = Z_TOP - LIP_DEPTH * 0.2 - CLIP_ARM_L

LID_W = BOX_W + 2 * LID_OVERLAP
LID_L = BOX_L + 2 * LID_OVERLAP
LIP_EXT_W = INT_W - 2 * CLEARANCE
LIP_EXT_L = INT_L - 2 * CLEARANCE
LIP_INT_W = LIP_EXT_W - 2 * LIP_T
LIP_INT_L = LIP_EXT_L - 2 * LIP_T

# Posizioni fori M4 (centrali)
BIKE_HOLES = [
    (CX - BIKE_HOLE_SPACING_X / 2, CY - BIKE_HOLE_SPACING_Y / 2),
    (CX + BIKE_HOLE_SPACING_X / 2, CY - BIKE_HOLE_SPACING_Y / 2),
    (CX - BIKE_HOLE_SPACING_X / 2, CY + BIKE_HOLE_SPACING_Y / 2),
    (CX + BIKE_HOLE_SPACING_X / 2, CY + BIKE_HOLE_SPACING_Y / 2),
]


# ============================================================
# GENERAZIONE BOX
# ============================================================

def make_box():
    """Genera il box con standoff Nucleo + fori M4 per staffa bici."""

    print("🔧 Generazione box...")

    # --- 1. GUSCIO ---
    outer = Part.makeBox(BOX_W, BOX_L, BOX_H,
        App.Vector(CX - BOX_W/2, CY - BOX_L/2, 0))
    inner = Part.makeBox(INT_W, INT_L, BOX_H - BASE_T + 0.1,
        App.Vector(CX - INT_W/2, CY - INT_L/2, BASE_T))
    shell = outer.cut(inner)
    print("  ✓ Guscio base")

    # --- 2. RACCORDI ---
    try:
        ve = [e for e in shell.Edges if abs(e.Length - BOX_H) < 0.1]
        if ve:
            shell = shell.makeFillet(BOX_FILLET_R, ve)
            print("  ✓ Raccordi angoli")
    except Exception as e:
        print(f"  ⚠ Raccordi: {e}")

    # --- 3. SLOT CLIP ---
    clip_ys = clip_positions_y()
    for y_pos in clip_ys:
        for sign in [+1, -1]:
            sx = CX + sign * BOX_W/2 - (SLOT_DEPTH if sign > 0 else 0)
            slot = Part.makeBox(SLOT_DEPTH, SLOT_W, SLOT_H,
                App.Vector(sx, y_pos - SLOT_W/2, CLIP_Z_BASE - 0.5))
            shell = shell.cut(slot)
    print(f"  ✓ {len(clip_ys)*2} slot clip")

    # --- 4. CATCH CLIP ---
    for y_pos in clip_ys:
        for sign in [+1, -1]:
            cx_pos = (CX + BOX_W/2 - WALL_T - CATCH_T) if sign > 0 else (CX - BOX_W/2 + WALL_T)
            catch = Part.makeBox(CATCH_T, CATCH_W, CATCH_H,
                App.Vector(cx_pos, y_pos - CATCH_W/2, CLIP_Z_BASE - 0.5))
            shell = shell.fuse(catch)
    print(f"  ✓ {len(clip_ys)*2} catch clip")

    # --- 5. NERVATURE ---
    if ADD_RIBS:
        rib_c = Part.makeBox(RIB_T, INT_L - 4, RIB_H,
            App.Vector(CX - RIB_T/2, CY - (INT_L-4)/2, BASE_T))
        shell = shell.fuse(rib_c)
        for frac in [0.33, 0.67]:
            yr = CY - INT_L/2 + INT_L * frac
            rib_x = Part.makeBox(INT_W - 4, RIB_T, RIB_H,
                App.Vector(CX - (INT_W-4)/2, yr - RIB_T/2, BASE_T))
            shell = shell.fuse(rib_x)
        print("  ✓ Nervature interne")

    # --- 6. STANDOFF NUCLEO ---
    box = CX - NUCLEO_W/2 + NUCLEO_OFFSET_X
    boy = CY - NUCLEO_L/2 + NUCLEO_OFFSET_Y
    for (hx, hy) in NUCLEO_HOLES:
        mx, my = box + hx, boy + hy
        boss = Part.makeCylinder(STANDOFF_D/2, STANDOFF_H,
            App.Vector(mx, my, BASE_T), App.Vector(0,0,1))
        shell = shell.fuse(boss)
        hole = Part.makeCylinder(STANDOFF_HOLE_D/2, STANDOFF_H + BASE_T + 1,
            App.Vector(mx, my, -0.5), App.Vector(0,0,1))
        shell = shell.cut(hole)
    print(f"  ✓ 4 standoff Nucleo (interasse {NUCLEO_HOLE_DX} x {NUCLEO_HOLE_DY} mm)")

    # --- 7. FORI M4 PER STAFFA BICI ---
    for bx, by in BIKE_HOLES:
        # Rinforzo
        b = Part.makeCylinder(BIKE_HOLE_BOSS_D/2, BIKE_HOLE_BOSS_H,
            App.Vector(bx, by, BASE_T), App.Vector(0,0,1))
        shell = shell.fuse(b)
        # Foro passante
        h = Part.makeCylinder(BIKE_HOLE_D/2, BASE_T + BIKE_HOLE_BOSS_H + 2,
            App.Vector(bx, by, -0.5), App.Vector(0,0,1))
        shell = shell.cut(h)
    print(f"  ✓ 4 fori M4 (interasse {BIKE_HOLE_SPACING_X} x {BIKE_HOLE_SPACING_Y} mm)")

    try:
        shell = shell.removeSplitter()
    except:
        pass
    return shell


# ============================================================
# GENERAZIONE COPERCHIO
# ============================================================

def make_lid():
    """Genera il coperchio con clip snap-fit."""

    print("\n🔧 Generazione coperchio...")
    parts = []

    top = Part.makeBox(LID_W, LID_L, LID_T,
        App.Vector(CX - LID_W/2, CY - LID_L/2, Z_TOP))
    try:
        ve = [e for e in top.Edges if abs(e.Length - LID_T) < 0.1]
        if ve: top = top.makeFillet(1.5, ve)
    except: pass
    parts.append(top)
    print("  ✓ Piastra superiore")

    lip_o = Part.makeBox(LIP_EXT_W, LIP_EXT_L, LIP_DEPTH,
        App.Vector(CX - LIP_EXT_W/2, CY - LIP_EXT_L/2, Z_TOP - LIP_DEPTH))
    lip_i = Part.makeBox(LIP_INT_W, LIP_INT_L, LIP_DEPTH + 1,
        App.Vector(CX - LIP_INT_W/2, CY - LIP_INT_L/2, Z_TOP - LIP_DEPTH - 0.5))
    lip = lip_o.cut(lip_i)
    try:
        be = [e for e in lip.Edges
              if abs(e.CenterOfMass.z - (Z_TOP - LIP_DEPTH)) < 0.2 and e.Length > 5]
        if be: lip = lip.makeChamfer(0.4, be)
    except: pass
    parts.append(lip)
    print("  ✓ Lip")

    clip_ys = clip_positions_y()
    xr, xl = CX + LIP_EXT_W/2, CX - LIP_EXT_W/2
    for y in clip_ys:
        parts.append(make_clip(xr, y, +1))
        parts.append(make_clip(xl, y, -1))
    print(f"  ✓ {len(clip_ys)*2} clip")

    parts.append(Part.makeBox(TAB_W, TAB_L, TAB_T,
        App.Vector(CX - TAB_W/2, CY + LID_L/2, Z_TOP)))
    parts.append(Part.makeBox(TAB_W, TAB_L, TAB_T,
        App.Vector(CX - TAB_W/2, CY - LID_L/2 - TAB_L, Z_TOP)))
    print("  ✓ 2 linguette")

    result = parts[0]
    for p in parts[1:]:
        try: result = result.fuse(p)
        except: pass
    try: result = result.removeSplitter()
    except: pass
    return result


def make_clip(x_base, y_center, direction):
    d = direction
    z_end = Z_TOP - LIP_DEPTH * 0.2 - CLIP_ARM_L
    arm_x = x_base if d > 0 else x_base - CLIP_ARM_T
    arm = Part.makeBox(CLIP_ARM_T, CLIP_W, CLIP_ARM_L,
        App.Vector(arm_x, y_center - CLIP_W/2, z_end))
    hook_x = (arm_x + CLIP_ARM_T) if d > 0 else (arm_x - CLIP_HOOK_D)
    hook = Part.makeBox(CLIP_HOOK_D, CLIP_W, CLIP_HOOK_H,
        App.Vector(hook_x, y_center - CLIP_W/2, z_end))
    ramp_h = CLIP_HOOK_D * math.tan(math.radians(35))
    if d > 0:
        p1 = App.Vector(hook_x, y_center - CLIP_W/2, z_end + CLIP_HOOK_H)
        p2 = App.Vector(hook_x + CLIP_HOOK_D, y_center - CLIP_W/2, z_end + CLIP_HOOK_H)
        p3 = App.Vector(hook_x, y_center - CLIP_W/2, z_end + CLIP_HOOK_H + ramp_h)
    else:
        p1 = App.Vector(hook_x + CLIP_HOOK_D, y_center - CLIP_W/2, z_end + CLIP_HOOK_H)
        p2 = App.Vector(hook_x, y_center - CLIP_W/2, z_end + CLIP_HOOK_H)
        p3 = App.Vector(hook_x + CLIP_HOOK_D, y_center - CLIP_W/2, z_end + CLIP_HOOK_H + ramp_h)
    try:
        wire = Part.makePolygon([p1, p2, p3, p1])
        face = Part.Face(wire)
        ramp = face.extrude(App.Vector(0, CLIP_W, 0))
        result = arm.fuse(hook).fuse(ramp)
    except:
        result = arm.fuse(hook)
    return result


# ============================================================
# GENERAZIONE STAFFA BICI (portaborraccia)
# ============================================================

def make_bike_bracket():
    """
    Genera la staffa che si avvita ai fori portaborraccia M5.
    Ha 4 colonnine M4 che corrispondono ai fori nel fondo del box.
    Il box si appoggia sulle colonnine e si fissa con 4 viti M4.
    """

    print("\n🔧 Generazione staffa bici...")

    # --- 1. PIASTRA BASE ---
    plate = Part.makeBox(BRACKET_W, BRACKET_L, BRACKET_T,
        App.Vector(CX - BRACKET_W/2, CY - BRACKET_L/2, 0))
    try:
        ve = [e for e in plate.Edges if abs(e.Length - BRACKET_T) < 0.1]
        if ve: plate = plate.makeFillet(BRACKET_FILLET_R, ve)
    except: pass
    print("  ✓ Piastra base")

    result = plate

    # --- 2. COLONNINE M4 (sporgono verso l'alto, verso il box) ---
    for bx, by in BIKE_HOLES:
        col = Part.makeCylinder(BOSS_D/2, BOSS_H,
            App.Vector(bx, by, BRACKET_T), App.Vector(0,0,1))
        result = result.fuse(col)

        # Foro passante M4 (attraversa piastra + colonnina)
        hole = Part.makeCylinder(BOSS_HOLE_D/2, BRACKET_T + BOSS_H + 2,
            App.Vector(bx, by, -0.5), App.Vector(0,0,1))
        result = result.cut(hole)

    print(f"  ✓ 4 colonnine M4 (Ø{BOSS_D}mm x h{BOSS_H}mm)")

    # --- 3. FORI M5 PORTABORRACCIA ---
    for y_sign in [-1, +1]:
        hy = CY + y_sign * BOTTLE_HOLE_SPACING / 2

        # Foro passante M5
        hole = Part.makeCylinder(BOTTLE_HOLE_D/2, BRACKET_T + 2,
            App.Vector(CX, hy, -0.5), App.Vector(0,0,1))
        result = result.cut(hole)

        # Svasatura testa bullone (lato bici = lato -Z)
        cs = Part.makeCylinder(BOTTLE_HEAD_D/2, BOTTLE_HEAD_H + 0.1,
            App.Vector(CX, hy, -0.1), App.Vector(0,0,1))
        result = result.cut(cs)

    print(f"  ✓ 2 fori M5 portaborraccia (interasse {BOTTLE_HOLE_SPACING}mm)")

    # --- 4. ALLEGGERIMENTI (opzionali, riducono peso e materiale) ---
    # Asole tra le colonnine per risparmiare materiale
    for y_sign in [-1, +1]:
        slot_y = CY + y_sign * BIKE_HOLE_SPACING_Y / 4
        slot_w = BIKE_HOLE_SPACING_X - BOSS_D - 2  # tra le colonnine
        if slot_w > 4:
            slot = Part.makeBox(slot_w, 12, BRACKET_T + 2,
                App.Vector(CX - slot_w/2, slot_y - 6, -0.5))
            # Arrotondamenti
            for sy in [-1, +1]:
                c = Part.makeCylinder(slot_w/2, BRACKET_T + 2,
                    App.Vector(CX, slot_y + sy * 6, -0.5), App.Vector(0,0,1))
                slot = slot.fuse(c)
            result = result.cut(slot)

    print("  ✓ Alleggerimenti")

    try:
        result = result.removeSplitter()
    except:
        pass
    return result


# ============================================================
# MAIN
# ============================================================

print("=" * 60)
print("  BOX TELEMETRIA + COPERCHIO + STAFFA BICI")
print("=" * 60)
print(f"\n📦 Box: {BOX_W:.1f} x {BOX_L:.1f} x {BOX_H:.0f} mm")
print(f"🔩 Nucleo: {NUCLEO_W} x {NUCLEO_L} mm (fori {NUCLEO_HOLE_DX} x {NUCLEO_HOLE_DY})")
print(f"🚲 Staffa: {BRACKET_W} x {BRACKET_L} x {BRACKET_T} mm")
print(f"   M5 portaborraccia: interasse {BOTTLE_HOLE_SPACING}mm")
print(f"   M4 colonnine: interasse {BIKE_HOLE_SPACING_X} x {BIKE_HOLE_SPACING_Y}mm")
print(f"\n{'='*60}\n")

doc = App.ActiveDocument
if doc is None:
    doc = App.newDocument("TelemetryBox")

# ── 1. BOX ──
box_shape = make_box()
box_obj = doc.addObject("Part::Feature", "TelemetryBox")
box_obj.Shape = box_shape
box_obj.Label = "Box Telemetria"
try:
    box_obj.ViewObject.ShapeColor = (0.15, 0.15, 0.18)
    box_obj.ViewObject.Transparency = 0
except: pass

# ── 2. COPERCHIO ──
lid_shape = make_lid()
lid_obj = doc.addObject("Part::Feature", "TelemetryLid")
lid_obj.Shape = lid_shape
lid_obj.Label = "Coperchio con Clip"
try:
    lid_obj.ViewObject.ShapeColor = (0.18, 0.72, 0.35)
    lid_obj.ViewObject.Transparency = 25
except: pass

# ── 3. STAFFA BICI ──
bracket_shape = make_bike_bracket()
bracket_obj = doc.addObject("Part::Feature", "BikeBracket")
bracket_obj.Shape = bracket_shape
bracket_obj.Label = "Staffa Bici"
try:
    bracket_obj.ViewObject.ShapeColor = (0.85, 0.45, 0.10)
    bracket_obj.ViewObject.Transparency = 0
except: pass

# Posiziona la staffa sotto il box per visualizzazione assemblaggio
bracket_obj.Placement = App.Placement(
    App.Vector(0, 0, -(BRACKET_T + BOSS_H + 0.5)),
    App.Rotation(0, 0, 0)
)

doc.recompute()

# ============================================================
# REPORT
# ============================================================

bb_box = box_shape.BoundBox
bb_lid = lid_shape.BoundBox
bb_brk = bracket_shape.BoundBox

print(f"\n{'='*60}")
print(f"✅ GENERAZIONE COMPLETATA — 3 PEZZI")
print(f"{'='*60}")
print(f"\n📦 Pezzo 1: BOX TELEMETRIA")
print(f"   {bb_box.XLength:.1f} x {bb_box.YLength:.1f} x {bb_box.ZLength:.1f} mm")
print(f"\n🔝 Pezzo 2: COPERCHIO")
print(f"   {bb_lid.XLength:.1f} x {bb_lid.YLength:.1f} x {bb_lid.ZLength:.1f} mm")
print(f"\n🚲 Pezzo 3: STAFFA BICI")
print(f"   {bb_brk.XLength:.1f} x {bb_brk.YLength:.1f} x {bb_brk.ZLength:.1f} mm")

print(f"\n{'='*60}")
print(f"📋 ESPORTAZIONE STL")
print(f"{'='*60}")
print(f"")
print(f"  Clicca UN pezzo alla volta → File → Esporta → .stl")
print(f"")
print(f"  'Box Telemetria'      → box_telemetria.stl")
print(f"  'Coperchio con Clip'  → coperchio.stl")
print(f"  'Staffa Bici'         → staffa_bici.stl")
print(f"")
print(f"  Oppure dalla console Python:")
print(f"     import Mesh")
print(f"     Mesh.export([App.ActiveDocument.TelemetryBox], 'box_telemetria.stl')")
print(f"     Mesh.export([App.ActiveDocument.TelemetryLid], 'coperchio.stl')")
print(f"     Mesh.export([App.ActiveDocument.BikeBracket], 'staffa_bici.stl')")

print(f"\n🔧 ASSEMBLAGGIO:")
print(f"   1. Avvita la STAFFA al downtube con 2 viti M5 (portaborraccia)")
print(f"   2. Appoggia il BOX sulle 4 colonnine della staffa")
print(f"   3. Avvita con 4 viti M4x{int(BOSS_H + BASE_T + 2)}mm dal basso")
print(f"   4. Monta la Nucleo sugli standoff (4 viti M3)")
print(f"   5. Chiudi il COPERCHIO (snap-fit)")
print(f"   6. Per smontare: svita le 4 viti M4, stacca il box")
print(f"      La staffa resta sulla bici!")

print(f"\n⚙ Stampa 3D:")
print(f"   - Box: fondo verso il basso")
print(f"   - Coperchio: capovolto (lip verso l'alto)")
print(f"   - Staffa: colonnine verso l'alto (piastra sul piatto)")
print(f"   - Materiale: PETG o ABS (NO PLA)")
print(f"   - Infill: 100% per staffa e clip, 20-30% per il resto")
print(f"   - Metti un pad in gomma tra staffa e downtube")
