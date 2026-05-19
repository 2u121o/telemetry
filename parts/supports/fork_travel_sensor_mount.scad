/*
 * Due morsetti (stampa 4 mezzi anelli: 2 per stelo + 2 per fodero). OD misurati sulla tua forcella:
 *
 *   STELLO (upper tube):
 *     PART=stanchion_upper  → mezzo anello + alette + pad sensore (semicerchio +Y)
 *     PART=stanchion_lower   → mezzo anello + alette (no sensore; chiude con vite)
 *     PART=stanchion_layout → entrambi in tavola
 *
 *   FODERO (lower leg, Ø misurato sul punto dove va il collare):
 *     PART=lowerleg_upper   → mezzo anello + alette (chiude sul fodero)
 *     PART=lowerleg_lower   → mezzo anello + alette + pad magnete (speculare −Y)
 *     PART=lowerleg_layout  → entrambi in tavola
 *
 *   R_in stelo = STANCHION_OD/2 + slack/2  (default: Ø 46 mm sopra).
 *   R_in fodero = LOWER_OD_MM/2 + slack/2  (default: Ø 49 mm sotto). Aggiorna STANCHION_OD / LOWER_OD_MM se rimesuri.
 *
 * Vista dall’alto: fori alette lungo Y. Pad sensore/magnete fuori da r_out; foro interno r_in ripulito.
 *./export_fork_travel_stl.sh
 */

$fn = 80;

GAP             = 0.35;
LUG_RADIAL      = 9.0;
LUG_TANGENT     = 12.0;
BOLT_CLR        = 3.3;

// Upper clamp = stanchion (measured OD at clamp height)
STANCHION_OD    = 46.0;
DIAMETRIC_SLACK = 0.4;
CLAMP_H         = 12.0;
WALL            = 2.5;

POCKET_W        = 22.0;
POCKET_H        = 15.0;
POCKET_DEPTH    = 32.0;
EYELET_D        = 4.0;

// Lower clamp = lower leg (measured OD at clamp height)
LOWER_OD_MM     = 49.0;
LOWER_CLAMP_H   = 30.0;
MAGNET_OD       = 8.2;
MAGNET_H        = 3.2;

TAB_W               = 22.0;
TAB_D               = 8.0;
TAB_RADIAL_EXTRA    = 1.2;

R_in  = STANCHION_OD / 2 + DIAMETRIC_SLACK / 2;
R_out = R_in + WALL;

R_in_lo  = LOWER_OD_MM / 2 + DIAMETRIC_SLACK / 2;
R_out_lo = R_in_lo + WALL;

function tab_radial_total() = TAB_D + TAB_RADIAL_EXTRA;

module annulus(r_in, r_out, h) {
    difference() {
        cylinder(h = h, r = r_out);
        translate([0, 0, -0.01])
            cylinder(h = h + 0.02, r = r_in);
    }
}

module half_ring_upper(r_in, r_out, h, gap) {
    intersection() {
        annulus(r_in, r_out, h);
        translate([-r_out * 6, gap / 2, -0.01])
            cube([r_out * 12, r_out * 6, h + 0.02]);
    }
}

module half_ring_lower(r_in, r_out, h, gap) {
    intersection() {
        annulus(r_in, r_out, h);
        translate([-r_out * 6, -r_out * 6, -0.01])
            cube([r_out * 12, r_out * 6 - gap / 2, h + 0.02]);
    }
}

module junction_lugs_upper(r_in, r_out, h, gap) {
    difference() {
        intersection() {
            union() {
                hull() {
                    translate([-r_out - LUG_RADIAL, -LUG_TANGENT / 2, 0])
                        cube([LUG_RADIAL, LUG_TANGENT, h]);
                    intersection() {
                        annulus(r_in, r_out, h);
                        translate([-r_out - 5, -LUG_TANGENT / 2 - 1, -0.01])
                            cube([10, LUG_TANGENT + 2, h + 0.02]);
                    }
                }
                hull() {
                    translate([r_out, -LUG_TANGENT / 2, 0])
                        cube([LUG_RADIAL, LUG_TANGENT, h]);
                    intersection() {
                        annulus(r_in, r_out, h);
                        translate([r_out - 5, -LUG_TANGENT / 2 - 1, -0.01])
                            cube([10, LUG_TANGENT + 2, h + 0.02]);
                    }
                }
            }
            translate([-r_out * 6, gap / 2, -0.01])
                cube([r_out * 12, r_out * 6, h + 0.02]);
        }
        translate([-r_out - LUG_RADIAL / 2, 0, h / 2])
            rotate([90, 0, 0])
                cylinder(h = LUG_TANGENT + 10, d = BOLT_CLR, center = true);
        translate([r_out + LUG_RADIAL / 2, 0, h / 2])
            rotate([90, 0, 0])
                cylinder(h = LUG_TANGENT + 10, d = BOLT_CLR, center = true);
    }
}

module junction_lugs_lower(r_in, r_out, h, gap) {
    difference() {
        intersection() {
            union() {
                hull() {
                    translate([-r_out - LUG_RADIAL, -LUG_TANGENT / 2, 0])
                        cube([LUG_RADIAL, LUG_TANGENT, h]);
                    intersection() {
                        annulus(r_in, r_out, h);
                        translate([-r_out - 5, -LUG_TANGENT / 2 - 1, -0.01])
                            cube([10, LUG_TANGENT + 2, h + 0.02]);
                    }
                }
                hull() {
                    translate([r_out, -LUG_TANGENT / 2, 0])
                        cube([LUG_RADIAL, LUG_TANGENT, h]);
                    intersection() {
                        annulus(r_in, r_out, h);
                        translate([r_out - 5, -LUG_TANGENT / 2 - 1, -0.01])
                            cube([10, LUG_TANGENT + 2, h + 0.02]);
                    }
                }
            }
            translate([-r_out * 6, -r_out * 6, -0.01])
                cube([r_out * 12, r_out * 6 - gap / 2, h + 0.02]);
        }
        translate([-r_out - LUG_RADIAL / 2, 0, h / 2])
            rotate([90, 0, 0])
                cylinder(h = LUG_TANGENT + 10, d = BOLT_CLR, center = true);
        translate([r_out + LUG_RADIAL / 2, 0, h / 2])
            rotate([90, 0, 0])
                cylinder(h = LUG_TANGENT + 10, d = BOLT_CLR, center = true);
    }
}

