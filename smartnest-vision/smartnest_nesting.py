"""
Bansali SmartNest - irregular nesting into the MEASURED material (sheet minus existing cut-outs).

Geometry kernel (exact polygon maths, no bounding-box approximations):
    convex_decompose(P)         constrained Delaunay triangles merged into convex pieces
    calculate_nfp(A, B)         No-Fit Polygon A (+) (-B): positions of B's reference point at
                                which B overlaps A. Union of convex hulls of piece-pair sums.
    inner_fit(C, S)             positions of S's reference point at which S lies inside the
                                container C (which may have holes): (C - b0) minus the sweep of
                                -S along every edge of C.
Placement:
    feasible = IFP(part, rot) - union(NFP(placed_i, part)) ; a linear "bottom-left" score is
    optimal at a vertex of that region, so its vertices are the candidates. The chosen position
    is then VERIFIED with exact Shapely containment and distance checks (kernel proposes,
    polygon geometry decides). NFP/IFP use slightly conservative shapes, so rounding can only
    lose a placement, never create an overlap.
Optimisation:
    greedy decoder over a part sequence (best rotation per part), evolutionary search over
    sequences until max_time_s or no improvement; the best VALID layout is always returned.
Coordinates: machine/CAD millimetres, Y up, origin = bed bottom-left (the DXF frame).
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

EPS_MM = 0.01            # extra spacing inside the kernel so exact checks pass with margin


@dataclass
class NestConfig:
    kerf_mm: float = 0.3                 # laser kerf width
    clearance_mm: float = 3.0            # minimum material web between neighbouring parts' kerfs
    edge_margin_mm: float = 5.0          # minimum web between a part's kerf and a material edge
    measurement_uncertainty_mm: float = 3.0   # vision uncertainty; see smartnest_vision.usable_region
    rotation_step_deg: float = 90.0      # allowed rotations 0, step, 2*step ... unless a part overrides
    max_time_s: float = 30.0             # MAX_OPTIMIZATION_TIME_SECONDS
    seed: int = 0
    geometry_tol_mm: float = 0.25        # conservative simplification used inside the kernel only
    min_remnant_mm: float = 100.0        # leftover narrower than this is counted as scrap
    gravity_y_weight: float = 0.25       # bottom-left score = right edge + w * top edge
    population: int = 8
    stall_generations: int = 40
    w_unplaced: float = 1e6              # objective weights (lower score is better)
    w_unplaced_area: float = 1e3
    w_envelope: float = 100.0
    w_cut_per_m: float = 1e-3

    @property
    def part_gap_mm(self) -> float:      # required distance between two real part edges
        return self.kerf_mm + self.clearance_mm

    @property
    def edge_gap_mm(self) -> float:      # required distance from a real part edge to material edge
        return self.kerf_mm / 2 + self.edge_margin_mm + self.measurement_uncertainty_mm


# ---------------------------------------------------------------------------
# Geometry kernel
# ---------------------------------------------------------------------------
def _as_area(g):
    parts = [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and not p.is_empty] if g is not None else []
    if not parts and hasattr(g, "geoms"):
        parts = [q for p in g.geoms for q in getattr(p, "geoms", [p]) if isinstance(q, Polygon) and not q.is_empty]
    if not parts:
        return Polygon()
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def grow_simplify(g, tol):
    """Fewer vertices, never smaller than g (buffer out by tol, then simplify by tol)."""
    return _as_area(make_valid(g.buffer(tol, join_style="mitre", mitre_limit=2.0).simplify(tol, preserve_topology=True)))


def shrink_simplify(g, tol):
    """Fewer vertices, never larger than g."""
    return _as_area(make_valid(g.buffer(-tol, join_style="mitre", mitre_limit=2.0).simplify(tol, preserve_topology=True)))


def convex_decompose(poly: Polygon) -> list[np.ndarray]:
    """Convex pieces covering the polygon's outline (holes are filled: parts are not nested
    inside other parts' holes in this version)."""
    solid = orient(Polygon(poly.exterior))
    hull = solid.convex_hull
    if solid.area >= hull.area * (1 - 1e-9):
        return [np.asarray(hull.exterior.coords)[:-1]]
    pieces = [orient(t) for t in shapely.constrained_delaunay_triangles(solid).geoms if t.area > 1e-12]
    merged = True
    while merged and len(pieces) > 1:            # greedy Hertel-Mehlhorn style merge
        merged = False
        tree = STRtree(pieces)
        for i, p in enumerate(pieces):
            for j in tree.query(p):
                if j <= i or p.intersection(pieces[j]).length < 1e-9:
                    continue
                u = p.union(pieces[j])
                if isinstance(u, Polygon) and u.area >= u.convex_hull.area * (1 - 1e-9):
                    pieces[i] = orient(u.convex_hull)
                    del pieces[j]
                    merged = True
                    break
            if merged:
                break
    return [np.asarray(p.exterior.coords)[:-1] for p in pieces]


