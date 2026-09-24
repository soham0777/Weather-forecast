"""
Side-by-side benchmark: the original Colab notebook's algorithm vs. the optimized pipeline, on
synthetic scenes whose true geometry is known exactly.

`original_pipeline` ports Steps 3, 4 and 6 of the notebook line for line. Step 5 (sheet
detection) was not in the code that was shared, so a minimal stand-in in the same style
(CLAHE + bilateral + Otsu + largest contour + approxPolyDP) is used and marked as such.

    python benchmark_original_vs_optimized.py            # prints a table, writes BENCHMARK.md
"""
from __future__ import annotations

import math
import time

import cv2
import numpy as np
from shapely.geometry import Point, Polygon

import smartnest_synthetic as ss
import smartnest_vision as sv


def original_pipeline(raw_image, selected_corners, BED_WIDTH_MM, BED_HEIGHT_MM):
    # ---- Step 3 (as in the notebook) ------------------------------------------------------
    gray_img = cv2.cvtColor(raw_image, cv2.COLOR_BGR2GRAY)
    corners_subpix = np.asarray(selected_corners, dtype=np.float32).copy()
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.01)
    try:
        corners_subpix = cv2.cornerSubPix(gray_img, corners_subpix, (9, 9), (-1, -1), criteria)
    except Exception:
        pass
    # ---- Step 4 (as in the notebook) ------------------------------------------------------
    SCALE_MM_PER_PX = 2.0
    ortho_w = int(BED_WIDTH_MM / SCALE_MM_PER_PX)
    ortho_h = int(BED_HEIGHT_MM / SCALE_MM_PER_PX)
    ortho_dst = np.array([[0, 0], [ortho_w - 1, 0], [ortho_w - 1, ortho_h - 1], [0, ortho_h - 1]], dtype=np.float32)
    M_warp = cv2.getPerspectiveTransform(corners_subpix.reshape(4, 2), ortho_dst)
    ortho_img = cv2.warpPerspective(raw_image, M_warp, (ortho_w, ortho_h))
    # ---- Step 5 STAND-IN (not in the shared code) -----------------------------------------
    ortho_gray = cv2.cvtColor(ortho_img, cv2.COLOR_BGR2GRAY)
    g = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(ortho_gray)
    g = cv2.bilateralFilter(g, 9, 75, 75)
    _, th = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=2)
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sheet_cnt = max(cnts, key=cv2.contourArea)
    sheet_approx = cv2.approxPolyDP(sheet_cnt, 0.002 * cv2.arcLength(sheet_cnt, True), True)
    sheet_area_mm2 = cv2.contourArea(sheet_approx) * SCALE_MM_PER_PX ** 2
    (_, _), (bw, bh), _ = cv2.minAreaRect(sheet_approx)
    sheet_length_mm, sheet_width_mm = max(bw, bh) * SCALE_MM_PER_PX, min(bw, bh) * SCALE_MM_PER_PX
    # ---- Step 6 (as in the notebook) ------------------------------------------------------
    sheet_mask = np.zeros(ortho_gray.shape, dtype=np.uint8)
    cv2.fillPoly(sheet_mask, [sheet_approx], 255)
    inner_mask = cv2.erode(sheet_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (12, 12)), iterations=1)
    metal_pixels = ortho_gray[inner_mask == 255]
    mean_metal = float(np.mean(metal_pixels)) if len(metal_pixels) > 0 else 180.0
    void_thresh_val = max(50.0, mean_metal - 45.0)
    _, void_thresh = cv2.threshold(ortho_gray, void_thresh_val, 255, cv2.THRESH_BINARY_INV)
    void_blobs = cv2.bitwise_and(void_thresh, void_thresh, mask=inner_mask)
    cleaned_voids = cv2.morphologyEx(void_blobs, cv2.MORPH_CLOSE,
                                     cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4)), iterations=2)
    void_cnts, _ = cv2.findContours(cleaned_voids, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    detected_cutouts, total_cutout_area_mm2 = [], 0.0
    for cnt in void_cnts:
        c_area_px = cv2.contourArea(cnt)
        if c_area_px < 150:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri == 0:
            continue
        circ = 4.0 * math.pi * (c_area_px / (peri * peri))
        c_mm = cnt.reshape(-1, 2) * SCALE_MM_PER_PX
        xs, ys = c_mm[:, 0], c_mm[:, 1]
        c_area_mm2 = 0.5 * np.abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
        M = cv2.moments(cnt)
        cx = (M["m10"] / M["m00"]) * SCALE_MM_PER_PX if M["m00"] else 0.0
        cy = (M["m01"] / M["m00"]) * SCALE_MM_PER_PX if M["m00"] else 0.0
        is_circle = circ >= 0.85
        detected_cutouts.append({"type": "circle" if is_circle else "polygon", "area_mm2": c_area_mm2,
                                 "center_mm": (cx, cy),
                                 "radius_mm": math.sqrt(c_area_mm2 / math.pi) if is_circle else None})
        total_cutout_area_mm2 += c_area_mm2
    net_usable_area_mm2 = max(0.0, sheet_area_mm2 - total_cutout_area_mm2)
    return {"sheet_area_mm2": sheet_area_mm2, "net_mm2": net_usable_area_mm2, "cutouts": detected_cutouts,
            "length_mm": sheet_length_mm, "width_mm": sheet_width_mm}


def match(truth_holes, detected, center_key):
    found, circle_err, misclassified = 0, [], 0
    missed = []
    for h in truth_holes:
        c0 = np.array(h["geometry"].centroid.coords[0])
        r_eq = math.sqrt(h["geometry"].area / math.pi)
        cand = [d for d in detected if np.hypot(*(np.array(d[center_key]) - c0)) < max(5.0, 0.3 * r_eq)]
        if not cand:
            missed.append(h)
            continue
        found += 1
        d = cand[0]
        if h["type"] == "circle":
            dia = d.get("diameter_mm") or (2 * d["radius_mm"] if d.get("radius_mm") else None)
            if dia is None:
                misclassified += 1
            else:
                circle_err.append(abs(dia - 2 * h["radius"]))
    return found, missed, circle_err, misclassified


def describe(h):
    if h["type"] == "circle":
        return f"D{2 * h['radius']:.0f} @ ({h['center'][0]:.0f},{h['center'][1]:.0f})"
    return f"{h['type']} @ ({h['center'][0]:.0f},{h['center'][1]:.0f})"


def run():
    rows, notes = [], []
    for name in ss.SCENARIOS:
        sc = ss.make_scene(name)
        true_net = sc.material.area
        # original
        t = time.perf_counter()
        try:
            o = original_pipeline(sc.image, sc.corners_px, sc.bed_w, sc.bed_h)
            t_o = time.perf_counter() - t
            of, omiss, oerr, omis = match(sc.holes, o["cutouts"], "center_mm")
            orow = (f"{100 * (o['sheet_area_mm2'] / sc.sheet.area - 1):+.2f}%", f"{100 * (o['net_mm2'] / true_net - 1):+.2f}%",
                    f"{of}/{len(sc.holes)}" + (f" ({omis} not circle)" if omis else ""),
                    f"{max(oerr):.1f}" if oerr else "-", f"{1000 * t_o:.0f}")
            for h in omiss:
                notes.append(f"`{name}`: original missed {describe(h)}")
        except Exception as e:  # noqa: BLE001
            orow = ("fail", "fail", "-", "-", "-")
            notes.append(f"`{name}`: original failed ({type(e).__name__}: {e})")
        # optimized (uses the scenario's reference image / lens model where the scene needs one)
        use_lens = sc.hint.get("needs_lens_model")
        cal = sv.calibrate_bed(sc.corners_px, sc.bed_w, sc.bed_h, sc.camera.size,
                               camera_matrix=sc.camera.K if use_lens else None,
                               dist_coeffs=sc.camera.dist if use_lens else None)
        rect = sv.Rectifier(cal)
        ref = sc.empty_bed if sc.hint.get("needs_reference") else None
        t = time.perf_counter()
        res = sv.scan_sheet(sc.image, cal, reference_image=ref, rectifier=rect)
        t_n = time.perf_counter() - t
        nf, nmiss, nerr, nmis = match(sc.holes, res.cutouts, "centroid_mm")
        nrow = (f"{100 * (res.sheet_area_mm2 / sc.sheet.area - 1):+.3f}%",
                f"{100 * (res.available_area_mm2 / true_net - 1):+.3f}%",
                f"{nf}/{len(sc.holes)}", f"{max(nerr):.1f}" if nerr else "-", f"{1000 * t_n:.0f}")
        extra = " (ref)" if ref is not None else " (lens)" if use_lens else ""
        rows.append((name + extra, orow, nrow))
    hdr = ("| scene | sheet area err (orig / new) | usable area err (orig / new) | cut-outs found (orig / new) "
           "| worst circle D err mm (orig / new) | time ms (orig / new) |")
    lines = [hdr, "|" + "---|" * 6]
    for name, o, n in rows:
        lines.append(f"| {name} | {o[0]} / {n[0]} | {o[1]} / {n[1]} | {o[2]} / {n[2]} | {o[3]} / {n[3]} | {o[4]} / {n[4]} |")
    table = "\n".join(lines)
    md = ["# Original vs optimized - synthetic benchmark", "",
          "Ground truth is known exactly (see `smartnest_synthetic.py`). Original = notebook Steps 3, 4, 6 "
          "ported line for line; its Step 5 was not shared, so a stand-in in the same style is used.", "",
          "`(ref)` = optimized run given an empty-bed reference image; `(lens)` = given the lens model. "
          "The original has neither option.", "", table, "", "Notes:", ""]
    md += [f"- {n}" for n in notes]
    md += ["- The original exports DXF in image coordinates (y down): every layout is mirrored top-to-bottom "
           "on a Y-up CNC controller. The optimized export flips Y and is re-read and compared before release."]
    open("BENCHMARK.md", "w").write("\n".join(md) + "\n")
    print(table)
    print("\n".join(notes))


if __name__ == "__main__":
    run()
