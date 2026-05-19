# -*- coding: utf-8 -*-
"""
Stanchion travel clamp — vista dall’alto: fori passanti lungo Y (asse vite nel piano XY).
Sensore sul semicerchio superiore (+Y). Alette hull all’anello.
"""

from __future__ import annotations

import os
import sys

try:
    _MACRO_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    _MACRO_DIR = os.getcwd()
if _MACRO_DIR not in sys.path:
    sys.path.insert(0, _MACRO_DIR)

import FreeCAD as App
import Part

import fork_travel_common as ftc

GAP = 0.35
LUG_RADIAL = 9.0
LUG_TANGENT = 12.0
BOLT_CLR = 3.3

STANCHION_OD = 46.0
DIAMETRIC_SLACK = 0.4
CLAMP_H = 12.0
WALL = 2.5

R_in = STANCHION_OD / 2.0 + DIAMETRIC_SLACK / 2.0
R_out = R_in + WALL


def _half_ring_upper(r_in: float, r_out: float, h: float, gap: float) -> Part.Shape:
    ring = ftc.annulus(r_in, r_out, h)
    box = Part.makeBox(r_out * 12, r_out * 6, h + 0.02)
    box.translate(App.Vector(-r_out * 6, gap / 2, -0.01))
    return ring.common(box)


def _half_ring_lower(r_in: float, r_out: float, h: float, gap: float) -> Part.Shape:
    ring = ftc.annulus(r_in, r_out, h)
    box = Part.makeBox(r_out * 12, r_out * 6 - gap / 2, h + 0.02)
    box.translate(App.Vector(-r_out * 6, -r_out * 6, -0.01))
    return ring.common(box)


def _clip_y_positive(shape: Part.Shape, h: float, gap: float) -> Part.Shape:
    box = Part.makeBox(400.0, 200.0, h + 4.0)
    box.translate(App.Vector(-200.0, gap / 2.0, -0.02))
    return shape.common(box)


def _clip_y_negative(shape: Part.Shape, h: float, gap: float) -> Part.Shape:
    box = Part.makeBox(400.0, 200.0, h + 4.0)
    box.translate(App.Vector(-200.0, -200.0 - gap / 2.0, -0.02))
    return shape.common(box)


def _junction_lugs(r_in: float, r_out: float, h: float, gap: float, upper: bool) -> Part.Shape:
    ring = ftc.annulus(r_in, r_out, h)

    left_lug = Part.makeBox(LUG_RADIAL, LUG_TANGENT, h)
    left_lug.translate(App.Vector(-r_out - LUG_RADIAL, -LUG_TANGENT / 2.0, 0))
    pl = Part.makeBox(10.0, LUG_TANGENT + 2.0, h + 0.02)
    pl.translate(App.Vector(-r_out - 5.0, -LUG_TANGENT / 2.0 - 1.0, -0.01))
    left = ftc.hull_fuse(left_lug, ring.common(pl))

    right_lug = Part.makeBox(LUG_RADIAL, LUG_TANGENT, h)
    right_lug.translate(App.Vector(r_out, -LUG_TANGENT / 2.0, 0))
    pr = Part.makeBox(10.0, LUG_TANGENT + 2.0, h + 0.02)
    pr.translate(App.Vector(r_out - 5.0, -LUG_TANGENT / 2.0 - 1.0, -0.01))
    right = ftc.hull_fuse(right_lug, ring.common(pr))

    u = left.fuse(right)
    bh = Part.makeCylinder(BOLT_CLR / 2.0, LUG_TANGENT + 10.0)
    bh.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90.0)
    bh.translate(App.Vector(-r_out - LUG_RADIAL / 2.0, 0, h / 2.0))
    u = u.cut(bh)
    bh2 = Part.makeCylinder(BOLT_CLR / 2.0, LUG_TANGENT + 10.0)
    bh2.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90.0)
    bh2.translate(App.Vector(r_out + LUG_RADIAL / 2.0, 0, h / 2.0))
    u = u.cut(bh2)
    return _clip_y_positive(u, h, gap) if upper else _clip_y_negative(u, h, gap)


def build_upper_half() -> Part.Shape:
    u = _half_ring_upper(R_in, R_out, CLAMP_H, GAP).fuse(
        _junction_lugs(R_in, R_out, CLAMP_H, GAP, upper=True)
    ).fuse(ftc.sensor_tab_unified(R_in, R_out, CLAMP_H, GAP, CLAMP_H, 1, False))
    try:
        return u.removeSplitter()
    except AttributeError:
        return u


def build_lower_half() -> Part.Shape:
    u = _half_ring_lower(R_in, R_out, CLAMP_H, GAP).fuse(
        _junction_lugs(R_in, R_out, CLAMP_H, GAP, upper=False)
    )
    try:
        return u.removeSplitter()
    except AttributeError:
        return u


def main() -> None:
    doc = App.activeDocument()
    if doc is None:
        doc = App.newDocument("ForkTravelStanchion")

    a = doc.addObject("Part::Feature", "HalfUpper_semicerchio")
    a.Shape = build_upper_half()
    a.Placement = App.Placement(App.Vector(-90.0, 0, 0), App.Rotation())

    b = doc.addObject("Part::Feature", "HalfLower_sensore")
    b.Shape = build_lower_half()
    b.Placement = App.Placement(App.Vector(90.0, 0, 0), App.Rotation())

    doc.recompute()


if __name__ == "__main__":
    main()
