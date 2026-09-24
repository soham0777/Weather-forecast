"""Automated tests for the SmartNest vision core.

Unit tests cover the mathematics (homography, pixel conventions, half-pixel correction, circle
fit, geometric material subtraction, DXF orientation). Scenario tests render synthetic beds with
exactly known geometry and check detection errors in millimetres. Run:  pytest -q
"""
import json
import math
import os
import sys

import cv2
import numpy as np
import pytest
from shapely.geometry import Point, Polygon, box

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import smartnest_synthetic as ss  # noqa: E402
import smartnest_vision as sv  # noqa: E402


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
_SCENES = {}


def scene(name):
    if name not in _SCENES:
        _SCENES[name] = ss.make_scene(name)
    return _SCENES[name]


def calib_for(sc, lens=True):
    use = lens and sc.hint.get("needs_lens_model")
    return sv.calibrate_bed(sc.corners_px, sc.bed_w, sc.bed_h, sc.camera.size,
                            camera_matrix=sc.camera.K if use else None,
                            dist_coeffs=sc.camera.dist if use else None)


def scan(sc, **kw):
    ref = sc.empty_bed if sc.hint.get("needs_reference") else None
    return sv.scan_sheet(sc.image, calib_for(sc), reference_image=ref, **kw)


def iou(a, b):
    return a.intersection(b).area / a.union(b).area


def unit_rectifier(w=600, h=400):
    """Calibration where 1 image px == 1 mm and ortho == image (for mask-level unit tests)."""
    pts = np.array([[-0.5, -0.5], [w - 0.5, -0.5], [w - 0.5, h - 0.5], [-0.5, h - 0.5]])
    cal = sv.calibrate_bed(pts, w, h, (w, h))
    return sv.Rectifier(cal, mm_per_px=1.0)


# ---------------------------------------------------------------------------
# calibration & coordinates
# ---------------------------------------------------------------------------
def test_homography_roundtrip():
    img = np.array([[160, 80], [1760, 80], [1840, 1000], [80, 1000]], float)
    cal = sv.calibrate_bed(img, 1500, 950, (1920, 1080))
    assert np.allclose(cal.image_to_bed(img), [[0, 0], [1500, 0], [1500, 950], [0, 950]], atol=1e-6)
    p = np.array([[400.0, 300.0], [1200.5, 777.25]])
    assert np.allclose(cal.image_to_bed(cal.bed_to_image(p)), p, atol=1e-6)
    assert cal.rms_mm is None and any("cannot be measured" in w for w in cal.warnings)


def test_corner_order_is_repaired():
    tl, tr, br, bl = [160, 80], [1760, 80], [1840, 1000], [80, 1000]
    good = np.array([tl, tr, br, bl], float)
    crossed = np.array([tl, br, tr, bl], float)          # operator clicked in a Z pattern
    mirrored = np.array([tl, bl, br, tr], float)         # counter-clockwise -> mirrored layout
    for clicks in (crossed, mirrored):
        fixed, changed = sv.order_corners_clockwise(clicks)
        assert changed and np.allclose(fixed, good)
    with pytest.raises(sv.VisionError):
        sv.order_corners_clockwise(good[:3])


def test_more_points_give_measured_residual():
    rng = np.random.default_rng(1)
    mm = np.array([[x, y] for x in (0, 750, 1500) for y in (0, 475, 950)], float)
    cam = ss.make_camera(1500, 950)
    px = cam.project(mm) + rng.normal(0, 0.3, (len(mm), 2))
    cal = sv.calibrate_bed(px, 1500, 950, cam.size, bed_pts_mm=mm)
    assert cal.n_points == 9 and 0 < cal.rms_mm < 1.0


def test_calibration_json_roundtrip(tmp_path):
    sc = scene("lens_distortion")
    cal = calib_for(sc)
    f = tmp_path / "calibration.json"
    cal.save(str(f))
    back = sv.BedCalibration.load(str(f))
    p = np.array([[100.0, 200.0], [2900.0, 1400.0]])
    assert np.allclose(back.bed_to_image(p), cal.bed_to_image(p), atol=1e-6)
    assert json.loads(f.read_text())["camera_matrix"] is not None


