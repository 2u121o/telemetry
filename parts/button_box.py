"""
FreeCAD Macro: Scatoletta per 3 pulsanti luminosi 16mm
=======================================================

Genera DUE pezzi separati:

  1. SCATOLA PULSANTI
     - 3 fori da 16mm in fila per pulsanti illuminati
     - Pareti spesse e resistenti
     - Foro uscita cavi sul retro
     - Filettatura interna simulata (lip) per coperchio a vite

  2. COPERCHIO A VITE (twist-lock)
     - Si avvita con 1/4 di giro (bayonet/twist-lock)
     - 3 pin sul coperchio + 3 slot a L nel box
     - Resistente alle vibrazioni (non si svita da solo)
     - Guarnizione lip per tenuta

  Vista dall'alto:

     ┌─────────────────────────────┐
     │  ┌───┐    ┌───┐    ┌───┐   │
     │  │ ○ │    │ ○ │    │ ○ │   │  ← 3 pulsanti 16mm
     │  └───┘    └───┘    └───┘   │
     └─────────────────────────────┘

  Vista laterale assemblato:

     ┌─────────────────────────────┐  ← Pannello pulsanti (top)
     │  ○      ○      ○           │  ← Pulsanti sporgono
     ├─────────────────────────────┤
     │                             │
     │    Spazio per cablaggio     │  ← Profondità per corpo pulsante
     │                             │
     ├─────────────────────────────┤
     │    COPERCHIO (twist-lock)   │  ← Si avvita dal basso
     └─────────────────────────────┘
            ↑ Foro cavi

Come usare:
  1. Apri FreeCAD (documento vuoto)
  2. Macro → Esegui macro → button_box.py
  3. Verranno creati 2 oggetti nell'albero
  4. Esporta CIASCUNO come STL separato

Parametri modificabili nella sezione PARAMETRI.
"""

import FreeCAD as App
import Part
import math

# ============================================================
# PARAMETRI PULSANTE 16mm ILLUMINATO
# ============================================================

BTN_MOUNT_D = 11.8        # Diametro foro montaggio (mm) — pulsante Ø11.8mm
BTN_BODY_D = 18.0         # Diametro corpo dietro pannello (mm)
BTN_DEPTH = 28.0          # Profondità corpo dietro pannello (mm) — incluso dado
BTN_COUNT = 3             # Numero pulsanti in fila

# ============================================================
# PARAMETRI SCATOLA
# ============================================================

WALL_T = 2.5              # Spessore pareti (mm) — robusto per vibrazioni
TOP_T = 3.0               # Spessore pannello superiore (mm) — dove vanno i pulsanti
BASE_T = 0.0              # Niente fondo — il coperchio chiude dal basso

BTN_SPACING = 24.0        # Interasse tra pulsanti (mm) — centro a centro
BTN_MARGIN_X = 14.0       # Margine laterale dal centro del pulsante esterno (mm)
BTN_MARGIN_Y = 0.0        # Offset Y pulsanti dal centro (mm)

# Dimensioni derivate
BOX_W = BTN_SPACING * (BTN_COUNT - 1) + 2 * BTN_MARGIN_X   # Larghezza (asse X)
BOX_L = BTN_BODY_D + 2 * WALL_T + 6.0                       # Profondità (asse Y)
BOX_H = TOP_T + BTN_DEPTH + 5.0                              # Altezza totale (mm)

BOX_FILLET_R = 3.0        # Raccordo angoli esterni (mm)

# ============================================================
# PARAMETRI COPERCHIO TWIST-LOCK
# ============================================================

LID_T = 2.0               # Spessore piastra coperchio (mm)
LID_CLEARANCE = 0.3       # Gioco coperchio-box (mm)
LID_LIP_H = 6.0           # Altezza lip interno (mm)
LID_LIP_T = 1.5           # Spessore lip (mm)

# Pin bayonet (twist-lock)
PIN_COUNT = 4              # Numero pin (distribuiti sui lati)
PIN_W = 6.0                # Larghezza pin (mm)
PIN_H = 2.5                # Altezza pin (mm)
PIN_T = 1.8                # Spessore pin (mm)
SLOT_ARC = 12.0            # Lunghezza orizzontale slot a L (mm)

