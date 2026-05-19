/*
 * Washer under OEM air-valve cap. CAP_OD = factory cap OD (29.5 mm here): ring fits under the cap with small clearance
 * and is sized so the outer annulus sits slightly under the cap skirt (tune UNDER_CAP_DELTA).
 * Bent tab + small flange with SENSOR_MOUNT hole; rotate TAB_ROT_DEG to line up with the lower fork mount.
 */

$fn = 80;

// Tappo valvola (diametro nominale)
CAP_OD = 29.5;
// Rondella un filo piu piccola del tappo per andare sotto; se serve piu margine aumenta UNDER_CAP_DELTA
UNDER_CAP_DELTA = 0.7;
WASHER_OD = CAP_OD - UNDER_CAP_DELTA;
WASHER_ID = 11.0;
THICKNESS = 3.5;

// Linguetta: piastra orizzontale complanare all'anello + gamba verticale spessa (rigida, no gradini)
TAB_W = 10.0;
TAB_HORIZ = 6.0;
EXTRA_REACH = 10.0;
TAB_UP = 0.0;
TAB_THICK = 2.2;

// Flangia sensore in cima (robusta) con foro passante LATERALE (asse X)
FLANGE_W = 10.0;
FLANGE_T = 6.0;
FLANGE_H = 10.0;
SENSOR_MOUNT_D = 0.0;
GUSSET = 0.0;

// Ruota tutta la linguetta attorno a Z (gradi) per allineare foro sensore al supporto inferiore
TAB_ROT_DEG = 0;

R_out = WASHER_OD / 2;

module washer_2d_profile() {
    difference() {
        circle(d = WASHER_OD);
        circle(d = WASHER_ID);
    }
}

module washer_solid() {
    linear_extrude(height = THICKNESS, convexity = 4)
        washer_2d_profile();
}

module tab_bent_up() {
    y0 = R_out - 1.0;
    base_len = TAB_HORIZ + EXTRA_REACH;
    union() {
        translate([-TAB_W / 2, y0, 0])
            cube([TAB_W, base_len + TAB_THICK, THICKNESS]);
        translate([-TAB_W / 2, y0 + base_len, THICKNESS - 0.01])
            cube([TAB_W, TAB_THICK, TAB_UP + 0.01]);
    }
}

// Reinforced block on top of vertical leg; through-hole along X (side), plus triangular gussets on the base
module sensor_flange(y_vert, z_vert, h_vert) {
    z_top = z_vert + h_vert;
    y_front = y_vert + TAB_THICK - FLANGE_T;
    difference() {
        union() {
            translate([-FLANGE_W / 2, y_front, z_top - 0.01])
                cube([FLANGE_W, FLANGE_T, FLANGE_H + 0.01]);
            for (sx = [-1, 1])
                hull() {
                    translate([sx * (TAB_W / 2 - 0.01), y_vert, z_top - 0.01])
                        cube([0.02, TAB_THICK, 0.02]);
                    translate([sx * (TAB_W / 2 - 0.01), y_vert, z_top + GUSSET - 0.01])
                        cube([0.02, TAB_THICK, 0.02]);
                    translate([sx * (TAB_W / 2 - 0.01), y_vert - GUSSET, z_top - 0.01])
                        cube([0.02, 0.02, 0.02]);
                }
        }
        translate([-FLANGE_W / 2 - 1, y_front + FLANGE_T / 2, z_top + FLANGE_H / 2])
            rotate([0, 90, 0])
                cylinder(h = FLANGE_W + 2, d = SENSOR_MOUNT_D);
    }
}

module tab_with_cuts() {
    y0 = R_out - 1.0;
    y_vert = y0 + TAB_HORIZ + EXTRA_REACH;
    z_vert = THICKNESS;
    h_vert = TAB_UP;
    union() {
        tab_bent_up();
        sensor_flange(y_vert, z_vert, h_vert);
    }
}

module air_valve_washer_sensor() {
    union() {
        washer_solid();
        rotate([0, 0, TAB_ROT_DEG])
            tab_with_cuts();
    }
}

air_valve_washer_sensor();
