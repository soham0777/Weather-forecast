"""
Bansali SmartNest - CAD input/output for nesting.

    read_dxf_parts()      DXF -> validated closed part polygons (mm), quantities by de-duplication
    export_layout_dxf()   nested layout -> machine DXF (mm, Y up), original ARC/CIRCLE/SPLINE kept
    validate_layout_dxf() re-read the exported file and compare with the layout geometry
    make_sample_job_dxf() demo job with lines+arcs, bulged polylines, circles and holes

Invalid geometry is never repaired silently: open or self-intersecting contours are reported
with the part they belong to, and those contours are not nested.
"""
from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.validation import explain_validity

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
UNIT_SCALE = {0: 1.0, 1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}   # $INSUNITS -> mm
SUPPORTED = {"LINE", "ARC", "CIRCLE", "LWPOLYLINE", "POLYLINE", "SPLINE", "ELLIPSE"}


@dataclass
class PartDef:
    name: str
    polygon: Polygon                        # mm, centred on its centroid (0, 0), holes included
    quantity: int = 1
    allowed_rotations: list[float] | None = None   # None = use the job's rotation step
    source_entities: list = field(default_factory=list)   # ezdxf entities (source file coordinates)
    source_offset: tuple[float, float] = (0.0, 0.0)       # centroid in source coordinates (mm)
    source_scale: float = 1.0                             # source units -> mm

    @property
    def area_mm2(self) -> float:
        return float(self.polygon.area)

    @property
    def cut_length_mm(self) -> float:
        return float(self.polygon.exterior.length + sum(r.length for r in self.polygon.interiors))

    def summary(self) -> dict[str, Any]:
        minx, miny, maxx, maxy = self.polygon.bounds
        return {"name": self.name, "quantity": self.quantity, "area_mm2": round(self.area_mm2, 1),
                "bbox_mm": [round(maxx - minx, 2), round(maxy - miny, 2)],
                "holes": len(self.polygon.interiors), "cut_length_mm": round(self.cut_length_mm, 1),
                "allowed_rotations": self.allowed_rotations}


@dataclass
class ImportReport:
    file: str
    units: str
    parts: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def safe_filename(name: str) -> str:
    base = os.path.basename(name or "upload.dxf")
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._") or "upload"
    return base[:120]


def _entities(msp):
    """Model-space entities with blocks (INSERT) exploded recursively."""
    for e in msp:
        if e.dxftype() == "INSERT":
            try:
                yield from _explode(e, depth=0)
            except Exception:  # noqa: BLE001
                continue
        else:
            yield e


def _explode(insert, depth):
    if depth > 8:
        return
    for v in insert.virtual_entities():
        if v.dxftype() == "INSERT":
            yield from _explode(v, depth + 1)
        else:
            yield v


def _to_points(e, scale: float, arc_tol: float):
    import ezdxf.path

    p = ezdxf.path.make_path(e)
    pts = np.array([(v.x, v.y) for v in p.flattening(distance=arc_tol / scale)], dtype=np.float64) * scale
    closed = bool(getattr(p, "is_closed", False))
    t = e.dxftype()
    if t == "CIRCLE" or (t == "LWPOLYLINE" and e.closed) or (t == "POLYLINE" and e.is_closed):
        closed = True
    if t == "SPLINE" and e.closed:
        closed = True
    if t == "ELLIPSE" and abs((e.dxf.end_param - e.dxf.start_param) - 2 * math.pi) < 1e-9:
        closed = True
    return pts, closed