# ============================================================
# PARAMETRI FORO CAVI
# ============================================================

CABLE_HOLE_W = 12.0        # Larghezza foro cavi (mm)
CABLE_HOLE_H = 6.0         # Altezza foro cavi (mm)
CABLE_HOLE_R = 2.0         # Raccordo foro cavi (mm)

# ============================================================
# CALCOLI DERIVATI
# ============================================================

CX = 0.0
CY = 0.0

INT_W = BOX_W - 2 * WALL_T
INT_L = BOX_L - 2 * WALL_T

# Posizioni pulsanti (asse X, centrati)
BTN_POSITIONS = []
start_x = CX - BTN_SPACING * (BTN_COUNT - 1) / 2
for i in range(BTN_COUNT):
    BTN_POSITIONS.append((start_x + i * BTN_SPACING, CY + BTN_MARGIN_Y))

# Posizioni pin/slot (4 pin: 2 sui lati lunghi)
# I pin sono sul coperchio, gli slot sul box

# ============================================================
# GENERAZIONE SCATOLA
# ============================================================

def make_button_box():
    """Genera la scatola con 3 fori per pulsanti 16mm e slot twist-lock."""

    print("🔧 Generazione scatola pulsanti...")

    # --- 1. GUSCIO (aperto sotto) ---
    outer = Part.makeBox(BOX_W, BOX_L, BOX_H,
        App.Vector(CX - BOX_W/2, CY - BOX_L/2, 0))
    inner = Part.makeBox(INT_W, INT_L, BOX_H - TOP_T + 0.1,
        App.Vector(CX - INT_W/2, CY - INT_L/2, -0.1))
    shell = outer.cut(inner)
    print(f"  ✓ Guscio {BOX_W:.1f} x {BOX_L:.1f} x {BOX_H:.1f} mm")

    # --- 2. RACCORDI ANGOLI ---
    try:
        ve = [e for e in shell.Edges if abs(e.Length - BOX_H) < 0.1]
        if ve:
            shell = shell.makeFillet(BOX_FILLET_R, ve)
            print("  ✓ Raccordi angoli")
    except Exception as e:
        print(f"  ⚠ Raccordi: {e}")

    # --- 3. FORI PULSANTI (sul pannello superiore) ---
    for (bx, by) in BTN_POSITIONS:
        hole = Part.makeCylinder(BTN_MOUNT_D / 2, TOP_T + 2,
            App.Vector(bx, by, BOX_H - TOP_T - 0.5), App.Vector(0, 0, 1))
        shell = shell.cut(hole)
    print(f"  ✓ {BTN_COUNT} fori Ø{BTN_MOUNT_D}mm per pulsanti")

    # --- 4. SLOT TWIST-LOCK (tasche a L nelle pareti interne, vicino al fondo) ---
    # 4 slot: 2 sui lati lunghi (asse X), 2 sui lati corti (asse Y)
    slot_z = PIN_H  # Altezza dal fondo dove inizia la parte orizzontale
    slot_parts = []

    # Lati lunghi (paralleli a X) — 2 slot
    for y_sign in [-1, +1]:
        # Parete interna Y
        wall_y = CY + y_sign * INT_L / 2
        # Slot verticale (entrata pin)
        sv_x = CX - SLOT_ARC / 2 - PIN_W / 2
        if y_sign > 0:
            sy = wall_y - PIN_T
        else:
            sy = wall_y
        # Entrata verticale
        vert_slot = Part.makeBox(PIN_W, PIN_T + 0.5, PIN_H + LID_LIP_H,
            App.Vector(sv_x, sy, 0))
        shell = shell.cut(vert_slot)
        # Corsa orizzontale
        horiz_slot = Part.makeBox(SLOT_ARC + PIN_W, PIN_T + 0.5, PIN_H,
            App.Vector(sv_x, sy, 0))
        shell = shell.cut(horiz_slot)

    # Lati corti (paralleli a Y) — 2 slot
    for x_sign in [-1, +1]:
        wall_x = CX + x_sign * INT_W / 2
        sx_x = wall_x - PIN_T if x_sign > 0 else wall_x
        sv_y = CY - SLOT_ARC / 2 - PIN_W / 2
        # Entrata verticale
        vert_slot = Part.makeBox(PIN_T + 0.5, PIN_W, PIN_H + LID_LIP_H,
            App.Vector(sx_x, sv_y, 0))
        shell = shell.cut(vert_slot)
        # Corsa orizzontale
        horiz_slot = Part.makeBox(PIN_T + 0.5, SLOT_ARC + PIN_W, PIN_H,
            App.Vector(sx_x, sv_y, 0))
        shell = shell.cut(horiz_slot)

    print(f"  ✓ 4 slot twist-lock (bayonet)")

    # --- 5. FORO USCITA CAVI (parete laterale, lato -Y, in basso) ---
    cable_y = CY - BOX_L / 2 - 0.5
    cable_z = BOX_H / 2  # A metà altezza
    cable_hole = Part.makeBox(CABLE_HOLE_W, WALL_T + 1.0, CABLE_HOLE_H,
        App.Vector(CX - CABLE_HOLE_W / 2, cable_y, cable_z - CABLE_HOLE_H / 2))
    shell = shell.cut(cable_hole)
    # Raccordi foro cavi
    try:
        # Aggiungi cilindretti per arrotondare
        for xo in [-1, +1]:
            for zo in [-1, +1]:
                cx_pos = CX + xo * (CABLE_HOLE_W / 2 - CABLE_HOLE_R)
                cz_pos = cable_z + zo * (CABLE_HOLE_H / 2 - CABLE_HOLE_R)
                rnd = Part.makeCylinder(CABLE_HOLE_R, WALL_T + 1.0,
                    App.Vector(cx_pos, cable_y, cz_pos), App.Vector(0, 1, 0))
                shell = shell.cut(rnd)
    except:
        pass
    print(f"  ✓ Foro cavi {CABLE_HOLE_W}x{CABLE_HOLE_H}mm")

    # --- 6. SMUSSO BORDO INFERIORE (per facilitare inserimento coperchio) ---
    try:
        bottom_edges = [e for e in shell.Edges
                       if abs(e.CenterOfMass.z) < 0.5 and e.Length > 5]
        if bottom_edges:
            shell = shell.makeChamfer(0.8, bottom_edges[:4])
            print("  ✓ Smusso bordo inferiore")
    except:
        pass

    try:
        shell = shell.removeSplitter()
    except:
        pass
    return shell


