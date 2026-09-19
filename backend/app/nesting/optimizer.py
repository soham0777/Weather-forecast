import time
import random
from typing import List, Tuple, Union, Optional
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

from .models import PartGeometry, NestingConfig, NestingResult, PlacementResult
from .placement import place_part_with_rotations
from .scoring import score_layout, calculate_utilization, calculate_cutting_distance
from ..geometry.collision import CollisionChecker
from ..geometry.buffering import apply_edge_margin
from ..geometry.boolean_ops import get_all_available_regions


def sort_parts_for_nesting(parts: List[PartGeometry]) -> List[PartGeometry]:
    """Sort parts: largest area first (decreasing difficulty heuristic)."""
    return sorted(parts, key=lambda p: p.area_mm2, reverse=True)


def expand_part_instances(parts: List[PartGeometry]) -> List[Tuple[PartGeometry, str]]:
    """Create one entry per required instance."""
    instances = []
    for part in parts:
        for i in range(part.quantity):
            instance_id = f"{part.part_id}_inst{i:02d}"
            instances.append((part, instance_id))
    return instances


def run_greedy_nesting(
    part_instances: List[Tuple[PartGeometry, str]],
    available_material: Union[Polygon, MultiPolygon],
    config: NestingConfig,
    grid_step_mm: float = 10.0,
) -> NestingResult:
    """
    Greedy bottom-left nesting:
    Place each part in the first valid position found, scanning row by row.
    """
    checker = CollisionChecker()
    placements = []
    unplaced = []

    # Apply edge margin to available material
    if isinstance(available_material, Polygon):
        safe_area = apply_edge_margin(available_material, config.edge_margin_mm)
    else:
        regions = get_all_available_regions(available_material)
        safe_area = max(regions, key=lambda p: p.area) if regions else available_material
        safe_area = apply_edge_margin(safe_area, config.edge_margin_mm)

    for part, instance_id in part_instances:
        result = place_part_with_rotations(
            part, instance_id, safe_area, checker, config, grid_step_mm
        )
        if result:
            placements.append(result)
        else:
            unplaced.append(instance_id)

    available_area = available_material.area if hasattr(available_material, "area") else 0
    util = calculate_utilization(placements, available_area)
    cut_dist = calculate_cutting_distance(placements)

    return NestingResult(
        placements=placements,
        unplaced_parts=unplaced,
        required_count=len(part_instances),
        placed_count=len(placements),
        utilization_percent=util["utilization_percent"],
        waste_percent=util["waste_percent"],
        waste_area_mm2=util["waste_area_mm2"],
        cutting_distance_mm=cut_dist,
        success=len(unplaced) == 0,
        message=(
            f"All {len(placements)} parts placed successfully."
            if len(unplaced) == 0
            else f"{len(placements)} of {len(part_instances)} parts placed. {len(unplaced)} could not fit."
        ),
    )


def optimize_nesting(
    parts: List[PartGeometry],
    available_material: Union[Polygon, MultiPolygon],
    config: NestingConfig,
) -> NestingResult:
    """
    Main optimization entry point.
    1. Sort parts by area (largest first).
    2. Try greedy nesting with different grid steps.
    3. Return best result within time limit.
    """
    start_time = time.time()

    sorted_parts = sort_parts_for_nesting(parts)
    instances = expand_part_instances(sorted_parts)

    total_required = len(instances)
    if total_required == 0:
        return NestingResult(
            required_count=0,
            placed_count=0,
            success=True,
            message="No parts to nest.",
        )

    best_result: Optional[NestingResult] = None
    best_score = float("inf")

    available_area = available_material.area

    # Try multiple grid resolutions
    grid_steps = [15.0, 10.0, 5.0]

    for grid_step in grid_steps:
        elapsed = time.time() - start_time
        if elapsed > config.max_time_seconds * 0.8:
            break

        result = run_greedy_nesting(instances, available_material, config, grid_step)
        score = score_layout(
            result.placements,
            len(result.unplaced_parts),
            available_area,
            available_material,
        )

        if best_result is None or score < best_score:
            best_result = result
            best_score = score

        if len(result.unplaced_parts) == 0:
            break

    # Random restart with shuffled order to potentially improve
    random.seed(42)
    for attempt in range(3):
        elapsed = time.time() - start_time
        if elapsed > config.max_time_seconds * 0.9:
            break

        shuffled = instances[:]
        random.shuffle(shuffled)

        result = run_greedy_nesting(shuffled, available_material, config, 10.0)
        score = score_layout(
            result.placements,
            len(result.unplaced_parts),
            available_area,
            available_material,
        )

        if score < best_score:
            best_result = result
            best_score = score

    return best_result