def _chain(segments, tol):
    """Join open polylines end-to-end (within tol) into loops. Returns (loops, open_chains);
    each item is (points, [entity indices])."""
    segs = [(s, [i]) for i, s in enumerate(segments)]
    loops, open_chains = [], []
    used = [False] * len(segs)
    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        pts, ids = segs[i][0].copy(), list(segs[i][1])
        grown = True
        while grown and np.hypot(*(pts[0] - pts[-1])) > tol:
            grown = False
            for j in range(len(segs)):
                if used[j]:
                    continue
                q = segs[j][0]
                if np.hypot(*(pts[-1] - q[0])) <= tol:
                    pts = np.vstack([pts, q[1:]])
                elif np.hypot(*(pts[-1] - q[-1])) <= tol:
                    pts = np.vstack([pts, q[::-1][1:]])
                elif np.hypot(*(pts[0] - q[-1])) <= tol:
                    pts = np.vstack([q[:-1], pts])
                elif np.hypot(*(pts[0] - q[0])) <= tol:
                    pts = np.vstack([q[::-1][:-1], pts])
                else:
                    continue
                used[j] = True
                ids += segs[j][1]
                grown = True
                break
        if np.hypot(*(pts[0] - pts[-1])) <= tol and len(pts) >= 4:
            loops.append((pts[:-1], ids))
        else:
            open_chains.append((pts, ids))
    return loops, open_chains


def _signature(poly: Polygon) -> tuple:
    mrr = poly.minimum_rotated_rectangle
    c = np.asarray(mrr.exterior.coords)[:4]
    a, b = sorted([np.hypot(*(c[1] - c[0])), np.hypot(*(c[2] - c[1]))])
    return (round(poly.area, 0), round(poly.exterior.length, 0), len(poly.interiors), round(a, 0), round(b, 0))