def test_ortho_pixel_convention_has_no_scale_error():
    """Pixel (u, v) centre == ((u+.5)s, (v+.5)s). The original notebook mapped the bed onto
    (w-1) pixels but converted back with *s, a (w-1)/w scale error: 2 mm over 1500 mm at 2 mm/px."""
    cal = sv.calibrate_bed([[0, 0], [1500, 0], [1500, 950], [0, 950]], 1500, 950, (1500, 950))
    r = sv.Rectifier(cal, mm_per_px=2.0)
    assert (r.w, r.h) == (750, 475)
    assert np.allclose(r.px_to_mm([[0, 0], [749, 474]]), [[1, 1], [1499, 949]])
    assert np.allclose(r.mm_to_px(r.px_to_mm([[12.3, 45.6]])), [[12.3, 45.6]])
    original_far_corner_mm = (750 - 1) * 2.0      # the notebook's mapping of the bed's right edge
    assert abs(original_far_corner_mm - 1500) == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# mask -> geometry
# ---------------------------------------------------------------------------
def test_half_pixel_and_subpixel_correction_give_exact_area():
    """Raw cv2.contourArea under-reports a filled rectangle (contour runs through the boundary
    pixel centres). After correction the area must be exact."""
    r = unit_rectifier()
    m = np.zeros((r.h, r.w), np.uint8)
    m[50:250, 100:500] = 255          # 400 x 200 px
    m[100:150, 200:250] = 0           # 50 x 50 hole
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    assert cv2.contourArea(cs[0]) == pytest.approx(399 * 199)          # the raw bias
    outline, holes, _, stats = sv.mask_to_geometry(m, m, r, sv.VisionConfig(min_sheet_area_mm2=1000))
    assert outline.area == pytest.approx(80000, rel=2e-4)
    assert len(holes) == 1 and holes[0].area == pytest.approx(2500, rel=2e-3)
    assert stats["edge_support"] > 0.9


def test_fit_circle_exact():
    t = np.linspace(0, 2 * np.pi, 200, endpoint=False)
    pts = np.c_[123.4 + 56.7 * np.cos(t), -8.9 + 56.7 * np.sin(t)]
    cx, cy, r, rms = sv.fit_circle(pts)
    assert (cx, cy, r) == pytest.approx((123.4, -8.9, 56.7), abs=1e-9) and rms < 1e-9


@pytest.mark.parametrize("geom,kind", [
    (Point(500, 500).buffer(40, quad_segs=64), "circle"),
    (box(0, 0, 300, 120), "rectangle"),
    (Polygon([(0, 0), (200, 0), (220, 150), (60, 90), (0, 160)]), "irregular"),
    (Point(0, 0).buffer(30).union(box(0, -30, 120, 30)), "irregular"),     # slot / keyhole
])
def test_cutout_classification(geom, kind):
    assert sv.classify_cutout(geom, sv.VisionConfig())["type"] == kind


def test_material_is_geometric_not_arithmetic():
    """Overlapping cut-outs must not be subtracted twice, and a cut-out that breaks the sheet
    edge becomes part of the outline, not an interior hole."""
    sheet = box(0, 0, 1000, 500)
    a, b = Point(300, 250).buffer(100, quad_segs=128), Point(400, 250).buffer(100, quad_segs=128)
    edge = Point(1000, 250).buffer(80, quad_segs=128)
    res = sv.build_result(sheet, [a, b, edge], 2000, 1000, 1.0, sv.VisionConfig())
    naive = sheet.area - a.area - b.area - edge.area
    exact = sheet.difference(a.union(b).union(edge)).area
    assert res.available_area_mm2 == pytest.approx(exact) and exact > naive + 1000
    assert len(res.cutouts) == 1                      # the overlapping pair is one void
    assert res.sheet_area_mm2 == pytest.approx(sheet.difference(edge).area)
    assert len(res.edge_notches) == 1


