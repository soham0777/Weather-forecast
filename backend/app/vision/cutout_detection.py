import cv2
import numpy as np
from typing import List, Optional, Tuple

from .preprocessing import preprocess_for_cutout_detection
from .edge_detection import detect_edges_canny, detect_circles, dilate_edges
from .contour_detection import (
    find_contours_with_hierarchy,
    filter_by_area,
    approximate_polygon,
    contour_to_points,
)


def circle_to_polygon(cx: float, cy: float, r: float, num_points: int = 64) -> List[Tuple[float, float]]:
    angles = np.linspace(0, 2 * np.pi, num_points, endpoint=False)
    return [(cx + r * np.cos(a), cy + r * np.sin(a)) for a in angles]


def detect_cutouts(
    image: np.ndarray,
    sheet_polygon_px: Optional[List[Tuple[float, float]]] = None,
    min_area_px: float = 200,
    max_area_ratio: float = 0.3,
) -> List[dict]:
    """
    Detect existing cut-outs (holes) in the material sheet.

    Returns list of dicts:
    - id: str
    - type: 'circle' | 'rectangle' | 'polygon'
    - polygon_px: list of (x,y)
    - area_px2: float
    - centroid_px: (cx, cy)
    - circularity: float (1.0 = perfect circle)
    """
    h, w = image.shape[:2]
    total_area = h * w
    max_area_px = total_area * max_area_ratio

    preprocessed = preprocess_for_cutout_detection(image)

    # Build mask for the sheet region if provided
    sheet_mask = None
    if sheet_polygon_px:
        sheet_mask = np.zeros((h, w), dtype=np.uint8)
        pts = np.array(sheet_polygon_px, dtype=np.int32)
        cv2.fillPoly(sheet_mask, [pts], 255)

    # Dark regions inside the sheet = cut-outs
    _, thresh = cv2.threshold(preprocessed, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    if sheet_mask is not None:
        thresh = cv2.bitwise_and(thresh, sheet_mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    contours, hierarchy = find_contours_with_hierarchy(thresh)

    cutouts = []
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area < min_area_px or area > max_area_px:
            continue

        # Skip the outermost sheet boundary contour
        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue

        circularity = 4 * np.pi * area / (perimeter ** 2)

        M = cv2.moments(contour)
        if M["m00"] == 0:
            continue
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]

        approx = approximate_polygon(contour, epsilon_factor=0.02)
        points = contour_to_points(approx)

        # Classify shape
        if circularity > 0.85:
            shape_type = "circle"
        elif len(approx) == 4:
            shape_type = "rectangle"
        else:
            shape_type = "polygon"

        cutouts.append({
            "id": f"cutout_{i:03d}",
            "type": shape_type,
            "polygon_px": points,
            "area_px2": area,
            "centroid_px": (cx, cy),
            "circularity": circularity,
        })

    return cutouts


def cutouts_pixels_to_mm(cutouts: List[dict], transform: dict) -> List[dict]:
    """Convert cut-out pixel coordinates to millimeter coordinates."""
    from .coordinate_transform import pixel_to_mm_scale

    result = []
    sx = transform["scale_x"]
    sy = transform["scale_y"]

    for c in cutouts:
        polygon_mm = pixel_to_mm_scale(c["polygon_px"], transform)
        cx_mm, cy_mm = pixel_to_mm_scale([c["centroid_px"]], transform)[0]
        area_mm2 = c["area_px2"] * sx * sy

        result.append({
            "id": c["id"],
            "type": c["type"],
            "polygon_mm": polygon_mm,
            "area_mm2": round(area_mm2, 1),
            "centroid_mm": (round(cx_mm, 1), round(cy_mm, 1)),
            "circularity": c["circularity"],
        })
    return result