def read_dxf_parts(path: str, tol_mm: float = 0.05, arc_tol_mm: float = 0.05) -> tuple[list[PartDef], ImportReport]:
    """Every outer closed contour (with the closed contours inside it as holes) is one part.
    Identical parts drawn several times become one PartDef with that quantity."""
    import ezdxf
    from ezdxf import recover

    rep = ImportReport(file=os.path.basename(path), units="mm")
    if not path.lower().endswith(".dxf"):
        rep.errors.append("Only .dxf files are accepted for parts.")
        return [], rep
    if os.path.getsize(path) > MAX_UPLOAD_BYTES:
        rep.errors.append(f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
        return [], rep
    try:
        doc, auditor = recover.readfile(path)
    except (IOError, ezdxf.DXFStructureError) as e:
        rep.errors.append(f"Not a readable DXF file ({e}).")
        return [], rep
    code = int(doc.header.get("$INSUNITS", 0))
    scale = UNIT_SCALE.get(code)
    if scale is None:
        rep.errors.append(f"Unsupported drawing units ($INSUNITS={code}).")
        return [], rep
    rep.units = {0: "unitless (assumed mm)", 1: "inch", 2: "foot", 4: "mm", 5: "cm", 6: "m"}[code]
    if code == 0:
        rep.warnings.append("Drawing has no units set; millimetres assumed. Check the part sizes below.")

    ents, closed_loops, open_segs, open_ents, skipped = [], [], [], [], {}
    for e in _entities(doc.modelspace()):
        t = e.dxftype()
        if t not in SUPPORTED:
            skipped[t] = skipped.get(t, 0) + 1
            continue
        try:
            pts, closed = _to_points(e, scale, arc_tol_mm)
        except Exception as ex:  # noqa: BLE001
            rep.warnings.append(f"Could not read a {t} entity ({ex}).")
            continue
        if len(pts) < 2:
            continue
        ents.append(e)
        k = len(ents) - 1
        if closed:
            if np.hypot(*(pts[0] - pts[-1])) <= tol_mm:
                pts = pts[:-1]
            closed_loops.append((pts, [k]))
        else:
            open_segs.append(pts)
            open_ents.append(k)
    for t, n in skipped.items():
        if t not in ("TEXT", "MTEXT", "DIMENSION", "POINT", "HATCH", "LEADER", "MLEADER"):
            rep.warnings.append(f"Ignored {n} unsupported {t} entit{'y' if n == 1 else 'ies'}.")
    chained, open_chains = _chain(open_segs, tol_mm)
    loops = closed_loops + [(p, [open_ents[i] for i in ids]) for p, ids in chained]
    if not loops and not open_chains:
        rep.errors.append("No closed part contours found in the file.")
        return [], rep

    polys = []
    for pts, ids in loops:
        g = Polygon(pts)
        if not g.is_valid:
            polys.append((g, ids, "self-intersecting (" + explain_validity(g) + ")"))
        elif g.area < 1.0:
            polys.append((g, ids, "zero-area"))
        else:
            polys.append((orient(g), ids, None))
    order = sorted(range(len(polys)), key=lambda i: -abs(polys[i][0].area))
    parent = {}
    for pos, i in enumerate(order):
        pt = polys[i][0].representative_point() if polys[i][0].is_valid else polys[i][0].centroid
        cands = [j for j in order[:pos] if polys[j][2] is None and polys[j][0].contains(pt)]
        parent[i] = cands[-1] if cands else None
    depth = {}
    for i in order:
        depth[i] = 0 if parent[i] is None else depth[parent[i]] + 1

    raw_parts = []
    for i in order:
        if depth[i] % 2:
            continue
        g, ids, problem = polys[i]
        holes = [j for j in order if parent[j] == i]
        raw_parts.append((i, g, ids, problem, holes))
    raw_parts.sort(key=lambda t: (round(t[1].bounds[0], 3), round(t[1].bounds[1], 3)))   # drawing order
    for n, (i, g, ids, problem, holes) in enumerate(raw_parts):
        label = f"Part {n + 1:02d}"
        bad = [polys[j][2] for j in holes if polys[j][2]]
        if problem or bad:
            rep.errors.append(f"{label} has a {problem or bad[0]} contour and cannot be nested.")
    for pts, _ in open_chains:
        c = pts.mean(axis=0)
        owner = next((f"Part {n + 1:02d}" for n, (i, g, *_r) in enumerate(raw_parts)
                      if g.is_valid and g.buffer(1.0).intersects(LineString(pts))), None)
        where = f"{owner} contains" if owner else f"Near ({c[0]:.1f}, {c[1]:.1f}) mm there is"
        rep.errors.append(f"{where} an open contour (gap > {tol_mm} mm) and cannot be nested.")

    groups: dict[tuple, PartDef] = {}
    names = iter([chr(ord("A") + k) if k < 26 else f"P{k + 1}" for k in range(10_000)])
    bad_parts = {f"Part {n + 1:02d}" for n, _ in enumerate(raw_parts)
                 if any(f"Part {n + 1:02d} " in e for e in rep.errors)}
    for n, (i, g, ids, problem, holes) in enumerate(raw_parts):
        if f"Part {n + 1:02d}" in bad_parts:
            continue
        poly = orient(Polygon(g.exterior, [polys[j][0].exterior for j in holes]))
        c = poly.centroid
        centred = affinity.translate(poly, -c.x, -c.y)
        sig = _signature(centred)
        if sig in groups:
            groups[sig].quantity += 1
            continue
        src = [ents[k] for k in ids] + [ents[k] for j in holes for k in polys[j][1]]
        groups[sig] = PartDef(next(names), centred, 1, None, src, (c.x / scale, c.y / scale), scale)
    parts = list(groups.values())
    rep.parts = [p.summary() for p in parts]
    return parts, rep


# ---------------------------------------------------------------------------
# Layout export
# ---------------------------------------------------------------------------
def _matrix(part: PartDef, x: float, y: float, rot_deg: float):
    from ezdxf.math import Matrix44

    ox, oy = part.source_offset
    return (Matrix44.translate(-ox, -oy, 0) @ Matrix44.scale(part.source_scale, part.source_scale, 1)
            @ Matrix44.z_rotate(math.radians(rot_deg)) @ Matrix44.translate(x, y, 0))


def export_layout_dxf(nest, parts: list[PartDef], path: str, material=None, bed=None,
                      include_reference: bool = False, true_arcs: bool = True) -> dict[str, Any]:
    """Cutting file in machine millimetres (Y up, origin = bed bottom-left).
    Layer CUT holds only part contours. Reference layers (sheet, existing cut-outs, bed) are added
    only on request and use colour 8 - make sure your CAM does not cut them."""
    import ezdxf

    if not nest.export_enabled:
        raise ValueError("Export blocked: " + "; ".join(nest.failed_checks()))
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    doc.header["$MEASUREMENT"] = 1
    doc.layers.add("CUT", color=1)
    doc.layers.add("PART_ID", color=2)
    msp = doc.modelspace()
    arcs = polys = 0
    for pl in nest.placements:
        part = parts[pl.part_index]
        done = False
        if true_arcs and part.source_entities:
            try:                                  # transform detached copies; add only if all succeed
                m = _matrix(part, pl.x_mm, pl.y_mm, pl.rotation_deg)
                copies = []
                for e in part.source_entities:
                    ne = e.copy()
                    ne.transform(m)
                    ne.dxf.layer = "CUT"
                    copies.append(ne)
                for ne in copies:
                    msp.add_foreign_entity(ne, copy=True)
                    arcs += ne.dxftype() in ("ARC", "CIRCLE", "SPLINE", "ELLIPSE")
                done = True
            except Exception:  # noqa: BLE001 - fall back to the exact polygon contours
                done = False
        if not done:
            for ring in [pl.geometry.exterior, *pl.geometry.interiors]:
                msp.add_lwpolyline(list(ring.coords)[:-1], close=True, dxfattribs={"layer": "CUT"})
                polys += 1
        msp.add_text(pl.instance_id, height=min(20.0, 0.15 * math.sqrt(pl.geometry.area)),
                     dxfattribs={"layer": "PART_ID"}).set_placement((pl.x_mm, pl.y_mm))
    if include_reference and material is not None:
        doc.layers.add("REF_SHEET", color=8)
        doc.layers.add("REF_CUTOUTS", color=8)
        for g in getattr(material, "geoms", [material]):
            msp.add_lwpolyline(list(g.exterior.coords)[:-1], close=True, dxfattribs={"layer": "REF_SHEET"})
            for r in g.interiors:
                msp.add_lwpolyline(list(r.coords)[:-1], close=True, dxfattribs={"layer": "REF_CUTOUTS"})
    if include_reference and bed is not None:
        doc.layers.add("REF_BED", color=8)
        msp.add_lwpolyline([(0, 0), (bed[0], 0), (bed[0], bed[1]), (0, bed[1])], close=True,
                           dxfattribs={"layer": "REF_BED"})
    doc.saveas(path)
    return {"path": path, "parts": len(nest.placements), "true_curve_entities": arcs,
            "polyline_contours": polys, "units": "mm", "origin": "bed bottom-left, Y up"}


def validate_layout_dxf(path: str, nest, tol_mm2_per_part: float = 2.0) -> dict[str, Any]:
    """Re-read the CUT layer, rebuild the part polygons and compare with the layout."""
    import ezdxf

    msp = ezdxf.readfile(path).modelspace()
    segs, closed = [], []
    for e in msp.query('*[layer=="CUT"]'):
        if e.dxftype() not in SUPPORTED:
            continue
        pts, is_closed = _to_points(e, 1.0, 0.05)
        (closed if is_closed else segs).append(pts[:-1] if is_closed and np.hypot(*(pts[0] - pts[-1])) < 1e-6 else pts)
    loops, open_chains = _chain(segs, 0.05)
    rings = [Polygon(p) for p in closed] + [Polygon(p) for p, _ in loops]
    rings.sort(key=lambda g: -g.area)
    outers = []
    for g in rings:
        host = next((o for o in outers if o[0].contains(g.representative_point())), None)
        if host is None:
            outers.append([g, []])
        else:
            host[1].append(g)
    got = unary_union([o.difference(unary_union(h)) if h else o for o, h in outers])
    want = unary_union([pl.geometry for pl in nest.placements])
    diff = got.symmetric_difference(want).area
    tol = tol_mm2_per_part * max(1, len(nest.placements))
    return {"ok": bool(diff <= tol and not open_chains and len(outers) == len(nest.placements)),
            "contours_read": len(rings), "parts_read": len(outers), "open_contours": len(open_chains),
            "symmetric_difference_mm2": diff, "tolerance_mm2": tol}


def export_layout_svg(nest, material, bed, path: str) -> str:
    """Visual preview (not for cutting). SVG y runs down, so CAD Y is flipped."""
    W, H = bed

    def d(ring):
        pts = np.asarray(ring.coords)
        return "M " + " L ".join(f"{x:.2f},{H - y:.2f}" for x, y in pts) + " Z"

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 {W + 20} {H + 20}" width="1200">',
           f'<rect x="0" y="0" width="{W}" height="{H}" fill="#1b1f24" stroke="#666" stroke-width="3"/>']
    for g in getattr(material, "geoms", [material]):
        out.append(f'<path d="{" ".join(d(r) for r in [g.exterior, *g.interiors])}" fill="#b9bec4" '
                   'fill-rule="evenodd" stroke="#2e7d32" stroke-width="3"/>')
    for pl in nest.placements:
        g = pl.geometry
        out.append(f'<path d="{" ".join(d(r) for r in [g.exterior, *g.interiors])}" fill="#1565c0" '
                   'fill-opacity="0.8" fill-rule="evenodd" stroke="#0d47a1" stroke-width="1.5"/>')
        out.append(f'<text x="{pl.x_mm:.1f}" y="{H - pl.y_mm:.1f}" font-size="18" fill="white" '
                   f'text-anchor="middle">{pl.instance_id}</text>')
    out.append("</svg>")
    with open(path, "w") as f:
        f.write("\n".join(out))
    return path


