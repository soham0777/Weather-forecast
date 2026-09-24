"""Tests for the nesting kernel, DXF part import and layout export. Run: pytest -q"""
import math
import os
import sys

import ezdxf
import numpy as np
import pytest
from shapely import affinity
from shapely.geometry import Point, Polygon, box

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import smartnest_cad as cad  # noqa: E402
import smartnest_nesting as sn  # noqa: E402

L_SHAPE = Polygon([(0, 0), (120, 0), (120, 30), (30, 30), (30, 90), (0, 90)])
TRI = Polygon([(0, 0), (60, 0), (0, 45)])


def centred(g):
    c = g.centroid
    return affinity.translate(g, -c.x, -c.y)


def part(name, g, qty=1, rots=None):
    return cad.PartDef(name, centred(g), qty, rots)


# ---------------------------------------------------------------------------
# kernel
# ---------------------------------------------------------------------------
def test_convex_decomposition_covers_polygon():
    pieces = sn.convex_decompose(L_SHAPE)
    polys = [Polygon(p) for p in pieces]
    assert all(abs(p.area - p.convex_hull.area) < 1e-9 for p in polys)
    assert sum(p.area for p in polys) == pytest.approx(L_SHAPE.area)
    assert len(pieces) <= 3


def test_nfp_is_exactly_the_overlap_set():
    a, b = centred(L_SHAPE), centred(TRI)
    nfp = sn.calculate_nfp(sn.convex_decompose(a), sn.convex_decompose(b))
    rng = np.random.default_rng(0)
    checked = 0
    for t in rng.uniform(-160, 160, (1500, 2)):
        if nfp.boundary.distance(Point(t)) < 1e-3:
            continue
        overlap = a.intersection(affinity.translate(b, *t)).area > 1e-9
        assert overlap == nfp.contains(Point(t)), t
        checked += 1
    assert checked > 1400


def test_inner_fit_is_exactly_the_containment_set():
    container = box(0, 0, 400, 250).difference(Point(200, 125).buffer(40, quad_segs=32))
    s = centred(L_SHAPE)
    b0 = s.representative_point()
    ifp = sn.inner_fit(container, sn.ring_edges(container), sn.convex_decompose(s), (b0.x, b0.y))
    rng = np.random.default_rng(1)
    agree = 0
    for t in rng.uniform([-20, -20], [420, 270], (1500, 2)):
        if ifp.boundary.distance(Point(t)) < 1e-3:
            continue
        inside = container.contains(affinity.translate(s, *t))
        assert inside == ifp.contains(Point(t)), t
        agree += 1
    assert agree > 1400 and ifp.area > 0


# ---------------------------------------------------------------------------
# DXF import
# ---------------------------------------------------------------------------
def test_sample_job_import(tmp_path):
    parts, rep = cad.read_dxf_parts(cad.make_sample_job_dxf(str(tmp_path / "job.dxf")))
    assert rep.ok and [p.name for p in parts] == ["A", "B", "C", "D"]
    bracket, plate, flange, gusset = parts
    fillet = (1 - math.pi / 4) * 20 ** 2                 # inner LINE+ARC fillet adds this material
    assert bracket.polygon.area + 2 * math.pi * 36 == pytest.approx(240 * 50 + 50 * 120 + fillet, rel=1e-3)
    assert len(bracket.polygon.interiors) == 2
    assert len(plate.polygon.interiors) == 5 and len(flange.polygon.interiors) == 7
    assert flange.polygon.area == pytest.approx(math.pi * (100**2 - 40**2 - 6 * 7**2), rel=1e-3)


def _doc():
    d = ezdxf.new("R2010")
    d.units = ezdxf.units.MM
    return d


def test_open_contour_is_reported(tmp_path):
    d = _doc()
    m = d.modelspace()
    for a, b in [((0, 0), (100, 0)), ((100, 0), (100, 50)), ((100, 50), (0, 50))]:   # left side missing
        m.add_line(a, b)
    m.add_lwpolyline([(200, 0), (300, 0), (300, 50), (200, 50)], close=True)
    f = str(tmp_path / "open.dxf")
    d.saveas(f)
    parts, rep = cad.read_dxf_parts(f)
    assert any("open contour" in e and "cannot be nested" in e for e in rep.errors)
    assert len(parts) == 1                                 # the valid part is still usable


