from typing import List, Tuple, Optional
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, Point, LinearRing
from shapely.ops import unary_union
from shapely.validation import make_valid


def points_to_shapely(points: List[Tuple[float, float]]) -> Optional[Polygon]:
    """Convert list of (x,y) tuples to a Shapely Polygon."""
    if len(points) < 3:
        return None
    poly = Polygon(points)
    if not poly.is_valid:
        poly = make_valid(poly)
    if poly.is_empty:
        return None
    return poly


def shapely_to_points(poly: Polygon) -> List[Tuple[float, float]]:
    """Convert Shapely Polygon exterior to list of (x,y) tuples."""
    return list(poly.exterior.coords)


def compute_area(poly: Polygon) -> float:
    return poly.area if poly else 0.0


def compute_centroid(poly: Polygon) -> Tuple[float, float]:
    c = poly.centroid
    return (c.x, c.y)


def compute_bounding_box(poly: Polygon) -> Tuple[float, float, float, float]:
    """Returns (min_x, min_y, max_x, max_y)."""
    return poly.bounds


def compute_perimeter(poly: Polygon) -> float:
    if not poly:
        return 0.0
    total = poly.exterior.length
    for interior in poly.interiors:
        total += interior.length
    return total


def buffer_polygon(poly: Polygon, distance: float) -> Polygon:
    """Expand (positive) or shrink (negative) polygon by distance."""
    result = poly.buffer(distance, join_style=2)
    if not result.is_valid:
        result = make_valid(result)
    return result


def rotate_polygon(poly: Polygon, angle_deg: float, origin: str = "centroid") -> Polygon:
    from shapely.affinity import rotate
    return rotate(poly, angle_deg, origin=origin)


def translate_polygon(poly: Polygon, dx: float, dy: float) -> Polygon:
    from shapely.affinity import translate
    return translate(poly, xoff=dx, yoff=dy)


def polygons_overlap(poly_a: Polygon, poly_b: Polygon) -> bool:
    return poly_a.intersects(poly_b) and not poly_a.touches(poly_b)


def polygon_fits_inside(inner: Polygon, outer: Polygon) -> bool:
    return outer.contains(inner)


def subtract_cutouts(sheet: Polygon, cutouts: List[Polygon]) -> Polygon:
    """Subtract cut-out polygons from the sheet polygon."""
    if not cutouts:
        return sheet
    union_cutouts = unary_union(cutouts)
    remaining = sheet.difference(union_cutouts)
    if not remaining.is_valid:
        remaining = make_valid(remaining)
    return remaining


def union_polygons(polys: List[Polygon]) -> Polygon:
    return unary_union(polys)


def get_polygon_holes(poly: Polygon) -> List[List[Tuple[float, float]]]:
    return [list(interior.coords) for interior in poly.interiors]