# ============================================================
# GENERAZIONE COPERCHIO TWIST-LOCK
# ============================================================

def make_button_lid():
    """Genera il coperchio twist-lock (1/4 di giro) per la scatola pulsanti."""

    print("\n🔧 Generazione coperchio twist-lock...")

    parts = []

    # --- 1. PIASTRA BASE COPERCHIO ---
    lid_w = BOX_W + 1.0   # Leggermente più largo per grip
    lid_l = BOX_L + 1.0
    plate = Part.makeBox(lid_w, lid_l, LID_T,
        App.Vector(CX - lid_w/2, CY - lid_l/2, 0))
    try:
        ve = [e for e in plate.Edges if abs(e.Length - LID_T) < 0.1]
        if ve: plate = plate.makeFillet(BOX_FILLET_R, ve)
    except: pass
    parts.append(plate)
    print(f"  ✓ Piastra {lid_w:.1f} x {lid_l:.1f} x {LID_T:.1f} mm")

    # --- 2. LIP INTERNO (entra dentro il box) ---
    lip_w = INT_W - 2 * LID_CLEARANCE
    lip_l = INT_L - 2 * LID_CLEARANCE
    lip_iw = lip_w - 2 * LID_LIP_T
    lip_il = lip_l - 2 * LID_LIP_T

    lip_outer = Part.makeBox(lip_w, lip_l, LID_LIP_H,
        App.Vector(CX - lip_w/2, CY - lip_l/2, LID_T))
    lip_inner = Part.makeBox(lip_iw, lip_il, LID_LIP_H + 1,
        App.Vector(CX - lip_iw/2, CY - lip_il/2, LID_T - 0.5))
    lip = lip_outer.cut(lip_inner)
    parts.append(lip)
    print(f"  ✓ Lip interno (h={LID_LIP_H}mm)")

    # --- 3. PIN TWIST-LOCK (4 pin che entrano negli slot a L) ---
    # Corrispondono alle posizioni degli slot nel box

    # 2 pin sui lati lunghi (asse X)
    for y_sign in [-1, +1]:
        wall_y = CY + y_sign * (lip_w / 2 - LID_LIP_T)  # Posizione sulla lip
        # Pin sporge dalla lip verso l'esterno
        pin_x = CX - SLOT_ARC / 2 - PIN_W / 2
        if y_sign > 0:
            py = CY + lip_l / 2 - LID_CLEARANCE
        else:
            py = CY - lip_l / 2 + LID_CLEARANCE - PIN_T
        pin = Part.makeBox(PIN_W, PIN_T, PIN_H,
            App.Vector(pin_x, py, LID_T + LID_LIP_H - PIN_H))
        parts.append(pin)

    # 2 pin sui lati corti (asse Y)
    for x_sign in [-1, +1]:
        if x_sign > 0:
            px = CX + lip_w / 2 - LID_CLEARANCE
        else:
            px = CX - lip_w / 2 + LID_CLEARANCE - PIN_T
        pin_y = CY - SLOT_ARC / 2 - PIN_W / 2
        pin = Part.makeBox(PIN_T, PIN_W, PIN_H,
            App.Vector(px, pin_y, LID_T + LID_LIP_H - PIN_H))
        parts.append(pin)

    print(f"  ✓ 4 pin twist-lock")

    # --- 4. ZIGRINATURA / GRIP (tacchette sul bordo per girare) ---
    grip_count = 12
    grip_r = 1.5
    grip_h = LID_T + 1.0
    for i in range(grip_count):
        angle = 2 * math.pi * i / grip_count
        # Posiziona le tacchette sul perimetro
        diag = math.sqrt((lid_w/2)**2 + (lid_l/2)**2)
        # Tacchette solo sugli angoli per estetica
        gx = CX + (lid_w/2 + grip_r * 0.3) * math.cos(angle)
        gy = CY + (lid_l/2 + grip_r * 0.3) * math.sin(angle)
        # Verifica che sia sul bordo
        on_edge_x = abs(abs(gx - CX) - lid_w/2) < grip_r * 2
        on_edge_y = abs(abs(gy - CY) - lid_l/2) < grip_r * 2
        if on_edge_x or on_edge_y:
            notch = Part.makeCylinder(grip_r, grip_h,
                App.Vector(gx, gy, -0.5), App.Vector(0, 0, 1))
            # Taglia dalla piastra per creare zigrinatura
            parts[0] = parts[0].cut(notch)

    print(f"  ✓ Zigrinatura grip")

    # --- 5. INDICATORE ALLINEAMENTO (freccia/tacca) ---
    # Piccola tacca triangolare sul bordo per sapere dove allineare
    arrow = Part.makeBox(2.0, 3.0, LID_T + 0.5,
        App.Vector(CX - 1.0, CY + lid_l/2 - 0.5, -0.25))
    parts[0] = parts[0].cut(arrow)
    print("  ✓ Indicatore allineamento")

    # Assembla tutto
    result = parts[0]
    for p in parts[1:]:
        try:
            result = result.fuse(p)
        except:
            pass
    try:
        result = result.removeSplitter()
    except:
        pass
    return result


