import ezdxf
import numpy as np
from typing import List, Tuple, Optional, Dict
from shapely.geometry import Polygon, MultiPolygon, LinearRing
from shapely.ops import unary_union
from shapely.validation import make_valid
import math


def _arc_to_points(
    center: Tuple[float, float],
    radius: float,
    start_angle_deg: float,
    end_angle_deg: float,
    num_segments: int = 32,
) -> List[Tuple[float, float]]:
    start = math.radians(start_angle_deg)
    end = math.radians(end_angle_deg)
    if end < start:
        end += 2 * math.pi
    angles = np.linspace(start, end, num_segments)
    cx, cy = center
    return [(cx + radius * math.cos(a), cy + radius * math.sin(a)) for a in angles]


def _circle_to_points(
    center: Tuple[float, float], radius: float, num_segments: int = 64
) -> List[Tuple[float, float]]:
    cx, cy = center
    angles = np.linspace(0, 2 * math.pi, num_segments, endpoint=False)
    return [(cx + radius * math.cos(a), cy + radius * math.sin(a)) for a in angles]


def _spline_to_points(spline, num_points: int = 64) -> List[Tuple[float, float]]:
    try:
        bspline = spline.construction_tool()
        params = np.linspace(0, 1, num_points)
        pts = [bspline.point(t) for t in params]
        return [(float(p[0]), float(p[1])) for p in pts]
    except Exception:
        # Fallback to control points
        pts = spline.control_points
        return [(float(p[0]), float(p[1])) for p in pts]


def extract_polygons_from_dxf(filepath: str) -> List[dict]:
    """
    Extract closed 2D polygons from a DXF file.

    Returns list of dicts:
    - id: str
    - polygon: Shapely Polygon
    - area_mm2: float
    - perimeter_mm: float
    - bounding_box: (min_x, min_y, max_x, max_y)
    """
    doc = ezdxf.readfile(filepath)
    msp = doc.modelspace()

    raw_polygons = []

    for entity in msp:
        entity_type = entity.dxftype()
        points = None

        if entity_type == "LWPOLYLINE":
            if entity.is_closed:
                points = [(p[0], p[1]) for p in entity.get_points()]
            else:
                # Open polylines: try closing if endpoints are near
                pts = [(p[0], p[1]) for p in entity.get_points()]
                if len(pts) >= 3:
                    dx = pts[0][0] - pts[-1][0]
                    dy = pts[0][1] - pts[-1][1]
                    if math.sqrt(dx**2 + dy**2) < 1.0:
                        points = pts

        elif entity_type == "POLYLINE":
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            if len(pts) >= 3:
                points = pts

        elif entity_type == "CIRCLE":
            center = (entity.dxf.center.x, entity.dxf.center.y)
            radius = entity.dxf.radius
            points = _circle_to_points(center, radius)

        elif entity_type == "SPLINE":
            pts = _spline_to_points(entity)
            if len(pts) >= 3:
                points = pts

        if points and len(points) >= 3:
            try:
                poly = Polygon(points)
                if not poly.is_valid:
                    poly = make_valid(poly)
                if not poly.is_empty and poly.area > 0:
                    raw_polygons.append(poly)
            except Exception:
                continue

    # Organize as outer polygons with potential holes
    result = []
    for i, poly in enumerate(raw_polygons):
        if not poly.is_valid or poly.is_empty:
            continue
        area = poly.area
        bbox = poly.bounds
        perim = poly.exterior.length

        result.append({
            "id": f"part_{i:03d}",
            "polygon": poly,
            "area_mm2": round(area, 2),
            "perimeter_mm": round(perim, 2),
            "bounding_box": bbox,
        })

    return result


def validate_part_polygons(parts: List[dict]) -> Tuple[List[dict], List[str]]:
    """Validate extracted polygons and return valid parts plus error messages."""
    valid = []
    errors = []
    for part in parts:
        poly = part.get("polygon")
        if poly is None:
            errors.append(f"{part['id']}: no polygon extracted")
            continue
        if poly.is_empty:
            errors.append(f"{part['id']}: empty polygon")
            continue
        if part["area_mm2"] < 1.0:
            errors.append(f"{part['id']}: area too small ({part['area_mm2']:.2f} mm²)")
            continue
        if not poly.is_valid:
            errors.append(f"{part['id']}: invalid geometry (self-intersection)")
            continue
        valid.append(part)
    return valid, errors
