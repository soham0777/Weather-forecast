"""
Bansali SmartNest - vision core (optimized rewrite of the Colab prototype).

Every measurement ends in *bed millimetres*. The pipeline:

    raw camera frame
      -> lens undistortion           camera_matrix + dist_coeffs (chessboard, once per camera)
      -> homography  image -> mm     4+ reference points (clicks or ArUco markers), once per mount
      -> orthographic resample       ONE remap at the camera's native resolution (cached maps)
      -> material segmentation       empty-bed reference difference, or Otsu on luminance
      -> contour hierarchy           outer boundary = sheet, child contours = existing cut-outs
      -> Shapely geometry (mm)       material = sheet - union(cut-outs), half-pixel corrected
      -> classification, confidence
      -> DXF (Y-up, mm) + validation by reading the file back

Coordinate frames (see README):
    image px : OpenCV convention, pixel (col j, row i) has its centre at (x=j, y=i)
    bed mm   : origin at calibration corner #1 (image top-left), x -> corner #2, y -> corner #4
    ortho px : pixel (u, v) has its centre at bed mm ((u + 0.5) * s, (v + 0.5) * s)
    CAD mm   : right-handed, Y up; X = x, Y = bed_h - y   (origin = bottom-left of the bed)

Nothing here assumes a global pixel/mm ratio, a sheet that fills the bed, or round cut-outs.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from typing import Any, Sequence

import cv2
import numpy as np
import shapely
from shapely.geometry import LinearRing, MultiPolygon, Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.validation import make_valid

CORNER_NAMES = ("top-left", "top-right", "bottom-right", "bottom-left")


class VisionError(RuntimeError):
    """Raised with an operator-readable message when a scan cannot be trusted."""


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
@dataclass
class VisionConfig:
    mm_per_px: float | None = None     # ortho resolution; None = match the camera's native resolution
    segmentation: str = "auto"         # "auto" (reference if given, else intensity) | "reference" | "intensity"
    polarity: str = "bright"           # intensity mode: sheet "bright"er or "dark"er than the bed
    min_feature_mm: float = 6.0        # thinner structures are removed: slat tops, scratches, dust
    min_sheet_area_mm2: float = 50_000.0
    max_hole_fraction: float = 0.5     # a "sheet" whose biggest hole is larger than this is the bed around a sheet
    ambiguity_ratio: float = 0.15      # a 2nd blob this large (vs the sheet) is reported as ambiguous
    reference_min_delta: float = 18.0  # min Lab colour difference that counts as "something is on the bed"
    simplify_mm: float = 0.02          # drops collinear points only: a coarser Douglas-Peucker pass
                                       # keeps rounded corner points and shifts whole edges
    circle_rms_mm: float = 0.6         # max RMS radial residual to call a cut-out a circle ...
    circle_rms_frac: float = 0.015     # ... or this fraction of the radius, whichever is larger
    rect_fill: float = 0.97            # area / minimum-rotated-rectangle area to call it a rectangle
    edge_notch_min_area_mm2: float = 400.0
    confirm_below: float = 0.85        # quality score below this requires operator confirmation


# ---------------------------------------------------------------------------
# Small numeric helpers
# ---------------------------------------------------------------------------
def _pts(a) -> np.ndarray:
    return np.asarray(a, dtype=np.float64).reshape(-1, 2)


def apply_homography(H: np.ndarray, pts) -> np.ndarray:
    p = _pts(pts)
    q = np.c_[p, np.ones(len(p))] @ np.asarray(H, dtype=np.float64).T
    return q[:, :2] / q[:, 2:3]


def _shoelace(p: np.ndarray) -> float:
    x, y = p[:, 0], p[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def distort_pixels(pts, K, D) -> np.ndarray:
    """Ideal (pinhole) pixel coordinates -> where the real, distorting lens puts them."""
    p = _pts(pts)
    K = np.asarray(K, dtype=np.float64)
    xn = (p[:, 0] - K[0, 2]) / K[0, 0]
    yn = (p[:, 1] - K[1, 2]) / K[1, 1]
    obj = np.c_[xn, yn, np.ones(len(p))].reshape(-1, 1, 3)
    img, _ = cv2.projectPoints(obj, np.zeros(3), np.zeros(3), K, np.asarray(D, dtype=np.float64))
    return img.reshape(-1, 2)


def undistort_pixels(pts, K, D, iterations: int = 6) -> np.ndarray:
    """Distorted pixels -> ideal pixels. cv2.undistortPoints plus fixed-point refinement,
    because its default 5 iterations are not enough near the corners of wide-angle webcams."""
    p = _pts(pts)
    K = np.asarray(K, dtype=np.float64)
    D = np.asarray(D, dtype=np.float64)
    u = cv2.undistortPoints(p.reshape(-1, 1, 2), K, D, P=K).reshape(-1, 2)
    for _ in range(iterations):
        u = u + (p - distort_pixels(u, K, D))
    return u


def _otsu(values: np.ndarray) -> tuple[int, float]:
    """Otsu threshold on uint8 values and its separability eta = between-class / total variance
    (1.0 = two perfectly separated populations; ~0 = no structure)."""
    hist = np.bincount(values.ravel(), minlength=256).astype(np.float64)
    p = hist / max(hist.sum(), 1.0)
    levels = np.arange(256, dtype=np.float64)
    omega = np.cumsum(p)
    mu = np.cumsum(p * levels)
    mu_t = mu[-1]
    var_t = float(np.sum(p * (levels - mu_t) ** 2))
    with np.errstate(divide="ignore", invalid="ignore"):
        sigma_b = (mu_t * omega - mu) ** 2 / (omega * (1.0 - omega))
    sigma_b = np.nan_to_num(sigma_b)
    t = int(np.argmax(sigma_b))
    return t, float(sigma_b[t] / var_t) if var_t > 0 else 0.0


def fit_circle(pts) -> tuple[float, float, float, float]:
    """Algebraic least-squares circle (Kasa). Returns cx, cy, r, rms radial residual."""
    p = _pts(pts)
    m = p.mean(axis=0)
    q = p - m
    A = np.c_[2.0 * q, np.ones(len(q))]
    b = (q ** 2).sum(axis=1)
    (a, bb, c), *_ = np.linalg.lstsq(A, b, rcond=None)
    r = math.sqrt(max(c + a * a + bb * bb, 0.0))
    resid = np.hypot(q[:, 0] - a, q[:, 1] - bb) - r
    return float(m[0] + a), float(m[1] + bb), r, float(np.sqrt(np.mean(resid ** 2)))


def _ring_samples(ring, step: float) -> np.ndarray:
    ring = LinearRing(ring) if not isinstance(ring, LinearRing) else ring
    n = int(np.clip(ring.length / max(step, 1e-6), 32, 20000))
    d = np.linspace(0.0, ring.length, n, endpoint=False)
    return shapely.get_coordinates(shapely.line_interpolate_point(ring, d))


def _polygons(geom) -> list[Polygon]:
    """All polygonal parts of any geometry (make_valid may return collections)."""
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    if hasattr(geom, "geoms"):
        return [p for g in geom.geoms for p in _polygons(g)]
    return []


def _as_area(geom):
    parts = _polygons(geom)
    if not parts:
        return Polygon()
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------
@dataclass
class BedCalibration:
    bed_w_mm: float
    bed_h_mm: float
    H: np.ndarray                      # 3x3: *undistorted* image px -> bed mm
    image_size: tuple[int, int]        # (width, height) of camera frames
    camera_matrix: np.ndarray | None = None
    dist_coeffs: np.ndarray | None = None
    rms_mm: float | None = None        # residual at the reference points; None = exactly 4 points
    n_points: int = 4
    source: str = "manual"
    warnings: list[str] = field(default_factory=list)

    @property
    def has_lens_model(self) -> bool:
        return self.camera_matrix is not None and self.dist_coeffs is not None

    def image_to_bed(self, pts_px) -> np.ndarray:
        p = _pts(pts_px)
        if self.has_lens_model:
            p = undistort_pixels(p, self.camera_matrix, self.dist_coeffs)
        return apply_homography(self.H, p)

    def bed_to_image(self, pts_mm) -> np.ndarray:
        p = apply_homography(np.linalg.inv(self.H), pts_mm)
        if self.has_lens_model:
            p = distort_pixels(p, self.camera_matrix, self.dist_coeffs)
        return p

    def bed_corners_mm(self) -> np.ndarray:
        w, h = self.bed_w_mm, self.bed_h_mm
        return np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float64)

    def native_mm_per_px(self) -> float:
        """Average size of one camera pixel on the bed plane."""
        px = apply_homography(np.linalg.inv(self.H), self.bed_corners_mm())
        return math.sqrt(self.bed_w_mm * self.bed_h_mm / _shoelace(px))

    def to_dict(self) -> dict[str, Any]:
        return {
            "bed_w_mm": self.bed_w_mm, "bed_h_mm": self.bed_h_mm,
            "homography_img_to_mm": np.asarray(self.H).tolist(),
            "image_size": list(self.image_size),
            "camera_matrix": None if self.camera_matrix is None else np.asarray(self.camera_matrix).tolist(),
            "dist_coeffs": None if self.dist_coeffs is None else np.asarray(self.dist_coeffs).ravel().tolist(),
            "rms_mm": self.rms_mm, "n_points": self.n_points, "source": self.source,
            "bed_corners_px": self.bed_to_image(self.bed_corners_mm()).round(2).tolist(),
            "native_mm_per_px": round(self.native_mm_per_px(), 4),
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "BedCalibration":
        return cls(
            bed_w_mm=float(d["bed_w_mm"]), bed_h_mm=float(d["bed_h_mm"]),
            H=np.array(d["homography_img_to_mm"], dtype=np.float64),
            image_size=tuple(d["image_size"]),
            camera_matrix=None if d.get("camera_matrix") is None else np.array(d["camera_matrix"], dtype=np.float64),
            dist_coeffs=None if d.get("dist_coeffs") is None else np.array(d["dist_coeffs"], dtype=np.float64),
            rms_mm=d.get("rms_mm"), n_points=int(d.get("n_points", 4)), source=d.get("source", "file"),
        )

    def save(self, path: str) -> None:
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, path: str) -> "BedCalibration":
        with open(path) as f:
            return cls.from_dict(json.load(f))


def order_corners_clockwise(pts, keep_first: bool = True) -> tuple[np.ndarray, bool]:
    """Put 4 clicked corners in clockwise image order (TL, TR, BR, BL for an upright view).

    A crossed or mirrored click order would produce a twisted or mirrored homography - and a
    mirrored cutting file. If keep_first, the first click stays first (it defines the origin).
    Returns (ordered, changed)."""
    p = _pts(pts)
    if len(p) != 4:
        raise VisionError("Exactly 4 bed corners are required.")
    c = p.mean(axis=0)
    ang = np.arctan2(p[:, 1] - c[1], p[:, 0] - c[0])   # image y is down -> ascending angle = clockwise
    order = list(np.argsort(ang))
    start = order.index(0) if keep_first else order.index(int(np.argmin(p.sum(axis=1))))
    order = order[start:] + order[:start]
    q = p[order]
    if not cv2.isContourConvex(q.astype(np.float32).reshape(-1, 1, 2)):
        raise VisionError("The 4 bed corners do not form a convex shape - re-click the corners.")
    return q, order != [0, 1, 2, 3]


def refine_corners(gray: np.ndarray, pts, window_px: int = 5, max_shift_px: float = 2.0):
    """Sub-pixel snap with a safety limit. cornerSubPix is designed for chessboard saddle points;
    on an L-shaped bed corner next to slats it can slide along an edge, so any point that moves
    more than max_shift_px keeps the operator's click. Returns (points, shifts_px, accepted)."""
    p = _pts(pts).astype(np.float32).reshape(-1, 1, 2)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.01)
    refined = cv2.cornerSubPix(gray, p.copy(), (window_px, window_px), (-1, -1), crit).reshape(-1, 2)
    orig = p.reshape(-1, 2)
    shift = np.hypot(*(refined - orig).T)
    ok = shift <= max_shift_px
    out = np.where(ok[:, None], refined, orig).astype(np.float64)
    return out, shift, ok