def test_operator_corrections():
    sheet = box(100, 100, 1100, 700)
    holes = [Point(300, 300).buffer(50, quad_segs=64), box(600, 300, 700, 400)]
    res = sv.build_result(sheet, holes, 1500, 950, 1.0, sv.VisionConfig())
    false_id = next(c["id"] for c in res.cutouts if c["type"] == "rectangle")
    fixed = sv.apply_corrections(res, remove_ids=[false_id], add_cutouts_mm=[{"center": [900, 500], "radius": 40}])
    types = sorted(c["type"] for c in fixed.cutouts)
    assert types == ["circle", "circle"] and fixed.corrected_by_operator
    assert fixed.available_area_mm2 == pytest.approx(
        sheet.difference(holes[0]).difference(Point(900, 500).buffer(40, quad_segs=64)).area, rel=1e-6)


def test_usable_region_shrinks_edges_and_holes():
    sheet, hole = box(0, 0, 1000, 500), Point(500, 250).buffer(50, quad_segs=64)
    res = sv.build_result(sheet, [hole], 1500, 950, 1.0, sv.VisionConfig())
    u = sv.usable_region(res, uncertainty_mm=2.0, edge_margin_mm=3.0)
    assert u.bounds == pytest.approx((5, 5, 995, 495))
    assert u.distance(Point(500, 250)) == pytest.approx(55, abs=0.05)


# ---------------------------------------------------------------------------
# DXF
# ---------------------------------------------------------------------------
def test_dxf_roundtrip_and_orientation(tmp_path):
    sheet = box(100, 50, 1100, 650)
    near_top = Point(300, 120).buffer(30, quad_segs=128)     # small image y == near the far edge
    slot = box(700, 400, 900, 450)
    res = sv.build_result(sheet, [near_top, slot], 1500, 950, 1.0, sv.VisionConfig())
    path = str(tmp_path / "sheet.dxf")
    info = sv.export_dxf(res, path)
    assert info["circles"] == 1
    check = sv.validate_dxf(path, res)
    assert check["ok"], check
    import ezdxf
    doc = ezdxf.readfile(path)
    assert doc.units == ezdxf.units.MM
    (circle,) = doc.modelspace().query("CIRCLE")
    assert circle.dxf.center.y == pytest.approx(950 - 120, abs=0.05)     # Y flipped, not mirrored
    assert circle.dxf.center.x == pytest.approx(300, abs=0.05)
    path2 = str(tmp_path / "sheet_tl.dxf")
    sv.export_dxf(res, path2, origin="top-left")
    assert sv.validate_dxf(path2, res, origin="top-left")["ok"]


def test_export_refuses_invalid_geometry(tmp_path):
    res = sv.build_result(box(0, 0, 500, 500), [], 1500, 950, 1.0, sv.VisionConfig())
    res.cutouts.append({"id": "cutout_x", "type": "irregular", "geometry": box(600, 600, 700, 700)})
    with pytest.raises(sv.VisionError, match="Export blocked"):
        sv.export_dxf(res, str(tmp_path / "bad.dxf"))


# ---------------------------------------------------------------------------
# error handling
# ---------------------------------------------------------------------------
def test_empty_bed_and_bad_images_raise():
    sc = scene("fresh_sheet")
    cal = calib_for(sc)
    with pytest.raises(sv.VisionError, match="could not be detected|bed around a sheet"):
        sv.scan_sheet(sc.empty_bed, cal)
    with pytest.raises(sv.VisionError, match="No camera image"):
        sv.scan_sheet(np.zeros((0, 0, 3), np.uint8), cal)
    with pytest.raises(sv.VisionError, match="calibration was made"):
        sv.scan_sheet(cv2.resize(sc.image, (1280, 720)), cal)


