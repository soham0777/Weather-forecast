import cv2
import numpy as np
from typing import Tuple


def detect_edges_canny(
    gray: np.ndarray,
    low_threshold: int = 50,
    high_threshold: int = 150,
    aperture: int = 3,
) -> np.ndarray:
    return cv2.Canny(gray, low_threshold, high_threshold, apertureSize=aperture)


def detect_edges_auto(gray: np.ndarray) -> np.ndarray:
    """Canny with automatically computed thresholds using Otsu's method."""
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    low = thresh * 0.5
    high = thresh
    return cv2.Canny(gray, low, high)


def dilate_edges(edges: np.ndarray, iterations: int = 2) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.dilate(edges, kernel, iterations=iterations)


def detect_lines(
    edges: np.ndarray,
    rho: float = 1,
    theta: float = np.pi / 180,
    threshold: int = 100,
) -> np.ndarray:
    lines = cv2.HoughLines(edges, rho, theta, threshold)
    return lines if lines is not None else np.array([])


def detect_circles(
    gray: np.ndarray,
    min_radius: int = 10,
    max_radius: int = 500,
    param1: float = 50,
    param2: float = 30,
) -> np.ndarray:
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=min_radius * 2,
        param1=param1,
        param2=param2,
        minRadius=min_radius,
        maxRadius=max_radius,
    )
    if circles is not None:
        return np.round(circles[0, :]).astype(int)
    return np.array([])
