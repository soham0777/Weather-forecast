from typing import List, Tuple, Union
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.validation import make_valid


def compute_available_material(
    sheet_polygon: Polygon, cutout_polygons: List[Polygon]
) -> Union[Polygon, MultiPolygon]:
    """
    Core operation: subtract existing cut-outs from sheet to get remaining material.

    Returns the actual geometric region available for new parts.
    This may be a Polygon or MultiPolygon if the sheet is fragmented.
    """
    if not sheet_polygon or sheet_polygon.is_empty:
        raise ValueError("Sheet polygon is empty or invalid")

    if not cutout_polygons:
        return sheet_polygon

    valid_cutouts = []
    for c in cutout_polygons:
        if not c.is_valid:
            c = make_valid(c)
        if not c.is_empty:
            valid_cutouts.append(c)

    if not valid_cutouts:
        return sheet_polygon

    union_cutouts = unary_union(valid_cutouts)
    available = sheet_polygon.difference(union_cutouts)

    if not available.is_valid:
        available = make_valid(available)

    return available


def get_largest_available_region(available: Union[Polygon, MultiPolygon]) -> Polygon:
    """Return the largest contiguous region from available material."""
    if isinstance(available, Polygon):
        return available
    if isinstance(available, MultiPolygon):
        return max(available.geoms, key=lambda p: p.area)
    return available


def get_all_available_regions(
    available: Union[Polygon, MultiPolygon],
) -> List[Polygon]:
    """Return all contiguous available regions sorted by area (largest first)."""
    if isinstance(available, Polygon):
        return [available]
    if isinstance(available, MultiPolygon):
        return sorted(available.geoms, key=lambda p: p.area, reverse=True)
    return [available]


def calculate_utilization(
    placed_parts: List[Polygon],
    available_area: float,
) -> Tuple[float, float]:
    """
    Calculate material utilization and waste percentages.
    Returns (utilization_percent, waste_percent).
    """
    if available_area <= 0:
        return 0.0, 100.0
    total_part_area = sum(p.area for p in placed_parts)
    utilization = min(100.0, (total_part_area / available_area) * 100)
    waste = 100.0 - utilization
    return round(utilization, 2), round(waste, 2)
