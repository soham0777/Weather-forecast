import json
import numpy as np
import cv2
from pathlib import Path
from typing import Optional, Tuple


CALIBRATION_PATH = Path(__file__).parent.parent.parent.parent / "data" / "calibration" / "calibration.json"

DEFAULT_CONFIG = {
    "bed_width_mm": 1500,
    "bed_height_mm": 3000,
    "pixel_per_mm_x": 0.5,
    "pixel_per_mm_y": 0.5,
    "image_width_px": 3000,
    "image_height_px": 6000,
    "homography": None,
}


def load_calibration() -> dict:
    if CALIBRATION_PATH.exists():
        with open(CALIBRATION_PATH) as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()


def save_calibration(config: dict):
    CALIBRATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CALIBRATION_PATH, "w") as f:
        json.dump(config, f, indent=2)


def pixel_to_mm(px: float, py: float, config: dict) -> Tuple[float, float]:
    """Convert pixel coordinates to millimeter coordinates."""
    if config.get("homography"):
        H = np.array(config["homography"])
        pt = np.array([[[px, py]]], dtype=np.float32)
        result = cv2.perspectiveTransform(pt, H)
        return float(result[0][0][0]), float(result[0][0][1])
    # Simple linear scale fallback
    mm_x = px * config.get("pixel_per_mm_x", 1.0)
    mm_y = py * config.get("pixel_per_mm_y", 1.0)
    return mm_x, mm_y


def mm_to_pixel(mx: float, my: float, config: dict) -> Tuple[float, float]:
    """Convert millimeter coordinates to pixel coordinates."""
    if config.get("homography"):
        H = np.array(config["homography"])
        H_inv = np.linalg.inv(H)
        pt = np.array([[[mx, my]]], dtype=np.float32)
        result = cv2.perspectiveTransform(pt, H_inv)
        return float(result[0][0][0]), float(result[0][0][1])
    px = mx / config.get("pixel_per_mm_x", 1.0)
    py = my / config.get("pixel_per_mm_y", 1.0)
    return px, py


def compute_homography_from_reference(
    image_corners: list, real_corners_mm: list
) -> Optional[np.ndarray]:
    """Compute homography from 4 known reference corners."""
    src = np.array(image_corners, dtype=np.float32)
    dst = np.array(real_corners_mm, dtype=np.float32)
    H, _ = cv2.findHomography(src, dst)
    return H


def apply_perspective_correction(image: np.ndarray, config: dict) -> np.ndarray:
    """Apply perspective/homography correction to the image."""
    if not config.get("homography"):
        return image
    H = np.array(config["homography"])
    h, w = image.shape[:2]
    corrected = cv2.warpPerspective(image, H, (w, h))
    return corrected