def _pad(pieces: Sequence[np.ndarray]) -> np.ndarray:
    k = max(len(p) for p in pieces)
    return np.stack([np.vstack([p, np.repeat(p[-1:], k - len(p), axis=0)]) for p in pieces])


def _hull_union(point_sets: np.ndarray):
    n, k, _ = point_sets.shape
    mp = shapely.multipoints(point_sets.reshape(-1, 2), indices=np.repeat(np.arange(n), k))
    return shapely.union_all(shapely.convex_hull(mp))


def minkowski_sum(a_pieces: Sequence[np.ndarray], b_pieces: Sequence[np.ndarray]):
    A, B = _pad(a_pieces), _pad(b_pieces)
    s = A[:, None, :, None, :] + B[None, :, None, :, :]
    return _as_area(_hull_union(s.reshape(len(A) * len(B), -1, 2)))


def calculate_nfp(a_pieces, b_pieces):
    """No-Fit Polygon of B orbiting A (both with reference point at their own origin)."""
    return minkowski_sum(a_pieces, [-p for p in b_pieces])


def ring_edges(g) -> np.ndarray:
    segs = []
    for p in getattr(g, "geoms", [g]):
        for r in [p.exterior, *p.interiors]:
            c = np.asarray(r.coords)
            segs.append(np.stack([c[:-1], c[1:]], axis=1))
    return np.concatenate(segs) if segs else np.zeros((0, 2, 2))


def inner_fit(container, edges: np.ndarray, s_pieces: Sequence[np.ndarray], b0: tuple[float, float],
              chunk: int = 4000):
    """Positions t with S + t inside the container (exact for any container, holes included):
    b0 + t must be inside, and S + t must not touch any container edge."""
    neg = _pad([-p for p in s_pieces])
    forb = []
    for i in range(0, len(edges), chunk):
        e = edges[i:i + chunk]
        pts = e[:, None, :, None, :] + neg[None, :, None, :, :]          # (E, P, 2, k, 2)
        forb.append(_hull_union(pts.reshape(len(e) * len(neg), -1, 2)))
    region = affinity.translate(container, -b0[0], -b0[1])
    return _as_area(region.difference(shapely.union_all(forb)))


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
@dataclass
class Placement:
    part_index: int
    part_name: str
    instance_id: str
    x_mm: float                     # position of the part's centroid (CAD mm)
    y_mm: float
    rotation_deg: float             # counter-clockwise, about the centroid
    geometry: Polygon               # real part outline incl. holes, CAD mm