def test_multiple_sheets_are_reported():
    cam = ss.make_camera(3000, 1500)
    mat = box(150, 150, 1350, 1250).union(box(1650, 300, 2750, 1150))
    img = ss.render(3000, 1500, mat, cam, seed=5)
    cal = sv.calibrate_bed(cam.project([[0, 0], [3000, 0], [3000, 1500], [0, 1500]]), 3000, 1500, cam.size)
    res = sv.scan_sheet(img, cal)
    assert res.sheet_area_mm2 == pytest.approx(1200 * 1100, rel=2e-3)
    assert res.needs_confirmation and any("Multiple possible sheets" in w for w in res.warnings)


def test_scan_json_contract():
    res = scan(scene("four_circles"))
    d = res.to_dict()
    json.dumps(d)
    assert set(d) >= {"bed", "sheet", "cutouts", "material", "confidence", "warnings", "needs_confirmation"}
    assert d["bed"] == {"width_mm": 3000, "height_mm": 1500}
    assert {"length_mm", "width_mm", "area_mm2", "polygon_mm"} <= set(d["sheet"])
    c = d["cutouts"][0]
    assert c["id"] == "cutout_001" and c["type"] == "circle" and "area_mm2" in c and "diameter_mm" in c
    assert d["material"]["available_area_mm2"] == pytest.approx(
        d["material"]["sheet_area_mm2"] - d["material"]["removed_area_mm2"], abs=1)


# ---------------------------------------------------------------------------
# scenario accuracy against ground truth
# ---------------------------------------------------------------------------
ACCURACY_SCENES = ["fresh_sheet", "four_circles", "mixed_holes", "irregular_remnant", "lens_distortion", "small_bed"]
TRUE_DIMS = {"irregular_remnant": (2200, 1100, 2.5), "small_bed": (1200, 800, 0.0)}


@pytest.mark.parametrize("name", ACCURACY_SCENES)
def test_scenario_accuracy(name):
    sc = scene(name)
    res = scan(sc)
    assert res.segmentation["mode"] == "intensity"
    assert abs(res.sheet_area_mm2 / sc.sheet.area - 1) < 1e-3
    assert abs(res.available_area_mm2 / sc.material.area - 1) < 1e-3
    assert iou(res.material, sc.material) > 0.998
    L, W, ang = TRUE_DIMS.get(name, (2400, 1200, 0.0))
    assert res.dims["length_mm"] == pytest.approx(L, abs=0.5)
    assert res.dims["width_mm"] == pytest.approx(W, abs=0.5)
    assert res.dims["angle_deg"] == pytest.approx(ang, abs=0.1)
    assert len(res.cutouts) == len(sc.holes)
    assert len(res.edge_notches) == len(sc.notches)
    for h in sc.holes:
        c = min(res.cutouts, key=lambda c: np.hypot(*(np.array(c["centroid_mm"]) - h["geometry"].centroid.coords[0])))
        assert c["type"] == h["type"], (h, c["type"])
        # worst single point: up to ~3 mm where an edge runs along a bright slat (intensity mode);
        # assert_safe_after_margin below is the criterion that matters for cutting
        assert c["geometry"].hausdorff_distance(h["geometry"]) < 3.5
        assert iou(c["geometry"], h["geometry"]) > 0.96                        # D25 hole: 0.25 mm = 4 % IoU
        if h["type"] == "circle":
            assert np.hypot(*(np.array(c["center_mm"]) - h["center"])) < 0.5
            assert c["diameter_mm"] == pytest.approx(2 * h["radius"], abs=0.8)
        if h["type"] == "rectangle":
            assert c["length_mm"] == pytest.approx(max(h["size"]), abs=0.6)
            assert c["width_mm"] == pytest.approx(min(h["size"]), abs=0.6)
    assert res.confidence > 0.9 and not res.warnings
    assert_safe_after_margin(res, sc)


def assert_safe_after_margin(res, sc, margin=3.0):
    """The safety property that matters for cutting: after the measurement-uncertainty margin,
    nothing the nesting engine may use lies outside the real material."""
    usable = sv.usable_region(res, uncertainty_mm=margin)
    assert usable.difference(sc.material).area < 1.0, usable.difference(sc.material).area


