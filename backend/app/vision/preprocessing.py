import cv2
import numpy as np


def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Cannot load image: {path}")
    return img


def to_grayscale(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def denoise(gray: np.ndarray, method: str = "gaussian") -> np.ndarray:
    if method == "gaussian":
        return cv2.GaussianBlur(gray, (5, 5), 0)
    elif method == "median":
        return cv2.medianBlur(gray, 5)
    elif method == "bilateral":
        return cv2.bilateralFilter(gray, 9, 75, 75)
    return gray


def enhance_contrast(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def threshold_adaptive(gray: np.ndarray) -> np.ndarray:
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )


def morphological_close(binary: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)


def morphological_open(binary: np.ndarray, kernel_size: int = 3) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)


def preprocess_for_sheet_detection(image: np.ndarray) -> np.ndarray:
    gray = to_grayscale(image)
    enhanced = enhance_contrast(gray)
    denoised = denoise(enhanced, "gaussian")
    return denoised


def preprocess_for_cutout_detection(image: np.ndarray) -> np.ndarray:
    gray = to_grayscale(image)
    denoised = denoise(gray, "bilateral")
    return denoised
