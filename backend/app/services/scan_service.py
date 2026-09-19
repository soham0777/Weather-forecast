import cv2
import numpy as np
import base64
from typing import Optional
from pathlib import Path

from ..vision.calibration import load_calibration
from ..vision.preprocessing import preprocess_for_sheet_detection
from ..vision.sheet_detection import detect_sheet_boundary, sheet_pixels_to_mm
from ..vision.cutout_detection import detect_cutouts, cutouts_pixels_to_mm
from ..vision.bed_detection import detect_bed_boundary
from ..vision.coordinate_transform import build_scale_transform
from ..geometry.polygon_utils import points_to_shapely, subtract_cutouts
from ..geometry.boolean_ops import compute_available_material


def scan_image(image_bytes: bytes) -> dict:
    """
    Full scan pipeline from raw image bytes.
    Returns structured scan result with bed, sheet, cut-outs, and available material.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return {"success": False, "message": "Cannot decode image", "confidence": 0.0}

    config = load_calibration()
    h, w = image.shape[:2]
    transform = build_scale_transform(
        w, h, config.get("bed_width_mm", 1500), config.get("bed_height_mm", 3000)
    )

    # Detect bed boundary
    bed_corners_px = detect_bed_boundary(image, config)

    # Detect sheet
    sheet_result_px = detect_sheet_boundary(image)
    if sheet_result_px is None:
        return {
            "success": False,
            "message": "Sheet boundary could not be detected. Improve lighting or reposition the sheet.",
            "confidence": 0.0,
        }

    sheet_mm = sheet_pixels_to_mm(sheet_result_px, transform)

    # Detect cut-outs
    cutouts_px = detect_cutouts(image, sheet_result_px.get("polygon_px"))
    cutouts_mm = cutouts_pixels_to_mm(cutouts_px, transform)

    # Compute available material
    sheet_poly = points_to_shapely(sheet_mm["polygon_mm"])
    if sheet_poly is None:
        return {
            "success": False,
            "message": "Invalid sheet geometry computed.",
            "confidence": sheet_mm["confidence"],
        }

    cutout_polys = []
    for c in cutouts_mm:
        cp = points_to_shapely(c["polygon_mm"])
        if cp:
            cutout_polys.append(cp)

    available = compute_available_material(sheet_poly, cutout_polys)

    # Generate visualization
    viz = _generate_visualization(image, sheet_result_px, cutouts_px, h, w)
    viz_b64 = _encode_image(viz)

    return {
        "success": True,
        "confidence": sheet_mm["confidence"],
        "bed": {
            "width_mm": config.get("bed_width_mm", 1500),
            "height_mm": config.get("bed_height_mm", 3000),
            "corners_px": bed_corners_px,
        },
        "sheet": {
            "polygon_mm": sheet_mm["polygon_mm"],
            "width_mm": sheet_mm["width_mm"],
            "height_mm": sheet_mm["height_mm"],
            "area_mm2": sheet_mm["area_mm2"],
        },
        "cutouts": cutouts_mm,
        "available_area_mm2": round(available.area, 1),
        "total_cutout_area_mm2": round(sum(c["area_mm2"] for c in cutouts_mm), 1),
        "visualization_b64": viz_b64,
        "message": f"Sheet detected: {sheet_mm['width_mm']:.0f} × {sheet_mm['height_mm']:.0f} mm. "
                   f"{len(cutouts_mm)} existing cut-outs found.",
    }


def _generate_visualization(
    image: np.ndarray,
    sheet_result: dict,
    cutouts: list,
    h: int,
    w: int,
) -> np.ndarray:
    viz = image.copy()

    # Draw sheet boundary
    if sheet_result and sheet_result.get("polygon_px"):
        pts = np.array(sheet_result["polygon_px"], dtype=np.int32)
        cv2.polylines(viz, [pts], isClosed=True, color=(0, 255, 0), thickness=3)

    # Draw cut-outs
    for cutout in cutouts:
        pts = np.array(cutout["polygon_px"], dtype=np.int32)
        cv2.polylines(viz, [pts], isClosed=True, color=(0, 0, 255), thickness=2)

    return viz


def _encode_image(image: np.ndarray) -> str:
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buffer).decode("utf-8")