def test_self_intersection_is_reported_not_repaired(tmp_path):
    d = _doc()
    d.modelspace().add_lwpolyline([(0, 0), (100, 100), (100, 0), (0, 100)], close=True)       # bow tie
    f = str(tmp_path / "bow.dxf")
    d.saveas(f)
    parts, rep = cad.read_dxf_parts(f)
    assert not parts and any("self-intersecting" in e for e in rep.errors)


def test_duplicates_are_counted_and_inches_scaled(tmp_path):
    d = ezdxf.new("R2010")
    d.units = ezdxf.units.IN
    m = d.modelspace()
    for k, ang in enumerate((0, 90, 33)):
        g = affinity.rotate(Polygon([(0, 0), (4, 0), (4, 1), (1, 1), (1, 3), (0, 3)]), ang, origin=(0, 0))
        m.add_lwpolyline([(x + 10 * k, y) for x, y in list(g.exterior.coords)[:-1]], close=True)
    f = str(tmp_path / "inch.dxf")
    d.saveas(f)
    parts, rep = cad.read_dxf_parts(f)
    assert rep.ok and rep.units == "inch" and len(parts) == 1 and parts[0].quantity == 3
    assert parts[0].area_mm2 == pytest.approx(6 * 25.4 ** 2, rel=1e-6)


def test_rejects_non_dxf_and_sanitizes_names(tmp_path):
    f = tmp_path / "x.exe"
    f.write_bytes(b"MZ")
    parts, rep = cad.read_dxf_parts(str(f))
    assert not parts and rep.errors
    assert cad.safe_filename("../../etc/pass wd;.dxf") == "pass_wd_.dxf"


# ---------------------------------------------------------------------------
# nesting
# ---------------------------------------------------------------------------
def independent_check(res, material, cfg):
    for p in res.placements:
        assert material.contains(p.geometry)
        assert material.boundary.distance(p.geometry) >= cfg.edge_gap_mm - 1e-6
    g = [p.geometry for p in res.placements]
    for i in range(len(g)):
        for j in range(i + 1, len(g)):
            assert g[i].distance(g[j]) >= cfg.part_gap_mm - 1e-6


def test_nest_respects_every_constraint(tmp_path):
    parts, _ = cad.read_dxf_parts(cad.make_sample_job_dxf(str(tmp_path / "job.dxf")))
    for p, q in zip(parts, (4, 3, 2, 5)):
        p.quantity = q
    material = box(0, 0, 1400, 900).difference(Point(500, 450).buffer(120)).difference(box(900, 100, 1100, 300))
    cfg = sn.NestConfig(max_time_s=8, rotation_step_deg=45)
    res = sn.nest(parts, material, 1500, 950, cfg)
    assert res.placed == res.required == 14 and res.export_enabled, res.failed_checks()
    independent_check(res, material, cfg)
    assert all(p.rotation_deg in np.arange(0, 360, 45) for p in res.placements)
    out = str(tmp_path / "cut.dxf")
    info = sn.export_cutting_file(res, parts, out)
    assert info["validation"]["ok"] and info["true_curve_entities"] > 0 and os.path.exists(out)


def test_rotation_restrictions_are_respected():
    p = part("R", box(0, 0, 200, 60), qty=6, rots=[0])
    res = sn.nest([p], box(0, 0, 600, 600), 1000, 1000, sn.NestConfig(max_time_s=3))
    assert res.placed == 6 and {pl.rotation_deg for pl in res.placements} == {0.0}


def test_partial_fit_is_reported_honestly():
    p = part("S", box(0, 0, 100, 100), qty=30)
    cfg = sn.NestConfig(max_time_s=3, clearance_mm=2, kerf_mm=0.2, edge_margin_mm=2, measurement_uncertainty_mm=0)
    res = sn.nest([p], box(0, 0, 530, 530), 600, 600, cfg)
    # 5 x 5 fit: 5*100 + 4*2.2 + 2*2.1 = 513 <= 530; 6 would need 617
    assert res.placed == 25 and res.message == "25 of 30 parts fit within the available material."
    assert res.to_dict()["unplaced_by_part"] == {"S": 5} and res.export_enabled


