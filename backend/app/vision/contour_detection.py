import cv2
import numpy as np
from typing import List, Tuple


def find_contours(
    binary: np.ndarray, mode=cv2.RETR_EXTERNAL
) -> List[np.ndarray]:
    contours, _ = cv2.findContours(binary, mode, cv2.CHAIN_APPROX_SIMPLE)
    return list(contours)


def find_contours_with_hierarchy(
    binary: np.ndarray,
) -> Tuple[List[np.ndarray], np.ndarray]:
    contours, hierarchy = cv2.findContours(
        binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )
    return list(contours), hierarchy


def approximate_polygon(contour: np.ndarray, epsilon_factor: float = 0.02) -> np.ndarray:
    perimeter = cv2.arcLength(contour, True)
    epsilon = epsilon_factor * perimeter
    return cv2.approxPolyDP(contour, epsilon, True)


def filter_by_area(
    contours: List[np.ndarray], min_area: float = 1000, max_area: float = float("inf")
) -> List[np.ndarray]:
    return [c for c in contours if min_area <= cv2.contourArea(c) <= max_area]


def filter_by_aspect_ratio(
    contours: List[np.ndarray], min_ratio: float = 0.1, max_ratio: float = 10.0
) -> List[np.ndarray]:
    result = []
    for c in contours:
        _, _, w, h = cv2.boundingRect(c)
        if h == 0:
            continue
        ratio = w / h
        if min_ratio <= ratio <= max_ratio:
            result.append(c)
    return result


def get_largest_contour(contours: List[np.ndarray]) -> np.ndarray:
    if not contours:
        return None
    return max(contours, key=cv2.contourArea)


def contour_to_points(contour: np.ndarray) -> List[Tuple[float, float]]:
    return [(float(pt[0][0]), float(pt[0][1])) for pt in contour]


def is_closed_contour(contour: np.ndarray, threshold_px: float = 10) -> bool:
    if len(contour) < 3:
        return False
    first = contour[0][0]
    last = contour[-1][0]
    dist = np.linalg.norm(first - last)
    return dist < threshold_px