@dataclass
class NestResult:
    placements: list[Placement]
    required: int
    unplaced: dict[str, int]
    metrics: dict[str, Any]
    checks: dict[str, tuple[bool, str]]
    notes: list[str] = field(default_factory=list)
    history: list[tuple[float, float]] = field(default_factory=list)
    evaluations: int = 0
    time_s: float = 0.0
    config: NestConfig | None = None

    @property
    def placed(self) -> int:
        return len(self.placements)

    @property
    def export_enabled(self) -> bool:
        return all(ok for ok, _ in self.checks.values())

    def failed_checks(self) -> list[str]:
        return [f"{k}: {m}" for k, (ok, m) in self.checks.items() if not ok]

    @property
    def message(self) -> str:
        if self.placed == self.required:
            return f"All {self.required} parts fit within the available material."
        return f"{self.placed} of {self.required} parts fit within the available material."

    def to_dict(self) -> dict[str, Any]:
        m = self.metrics
        return {
            "required_parts": self.required, "placed_parts": self.placed,
            "unplaced_parts": self.required - self.placed, "unplaced_by_part": self.unplaced,
            "message": self.message,
            "utilization_percent": round(m["utilization_percent"], 2),
            "waste_percent": round(m["waste_percent"], 2),
            "waste_area_mm2": round(m["waste_area_mm2"], 0),
            "reusable_remnant_mm2": round(m["reusable_remnant_mm2"], 0),
            "scrap_area_mm2": round(m["scrap_area_mm2"], 0),
            "cutting_distance_mm": round(m["cutting_distance_mm"], 1),
            "pierces": m["pierces"], "travel_distance_mm": round(m["travel_distance_mm"], 1),
            "placements": [{"part_id": p.instance_id, "part": p.part_name, "x_mm": round(p.x_mm, 3),
                            "y_mm": round(p.y_mm, 3), "rotation_deg": p.rotation_deg} for p in self.placements],
            "checks": {k: {"ok": ok, "detail": msg} for k, (ok, msg) in self.checks.items()},
            "export_enabled": self.export_enabled, "notes": self.notes,
            "evaluations": self.evaluations, "time_s": round(self.time_s, 2),
        }


# ---------------------------------------------------------------------------
# Kernel with caches
# ---------------------------------------------------------------------------
@dataclass
class _Shape:
    real: Polygon
    ifp_pieces: list[np.ndarray]
    ifp_ref: tuple[float, float]
    eff_pieces: list[np.ndarray]
    bounds: tuple[float, float, float, float]


class _Kernel:
    def __init__(self, parts, container, cfg: NestConfig):
        self.parts, self.cfg = parts, cfg
        self.container = container
        shapely.prepare(self.container)
        self.cc = shrink_simplify(container, cfg.geometry_tol_mm)
        self.edges = ring_edges(self.cc)
        self._shape, self._ifp, self._nfp, self._rot = {}, {}, {}, {}

    def rotations(self, pi: int) -> list[float]:
        if pi in self._rot:
            return self._rot[pi]
        p = self.parts[pi]
        cand = p.allowed_rotations if p.allowed_rotations is not None else \
            list(np.arange(0.0, 360.0, self.cfg.rotation_step_deg))
        keep, shapes = [], []
        base = Polygon(p.polygon.exterior)
        for r in cand:
            g = affinity.rotate(base, float(r), origin=(0, 0))
            if all(g.symmetric_difference(s).area > 1e-4 * base.area for s in shapes):   # skip symmetric repeats
                keep.append(float(r) % 360.0)
                shapes.append(g)
        self._rot[pi] = keep
        return keep

    def shape(self, pi: int, rot: float) -> _Shape:
        key = (pi, rot)
        if key not in self._shape:
            c, tol = self.cfg, self.cfg.geometry_tol_mm
            real = orient(affinity.rotate(self.parts[pi].polygon, rot, origin=(0, 0)))
            solid = Polygon(real.exterior)
            s_c = grow_simplify(solid, tol)
            eff = solid.buffer(c.part_gap_mm / 2 + EPS_MM, join_style="mitre", mitre_limit=2.0)
            e_c = grow_simplify(eff, tol)
            b0 = s_c.representative_point()
            self._shape[key] = _Shape(real, convex_decompose(s_c), (b0.x, b0.y), convex_decompose(e_c), real.bounds)
        return self._shape[key]

    def ifp(self, pi: int, rot: float):
        key = (pi, rot)
        if key not in self._ifp:
            sh = self.shape(pi, rot)
            g = inner_fit(self.cc, self.edges, sh.ifp_pieces, sh.ifp_ref) if not self.cc.is_empty else Polygon()
            self._ifp[key] = (g, g.bounds if not g.is_empty else None)
        return self._ifp[key]

    def nfp(self, pa, ra, pb, rb):
        key = (pa, ra, pb, rb)
        if key not in self._nfp:
            g = calculate_nfp(self.shape(pa, ra).eff_pieces, self.shape(pb, rb).eff_pieces)
            self._nfp[key] = (g, g.bounds)
        return self._nfp[key]

    def exact_ok(self, real_t: Polygon, placed) -> bool:
        if not self.container.contains(real_t):
            return False
        gap = self.cfg.part_gap_mm - 1e-6
        x0, y0, x1, y1 = real_t.bounds
        for q in placed:
            qb = q[5]
            if qb[0] - gap > x1 or qb[2] + gap < x0 or qb[1] - gap > y1 or qb[3] + gap < y0:
                continue
            if real_t.distance(q[4]) < gap:
                return False
        return True

    def decode(self, seq: Sequence[int], deadline: float | None = None):
        """Greedy bottom-left construction. Returns (placed, unplaced) or None if out of time.

        Each (part type, rotation) keeps its own feasible region and subtracts only the NFPs of
        parts placed since it was last used; a part type whose regions are all empty is skipped
        for the rest of the sequence (regions only ever shrink)."""
        gy = self.cfg.gravity_y_weight
        placed, unplaced = [], []
        free: dict[tuple[int, float], list] = {}
        dead: set[int] = set()
        for pi in seq:
            if deadline is not None and time.perf_counter() > deadline:
                return None
            if pi in dead:
                unplaced.append(pi)
                continue
            best, any_region = None, False
            for rot in self.rotations(pi):
                key = (pi, rot)
                if key not in free:
                    ifp, ib = self.ifp(pi, rot)
                    free[key] = [ifp, 0]
                region, n = free[key]
                if region.is_empty:
                    continue
                if n < len(placed):
                    rb = region.bounds
                    obs = []
                    for q in placed[n:]:
                        g, nb = self.nfp(q[0], q[1], pi, rot)
                        if nb[0] + q[2] > rb[2] or nb[2] + q[2] < rb[0] or nb[1] + q[3] > rb[3] or nb[3] + q[3] < rb[1]:
                            continue
                        obs.append(affinity.translate(g, q[2], q[3]))
                    if obs:
                        region = _as_area(region.difference(shapely.union_all(obs)))
                    free[key] = [region, len(placed)]
                if region.is_empty:
                    continue
                any_region = True
                sh = self.shape(pi, rot)
                V = shapely.get_coordinates(region)
                score = V[:, 0] + sh.bounds[2] + gy * (V[:, 1] + sh.bounds[3])
                for k in np.argsort(score)[:12]:
                    if best is not None and score[k] >= best[0]:
                        break
                    real_t = affinity.translate(sh.real, V[k, 0], V[k, 1])
                    if self.exact_ok(real_t, placed):
                        best = (float(score[k]), rot, float(V[k, 0]), float(V[k, 1]), real_t)
                        break
            if best is None:
                unplaced.append(pi)
                if not any_region:
                    dead.add(pi)
            else:
                _, rot, x, y, real_t = best
                placed.append((pi, rot, x, y, real_t, real_t.bounds))
        return placed, unplaced


