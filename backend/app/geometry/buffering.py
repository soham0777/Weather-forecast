from typing import List
from shapely.geometry import Polygon
from shapely.validation import make_valid


def apply_kerf_and_clearance(
    part_polygon: Polygon,
    kerf_mm: float = 0.2,
    clearance_mm: float = 1.0,
) -> Polygon:
    """
    Expand part polygon by (kerf/2 + clearance) to represent physical space needed.
    This effective polygon is used for placement and collision checking.
    The kerf represents material removed by the laser beam.
    """
    expansion = kerf_mm / 2.0 + clearance_mm
    buffered = part_polygon.buffer(expansion, join_style=2, cap_style=3)
    if not buffered.is_valid:
        buffered = make_valid(buffered)
    return buffered


def apply_edge_margin(
    sheet_polygon: Polygon,
    edge_margin_mm: float = 5.0,
) -> Polygon:
    """
    Shrink the sheet polygon by edge_margin to prevent parts from being placed
    too close to the sheet edge.
    """
    shrunk = sheet_polygon.buffer(-edge_margin_mm, join_style=2)
    if not shrunk.is_valid:
        shrunk = make_valid(shrunk)
    return shrunk


def shrink_part_for_nesting(
    part_polygon: Polygon,
    shrink_amount: float,
) -> Polygon:
    """Shrink a part slightly to create clearance during nesting."""
    return part_polygon.buffer(-shrink_amount, join_style=2)