def calibrate_bed(image_pts, bed_w_mm: float, bed_h_mm: float, image_size: tuple[int, int],
                  bed_pts_mm=None, camera_matrix=None, dist_coeffs=None,
                  source: str = "manual") -> BedCalibration:
    """Homography from N >= 4 correspondences (image px -> bed mm).

    With exactly 4 points the homography fits them perfectly, so its error is *unknown*.
    With more points (e.g. mid-edge marks or ArUco corners) the residual is a real accuracy check."""
    img = _pts(image_pts)
    warnings: list[str] = []
    if bed_pts_mm is None:
        img, changed = order_corners_clockwise(img)
        if changed:
            warnings.append("Corner click order was corrected to clockwise (TL, TR, BR, BL).")
        mm = np.array([[0, 0], [bed_w_mm, 0], [bed_w_mm, bed_h_mm], [0, bed_h_mm]], dtype=np.float64)
    else:
        mm = _pts(bed_pts_mm)
    if len(img) != len(mm) or len(img) < 4:
        raise VisionError("Calibration needs at least 4 matching image/bed points.")
    und = undistort_pixels(img, camera_matrix, dist_coeffs) if camera_matrix is not None else img
    if len(img) == 4:
        H = cv2.getPerspectiveTransform(und.astype(np.float32), mm.astype(np.float32)).astype(np.float64)
        rms = None
        warnings.append("Only 4 reference points: calibration error cannot be measured. "
                        "Add fiducials (ArUco markers or marked points) for a verified calibration.")
    else:
        H, _ = cv2.findHomography(und, mm, 0)
        if H is None:
            raise VisionError("Calibration points are degenerate (collinear or duplicated).")
        rms = float(np.sqrt(np.mean(np.sum((apply_homography(H, und) - mm) ** 2, axis=1))))
    back = apply_homography(np.linalg.inv(H), [[0, 0], [bed_w_mm, 0], [bed_w_mm, bed_h_mm], [0, bed_h_mm]])
    if not cv2.isContourConvex(back.astype(np.float32).reshape(-1, 1, 2)):
        raise VisionError("Calibration is folded or mirrored - check the reference points.")
    if rms is not None and rms > 1.5:
        warnings.append(f"Calibration residual is {rms:.2f} mm - check lens calibration or reference points.")
    return BedCalibration(bed_w_mm, bed_h_mm, H, tuple(image_size),
                          None if camera_matrix is None else np.asarray(camera_matrix, dtype=np.float64),
                          None if dist_coeffs is None else np.asarray(dist_coeffs, dtype=np.float64),
                          rms, len(img), source, warnings)