# ---------------------------------------------------------------------------
# Optimiser
# ---------------------------------------------------------------------------
def material_to_cad(material_bed, bed_h_mm: float):
    """Vision frame (y down) -> machine frame (Y up, origin bottom-left)."""
    g = affinity.translate(affinity.scale(material_bed, 1.0, -1.0, origin=(0, 0)), 0.0, bed_h_mm)
    return _as_area(make_valid(orient(g) if isinstance(g, Polygon) else g))


def cad_to_bed(geom, bed_h_mm: float):
    return affinity.translate(affinity.scale(geom, 1.0, -1.0, origin=(0, 0)), 0.0, bed_h_mm)


def _score(kernel: _Kernel, placed, unplaced, required_area) -> float:
    c = kernel.cfg
    un_area = sum(kernel.parts[pi].area_mm2 for pi in unplaced)
    if placed:
        b = np.array([q[5] for q in placed])
        cb = kernel.container.bounds
        env = (b[:, 2].max() - cb[0]) * (b[:, 3].max() - cb[1])
        cut = sum(kernel.parts[q[0]].cut_length_mm for q in placed)
    else:
        env, cut = 0.0, 0.0
    return (c.w_unplaced * len(unplaced) + c.w_unplaced_area * un_area / max(required_area, 1.0)
            + c.w_envelope * env / max(kernel.container.area, 1.0) + c.w_cut_per_m * cut / 1000.0)