def test_small_bolt_hole_is_not_ignored():
    """The original notebook skipped voids < 150 px (600 mm2 at 2 mm/px): a D25 bolt hole would be
    treated as solid material and a part could be nested over it."""
    res = scan(scene("mixed_holes"))
    bolt = [c for c in res.cutouts if c["type"] == "circle" and c["diameter_mm"] < 40]
    assert len(bolt) == 1 and bolt[0]["diameter_mm"] == pytest.approx(25, abs=0.8)


def test_hole_near_sheet_edge_is_found():
    res = scan(scene("mixed_holes"))
    near = [c for c in res.cutouts if abs(c["centroid_mm"][0] - 235) < 3 and abs(c["centroid_mm"][1] - 1100) < 3]
    assert len(near) == 1 and near[0]["diameter_mm"] == pytest.approx(70, abs=0.8)


def test_dark_steel_needs_reference_and_errs_on_the_safe_side():
    sc = scene("dark_steel")
    cal = calib_for(sc)
    # brightness alone: the slat that runs along the sheet's left edge merges with the sheet and
    # reaches the bed edge. It must not pass as a clean scan.
    try:
        bad = sv.scan_sheet(sc.image, cal)
        assert iou(bad.material, sc.material) < 0.99 and bad.needs_confirmation
    except sv.VisionError:
        pass
    res = sv.scan_sheet(sc.image, cal, reference_image=sc.empty_bed)
    assert res.segmentation["mode"] == "reference"
    assert iou(res.material, sc.material) > 0.996
    assert len(res.cutouts) == len(sc.holes)
    # known limitation: an edge lying exactly on a slat is uncertain by up to ~2 px (conservative on
    # one side here, 0.5 mm optimistic on the other); the uncertainty margin must cover it
    assert res.material.difference(sc.material).area < 1e-3 * sc.material.area
    assert_safe_after_margin(res, sc)


def test_lens_model_is_required_for_wide_angle_cameras():
    sc = scene("lens_distortion")
    with_model = scan(sc)
    no_model = sv.scan_sheet(sc.image, calib_for(sc, lens=False))
    assert with_model.outline.hausdorff_distance(sc.sheet) < 3.0
    assert no_model.outline.hausdorff_distance(sc.sheet) > 20.0         # 4 exact corners, bulging middle
    assert iou(with_model.material, sc.material) > 0.998 > iou(no_model.material, sc.material)


def test_aruco_calibration_is_automatic_and_self_checking():
    sc = scene("mixed_holes")
    cal = sv.calibrate_from_aruco(sc.image, sc.markers_mm, sc.bed_w, sc.bed_h)
    assert cal.n_points >= 16 and cal.rms_mm < 0.5
    assert np.abs(cal.bed_to_image(cal.bed_corners_mm()) - sc.corners_px).max() < 0.5
    res = sv.scan_sheet(sc.image, cal)
    assert abs(res.available_area_mm2 / sc.material.area - 1) < 1e-3


def test_corner_refinement_never_jumps():
    sc = scene("fresh_sheet")
    gray = cv2.cvtColor(sc.image, cv2.COLOR_BGR2GRAY)
    rng = np.random.default_rng(3)
    clicks = sc.corners_px + rng.uniform(-3, 3, (4, 2))
    out, shift, ok = sv.refine_corners(gray, clicks, max_shift_px=2.0)
    assert np.all(np.hypot(*(out - clicks).T) <= 2.0 + 1e-6)
    assert np.allclose(out[~ok], clicks[~ok], atol=1e-4)


def test_scan_is_fast_enough_for_interactive_use():
    import time
    sc = scene("mixed_holes")
    cal = calib_for(sc)
    rect = sv.Rectifier(cal)
    sv.scan_sheet(sc.image, cal, rectifier=rect)
    t = time.perf_counter()
    sv.scan_sheet(sc.image, cal, rectifier=rect)
    assert time.perf_counter() - t < 2.0