# ---------------------------------------------------------------------------
# Demo job
# ---------------------------------------------------------------------------
def make_sample_job_dxf(path: str) -> str:
    """Four part types, one of each, drawn with the entity mix real CAD files contain."""
    import ezdxf

    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    msp = doc.modelspace()
    # A - L-bracket: LINE + ARC outline (must be chained), two D12 holes
    ox, oy, r = 0.0, 0.0, 20.0
    pts = [(ox, oy), (ox + 240, oy), (ox + 240, oy + 50), (ox + 50 + r, oy + 50)]
    for a, b in zip(pts, pts[1:]):
        msp.add_line(a, b)
    msp.add_arc((ox + 50 + r, oy + 50 + r), r, 180, 270)            # inner fillet
    msp.add_line((ox + 50, oy + 50 + r), (ox + 50, oy + 170))
    msp.add_line((ox + 50, oy + 170), (ox, oy + 170))
    msp.add_line((ox, oy + 170), (ox, oy))
    msp.add_circle((ox + 200, oy + 25), 6)
    msp.add_circle((ox + 25, oy + 140), 6)
    # B - plate with rounded corners (bulged LWPOLYLINE), 4 holes and a slot
    ox, oy, w, h, rr = 400.0, 0.0, 300.0, 180.0, 15.0
    b = math.tan(math.radians(90) / 4)
    msp.add_lwpolyline([(ox + rr, oy, 0), (ox + w - rr, oy, b), (ox + w, oy + rr, 0), (ox + w, oy + h - rr, b),
                        (ox + w - rr, oy + h, 0), (ox + rr, oy + h, b), (ox, oy + h - rr, 0), (ox, oy + rr, b)],
                       format="xyb", close=True)
    for hx, hy in ((30, 30), (w - 30, 30), (w - 30, h - 30), (30, h - 30)):
        msp.add_circle((ox + hx, oy + hy), 5)
    msp.add_lwpolyline([(ox + 110, oy + 80, 0), (ox + 190, oy + 80, 1), (ox + 190, oy + 100, 0),
                        (ox + 110, oy + 100, 1)], format="xyb", close=True)
    # C - flange: D200 disc, D80 bore, 6 x D14 bolt holes
    cx, cy = 900.0, 100.0
    msp.add_circle((cx, cy), 100)
    msp.add_circle((cx, cy), 40)
    for k in range(6):
        a = math.radians(60 * k)
        msp.add_circle((cx + 70 * math.cos(a), cy + 70 * math.sin(a)), 7)
    # D - gusset: chamfered right triangle, one hole
    ox, oy = 1100.0, 0.0
    msp.add_lwpolyline([(ox, oy), (ox + 200, oy), (ox + 200, oy + 20), (ox + 20, oy + 150), (ox, oy + 150)], close=True)
    msp.add_circle((ox + 40, oy + 30), 8)
    doc.saveas(path)
    return path