def _mutate(seq: list[int], rng: np.random.Generator) -> list[int]:
    s = list(seq)
    n = len(s)
    if n < 2:
        return s
    move = rng.integers(3)
    i, j = sorted(rng.choice(n, 2, replace=False))
    if move == 0:
        s[i], s[j] = s[j], s[i]
    elif move == 1:
        s.insert(j, s.pop(i))
    else:
        s[i:j + 1] = s[i:j + 1][::-1]
    return s


def nest(parts, material_cad, bed_w_mm: float, bed_h_mm: float, cfg: NestConfig | None = None,
         progress: Callable[[str, dict], None] | None = None, scan_problems: Sequence[str] = ()) -> NestResult:
    """Place every requested part instance into the material, maximising parts placed, then
    compactness (large reusable remnant), then cutting distance."""
    cfg = cfg or NestConfig()
    t0 = time.perf_counter()
    deadline = t0 + cfg.max_time_s
    say = progress or (lambda stage, info: None)
    rng = np.random.default_rng(cfg.seed)
    notes: list[str] = []

    say("Detecting geometry", {})
    material_cad = _as_area(make_valid(material_cad))
    container = _as_area(material_cad.buffer(-cfg.edge_gap_mm, join_style="mitre", mitre_limit=5.0))
    kernel = _Kernel(parts, container, cfg)
    instances = [pi for pi, p in enumerate(parts) for _ in range(p.quantity)]
    required_area = sum(parts[pi].area_mm2 for pi in instances)

    say("Generating candidate placements", {"part_types": len(parts)})
    for pi, p in enumerate(parts):
        if all(kernel.ifp(pi, r)[1] is None for r in kernel.rotations(pi)):
            notes.append(f"Part {p.name} is larger than the remaining usable region "
                         f"(after {cfg.edge_gap_mm:.1f} mm edge allowance) at every allowed rotation.")
    fits = [pi for pi in instances if any(kernel.ifp(pi, r)[1] is not None for r in kernel.rotations(pi))]
    never = [pi for pi in instances if pi not in set(fits)]

    say("Optimizing nesting", {"instances": len(instances)})
    hull_gap = {pi: 1 - p.area_mm2 / Polygon(p.polygon.exterior).convex_hull.area for pi, p in enumerate(parts)}
    diag = {pi: math.hypot(p.polygon.bounds[2] - p.polygon.bounds[0], p.polygon.bounds[3] - p.polygon.bounds[1])
            for pi, p in enumerate(parts)}
    seeds = [sorted(fits, key=lambda pi: -parts[pi].area_mm2),
             sorted(fits, key=lambda pi: -diag[pi]),
             sorted(fits, key=lambda pi: (-round(hull_gap[pi], 1), -parts[pi].area_mm2)),
             sorted(fits, key=lambda pi: parts[pi].area_mm2)]        # count is the primary objective
    pop, seen, history, evals = [], set(), [], 0
    best = None
    for s in seeds:
        if tuple(s) in seen:
            continue
        seen.add(tuple(s))
        res = kernel.decode(s, deadline if pop else None)          # the first layout always completes
        if res is None:
            break
        evals += 1
        sc = _score(kernel, res[0], res[1] + never, required_area)
        pop.append((sc, s, res))
        if best is None or sc < best[0]:
            best = (sc, s, res)
            history.append((time.perf_counter() - t0, sc))
    stall = 0
    while time.perf_counter() < deadline and stall < cfg.stall_generations and len(fits) > 1:
        k = rng.choice(len(pop), size=min(2, len(pop)), replace=False)
        parent = min((pop[i] for i in k), key=lambda t: t[0])
        child = _mutate(parent[1], rng)
        for _ in range(5):
            if tuple(child) not in seen:
                break
            child = _mutate(child, rng)
        if tuple(child) in seen:
            stall += 1
            continue
        seen.add(tuple(child))
        res = kernel.decode(child, deadline)
        if res is None:
            break
        evals += 1
        sc = _score(kernel, res[0], res[1] + never, required_area)
        if sc < best[0] - 1e-9:
            best, stall = (sc, child, res), 0
            history.append((time.perf_counter() - t0, sc))
            say("Optimizing nesting", {"evaluations": evals, "best_score": sc,
                                       "placed": len(res[0]), "required": len(instances)})
        else:
            stall += 1
        if len(pop) < cfg.population:
            pop.append((sc, child, res))
        else:
            worst = max(range(len(pop)), key=lambda i: pop[i][0])
            if sc < pop[worst][0]:
                pop[worst] = (sc, child, res)
    if time.perf_counter() >= deadline:
        notes.append(f"Optimization time limit ({cfg.max_time_s:.0f} s) reached; best layout found is returned.")

    say("Generating final layout", {})
    placed, unplaced = best[2]
    unplaced = unplaced + never
    counters: dict[int, int] = {}
    placements = []
    for pi, rot, x, y, real_t, _ in sorted(placed, key=lambda q: (parts[q[0]].name, q[2], q[3])):
        counters[pi] = counters.get(pi, 0) + 1
        placements.append(Placement(pi, parts[pi].name, f"{parts[pi].name}_{counters[pi]:02d}", x, y, rot, real_t))
    unplaced_by = {}
    for pi in unplaced:
        unplaced_by[parts[pi].name] = unplaced_by.get(parts[pi].name, 0) + 1
    if unplaced and not notes:
        notes.append("No feasible arrangement was found for all requested parts.")
    metrics = layout_metrics(placements, parts, material_cad, cfg)
    say("Validating layout", {})
    checks = validate_layout(placements, parts, material_cad, container, bed_w_mm, bed_h_mm, cfg, scan_problems)
    return NestResult(placements, len(instances), unplaced_by, metrics, checks, notes, history, evals,
                      time.perf_counter() - t0, cfg)


