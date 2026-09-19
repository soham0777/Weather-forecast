import cv2
import numpy as np
from typing import Optional, List, Tuple

from .preprocessing import preprocess_for_sheet_detection
from .edge_detection import detect_edges_auto, dilate_edges
from .contour_detection import (
    find_contours,
    filter_by_area,
    get_largest_contour,
    approximate_polygon,
    contour_to_points,
)


def detect_bed_boundary(
    image: np.ndarray, config: dict
) -> Optional[List[Tuple[float, float]]]:
    """
    Detect the laser bed boundary.
    In a calibrated setup, the bed boundary is fixed and can be stored in calibration config.
    Returns corner points in pixels.
    """
    # If calibrated corners are stored, use them directly
    if config.get("bed_corners_px"):
        return config["bed_corners_px"]

    # Otherwise detect the largest rectangular region as bed boundary
    h, w = image.shape[:2]
    # Return full image corners as bed boundary (calibration required for real use)
    return [(0, 0), (w, 0), (w, h), (0, h)]


def detect_bed_from_markers(
    image: np.ndarray,
    marker_color_lower: Tuple[int, int, int] = (0, 100, 100),
    marker_color_upper: Tuple[int, int, int] = (10, 255, 255),
) -> Optional[List[Tuple[float, float]]]:
    """
    Detect bed boundary using colored fiducial markers on bed corners.
    Uses HSV color detection to find markers.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(
        hsv,
        np.array(marker_color_lower),
        np.array(marker_color_upper),
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    centers = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 50:
            continue
        M = cv2.moments(c)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        centers.append((cx, cy))

    if len(centers) == 4:
        # Order: top-left, top-right, bottom-right, bottom-left
        centers.sort(key=lambda p: p[1])
        top = sorted(centers[:2], key=lambda p: p[0])
        bottom = sorted(centers[2:], key=lambda p: p[0])
        return [top[0], top[1], bottom[1], bottom[0]]

    return None
