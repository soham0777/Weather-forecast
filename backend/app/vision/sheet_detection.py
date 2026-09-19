import cv2
import numpy as np
from typing import Optional, List, Tuple

from .preprocessing import preprocess_for_sheet_detection
from .edge_detection import detect_edges_auto, detect_edges_canny, dilate_edges
from .contour_detection import (
    find_contours,
    filter_by_area,
    filter_by_aspect_ratio,
    get_largest_contour,
    approximate_polygon,
    contour_to_points,
)


def detect_sheet_boundary(
    image: np.ndarray,
    min_area_ratio: float = 0.05,
    max_area_ratio: float = 0.99,
) -> Optional[dict]:
    """
    Detect the actual material sheet on the laser bed.

    Returns dict with:
    - polygon_px: list of (x, y) pixel coords
    - bounding_rect: (x, y, w, h) in pixels
    - area_px2: area in pixels squared
    - confidence: detection confidence 0..1
    """
    h, w = image.shape[:2]
    total_area = h * w
    min_area = total_area * min_area_ratio
    max_area = total_area * max_area_ratio

    preprocessed = preprocess_for_sheet_detection(image)

    # Strategy 1: Canny + largest contour
    edges = detect_edges_canny(preprocessed, low_threshold=30, high_threshold=100)
    edges = dilate_edges(edges, iterations=2)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    contours = find_contours(closed)
    filtered = filter_by_area(contours, min_area, max_area)
    filtered = filter_by_aspect_ratio(filtered, 0.1, 10.0)

    if not filtered:
        # Strategy 2: threshold-based approach for high-contrast sheets
        _, thresh = cv2.threshold(preprocessed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours2 = find_contours(thresh)
        filtered = filter_by_area(contours2, min_area, max_area)
        if not filtered:
            return None

    largest = get_largest_contour(filtered)
    if largest is None:
        return None

    area_px = cv2.contourArea(largest)
    approx = approximate_polygon(largest, epsilon_factor=0.02)
    points = contour_to_points(approx)

    x, y, bw, bh = cv2.boundingRect(largest)
    hull = cv2.convexHull(largest)
    hull_area = cv2.contourArea(hull)
    solidity = area_px / hull_area if hull_area > 0 else 0

    # Confidence: higher if shape is rectangular/convex and large
    confidence = min(0.99, solidity * (area_px / total_area) * 5)

    return {
        "polygon_px": points,
        "hull_px": contour_to_points(hull),
        "bounding_rect": (x, y, bw, bh),
        "area_px2": area_px,
        "confidence": confidence,
    }


def sheet_pixels_to_mm(
    sheet_result: dict, transform: dict
) -> dict:
    """Convert sheet pixel dimensions to millimeter dimensions."""
    from .coordinate_transform import pixel_to_mm_scale

    polygon_mm = pixel_to_mm_scale(sheet_result["polygon_px"], transform)
    hull_mm = pixel_to_mm_scale(sheet_result["hull_px"], transform)

    sx = transform["scale_x"]
    sy = transform["scale_y"]
    bx, by, bw, bh = sheet_result["bounding_rect"]
    width_mm = bw * sx
    height_mm = bh * sy
    area_mm2 = sheet_result["area_px2"] * sx * sy

    return {
        "polygon_mm": polygon_mm,
        "hull_mm": hull_mm,
        "width_mm": round(width_mm, 1),
        "height_mm": round(height_mm, 1),
        "area_mm2": round(area_mm2, 1),
        "confidence": sheet_result["confidence"],
    }