def test_part_larger_than_material():
    res = sn.nest([part("BIG", box(0, 0, 900, 900))], box(0, 0, 800, 800), 1000, 1000, sn.NestConfig(max_time_s=2))
    assert res.placed == 0 and any("larger than the remaining usable region" in n for n in res.notes)


def test_utilization_and_waste_math():
    p = part("R", box(0, 0, 200, 100), qty=2)
    cfg = sn.NestConfig(max_time_s=2, measurement_uncertainty_mm=0)
    res = sn.nest([p], box(0, 0, 1000, 500), 1000, 500, cfg)
    m = res.metrics
    assert m["part_area_mm2"] == pytest.approx(40000)
    assert m["utilization_percent"] == pytest.approx(8.0)
    assert m["waste_area_mm2"] == pytest.approx(460000)
    assert m["cutting_distance_mm"] == pytest.approx(2 * 600)
    assert m["reusable_remnant_mm2"] + m["scrap_area_mm2"] == pytest.approx(m["waste_area_mm2"])


def test_export_puts_holes_where_the_layout_says(tmp_path):
    plate = box(0, 0, 200, 100).difference(Point(170, 50).buffer(10, quad_segs=64))
    d = _doc()
    m = d.modelspace()
    m.add_lwpolyline([(0, 0), (200, 0), (200, 100), (0, 100)], close=True)
    m.add_circle((170, 50), 10)
    f = str(tmp_path / "plate.dxf")
    d.saveas(f)
    parts, _ = cad.read_dxf_parts(f)
    parts[0].allowed_rotations = [90]
    res = sn.nest(parts, box(0, 0, 500, 500), 500, 500, sn.NestConfig(max_time_s=2))
    out = str(tmp_path / "cut.dxf")
    sn.export_cutting_file(res, parts, out)
    (circle,) = ezdxf.readfile(out).modelspace().query("CIRCLE")
    pl = res.placements[0]
    hole = pl.geometry.interiors[0]
    cx, cy = Polygon(hole).centroid.coords[0]
    assert (circle.dxf.center.x, circle.dxf.center.y) == pytest.approx((cx, cy), abs=0.05)
    assert circle.dxf.radius == pytest.approx(10)


def test_time_limit_is_respected():
    import time
    p = part("L", L_SHAPE, qty=40)
    t = time.perf_counter()
    res = sn.nest([p], box(0, 0, 1200, 800), 1200, 800, sn.NestConfig(max_time_s=2, rotation_step_deg=15))
    assert time.perf_counter() - t < 2 + 8          # the first complete layout may overrun the limit
    assert res.placed > 0 and res.export_enabled


def test_nesting_into_a_scanned_sheet_never_touches_real_cutouts(tmp_path):
    """End-to-end safety: camera image -> measured material -> nest -> every part is at least the
    edge margin away from the TRUE sheet edge and TRUE existing cut-outs of the synthetic scene."""
    import smartnest_synthetic as ss
    import smartnest_vision as sv
    sc = ss.make_scene("mixed_holes")
    scan = sv.scan_sheet(sc.image, sv.calibrate_bed(sc.corners_px, sc.bed_w, sc.bed_h, sc.camera.size))
    material = sn.material_to_cad(scan.material, sc.bed_h)
    truth = sn.material_to_cad(sc.material, sc.bed_h)
    parts, _ = cad.read_dxf_parts(cad.make_sample_job_dxf(str(tmp_path / "job.dxf")))
    for p, q in zip(parts, (12, 10, 8, 14)):
        p.quantity = q
    cfg = sn.NestConfig(max_time_s=10)
    res = sn.nest(parts, material, sc.bed_w, sc.bed_h, cfg)
    assert res.placed == res.required and res.export_enabled
    for p in res.placements:
        assert truth.contains(p.geometry)
        assert truth.boundary.distance(p.geometry) >= cfg.kerf_mm / 2 + cfg.edge_margin_mm
