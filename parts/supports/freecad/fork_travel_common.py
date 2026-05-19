# -*- coding: utf-8 -*-
"""Shared fork-travel tab geometry (matches fork_travel_sensor_mount.scad)."""

from __future__ import annotations

import FreeCAD as App
import Part

TAB_W = 22.0
TAB_D = 8.0
TAB_RADIAL_EXTRA = 1.2

POCKET_W = 22.0
POCKET_H = 15.0
POCKET_DEPTH = 32.0
EYELET_D = 4.0

MAGNET_OD = 8.2
MAGNET_H = 3.2


def tab_radial_total() -> float:
    return TAB_D + TAB_RADIAL_EXTRA


def hull_fuse(a: Part.Shape, b: Part.Shape) -> Part.Shape:
    try:
        return Part.makeHull((a, b))
    except (AttributeError, TypeError, Exception):
        return a.fuse(b)


def annulus(r_in: float, r_out: float, h: float) -> Part.Shape:
    outer = Part.makeCylinder(r_out, h)
    inner = Part.makeCylinder(r_in, h + 0.02)
    inner.translate(App.Vector(0, 0, -0.01))
    return outer.cut(inner)


def sensor_tab_unified(
    r_in: float,
    r_out: float,
    h: float,
    gap: float,
    tab_z: float,
    sign_y: int,
    with_magnet: bool,
) -> Part.Shape:
    tr = tab_radial_total()
    pocket_x = min(POCKET_DEPTH + 1.0, TAB_W - 5.0)
    ox = -TAB_W / 2.0
    oy0 = r_out if sign_y > 0 else (-r_out - tr)

    pad = Part.makeBox(TAB_W, tr, tab_z)
    pad.translate(App.Vector(ox, oy0, 0))

    bridge_strip = Part.makeBox(TAB_W + 10.0, 16.0, tab_z + 0.02)
    if sign_y > 0:
        bridge_strip.translate(App.Vector(ox - 5.0, r_out - 12.0, -0.01))
    else:
        bridge_strip.translate(App.Vector(ox - 5.0, -r_out - 4.0, -0.01))

    bridge = annulus(r_in, r_out, tab_z).common(bridge_strip)
    body = hull_fuse(pad, bridge)

    bore = Part.makeCylinder(r_in, tab_z + 0.02)
    bore.translate(App.Vector(0, 0, -0.01))
    body = body.cut(bore)

    if with_magnet:
        mag = Part.makeCylinder(MAGNET_OD / 2.0, MAGNET_H + 0.6)
        mag.translate(App.Vector(ox + 5.0, oy0 + 6.0, 1.0))
        body = body.cut(mag)
        hole = Part.makeCylinder(EYELET_D / 2.0, 40.0)
        hole.rotate(App.Vector(0, 0, 0), App.Vector(0, 1, 0), 90.0)
        hole.translate(App.Vector(ox + 5.0, oy0 + tr / 2.0 - 1.5, tab_z / 2.0))
        body = body.cut(hole)
    else:
        pocket = Part.makeBox(pocket_x, POCKET_W, POCKET_H)
        pocket.translate(
            App.Vector(ox + 5.0, oy0 + (tr - POCKET_W) / 2.0, (h - POCKET_H) / 2.0)
        )
        body = body.cut(pocket)
        hole = Part.makeCylinder(EYELET_D / 2.0, 30.0)
        hole.rotate(App.Vector(0, 0, 0), App.Vector(0, 1, 0), 90.0)
        hole.translate(App.Vector(ox + 3.0, oy0 + tr / 2.0 - 1.5, h / 2.0))
        body = body.cut(hole)

    if sign_y > 0:
        clip = Part.makeBox(r_out * 12, r_out * 6, tab_z + 0.02)
        clip.translate(App.Vector(-r_out * 6, gap / 2, -0.01))
    else:
        clip = Part.makeBox(r_out * 12, r_out * 6 - gap / 2, tab_z + 0.02)
        clip.translate(App.Vector(-r_out * 6, -r_out * 6, -0.01))
    return body.common(clip)