# ---------------------------------------------------------------------------
# Metrics and validation
# ---------------------------------------------------------------------------
def layout_metrics(placements, parts, material_cad, cfg: NestConfig) -> dict[str, Any]:
    available = material_cad.area
    part_area = sum(p.geometry.area for p in placements)
    cut = sum(p.geometry.exterior.length + sum(r.length for r in p.geometry.interiors) for p in placements)
    pierces = sum(1 + len(p.geometry.interiors) for p in placements)
    used = unary_union([p.geometry.buffer(cfg.kerf_mm / 2 + cfg.clearance_mm, join_style="mitre")
                        for p in placements]) if placements else Polygon()
    remaining = _as_area(material_cad.difference(used))
    r = cfg.min_remnant_mm / 2
    reusable = _as_area(remaining.buffer(-r, join_style="mitre").buffer(r, join_style="mitre").intersection(remaining))
    waste = available - part_area
    # rapid travel: nearest-neighbour tour from the machine origin through the part centroids
    pts = [np.array([p.x_mm, p.y_mm]) for p in placements]
    cur, travel = np.zeros(2), 0.0
    while pts:
        k = int(np.argmin([np.hypot(*(q - cur)) for q in pts]))
        travel += float(np.hypot(*(pts[k] - cur)))
        cur = pts.pop(k)
    return {"available_area_mm2": available, "part_area_mm2": part_area,
            "utilization_percent": 100 * part_area / available if available else 0.0,
            "waste_area_mm2": waste, "waste_percent": 100 * waste / available if available else 0.0,
            "reusable_remnant_mm2": reusable.area, "scrap_area_mm2": max(0.0, waste - reusable.area),
            "kerf_loss_mm2": cut * cfg.kerf_mm, "cutting_distance_mm": cut, "pierces": pierces,
            "travel_distance_mm": travel, "reusable_remnant": reusable}


