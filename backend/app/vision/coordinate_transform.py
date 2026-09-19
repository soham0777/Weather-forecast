import numpy as np
import cv2
from typing import List, Tuple


def build_scale_transform(
    image_width_px: int,
    image_height_px: int,
    bed_width_mm: float,
    bed_height_mm: float,
) -> dict:
    """Simple pixel-to-mm transform assuming camera covers the full bed."""
    return {
        "scale_x": bed_width_mm / image_width_px,
        "scale_y": bed_height_mm / image_height_px,
        "offset_x": 0.0,
        "offset_y": 0.0,
    }


def pixel_to_mm_scale(
    points: List[Tuple[float, float]], transform: dict
) -> List[Tuple[float, float]]:
    sx = transform["scale_x"]
    sy = transform["scale_y"]
    ox = transform["offset_x"]
    oy = transform["offset_y"]
    return [(x * sx + ox, y * sy + oy) for x, y in points]


def mm_to_pixel_scale(
    points: List[Tuple[float, float]], transform: dict
) -> List[Tuple[float, float]]:
    sx = transform["scale_x"]
    sy = transform["scale_y"]
    ox = transform["offset_x"]
    oy = transform["offset_y"]
    return [((x - ox) / sx, (y - oy) / sy) for x, y in points]


def pixel_points_to_mm_homography(
    points: List[Tuple[float, float]], H: np.ndarray
) -> List[Tuple[float, float]]:
    """Transform pixel coordinates using a homography matrix."""
    if not points:
        return []
    pts = np.array([[p] for p in points], dtype=np.float32)
    result = cv2.perspectiveTransform(pts, H)
    return [(float(r[0][0]), float(r[0][1])) for r in result]


def estimate_transform_from_bed_corners(
    detected_corners_px: List[Tuple[float, float]],
    bed_width_mm: float,
    bed_height_mm: float,
) -> np.ndarray:
    """Compute homography from detected bed corners to real mm coordinates."""
    src = np.array(detected_corners_px, dtype=np.float32)
    dst = np.array(
        [
            [0, 0],
            [bed_width_mm, 0],
            [bed_width_mm, bed_height_mm],
            [0, bed_height_mm],
        ],
        dtype=np.float32,
    )
    H, _ = cv2.findHomography(src, dst)
    return H