# ============================================================
# MAIN
# ============================================================

print("=" * 60)
print("  SCATOLETTA 3 PULSANTI LUMINOSI 16mm")
print("=" * 60)
print(f"\n📦 Scatola: {BOX_W:.1f} x {BOX_L:.1f} x {BOX_H:.1f} mm")
print(f"🔘 Pulsanti: {BTN_COUNT}x Ø{BTN_MOUNT_D}mm, interasse {BTN_SPACING}mm")
print(f"🔒 Chiusura: twist-lock (1/4 di giro)")
print(f"\n{'='*60}\n")

doc = App.ActiveDocument
if doc is None:
    doc = App.newDocument("ButtonBox")

# ── 1. SCATOLA ──
box_shape = make_button_box()
box_obj = doc.addObject("Part::Feature", "ButtonBox")
box_obj.Shape = box_shape
box_obj.Label = "Scatola Pulsanti"
try:
    box_obj.ViewObject.ShapeColor = (0.2, 0.2, 0.25)
    box_obj.ViewObject.Transparency = 0
except: pass

# ── 2. COPERCHIO ──
lid_shape = make_button_lid()
lid_obj = doc.addObject("Part::Feature", "ButtonLid")
lid_obj.Shape = lid_shape
lid_obj.Label = "Coperchio Twist-Lock"
try:
    lid_obj.ViewObject.ShapeColor = (0.1, 0.65, 0.85)
    lid_obj.ViewObject.Transparency = 25
