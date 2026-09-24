"""
Synthetic laser-bed scenes with exactly known geometry, for demo mode and automated tests.

Each scene is defined in bed millimetres, rendered as a flat texture at 0.5 mm/px (anti-aliased),
then photographed by a physically posed pinhole camera (tilt, pan, roll, optional barrel
distortion) with 2x supersampling, vignetting, sensor noise and JPEG compression. The ground
truth (sheet outline, every cut-out, the usable material) is kept as Shapely geometry, so
detection errors can be measured in mm and mm^2 instead of judged by eye.

It is still a simulation: real sheets add glare, dirt, burrs, dross, bent edges and thickness
parallax. Passing here is necessary, not sufficient - validate on real Bansali machine images.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable

import cv2
import numpy as np
from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from smartnest_vision import _polygons, apply_homography, aruco_layout, distort_pixels, undistort_pixels


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------
@dataclass
class Camera:
    K: np.ndarray
    dist: np.ndarray | None
    R: np.ndarray                 # world (bed mm, z into the bed) -> camera
    t: np.ndarray
    size: tuple[int, int]         # (width, height)

    @property
    def H_mm_to_img(self) -> np.ndarray:
        H = self.K @ np.c_[self.R[:, 0], self.R[:, 1], self.t]
        return H / H[2, 2]

    def project(self, pts_mm) -> np.ndarray:
        p = apply_homography(self.H_mm_to_img, pts_mm)
        return distort_pixels(p, self.K, self.dist) if self.dist is not None else p


def make_camera(bed_w: float, bed_h: float, size=(1920, 1080), f_px: float = 1400.0, fill: float = 0.86,
                tilt_deg: float = 9.0, pan_deg: float = 0.8, roll_deg: float = 0.7, dist=None) -> Camera:
    """Camera looking at the bed centre from above and slightly in front (tilt), so the far edge
    of the bed appears shorter than the near edge - a real, not hand-drawn, perspective."""
    W, H = size
    D = f_px * bed_w / (fill * W)
    T = np.array([bed_w / 2, bed_h / 2, 0.0])
    th = math.radians(tilt_deg)
    C = T + D * np.array([0.0, math.sin(th), -math.cos(th)])
    z = (T - C) / np.linalg.norm(T - C)
    x = np.array([1.0, 0.0, 0.0])
    x = x - x.dot(z) * z
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    R = np.vstack([x, y, z])
    p, r = math.radians(pan_deg), math.radians(roll_deg)
    Ry = np.array([[math.cos(p), 0, math.sin(p)], [0, 1, 0], [-math.sin(p), 0, math.cos(p)]])
    Rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    R = Rz @ Ry @ R
    K = np.array([[f_px, 0, (W - 1) / 2], [0, f_px, (H - 1) / 2], [0, 0, 1]], dtype=np.float64)
    return Camera(K, None if dist is None else np.asarray(dist, dtype=np.float64), R, -R @ C, (W, H))


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
@dataclass
class BedStyle:
    gap: tuple = (38, 40, 44)          # dark space between slats (BGR)
    slat: tuple = (112, 116, 122)      # slat tops
    slat_pitch_mm: float = 60.0
    slat_width_mm: float = 3.0
    frame: tuple = (58, 62, 68)
    rail: tuple = (96, 102, 108)


def _fill(img, polys_mm, value, mm2tex, shift=4):
    for p in polys_mm:
        pts = np.round(mm2tex(np.asarray(p.exterior.coords)) * (1 << shift)).astype(np.int32)
        cv2.fillPoly(img, [pts.reshape(-1, 1, 2)], value, cv2.LINE_AA, shift)


def coverage_alpha(material, shape_hw, mm2tex, tex_res: float, ss: int = 4, tile: int = 1024) -> np.ndarray:
    """Unbiased anti-aliased mask: 255 * (fraction of each texel covered by material).

    cv2.fillPoly is NOT unbiased: LINE_8 includes every pixel the edge touches (+0.5 px on
    average) and LINE_AA pushes edges out by 0.3-0.8 px. Ground truth rendered that way would
    make every detector look 0.3 mm wrong. Here: 4x supersampled LINE_8 fill of polygons shrunk
    by exactly half a sub-pixel, then an exact box-filter downsample (residual <= 1/8 texel)."""
    th, tw = shape_hw
    alpha = np.zeros((th, tw), np.uint8)
    e = 0.5 * tex_res / ss
    shells = [Polygon(p.exterior).buffer(-e, join_style="mitre") for p in _polygons(material)]
    holes = [Polygon(r).buffer(-e, join_style="mitre") for p in _polygons(material) for r in p.interiors]
    if not shells:
        return alpha
    minx, miny, maxx, maxy = unary_union(shells).bounds
    (j_lo, i_lo), (j_hi, i_hi) = np.floor(mm2tex([[minx, miny]])[0]) - 2, np.ceil(mm2tex([[maxx, maxy]])[0]) + 2
    j_lo, i_lo, j_hi, i_hi = int(max(j_lo, 0)), int(max(i_lo, 0)), int(min(j_hi, tw)), int(min(i_hi, th))
    SH = 4
    for i0 in range(i_lo, i_hi, tile):
        for j0 in range(j_lo, j_hi, tile):
            h, w = min(tile, i_hi - i0), min(tile, j_hi - j0)
            hi = np.zeros((h * ss, w * ss), np.uint8)

            def draw(geoms, value):
                for g in _polygons(unary_union(geoms)) if geoms else []:
                    for ring in [g.exterior]:
                        t = mm2tex(np.asarray(ring.coords)) - [j0, i0]           # texel coords in tile
                        q = ss * (t + 0.5) - 0.5                                 # sub-pixel coords
                        cv2.fillPoly(hi, [np.round(q * (1 << SH)).astype(np.int32).reshape(-1, 1, 2)],
                                     value, cv2.LINE_8, SH)
            draw(shells, 255)
            draw(holes, 0)
            alpha[i0:i0 + h, j0:j0 + w] = cv2.resize(hi, (w, h), interpolation=cv2.INTER_AREA)
    return alpha


def render(bed_w: float, bed_h: float, material, cam: Camera, *, metal=(188, 192, 196),
           style: BedStyle | None = None, glare: bool = True, markers: dict[int, np.ndarray] | None = None,
           seed: int = 0, tex_res: float = 0.5, margin: float = 260.0, noise: float = 2.5,
           jpeg_quality: int = 92) -> np.ndarray:
    style = style or BedStyle()
    rng = np.random.default_rng(seed)
    r, m = tex_res, margin
    tw, th = int(math.ceil((bed_w + 2 * m) / r)), int(math.ceil((bed_h + 2 * m) / r))

    def mm2tex(p):
        return (np.asarray(p, dtype=np.float64) + m) / r - 0.5

    tex = np.empty((th, tw, 3), np.uint8)
    tex[:] = style.frame
    _fill(tex, [box(-40, -40, bed_w + 40, bed_h + 40)], style.rail, mm2tex)
    _fill(tex, [box(0, 0, bed_w, bed_h)], style.gap, mm2tex)
    x = style.slat_pitch_mm / 2
    while x < bed_w:
        jitter = int(rng.integers(-10, 11))
        col = tuple(int(np.clip(c + jitter, 0, 255)) for c in style.slat)
        _fill(tex, [box(x - style.slat_width_mm / 2, 0, x + style.slat_width_mm / 2, bed_h)], col, mm2tex)
        x += style.slat_pitch_mm
    if markers:
        d = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        for mid, c in markers.items():
            x0, y0 = c[0]
            size = c[1][0] - c[0][0]
            _fill(tex, [box(x0 - 15, y0 - 15, x0 + size + 15, y0 + size + 15)], (245, 245, 245), mm2tex)
            n = int(round(size / r))
            img = cv2.aruco.generateImageMarker(d, int(mid), n)
            j0, i0 = int(round((x0 + m) / r)), int(round((y0 + m) / r))
            tex[i0:i0 + n, j0:j0 + n] = img[:, :, None]

    # sheet: anti-aliased alpha, brushed-metal texture, optional specular glare
    alpha = coverage_alpha(material, (th, tw), mm2tex, r)
    rows = cv2.GaussianBlur(rng.normal(0, 3.5, (th, 1)).astype(np.float32), (1, 0), sigmaX=0, sigmaY=6).ravel()
    if glare and not material.is_empty:
        c = material.representative_point()
        gx, gy = mm2tex([[c.x + 150, c.y - 80]])[0]
        sig = 240.0 / r
    band = 512
    yy_all = np.arange(th, dtype=np.float32)
    xx = np.arange(tw, dtype=np.float32)
    for i0 in range(0, th, band):
        i1 = min(th, i0 + band)
        a = alpha[i0:i1].astype(np.float32)[:, :, None] / 255.0
        met = np.empty((i1 - i0, tw, 3), np.float32)
        met[:] = np.asarray(metal, np.float32)
        met += rows[i0:i1, None, None]
        met += rng.normal(0, 1.5, (i1 - i0, tw, 1)).astype(np.float32)
        if glare and not material.is_empty:
            yy = yy_all[i0:i1, None]
            met += (55.0 * np.exp(-((xx[None, :] - gx) ** 2 + (yy - gy) ** 2) / (2 * sig * sig)))[:, :, None]
        seg = tex[i0:i1].astype(np.float32)
        tex[i0:i1] = np.clip(seg * (1 - a) + met * a, 0, 255).astype(np.uint8)
    tex = cv2.GaussianBlur(tex, (0, 0), 0.6)            # optics / pre-filter before sampling

    # photograph: 2x supersampled, one resampling from the texture
    W, H = cam.size
    T_tex2mm = np.array([[r, 0, 0.5 * r - m], [0, r, 0.5 * r - m], [0, 0, 1]])
    S2 = np.array([[2, 0, 0.5], [0, 2, 0.5], [0, 0, 1]], dtype=np.float64)
    if cam.dist is None:
        H2 = S2 @ cam.H_mm_to_img @ T_tex2mm
        big = cv2.warpPerspective(tex, H2, (2 * W, 2 * H), flags=cv2.INTER_LINEAR | cv2.WARP_FILL_OUTLIERS,
                                  borderValue=style.frame)
    else:
        # distortion is smooth: solve it on a 4 px grid, then let cv2.resize interpolate the map.
        # Grid node k sits at image x = 4k + 1.5, which is exactly where cv2.resize samples it.
        gw, gh = W // 4, H // 4
        u, v = np.meshgrid(4 * np.arange(gw) + 1.5, 4 * np.arange(gh) + 1.5)
        ideal = undistort_pixels(np.c_[u.ravel(), v.ravel()], cam.K, cam.dist)
        mm = apply_homography(np.linalg.inv(cam.H_mm_to_img), ideal)
        tp = mm2tex(mm).astype(np.float32)
        mx = cv2.resize(tp[:, 0].reshape(gh, gw), (2 * W, 2 * H), interpolation=cv2.INTER_CUBIC)
        my = cv2.resize(tp[:, 1].reshape(gh, gw), (2 * W, 2 * H), interpolation=cv2.INTER_CUBIC)
        big = cv2.remap(tex, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=style.frame)
    img = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)

    # lighting falloff, sensor noise, compression
    u, v = np.meshgrid(np.linspace(-1, 1, W, dtype=np.float32), np.linspace(-1, 1, H, dtype=np.float32))
    gain = (1.0 - 0.18 * (u * u + v * v) / 2.0) * (1.0 + 0.06 * u)
    img = img * gain[:, :, None] + rng.normal(0, noise, img.shape).astype(np.float32)
    img = np.clip(img, 0, 255).astype(np.uint8)
    if jpeg_quality:
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return img


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------
@dataclass
class Scene:
    name: str
    description: str
    bed_w: float
    bed_h: float
    camera: Camera
    image: np.ndarray
    empty_bed: np.ndarray
    corners_px: np.ndarray                    # true image position of bed corners TL, TR, BR, BL
    sheet: Polygon                            # true outer outline
    holes: list[dict[str, Any]]               # true interior cut-outs
    material: Any                             # true usable material
    notches: list[Polygon] = field(default_factory=list)
    markers_mm: dict[int, np.ndarray] = field(default_factory=dict)
    hint: dict[str, Any] = field(default_factory=dict)


def circle(cx, cy, r):
    return {"type": "circle", "center": (cx, cy), "radius": r, "geometry": Point(cx, cy).buffer(r, quad_segs=256)}


def rect(cx, cy, w, h, angle=0.0):
    g = affinity.rotate(box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), angle, origin=(cx, cy))
    return {"type": "rectangle", "center": (cx, cy), "size": (w, h), "angle": angle, "geometry": g}


def poly(pts):
    g = Polygon(pts)
    return {"type": "irregular", "center": (g.centroid.x, g.centroid.y), "geometry": g}


def _marker_layout(bed_w, bed_h, cam: Camera, size=90.0) -> dict[int, np.ndarray]:
    centers, i = {}, 0
    for x in (-110.0, bed_w + 110.0):
        for fy in (0.12, 0.5, 0.88):
            centers[i] = (x, round(fy * bed_h))
            i += 1
    for x in (0.25 * bed_w, 0.75 * bed_w):
        for y in (-110.0, bed_h + 110.0):
            centers[i] = (round(x), y)
            i += 1
    layout = aruco_layout(centers, size)
    W, H = cam.size
    ok = {}
    for k, c in layout.items():
        p = cam.project(np.vstack([c, c.mean(axis=0) + [[-60, -60], [60, -60], [60, 60], [-60, 60]]]))
        if (p[:, 0] > 5).all() and (p[:, 0] < W - 6).all() and (p[:, 1] > 5).all() and (p[:, 1] < H - 6).all():
            ok[k] = c
    return ok


def _scene(name, description, bed_w, bed_h, sheet, holes, *, notches=(), cam=None, metal=(188, 192, 196),
           style=None, seed=0, hint=None, **render_kw) -> Scene:
    cam = cam or make_camera(bed_w, bed_h)
    hole_geoms = [h["geometry"] for h in holes]
    material = sheet.difference(unary_union(hole_geoms)) if holes else sheet
    markers = _marker_layout(bed_w, bed_h, cam)
    img = render(bed_w, bed_h, material, cam, metal=metal, style=style, markers=markers, seed=seed, **render_kw)
    empty = render(bed_w, bed_h, Polygon(), cam, style=style, markers=markers, seed=seed + 1000, **render_kw)
    corners = cam.project([[0, 0], [bed_w, 0], [bed_w, bed_h], [0, bed_h]])
    return Scene(name, description, bed_w, bed_h, cam, img, empty, corners, sheet, holes, material,
                 list(notches), markers, hint or {})


def scene_fresh_sheet(seed=0):
    sheet = box(180, 140, 2580, 1340)
    return _scene("fresh_sheet", "Fresh 2400 x 1200 mm sheet on a 3000 x 1500 mm bed, not centred.",
                  3000, 1500, sheet, [], seed=seed)


def scene_four_circles(seed=0):
    sheet = box(180, 140, 2580, 1340)
    holes = [circle(780, 480, 90), circle(1980, 480, 90), circle(780, 1000, 90), circle(1980, 1000, 90)]
    return _scene("four_circles", "Sheet with 4 pre-cut circular holes (D180 mm).", 3000, 1500, sheet, holes,
                  seed=seed)


def _mixed_holes():
    return [circle(600, 450, 90), circle(1100, 420, 40),
            circle(1500, 400, 12.5),                        # D25 bolt hole: 491 mm2
            rect(1950, 875, 300, 150), rect(900, 950, 220, 120, 30.0),
            circle(235, 1100, 35),                          # only 20 mm from the sheet edge
            poly([(1400, 900), (1600, 880), (1650, 1050), (1520, 1150), (1380, 1060)])]


def scene_mixed_holes(seed=0):
    sheet = box(180, 140, 2580, 1340)
    return _scene("mixed_holes", "Circles (incl. a D25 bolt hole), rectangles (one rotated 30 deg), an "
                  "irregular cut-out, and a hole 20 mm from the sheet edge.", 3000, 1500, sheet, _mixed_holes(),
                  seed=seed)


def scene_irregular_remnant(seed=0):
    base = box(0, 0, 2200, 1100)
    corner = box(2200 - 750, 0, 2200, 450)                 # L-shaped remnant
    semi = Point(900, 1100).buffer(90, quad_segs=256)       # half-round notch in the near edge
    local = base.difference(corner).difference(semi)
    place = lambda g: affinity.translate(affinity.rotate(g, 2.5, origin=(1100, 550)), 150, 210)
    sheet = place(local)
    holes = [circle(*place(Point(400, 300)).coords[0], 60), circle(*place(Point(1700, 800)).coords[0], 60),
             poly(list(place(Polygon([(700, 500), (950, 430), (1100, 600), (980, 800), (760, 760)])).exterior.coords))]
    notches = [place(corner), place(semi.intersection(base))]
    return _scene("irregular_remnant", "L-shaped remnant rotated 2.5 deg, with an edge notch, an irregular "
                  "cut-out and two holes.", 3000, 1500, sheet, holes, notches=notches, seed=seed)


def scene_dark_steel(seed=0):
    sheet = box(300, 200, 2300, 1200)
    holes = [circle(700, 500, 70), circle(1300, 500, 70), circle(1900, 500, 70), rect(1300, 900, 250, 180)]
    style = BedStyle(gap=(38, 40, 44), slat=(150, 148, 144), slat_pitch_mm=40.0, slat_width_mm=4.0)
    return _scene("dark_steel", "Dark mild-steel sheet on a slat bed with bright slat tops: brightness "
                  "alone cannot separate sheet from bed.", 3000, 1500, sheet, holes, metal=(84, 86, 90),
                  style=style, glare=False, seed=seed, hint={"needs_reference": True})


def scene_lens_distortion(seed=0):
    sheet = box(180, 140, 2580, 1340)
    cam = make_camera(3000, 1500, dist=[-0.20, 0.05, 0.0, 0.0, 0.0])
    return _scene("lens_distortion", "Same as mixed_holes, through a wide-angle lens with barrel distortion.",
                  3000, 1500, sheet, _mixed_holes(), cam=cam, seed=seed, hint={"needs_lens_model": True})


def scene_small_bed(seed=0):
    cam = make_camera(1500, 950, fill=0.8)
    sheet = box(120, 90, 1320, 890)
    holes = [circle(330, 280, 45), circle(1110, 280, 45), circle(330, 700, 45), circle(1110, 700, 45),
             rect(720, 490, 260, 40, 0.0)]
    return _scene("small_bed", "1500 x 950 mm bed (the Colab default) with a 1200 x 800 mm sheet: camera "
                  "resolution ~1 mm/px.", 1500, 950, sheet, holes, cam=cam, seed=seed)


SCENARIOS: dict[str, Callable[..., Scene]] = {
    "fresh_sheet": scene_fresh_sheet,
    "four_circles": scene_four_circles,
    "mixed_holes": scene_mixed_holes,
    "irregular_remnant": scene_irregular_remnant,
    "dark_steel": scene_dark_steel,
    "lens_distortion": scene_lens_distortion,
    "small_bed": scene_small_bed,
}


def make_scene(name: str, seed: int = 0) -> Scene:
    return SCENARIOS[name](seed=seed)
