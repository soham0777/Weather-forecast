"""
Demo mode: generate synthetic scan and optimization results for testing
without a real camera or DXF file.
"""
import numpy as np
import cv2
import base64
import math
from pathlib import Path
from typing import List, Tuple

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"


def _generate_synthetic_sheet_image(scenario: str = "sheet_with_circles") -> np.ndarray:
    """Generate a synthetic image representing different bed scenarios."""
    h, w = 600, 900
    image = np.full((h, w, 3), 60, dtype=np.uint8)  # dark background = laser bed

    # Sheet: lighter gray rectangle, slightly smaller than bed
    sheet_x1, sheet_y1 = 60, 45
    sheet_x2, sheet_y2 = 840, 555
    cv2.rectangle(image, (sheet_x1, sheet_y1), (sheet_x2, sheet_y2), (180, 180, 190), -1)
    cv2.rectangle(image, (sheet_x1, sheet_y1), (sheet_x2, sheet_y2), (220, 220, 230), 3)

    if scenario in ("sheet_with_circles", "partial_sheet"):
        # Draw circular cut-outs (dark holes)
        holes = [(180, 150, 40), (450, 200, 55), (700, 130, 35), (300, 420, 50)]
        for cx, cy, r in holes:
            cv2.circle(image, (cx, cy), r, (30, 30, 30), -1)
            cv2.circle(image, (cx, cy), r, (80, 80, 80), 2)

    if scenario == "sheet_with_mixed_holes":
        # Circles
        cv2.circle(image, (200, 180), 45, (30, 30, 30), -1)
        cv2.circle(image, (600, 400), 60, (30, 30, 30), -1)
        # Rectangles
        cv2.rectangle(image, (400, 100), (530, 200), (30, 30, 30), -1)
        cv2.rectangle(image, (650, 300), (780, 400), (30, 30, 30), -1)

    return image


def get_demo_scan_result(scenario: str = "sheet_with_circles") -> dict:
    """Return a complete demo scan result."""
    image = _generate_synthetic_sheet_image(scenario)

    # Encode visualization
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
    viz_b64 = base64.b64encode(buffer).decode("utf-8")

    # Demo dimensions (scaled from synthetic image, assuming 0.5 mm/pixel scale)
    sheet_data = {
        "fresh_sheet": {
            "width_mm": 1200, "height_mm": 2400, "area_mm2": 2_880_000,
            "polygon_mm": [[60, 45], [840, 45], [840, 555], [60, 555]],
        },
        "sheet_with_circles": {
            "width_mm": 1200, "height_mm": 2400, "area_mm2": 2_880_000,
            "polygon_mm": [[30, 22], [420, 22], [420, 277], [30, 277]],
        },
        "sheet_with_mixed_holes": {
            "width_mm": 1200, "height_mm": 2400, "area_mm2": 2_880_000,
            "polygon_mm": [[30, 22], [420, 22], [420, 277], [30, 277]],
        },
        "partial_sheet": {
            "width_mm": 800, "height_mm": 1500, "area_mm2": 1_200_000,
            "polygon_mm": [[30, 22], [420, 22], [420, 277], [30, 277]],
        },
    }
    s = sheet_data.get(scenario, sheet_data["sheet_with_circles"])

    cutouts = []
    if scenario in ("sheet_with_circles", "partial_sheet"):
        for i, (cx, cy, r) in enumerate([(180, 150, 40), (450, 200, 55), (700, 130, 35), (300, 420, 50)]):
            pts = [(cx + r * math.cos(a * math.pi / 180), cy + r * math.sin(a * math.pi / 180)) for a in range(0, 360, 10)]
            cutouts.append({
                "id": f"cutout_{i:03d}",
                "type": "circle",
                "polygon_mm": pts,
                "area_mm2": round(math.pi * r * r, 1),
                "centroid_mm": (cx, cy),
                "circularity": 0.98,
            })
    elif scenario == "sheet_with_mixed_holes":
        # Circle
        cx, cy, r = 200, 180, 45
        pts = [(cx + r * math.cos(a * math.pi / 180), cy + r * math.sin(a * math.pi / 180)) for a in range(0, 360, 10)]
        cutouts.append({"id": "cutout_000", "type": "circle", "polygon_mm": pts, "area_mm2": round(math.pi * r * r, 1), "centroid_mm": (cx, cy), "circularity": 0.98})
        # Rectangle
        cutouts.append({"id": "cutout_001", "type": "rectangle", "polygon_mm": [[400, 100], [530, 100], [530, 200], [400, 200]], "area_mm2": 13000, "centroid_mm": (465, 150), "circularity": 0.4})

    total_cutout_area = sum(c["area_mm2"] for c in cutouts)
    available_area = s["area_mm2"] - total_cutout_area

    return {
        "success": True,
        "confidence": 0.94,
        "demo_mode": True,
        "scenario": scenario,
        "bed": {"width_mm": 1500, "height_mm": 3000},
        "sheet": {
            "polygon_mm": s["polygon_mm"],
            "width_mm": s["width_mm"],
            "height_mm": s["height_mm"],
            "area_mm2": s["area_mm2"],
        },
        "cutouts": cutouts,
        "available_area_mm2": round(available_area, 1),
        "total_cutout_area_mm2": round(total_cutout_area, 1),
        "visualization_b64": viz_b64,
        "message": f"[DEMO] Sheet detected: {s['width_mm']} × {s['height_mm']} mm. {len(cutouts)} existing cut-outs found.",
    }


def get_demo_optimization_result() -> dict:
    """Return a complete demo optimization result."""
    import math

    # Simulate 27 parts placed
    placements = []
    x, y = 50, 50
    for i in range(27):
        w, h = 80 + (i % 3) * 20, 60 + (i % 4) * 10
        poly_coords = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
        placements.append({
            "part_id": f"part_{i % 3:03d}",
            "instance_id": f"part_{i % 3:03d}_inst{i:02d}",
            "x_mm": x, "y_mm": y,
            "rotation_deg": 0,
            "area_mm2": w * h,
            "polygon_coords": poly_coords,
        })
        x += w + 5
        if x > 1100:
            x = 50
            y += h + 5

    return {
        "success": True,
        "demo_mode": True,
        "job_id": "demo0001",
        "required_parts": 27,
        "placed_parts": 27,
        "unplaced_parts": 0,
        "utilization_percent": 91.4,
        "waste_percent": 8.6,
        "waste_area_mm2": 247680,
        "cutting_distance_mm": 8640,
        "placements": placements,
        "dxf_parts_found": 3,
        "validation_errors": [],
        "message": "All 27 parts placed successfully.",
    }