// sign_y: +1 = ore 12 (semicerchio superiore); -1 = ore 6 (inferiore) — pad da y=±r_out verso esterno (mai nel foro)
module sensor_tab_unified(r_in, r_out, h, gap, tab_z, sign_y, with_magnet) {
    tr = tab_radial_total();
    pocket_x = min(POCKET_DEPTH + 1, TAB_W - 5);
    oy0 = sign_y > 0 ? r_out : (-r_out - tr);
    difference() {
        intersection() {
            difference() {
                hull() {
                    translate([-TAB_W / 2, oy0, 0])
                        cube([TAB_W, tr, tab_z]);
                    intersection() {
                        annulus(r_in, r_out, tab_z);
                        if (sign_y > 0)
                            translate([-TAB_W / 2 - 5, r_out - 12, -0.01])
                                cube([TAB_W + 10, 16, tab_z + 0.02]);
                        else
                            translate([-TAB_W / 2 - 5, -r_out - 4, -0.01])
                                cube([TAB_W + 10, 16, tab_z + 0.02]);
                    }
                }
                union() {
                    if (with_magnet) {
                        translate([-TAB_W / 2 + 5, oy0 + 6, 1])
                            cylinder(h = MAGNET_H + 0.6, d = MAGNET_OD);
                        translate([-TAB_W / 2 + 5, oy0 + tr / 2 - 1.5, tab_z / 2])
                            rotate([0, 90, 0])
                                cylinder(h = 40, d = EYELET_D, center = true);
                    } else {
                        translate([-TAB_W / 2 + 5, oy0 + (tr - POCKET_W) / 2, (h - POCKET_H) / 2])
                            cube([pocket_x, POCKET_W, POCKET_H]);
                        translate([-TAB_W / 2 + 3, oy0 + tr / 2 - 1.5, h / 2])
                            rotate([0, 90, 0])
                                cylinder(h = 30, d = EYELET_D, center = true);
                    }
                }
            }
            if (sign_y > 0)
                translate([-r_out * 6, gap / 2, -0.01])
                    cube([r_out * 12, r_out * 6, tab_z + 0.02]);
            else
                translate([-r_out * 6, -r_out * 6, -0.01])
                    cube([r_out * 12, r_out * 6 - gap / 2, tab_z + 0.02]);
        }
        translate([0, 0, -0.01])
            cylinder(h = tab_z + 0.02, r = r_in);
    }
}

module stanchion_sensor_tab(r_in, r_out, h, gap) {
    sensor_tab_unified(r_in, r_out, h, gap, h, 1, false);
}

module lower_leg_tab(r_in, r_out, h, gap) {
    sensor_tab_unified(r_in, r_out, h, gap, h + 3, -1, true);
}

module stanchion_upper_only() {
    union() {
        half_ring_upper(R_in, R_out, CLAMP_H, GAP);
        junction_lugs_upper(R_in, R_out, CLAMP_H, GAP);
        stanchion_sensor_tab(R_in, R_out, CLAMP_H, GAP);
    }
}

module stanchion_lower_only() {
    union() {
        half_ring_lower(R_in, R_out, CLAMP_H, GAP);
        junction_lugs_lower(R_in, R_out, CLAMP_H, GAP);
    }
}

module lowerleg_upper_only() {
    union() {
        half_ring_upper(R_in_lo, R_out_lo, LOWER_CLAMP_H, GAP);
        junction_lugs_upper(R_in_lo, R_out_lo, LOWER_CLAMP_H, GAP);
    }
}

module lowerleg_lower_only() {
    union() {
        half_ring_lower(R_in_lo, R_out_lo, LOWER_CLAMP_H, GAP);
        junction_lugs_lower(R_in_lo, R_out_lo, LOWER_CLAMP_H, GAP);
        lower_leg_tab(R_in_lo, R_out_lo, LOWER_CLAMP_H, GAP);
    }
}

module layout_stanchion() {
    translate([-45, 0, 0])
        stanchion_upper_only();
    translate([45, 0, 0])
        stanchion_lower_only();
}

module layout_lowerleg() {
    translate([-55, 0, 0])
        lowerleg_upper_only();
    translate([55, 0, 0])
        lowerleg_lower_only();
}

// Anteprima: kit stelo + kit fodero (offset Y per evitare sovrapposizione in tavola)
module layout_both_kits() {
    translate([0, -85, 0])
        layout_stanchion();
    translate([0, 85, 0])
        layout_lowerleg();
}

PART = "stanchion_layout";

if (PART == "stanchion_upper")
    stanchion_upper_only();
else if (PART == "stanchion_lower")
    stanchion_lower_only();
else if (PART == "stanchion_layout")
    layout_stanchion();
else if (PART == "lowerleg_upper")
    lowerleg_upper_only();
else if (PART == "lowerleg_lower")
    lowerleg_lower_only();
else if (PART == "lowerleg_layout")
    layout_lowerleg();
else if (PART == "both_kits_layout")
    layout_both_kits();
else
    layout_stanchion();