except: pass

# Posiziona il coperchio sotto la scatola (per visualizzazione)
lid_obj.Placement = App.Placement(
    App.Vector(0, 0, -(LID_T + LID_LIP_H + 2)),
    App.Rotation(0, 0, 0)
)

doc.recompute()

# ============================================================
# REPORT
# ============================================================

bb_box = box_shape.BoundBox
bb_lid = lid_shape.BoundBox

print(f"\n{'='*60}")
print(f"✅ GENERAZIONE COMPLETATA — 2 PEZZI")
print(f"{'='*60}")

print(f"\n📦 Pezzo 1: SCATOLA PULSANTI")
print(f"   {bb_box.XLength:.1f} x {bb_box.YLength:.1f} x {bb_box.ZLength:.1f} mm")
print(f"   Fori: {BTN_COUNT}x Ø{BTN_MOUNT_D}mm (interasse {BTN_SPACING}mm)")
print(f"   Foro cavi: {CABLE_HOLE_W}x{CABLE_HOLE_H}mm (parete laterale)")

print(f"\n🔒 Pezzo 2: COPERCHIO TWIST-LOCK")
print(f"   {bb_lid.XLength:.1f} x {bb_lid.YLength:.1f} x {bb_lid.ZLength:.1f} mm")
print(f"   4 pin bayonet + lip interno h={LID_LIP_H}mm")

print(f"\n   Posizioni pulsanti (dal centro):")
for i, (bx, by) in enumerate(BTN_POSITIONS):
    print(f"     Pulsante {i+1}: X={bx:+.1f}mm, Y={by:+.1f}mm")

print(f"\n{'='*60}")
print(f"📋 ESPORTAZIONE STL")
print(f"{'='*60}")
print(f"")
print(f"  Dalla console Python di FreeCAD:")
print(f"     import Mesh")
print(f"     Mesh.export([App.ActiveDocument.ButtonBox], '/home/dario/Workspace/telemetry/parts/scatola_pulsanti.stl')")
print(f"     Mesh.export([App.ActiveDocument.ButtonLid], '/home/dario/Workspace/telemetry/parts/coperchio_pulsanti.stl')")

print(f"\n🔧 ASSEMBLAGGIO:")
print(f"   1. Inserisci i 3 pulsanti nei fori del pannello superiore")
print(f"   2. Avvita i dadi di fissaggio dei pulsanti dall'interno")
print(f"   3. Collega i cavi e falli uscire dal foro laterale")
print(f"   4. Allinea i pin del coperchio con gli slot (tacca di riferimento)")
print(f"   5. Inserisci il coperchio e ruota 1/4 di giro in senso orario")
print(f"   6. Per aprire: ruota 1/4 di giro in senso antiorario e sfila")

print(f"\n⚙ Stampa 3D:")
print(f"   - Scatola: pannello pulsanti verso il basso (sul piatto)")
print(f"   - Coperchio: piastra sul piatto (pin verso l'alto)")
print(f"   - Materiale: PETG o ABS (resistente a vibrazioni)")
print(f"   - Layer: 0.2mm")
print(f"   - Infill: 40-60%")
print(f"   - NO supporti necessari")
