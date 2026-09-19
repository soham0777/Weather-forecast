from typing import List, Union
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

from .models import PlacementResult

COLLISION_PENALTY = 1_000_000
UNPLACED_PENALTY = 100_000
WASTE_WEIGHT = 1.0
CUT_DISTANCE_WEIGHT = 0.001
FRAGMENTATION_WEIGHT = 10.0


def score_layout(
    placements: List[PlacementResult],
    unplaced_count: int,
    available_area_mm2: float,
    available_material: Union[Polygon, MultiPolygon],
) -> float:
    """
    Lower score is better.
    Primary: minimize unplaced parts.
    Secondary: minimize waste.
    Tertiary: minimize cutting distance.
    """
    if available_area_mm2 <= 0:
        return float("inf")

    placed_area = sum(p.area_mm2 for p in placements)
    waste_area = max(0, available_area_mm2 - placed_area)
    waste_pct = waste_area / available_area_mm2

    cutting_dist = sum(p.polygon_mm.exterior.length for p in placements)

    # Fragmentation: penalize many small remaining regions
    placed_union = unary_union([p.polygon_mm for p in placements]) if placements else None
    if placed_union:
        remaining = available_material.difference(placed_union)
        if hasattr(remaining, "geoms"):
            frag_count = len(list(remaining.geoms))
        else:
            frag_count = 1
    else:
        frag_count = 1

    score = (
        unplaced_count * UNPLACED_PENALTY
        + waste_pct * WASTE_WEIGHT * available_area_mm2
        + cutting_dist * CUT_DISTANCE_WEIGHT
        + max(0, frag_count - 1) * FRAGMENTATION_WEIGHT
    )

    return score


def calculate_utilization(
    placements: List[PlacementResult], available_area_mm2: float
) -> dict:
    if available_area_mm2 <= 0:
        return {"utilization_percent": 0.0, "waste_percent": 100.0, "waste_area_mm2": 0.0}

    placed_area = sum(p.area_mm2 for p in placements)
    utilization = min(100.0, (placed_area / available_area_mm2) * 100)
    waste = 100.0 - utilization
    waste_area = max(0.0, available_area_mm2 - placed_area)

    return {
        "utilization_percent": round(utilization, 2),
        "waste_percent": round(waste, 2),
        "waste_area_mm2": round(waste_area, 2),
    }


def calculate_cutting_distance(placements: List[PlacementResult]) -> float:
    total = 0.0
    for p in placements:
        total += p.polygon_mm.exterior.length
        for interior in p.polygon_mm.interiors:
            total += interior.length
    return round(total, 2)