def aruco_layout(centers_mm: dict[int, tuple[float, float]], size_mm: float) -> dict[int, np.ndarray]:
    """Bed-mm corners (TL, TR, BR, BL - ArUco order) of square markers mounted axis-aligned."""
    h = size_mm / 2.0
    return {i: np.array([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]])
            for i, (x, y) in centers_mm.items()}


def calibrate_from_aruco(image: np.ndarray, layout_mm: dict[int, np.ndarray], bed_w_mm: float,
                         bed_h_mm: float, dictionary: int = cv2.aruco.DICT_4X4_50,
                         camera_matrix=None, dist_coeffs=None) -> BedCalibration:
    """Automatic, self-checking bed calibration from ArUco markers fixed to the machine frame.
    Re-run it on every scan and a bumped camera is detected instead of silently mis-measuring."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    det = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(dictionary),
                                  cv2.aruco.DetectorParameters())
    corners, ids, _ = det.detectMarkers(gray)
    img_pts, mm_pts = [], []
    if ids is not None:
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.01)
        for c, i in zip(corners, ids.ravel()):
            if int(i) in layout_mm:
                c = cv2.cornerSubPix(gray, c.reshape(-1, 1, 2).astype(np.float32), (5, 5), (-1, -1), crit)
                img_pts.append(c.reshape(4, 2))
                mm_pts.append(layout_mm[int(i)])
    if len(img_pts) < 2:
        raise VisionError(f"Only {len(img_pts)} calibration marker(s) visible - at least 2 are required.")
    cal = calibrate_bed(np.vstack(img_pts), bed_w_mm, bed_h_mm, gray.shape[::-1], np.vstack(mm_pts),
                        camera_matrix, dist_coeffs, source=f"aruco x{len(img_pts)}")
    return cal


def calibrate_lens_chessboard(images: Sequence[np.ndarray], pattern_size=(9, 6), square_mm: float = 25.0):
    """Standard OpenCV intrinsic calibration from >= 8 chessboard photos (varied tilt/position).
    Returns camera_matrix, dist_coeffs, rms_px. Run once per camera + lens + focus setting."""
    objp = np.zeros((pattern_size[0] * pattern_size[1], 3), np.float32)
    objp[:, :2] = np.mgrid[0:pattern_size[0], 0:pattern_size[1]].T.reshape(-1, 2) * square_mm
    obj_pts, img_pts, size = [], [], None
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.001)
    for im in images:
        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) if im.ndim == 3 else im
        size = gray.shape[::-1]
        ok, c = cv2.findChessboardCorners(gray, pattern_size, None)
        if ok:
            obj_pts.append(objp)
            img_pts.append(cv2.cornerSubPix(gray, c, (11, 11), (-1, -1), crit))
    if len(obj_pts) < 5:
        raise VisionError(f"Chessboard found in only {len(obj_pts)} photo(s); need at least 5 (8+ recommended).")
    rms, K, D, _, _ = cv2.calibrateCamera(obj_pts, img_pts, size, None, None)
    return K, D.ravel(), float(rms)


# ---------------------------------------------------------------------------
# Orthographic rectification
# ---------------------------------------------------------------------------
class Rectifier:
    """Resamples camera frames into a metric top-down bed image.

    One interpolation from the raw frame (undistortion + homography folded into a single cached
    map), so live video costs one cv2.remap per frame. Default resolution = the camera's own
    resolution on the bed, so no detail is thrown away and no fake detail is invented."""

    def __init__(self, calib: BedCalibration, mm_per_px: float | None = None):
        s = mm_per_px or float(np.clip(round(calib.native_mm_per_px() / 0.05) * 0.05, 0.25, 4.0))
        self.calib = calib
        self.s = float(s)
        self.w = int(math.ceil(calib.bed_w_mm / self.s - 1e-9))
        self.h = int(math.ceil(calib.bed_h_mm / self.s - 1e-9))
        A = np.array([[1 / self.s, 0, -0.5], [0, 1 / self.s, -0.5], [0, 0, 1]], dtype=np.float64)
        self.M = A @ calib.H                       # undistorted image px -> ortho px
        self._maps = None
        if calib.has_lens_model:
            u, v = np.meshgrid(np.arange(self.w), np.arange(self.h))
            mm = np.c_[(u.ravel() + 0.5) * self.s, (v.ravel() + 0.5) * self.s]
            src = calib.bed_to_image(mm).astype(np.float32)
            self._maps = cv2.convertMaps(src[:, 0].reshape(self.h, self.w), src[:, 1].reshape(self.h, self.w),
                                         cv2.CV_16SC2)
        W, H = calib.image_size
        self.valid = self.warp(np.full((H, W), 255, np.uint8), cv2.INTER_NEAREST) > 0

    def warp(self, image: np.ndarray, interpolation: int = cv2.INTER_LINEAR) -> np.ndarray:
        if image is None or image.size == 0:
            raise VisionError("No camera image.")
        if (image.shape[1], image.shape[0]) != tuple(self.calib.image_size):
            raise VisionError(f"Image is {image.shape[1]}x{image.shape[0]} px but the calibration was made "
                              f"for {self.calib.image_size[0]}x{self.calib.image_size[1]} px.")
        if self._maps is not None:
            return cv2.remap(image, self._maps[0], self._maps[1], interpolation, borderMode=cv2.BORDER_CONSTANT)
        return cv2.warpPerspective(image, self.M, (self.w, self.h), flags=interpolation,
                                   borderMode=cv2.BORDER_CONSTANT)

    def px_to_mm(self, pts) -> np.ndarray:
        return (_pts(pts) + 0.5) * self.s

    def mm_to_px(self, pts) -> np.ndarray:
        return _pts(pts) / self.s - 0.5

    @property
    def bed_box(self) -> Polygon:
        return box(0.0, 0.0, self.calib.bed_w_mm, self.calib.bed_h_mm)


# ---------------------------------------------------------------------------
# Segmentation: which ortho pixels are material?
# ---------------------------------------------------------------------------
def segment_material(ortho: np.ndarray, rect: Rectifier, cfg: VisionConfig,
                     reference_ortho: np.ndarray | None = None):
    """Returns (mask, feature, info). `feature` is oriented so material is HIGH; it is what the
    sub-pixel edge refinement later measures the 50 % crossing on."""
    mode = cfg.segmentation
    if mode == "auto":
        mode = "reference" if reference_ortho is not None else "intensity"
    blur = cv2.GaussianBlur(ortho, (0, 0), 0.5)
    if mode == "reference":
        if reference_ortho is None:
            raise VisionError("Reference segmentation needs an empty-bed image.")
        a = cv2.cvtColor(blur, cv2.COLOR_BGR2LAB).astype(np.float32)
        b = cv2.cvtColor(cv2.GaussianBlur(reference_ortho, (0, 0), 0.5), cv2.COLOR_BGR2LAB).astype(np.float32)
        feat = np.clip(np.linalg.norm(a - b, axis=2) * 2.0, 0, 255).astype(np.uint8)   # 2 units per dE
        t, eta = _otsu(feat[rect.valid])
        t = max(t, int(cfg.reference_min_delta * 2.0))
        mask = feat > t
        polarity = "changed"
    elif mode == "intensity":
        if cfg.polarity not in ("bright", "dark"):
            raise VisionError("polarity must be 'bright' or 'dark'.")
        feat = cv2.cvtColor(blur, cv2.COLOR_BGR2LAB)[:, :, 0]
        if cfg.polarity == "dark":
            feat = 255 - feat
        t, eta = _otsu(feat[rect.valid])
        mask = feat > t
        polarity = cfg.polarity
    else:
        raise VisionError(f"Unknown segmentation mode '{mode}'.")
    mask = (mask & rect.valid).astype(np.uint8) * 255
    k = max(3, int(round(cfg.min_feature_mm / rect.s)) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    # OPEN drops thin bright things (slat tops, glints); CLOSE heals thin dark things (scratches).
    # Reference mode closes first: wherever the empty-bed image ramps through the sheet's own
    # value (slat edges) the difference is ~0, leaving 1 px "unchanged" cracks inside the sheet.
    ops = (cv2.MORPH_CLOSE, cv2.MORPH_OPEN) if mode == "reference" else (cv2.MORPH_OPEN, cv2.MORPH_CLOSE)
    for op in ops:
        mask = cv2.morphologyEx(mask, op, kernel)
    return mask, feat, {"mode": mode, "polarity": polarity, "threshold": int(t), "separability": round(eta, 3),
                        "kernel_px": k}


def refine_ring(coords_mm, feat_f32: np.ndarray, rect: Rectifier, reach_px: float = 4.0,
                max_shift_px: float = 1.5, min_contrast: float = 20.0):
    """Sub-pixel edge refinement. At every ~1 px along the ring, sample the feature profile along
    the normal and move the point to where it crosses the midpoint between the LOCAL material
    level and the LOCAL bed level. A global threshold puts the edge in the wrong place wherever
    lighting falls off, glare brightens the sheet, or a bright slat sits next to the edge.

    The ring must be oriented so its left normal points into material (see shapely `orient`).
    Returns (refined coords in mm, per-sample 'clear step' flags, per-sample shifts in px)."""
    ring = LinearRing(coords_mm)
    p = _ring_samples(ring, rect.s)
    k = 2
    t = np.roll(p, -k, axis=0) - np.roll(p, k, axis=0)
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    n_in = np.c_[-t[:, 1], t[:, 0]]
    offs = np.arange(-reach_px, reach_px + 1e-9, 0.5)
    pp = rect.mm_to_px(p)
    sx = (pp[:, 0:1] + n_in[:, 0:1] * offs[None, :]).astype(np.float32)
    sy = (pp[:, 1:2] + n_in[:, 1:2] * offs[None, :]).astype(np.float32)
    prof = cv2.remap(feat_f32, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    inside = np.median(prof[:, offs >= 2.5], axis=1)
    outside = np.median(prof[:, offs <= -2.5], axis=1)
    mid = 0.5 * (inside + outside)
    d = prof - mid[:, None]
    up = (d[:, :-1] < 0) & (d[:, 1:] >= 0)
    near = np.abs(offs[:-1] + 0.25) <= max_shift_px
    cand = up & near[None, :]
    dist_to_0 = np.where(cand, np.abs(offs[:-1] + 0.25)[None, :], np.inf)
    j = np.argmin(dist_to_0, axis=1)
    has = np.isfinite(dist_to_0[np.arange(len(j)), j])
    d0, d1 = d[np.arange(len(j)), j], d[np.arange(len(j)), j + 1]
    frac = np.where(d1 != d0, -d0 / np.where(d1 != d0, d1 - d0, 1.0), 0.5)
    delta = offs[j] + 0.5 * frac
    margin = reach_px + 1.0
    inside_img = ((pp[:, 0] > margin) & (pp[:, 0] < rect.w - 1 - margin) &
                  (pp[:, 1] > margin) & (pp[:, 1] < rect.h - 1 - margin))
    ok = has & ((inside - outside) >= min_contrast) & inside_img
    delta = np.where(ok, np.clip(delta, -max_shift_px, max_shift_px), 0.0)
    new = rect.px_to_mm(pp + delta[:, None] * n_in)
    return new, ok, delta, inside_img


# ---------------------------------------------------------------------------
# Mask -> geometry (the heart of the measurement)
# ---------------------------------------------------------------------------
def mask_to_geometry(mask: np.ndarray, feat: np.ndarray, rect: Rectifier, cfg: VisionConfig):
    """Largest material blob as (outline, [holes]) in mm, the size ratio of the runner-up blob,
    and edge statistics.

    RETR_CCOMP gives a two-level hierarchy: outer borders and the holes inside them, from ONE
    segmentation. So cut-outs near the sheet edge are still found, and a cut-out that breaks the
    edge simply becomes part of the outline - no erosion margin that hides holes near the edge.

    Border following runs through the centres of the boundary pixels, i.e. half a pixel inside
    the true edge. A +0.5 px mitre buffer of the sheet AND of each void removes that bias; then
    every ring is refined to the sub-pixel 50 % crossing of the local intensity step."""
    contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise VisionError("Sheet boundary could not be detected. Improve lighting or reposition the sheet.")
    hier = hier[0]
    outers = [i for i in range(len(contours)) if hier[i][3] < 0]
    areas = np.array([cv2.contourArea(contours[i]) for i in outers]) * rect.s ** 2
    order = np.argsort(areas)[::-1]
    best = outers[int(order[0])]
    if areas[order[0]] < cfg.min_sheet_area_mm2:
        raise VisionError("Sheet boundary could not be detected (largest region is only "
                          f"{areas[order[0]] / 1e6:.3f} m2). Improve lighting or reposition the sheet.")
    runner_up = float(areas[order[1]] / areas[order[0]]) if len(order) > 1 else 0.0

    # Holes are traced as OUTER contours of the voids inside the sheet: the hole border that
    # findContours gives for the material follows material pixels 8-connected and chamfers every
    # hole corner. Traced on the void's own pixels, both sides get the same +0.5 px treatment.
    half = 0.5 * rect.s
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, contours, best, 255, thickness=cv2.FILLED)
    voids = cv2.bitwise_and(filled, cv2.bitwise_not(mask))
    void_cs, _ = cv2.findContours(voids, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

    def px_poly(c):
        c = c.reshape(-1, 2)
        if len(c) < 3:                                   # 1-2 px speck: use its pixel box
            x, y, w, h = cv2.boundingRect(c.reshape(-1, 1, 2))
            c = np.array([[x, y], [x + w - 1, y], [x + w - 1, y + h - 1], [x, y + h - 1]], float)
        return make_valid(Polygon(rect.px_to_mm(c))).buffer(half, join_style="mitre", mitre_limit=2.0)

    shell = px_poly(contours[best])
    geom = shell.difference(unary_union([px_poly(c) for c in void_cs])) if void_cs else shell

    feat_f32 = feat.astype(np.float32)
    parts, oks, shifts = [], [], []
    for p in _polygons(geom):
        p = orient(p, 1.0)       # exterior CCW, holes CW: left normal -> material
        ext, ok, dl, inner = refine_ring(p.exterior.coords, feat_f32, rect)
        oks.append(ok[inner]); shifts.append(dl[ok])
        holes = []
        for r in p.interiors:
            h, ok, dl, inner = refine_ring(r.coords, feat_f32, rect)
            oks.append(ok[inner]); shifts.append(dl[ok])
            holes.append(h)
        parts.extend(_polygons(make_valid(Polygon(ext, holes))))
    # Geometric opening (square element, keeps corners): removes spikes narrower than the minimum
    # feature - e.g. where a bright slat top meets the sheet edge. Such spikes claim material that
    # does not exist, which is the unsafe direction for nesting.
    r_open = 0.5 * cfg.min_feature_mm
    geom = unary_union(parts).intersection(rect.bed_box)
    geom = geom.buffer(-r_open, join_style="mitre", mitre_limit=5.0).buffer(r_open, join_style="mitre", mitre_limit=5.0)
    geom = _as_area(make_valid(geom.intersection(rect.bed_box)).simplify(cfg.simplify_mm, preserve_topology=True))
    polys = _polygons(geom)
    if not polys:
        raise VisionError("Sheet boundary could not be detected. Improve lighting or reposition the sheet.")
    outline = _as_area(unary_union([Polygon(p.exterior) for p in polys]))
    holes = [Polygon(r) for p in polys for r in p.interiors]
    ok_all = np.concatenate(oks) if oks else np.zeros(0, bool)
    sh = np.concatenate(shifts) if shifts else np.zeros(0)
    stats = {"edge_support": float(ok_all.mean()) if len(ok_all) else 0.0,
             "refine_shift_rms_px": float(np.sqrt(np.mean(sh ** 2))) if len(sh) else 0.0,
             "boundary_samples": int(len(ok_all))}
    return outline, holes, runner_up, stats


def _robust_rect_dims(outline, step: float) -> dict[str, Any]:
    """Length/width of the sheet from the minimum rotated rectangle's orientation, but with each
    side placed at the MEDIAN of the boundary points near it. Plain minAreaRect sits on the
    outermost pixel staircase and over-reports rotated sheets by up to a pixel per side."""
    hull = outline.convex_hull
    mrr = hull.minimum_rotated_rectangle
    c = np.asarray(mrr.exterior.coords)[:4]
    e1, e2 = c[1] - c[0], c[2] - c[1]
    long_edge = e1 if np.hypot(*e1) >= np.hypot(*e2) else e2
    theta = math.atan2(long_edge[1], long_edge[0])
    if theta > math.pi / 2:
        theta -= math.pi
    elif theta <= -math.pi / 2:
        theta += math.pi
    rot = np.array([[math.cos(theta), math.sin(theta)], [-math.sin(theta), math.cos(theta)]])
    pts = np.vstack([_ring_samples(p.exterior, step) for p in _polygons(outline)])
    q = (pts - pts.mean(axis=0)) @ rot.T
    ends = []
    for axis in (0, 1):
        lo, hi = q[:, axis].min(), q[:, axis].max()
        band = max(3.0 * step, 0.03 * (hi - lo))
        ends.append((np.median(q[q[:, axis] <= lo + band, axis]), np.median(q[q[:, axis] >= hi - band, axis])))
    length, width = ends[0][1] - ends[0][0], ends[1][1] - ends[1][0]
    minx, miny, maxx, maxy = outline.bounds
    return {"length_mm": float(length), "width_mm": float(width), "angle_deg": float(math.degrees(theta)),
            "bbox_mm": [float(minx), float(miny), float(maxx), float(maxy)],
            "rectangularity": float(outline.area / mrr.area) if mrr.area > 0 else 0.0}


def classify_cutout(poly: Polygon, cfg: VisionConfig) -> dict[str, Any]:
    """circle / rectangle / irregular, from geometry alone (no Hough accumulator to tune)."""
    area = poly.area
    pts = _ring_samples(poly.exterior, 0.5)
    cx, cy, r, rms = fit_circle(pts)
    info: dict[str, Any] = {"area_mm2": float(area), "perimeter_mm": float(poly.length),
                            "centroid_mm": [float(poly.centroid.x), float(poly.centroid.y)]}
    tol = max(cfg.circle_rms_mm, cfg.circle_rms_frac * r)
    if r > 0 and rms <= tol and abs(area / (math.pi * r * r) - 1.0) < 0.04:
        info.update(type="circle", center_mm=[cx, cy], radius_mm=r, diameter_mm=2 * r, fit_rms_mm=rms)
        return info
    mrr = poly.minimum_rotated_rectangle
    if mrr.area > 0 and area / mrr.area >= cfg.rect_fill:
        d = _robust_rect_dims(poly, 0.25)
        info.update(type="rectangle", length_mm=d["length_mm"], width_mm=d["width_mm"], angle_deg=d["angle_deg"])
        return info
    minx, miny, maxx, maxy = poly.bounds
    info.update(type="irregular", bbox_mm=[float(minx), float(miny), float(maxx), float(maxy)])
    return info


def _edge_notches(outline, cfg: VisionConfig) -> list[Polygon]:
    """Material missing from the sheet's bounding rectangle (edge notches, L-shaped remnants).
    Report-only: the outline already carries the exact geometry."""
    r = cfg.min_feature_mm / 2.0
    missing = outline.convex_hull.minimum_rotated_rectangle.difference(outline)
    missing = missing.buffer(-r, join_style="mitre").buffer(r, join_style="mitre")
    return [p for p in _polygons(missing) if p.area >= cfg.edge_notch_min_area_mm2]


def _touching_sides(outline, rect: Rectifier) -> list[str]:
    """Bed sides the sheet outline runs along (>= 30 mm). There the true sheet edge may lie
    beyond the calibrated bed, so the measured edge is only the bed limit."""
    pts = np.vstack([_ring_samples(p.exterior, rect.s) for p in _polygons(outline)])
    W, H = rect.calib.bed_w_mm, rect.calib.bed_h_mm
    near = 1.5 * rect.s
    sides = {"top": pts[:, 1] < near, "bottom": pts[:, 1] > H - near,
             "left": pts[:, 0] < near, "right": pts[:, 0] > W - near}
    return [k for k, m in sides.items() if m.sum() * rect.s > 30.0]


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
@dataclass
class ScanResult:
    bed_w_mm: float
    bed_h_mm: float
    mm_per_px: float
    outline: Any                   # Polygon | MultiPolygon: outer boundary of the physical sheet
    material: Any                  # Polygon | MultiPolygon: sheet minus every existing cut-out
    cutouts: list[dict[str, Any]]
    edge_notches: list[dict[str, Any]]
    dims: dict[str, Any]
    confidence: float
    quality: dict[str, Any]
    warnings: list[str]
    segmentation: dict[str, Any]
    ortho: np.ndarray | None = None
    mask: np.ndarray | None = None
    corrected_by_operator: bool = False

    @property
    def sheet_area_mm2(self) -> float:
        return float(self.outline.area)

    @property
    def available_area_mm2(self) -> float:
        return float(self.material.area)

    @property
    def removed_area_mm2(self) -> float:
        return float(self.outline.area - self.material.area)

    @property
    def needs_confirmation(self) -> bool:
        return self.confidence < self.quality.get("confirm_below", 0.85) or bool(self.warnings)

    def to_dict(self, include_geometry: bool = True) -> dict[str, Any]:
        def ring(g):
            return np.round(np.asarray(g.exterior.coords), 2).tolist()

        def clean(d):
            out = {k: (round(v, 2) if isinstance(v, float) else
                       [round(x, 2) for x in v] if isinstance(v, list) and v and isinstance(v[0], float) else v)
                   for k, v in d.items() if k != "geometry"}
            if include_geometry:
                out["polygon_mm"] = ring(d["geometry"])
            return out

        sheet = {"length_mm": round(self.dims["length_mm"], 1), "width_mm": round(self.dims["width_mm"], 1),
                 "angle_deg": round(self.dims["angle_deg"], 2), "area_mm2": round(self.sheet_area_mm2, 0),
                 "bbox_mm": [round(v, 1) for v in self.dims["bbox_mm"]],
                 "rectangularity": round(self.dims["rectangularity"], 4)}
        if include_geometry:
            sheet["polygon_mm"] = [ring(p) for p in _polygons(self.outline)]
        return {
            "bed": {"width_mm": self.bed_w_mm, "height_mm": self.bed_h_mm},
            "sheet": sheet,
            "cutouts": [clean(c) for c in self.cutouts],
            "edge_notches": [clean(n) for n in self.edge_notches],
            "material": {"sheet_area_mm2": round(self.sheet_area_mm2, 0),
                         "removed_area_mm2": round(self.removed_area_mm2, 0),
                         "available_area_mm2": round(self.available_area_mm2, 0),
                         "available_percent": round(100 * self.available_area_mm2 / self.sheet_area_mm2, 2),
                         **({"geometry_wkt": self.material.wkt} if include_geometry else {})},
            "scale_mm_per_px": self.mm_per_px,
            "confidence": round(self.confidence, 3),
            "needs_confirmation": self.needs_confirmation,
            "quality": self.quality,
            "segmentation": self.segmentation,
            "warnings": self.warnings,
            "corrected_by_operator": self.corrected_by_operator,
        }


def build_result(outline, holes: list[Polygon], bed_w_mm: float, bed_h_mm: float, mm_per_px: float,
                 cfg: VisionConfig, **extra) -> ScanResult:
    """Single source of truth for every derived number. material = sheet - union(cut-outs):
    geometry, not arithmetic, so overlapping or edge-breaking cut-outs are handled exactly."""
    bed = box(0.0, 0.0, bed_w_mm, bed_h_mm)
    outline = _as_area(make_valid(outline).intersection(bed))
    holes = [h for h in (_as_area(make_valid(h)) for h in holes) if not h.is_empty]
    material = _as_area(outline.difference(unary_union(holes))) if holes else outline
    inner_holes = [Polygon(r) for p in _polygons(material) for r in p.interiors]
    outline = _as_area(unary_union([Polygon(p.exterior) for p in _polygons(material)]))
    cutouts = []
    for i, h in enumerate(sorted(inner_holes, key=lambda g: (round(g.centroid.y, -1), g.centroid.x))):
        c = classify_cutout(h, cfg)
        c.update(id=f"cutout_{i + 1:03d}", geometry=h)
        cutouts.append(c)
    notches = [{"id": f"edge_{i + 1:03d}", "area_mm2": float(n.area),
                "centroid_mm": [float(n.centroid.x), float(n.centroid.y)], "geometry": n}
               for i, n in enumerate(_edge_notches(outline, cfg))]
    dims = _robust_rect_dims(outline, 0.5 * mm_per_px)
    return ScanResult(bed_w_mm, bed_h_mm, mm_per_px, outline, material, cutouts, notches, dims,
                      extra.pop("confidence", 1.0), extra.pop("quality", {}), extra.pop("warnings", []),
                      extra.pop("segmentation", {}), **extra)


def scan_sheet(image: np.ndarray, calib: BedCalibration, cfg: VisionConfig | None = None,
               reference_image: np.ndarray | None = None, rectifier: Rectifier | None = None) -> ScanResult:
    """Camera frame -> measured material map (all geometry in bed mm)."""
    cfg = cfg or VisionConfig()
    rect = rectifier or Rectifier(calib, cfg.mm_per_px)
    ortho = rect.warp(image)
    ref = rect.warp(reference_image) if reference_image is not None else None
    mask, feat, seg = segment_material(ortho, rect, cfg, ref)
    outline, holes, runner_up, edge = mask_to_geometry(mask, feat, rect, cfg)

    warnings = []
    if calib.rms_mm is not None and calib.rms_mm > 1.5:
        warnings.append(f"Calibration residual is {calib.rms_mm:.2f} mm - recalibrate before cutting.")
    biggest_hole = max((h.area for h in holes), default=0.0)
    if biggest_hole > cfg.max_hole_fraction * outline.area:
        raise VisionError("The detected region looks like the bed around a sheet, not a sheet. "
                          "Check the material polarity setting or capture an empty-bed reference.")
    support, touching = edge["edge_support"], _touching_sides(outline, rect)
    sep = seg["separability"]
    ambiguous = runner_up > cfg.ambiguity_ratio
    conf = support * min(1.0, sep / 0.75) * (0.5 if ambiguous else 1.0)
    if ambiguous:
        warnings.append(f"Multiple possible sheets: a second region is {runner_up:.0%} of the largest. "
                        "Only the largest is used.")
    if touching:
        warnings.append(f"Sheet touches the calibrated bed edge ({', '.join(touching)}): the real sheet edge "
                        "there may lie outside the camera's calibrated area. Confirm those edges.")
    if not rect.valid.all():
        lost = outline.intersection(_invalid_region(rect)).area
        if lost > 1.0:
            warnings.append("Part of the sheet is outside the camera view.")
    if sep < 0.5:
        warnings.append("Low contrast between sheet and bed. Improve lighting.")
    quality = {"edge_support": round(support, 3), "refine_shift_rms_px": round(edge["refine_shift_rms_px"], 3),
               "separability": sep, "runner_up_ratio": round(runner_up, 3),
               "calibration_rms_mm": calib.rms_mm, "calibration_points": calib.n_points,
               "confirm_below": cfg.confirm_below,
               "note": "Heuristic quality score, not a probability. Validate on real machine images."}
    return build_result(outline, holes, calib.bed_w_mm, calib.bed_h_mm, rect.s, cfg,
                        confidence=conf, quality=quality, warnings=warnings, segmentation=seg,
                        ortho=ortho, mask=mask)


def _invalid_region(rect: Rectifier):
    m = (~rect.valid).astype(np.uint8) * 255
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return unary_union([Polygon(rect.px_to_mm(c.reshape(-1, 2))).buffer(rect.s) for c in cs if len(c) >= 3])


def apply_corrections(result: ScanResult, cfg: VisionConfig | None = None, remove_ids: Sequence[str] = (),
                      add_cutouts_mm: Sequence[Any] = (), sheet_polygon_mm=None) -> ScanResult:
    """Operator 'Confirm / Adjust': drop false cut-outs, add missed ones, replace the sheet outline.
    Added cut-outs may be polygons (list of [x, y]) or circles ({'center': [x, y], 'radius': r})."""
    cfg = cfg or VisionConfig()
    holes = [c["geometry"] for c in result.cutouts if c["id"] not in set(remove_ids)]
    for a in add_cutouts_mm:
        holes.append(Point(a["center"]).buffer(a["radius"], quad_segs=64) if isinstance(a, dict)
                     else Polygon(_pts(a)))
    outline = Polygon(_pts(sheet_polygon_mm)) if sheet_polygon_mm is not None else result.outline
    return build_result(outline, holes, result.bed_w_mm, result.bed_h_mm, result.mm_per_px, cfg,
                        confidence=result.confidence, quality=result.quality,
                        warnings=[w for w in result.warnings], segmentation=result.segmentation,
                        ortho=result.ortho, mask=result.mask, corrected_by_operator=True)


def usable_region(result: ScanResult, uncertainty_mm: float = 3.0, edge_margin_mm: float = 0.0):
    """The region the nesting engine may use: material shrunk by the measurement uncertainty plus
    the required part-to-edge margin. Shrinking the MATERIAL (not the parts) applies it both to
    the sheet edge and to every existing cut-out in one exact operation."""
    d = uncertainty_mm + edge_margin_mm
    return _as_area(result.material.buffer(-d, join_style="mitre", mitre_limit=5.0)) if d > 0 else result.material


def validate_scan(result: ScanResult) -> list[str]:
    """Checks that must pass before anything is exported."""
    problems = []
    bed = box(0.0, 0.0, result.bed_w_mm, result.bed_h_mm).buffer(1e-6)
    if result.material.is_empty or result.available_area_mm2 <= 0:
        problems.append("No usable material.")
    if not result.material.is_valid:
        problems.append("Material geometry is invalid.")
    if not bed.contains(result.outline):
        problems.append("Sheet outline extends beyond the machine bed.")
    for c in result.cutouts:
        if not result.outline.buffer(1e-6).contains(c["geometry"]):
            problems.append(f"{c['id']} lies outside the sheet.")
    return problems


# ---------------------------------------------------------------------------
# Visualisation
# ---------------------------------------------------------------------------
def draw_blueprint(result: ScanResult, rect: Rectifier, show_hud: bool = True) -> np.ndarray:
    vis = result.ortho.copy()
    t = max(1, int(round(min(rect.w, rect.h) / 400)))
    fs = max(0.35, min(rect.w, rect.h) / 1600)
    SH = 4                                                  # sub-pixel drawing (1/16 px)

    def ipts(coords):
        return np.round((rect.mm_to_px(coords)) * (1 << SH)).astype(np.int32).reshape(-1, 1, 2)

    def put(txt, xy, color, scale=fs, th=1):
        x, y = int(xy[0]), int(xy[1])
        cv2.putText(vis, txt, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), th + 2, cv2.LINE_AA)
        cv2.putText(vis, txt, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, th, cv2.LINE_AA)

    overlay = vis.copy()
    for p in _polygons(result.material):
        cv2.fillPoly(overlay, [ipts(p.exterior.coords)], (60, 170, 60), cv2.LINE_AA, SH)
        for r in p.interiors:
            cv2.fillPoly(overlay, [ipts(r.coords)], (40, 40, 200), cv2.LINE_AA, SH)
    cv2.addWeighted(overlay, 0.28, vis, 0.72, 0, vis)
    for n in result.edge_notches:
        cv2.polylines(vis, [ipts(n["geometry"].exterior.coords)], True, (0, 165, 255), t, cv2.LINE_AA, SH)
    for p in _polygons(result.outline):
        cv2.polylines(vis, [ipts(p.exterior.coords)], True, (0, 255, 0), t + 1, cv2.LINE_AA, SH)
    for c in result.cutouts:
        cv2.polylines(vis, [ipts(c["geometry"].exterior.coords)], True, (0, 0, 255), t, cv2.LINE_AA, SH)
        cx, cy = rect.mm_to_px([c["centroid_mm"]])[0]
        lbl = c["id"].replace("cutout_", "#")
        if c["type"] == "circle":
            lbl += f" D{c['diameter_mm']:.1f}"
        elif c["type"] == "rectangle":
            lbl += f" {c['length_mm']:.0f}x{c['width_mm']:.0f}"
        put(lbl, (cx - 30 * fs, cy - 8 * fs), (0, 230, 255), fs * 0.9)
    minx, miny, maxx, maxy = result.dims["bbox_mm"]
    put(f"{result.dims['length_mm']:.1f} x {result.dims['width_mm']:.1f} mm",
        rect.mm_to_px([[minx, miny]])[0] + [8, 22 * fs + 8], (0, 255, 255), fs * 1.3, t + 1)
    if show_hud:
        lines = ["BANSALI SMARTNEST - MEASURED MATERIAL MAP",
                 f"Sheet {result.dims['length_mm']:.1f} x {result.dims['width_mm']:.1f} mm  "
                 f"(angle {result.dims['angle_deg']:+.2f} deg)",
                 f"Sheet area      {result.sheet_area_mm2 / 1e6:.4f} m2",
                 f"Cut-outs        {len(result.cutouts)}  ({result.removed_area_mm2 / 1e6:.4f} m2 removed)",
                 f"Edge notches    {len(result.edge_notches)}",
                 f"Available       {result.available_area_mm2 / 1e6:.4f} m2",
                 f"Quality score   {result.confidence:.2f}" + ("  -> CONFIRM" if result.needs_confirmation else "")]
        lh = int(26 * fs * 1.6)
        bw, bh = int(560 * fs * 1.6), lh * len(lines) + 16
        ov = vis.copy()
        cv2.rectangle(ov, (10, 10), (10 + bw, 10 + bh), (20, 24, 30), -1)
        cv2.addWeighted(ov, 0.82, vis, 0.18, 0, vis)
        for i, line in enumerate(lines):
            put(line, (20, 10 + lh * (i + 1)), (0, 240, 255) if i == 0 else (235, 240, 245), fs * 1.05)
    return vis


# ---------------------------------------------------------------------------
# DXF export (machine millimetres, Y up) + read-back validation
# ---------------------------------------------------------------------------
def to_cad(pts, bed_h_mm: float, origin: str = "bottom-left") -> np.ndarray:
    """Bed mm (image-like, y down) -> CAD mm (right-handed, Y up).
    Exporting image-style y-down coordinates would MIRROR the whole layout on the machine."""
    p = _pts(pts)
    if origin == "bottom-left":
        return np.c_[p[:, 0], bed_h_mm - p[:, 1]]
    if origin == "top-left":
        return np.c_[p[:, 0], -p[:, 1]]
    raise ValueError("origin must be 'bottom-left' or 'top-left'")


def export_dxf(result: ScanResult, path: str, origin: str = "bottom-left", include_bed: bool = True) -> dict:
    import ezdxf

    problems = validate_scan(result)
    if problems:
        raise VisionError("Export blocked: " + "; ".join(problems))
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    doc.header["$MEASUREMENT"] = 1
    for name, color in (("BED", 8), ("SHEET_BOUNDARY", 3), ("EXISTING_CUTOUTS", 1)):
        doc.layers.add(name, color=color)
    msp = doc.modelspace()
    H = result.bed_h_mm

    def poly(coords, layer):
        msp.add_lwpolyline([tuple(p) for p in to_cad(np.asarray(coords)[:-1], H, origin)],
                           close=True, dxfattribs={"layer": layer})

    if include_bed:
        poly(box(0, 0, result.bed_w_mm, H).exterior.coords, "BED")
    for p in _polygons(result.outline):
        poly(p.exterior.coords, "SHEET_BOUNDARY")
    n_circles = 0
    for c in result.cutouts:
        if c["type"] == "circle":
            (X, Y), = to_cad([c["center_mm"]], H, origin)
            msp.add_circle((float(X), float(Y)), float(c["radius_mm"]), dxfattribs={"layer": "EXISTING_CUTOUTS"})
            n_circles += 1
        else:
            poly(c["geometry"].exterior.coords, "EXISTING_CUTOUTS")
    doc.saveas(path)
    return {"path": path, "sheet_outlines": len(_polygons(result.outline)), "cutouts": len(result.cutouts),
            "circles": n_circles, "origin": origin, "units": "mm"}


def read_dxf_material(path: str, bed_h_mm: float, origin: str = "bottom-left"):
    """Rebuild the material geometry from an exported DXF (back in bed mm)."""
    import ezdxf

    msp = ezdxf.readfile(path).modelspace()

    def back(pts):
        p = _pts(pts)
        return np.c_[p[:, 0], bed_h_mm - p[:, 1]] if origin == "bottom-left" else np.c_[p[:, 0], -p[:, 1]]

    sheets, holes = [], []
    for e in msp.query("LWPOLYLINE"):
        g = Polygon(back([(x, y) for x, y, *_ in e.get_points()]))
        (sheets if e.dxf.layer == "SHEET_BOUNDARY" else holes if e.dxf.layer == "EXISTING_CUTOUTS" else []).append(g)
    for e in msp.query("CIRCLE"):
        (c,) = back([(e.dxf.center.x, e.dxf.center.y)])
        holes.append(Point(c).buffer(e.dxf.radius, quad_segs=128))
    outline = unary_union(sheets)
    return outline.difference(unary_union(holes)) if holes else outline


def validate_dxf(path: str, result: ScanResult, origin: str = "bottom-left", tol_mm2: float | None = None) -> dict:
    """Re-read the file and compare it to the scan: the exported geometry is validated again."""
    got = read_dxf_material(path, result.bed_h_mm, origin)
    diff = got.symmetric_difference(result.material).area
    tol = tol_mm2 if tol_mm2 is not None else 1e-3 * result.available_area_mm2
    return {"ok": bool(diff <= tol), "dxf_area_mm2": got.area, "scan_area_mm2": result.available_area_mm2,
            "symmetric_difference_mm2": diff, "tolerance_mm2": tol}