def validate_layout(placements, parts, material_cad, container, bed_w, bed_h, cfg: NestConfig,
                    scan_problems: Sequence[str] = ()) -> dict[str, tuple[bool, str]]:
    """The export gate: every check must pass."""
    checks: dict[str, tuple[bool, str]] = {}
    checks["sheet"] = (bool(material_cad.is_valid and material_cad.area > 0),
                       "material geometry valid" if material_cad.is_valid else "material geometry invalid")
    checks["cutouts"] = (not scan_problems, "; ".join(scan_problems) or "scan geometry consistent")
    bad_parts = [p.name for p in parts if not (p.polygon.is_valid and p.polygon.area > 0)]
    checks["parts"] = (not bad_parts, f"invalid parts: {bad_parts}" if bad_parts else f"{len(parts)} part types valid")
    tolv = 1e-6
    outside = [p.instance_id for p in placements if p.geometry.difference(material_cad).area > tolv]
    checks["inside_sheet"] = (not outside, f"outside material: {outside}" if outside else "all parts on material")
    edge = [p.instance_id for p in placements if not container.buffer(tolv).contains(p.geometry)]
    checks["placements"] = (not edge, f"closer than {cfg.edge_gap_mm:.2f} mm to a material edge: {edge}" if edge
                            else f"all parts >= {cfg.edge_gap_mm:.2f} mm from sheet edges and existing cut-outs")
    geoms = [p.geometry for p in placements]
    tree = STRtree(geoms) if geoms else None
    overlaps, close = [], []
    for i, g in enumerate(geoms):
        for j in tree.query(g.buffer(cfg.part_gap_mm)):
            if j <= i:
                continue
            if g.intersection(geoms[j]).area > tolv:
                overlaps.append((placements[i].instance_id, placements[j].instance_id))
            elif g.distance(geoms[j]) < cfg.part_gap_mm - 1e-6:
                close.append((placements[i].instance_id, placements[j].instance_id, round(g.distance(geoms[j]), 3)))
    checks["no_overlap"] = (not overlaps, f"overlapping: {overlaps}" if overlaps else "no overlapping parts")
    checks["clearance"] = (not close, f"below {cfg.part_gap_mm:.2f} mm: {close}" if close
                           else f"all part gaps >= kerf + clearance = {cfg.part_gap_mm:.2f} mm")
    bed = box(0, 0, bed_w, bed_h).buffer(tolv)
    oob = [p.instance_id for p in placements if not bed.contains(p.geometry)]
    checks["machine_bounds"] = (not oob, f"outside machine bed: {oob}" if oob else "inside machine bed")
    return checks


def export_cutting_file(nest_result: NestResult, parts, path: str, **kw) -> dict[str, Any]:
    """Write the DXF, read it back, compare. The file is kept only if the comparison passes."""
    import os

    from smartnest_cad import export_layout_dxf, validate_layout_dxf

    tmp = path + ".tmp.dxf"
    info = export_layout_dxf(nest_result, parts, tmp, **kw)
    check = validate_layout_dxf(tmp, nest_result)
    nest_result.checks["dxf_geometry"] = (check["ok"], f"re-read {check['parts_read']} parts, "
                                          f"difference {check['symmetric_difference_mm2']:.2f} mm2")
    if not check["ok"]:
        os.remove(tmp)
        raise ValueError(f"Export failed validation: {check}")
    os.replace(tmp, path)
    info["path"] = path
    info["validation"] = check
    return info


def draw_layout(ortho_bgr: np.ndarray, rect, nest_result: NestResult, bed_h_mm: float) -> np.ndarray:
    """New parts on the measured bed image: blue fill, white outline, part id."""
    import cv2

    vis = ortho_bgr.copy()
    over = vis.copy()
    SH = 4
    for p in nest_result.placements:
        g = cad_to_bed(p.geometry, bed_h_mm)
        rings = [g.exterior, *g.interiors]
        pts = [np.round(rect.mm_to_px(np.asarray(r.coords)) * (1 << SH)).astype(np.int32).reshape(-1, 1, 2) for r in rings]
        cv2.fillPoly(over, pts[:1], (200, 110, 20), cv2.LINE_AA, SH)
        for q in pts[1:]:
            cv2.fillPoly(over, [q], (30, 30, 30), cv2.LINE_AA, SH)
    cv2.addWeighted(over, 0.7, vis, 0.3, 0, vis)
    fs = max(0.35, min(vis.shape[:2]) / 1800)
    for p in nest_result.placements:
        g = cad_to_bed(p.geometry, bed_h_mm)
        for r in [g.exterior, *g.interiors]:
            q = np.round(rect.mm_to_px(np.asarray(r.coords)) * (1 << SH)).astype(np.int32).reshape(-1, 1, 2)
            cv2.polylines(vis, [q], True, (255, 255, 255), 1, cv2.LINE_AA, SH)
        cx, cy = rect.mm_to_px(np.asarray(cad_to_bed(shapely.Point(p.x_mm, p.y_mm), bed_h_mm).coords))[0]
        cv2.putText(vis, p.instance_id, (int(cx - 25 * fs), int(cy + 5 * fs)), cv2.FONT_HERSHEY_SIMPLEX, fs,
                    (255, 255, 255), 1, cv2.LINE_AA)
    return vis
