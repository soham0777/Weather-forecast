import numpy as np
from typing import List, Optional, Tuple, Union
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.affinity import rotate, translate
from shapely.ops import unary_union

from .models import PartGeometry, PlacementResult, NestingConfig
from ..geometry.collision import CollisionChecker
from ..geometry.buffering import apply_kerf_and_clearance, apply_edge_margin


def rotate_part(polygon: Polygon, angle_deg: float) -> Polygon:
    """Rotate polygon around its centroid."""
    return rotate(polygon, angle_deg, origin="centroid")


def place_part_at(polygon: Polygon, x: float, y: float) -> Polygon:
    """Translate polygon so its bounding box min corner is at (x, y)."""
    bbox = polygon.bounds
    dx = x - bbox[0]
    dy = y - bbox[1]
    return translate(polygon, xoff=dx, yoff=dy)


def generate_candidate_positions(
    available_material: Union[Polygon, MultiPolygon],
    part_bounds: Tuple[float, float, float, float],
    grid_step_mm: float = 5.0,
) -> List[Tuple[float, float]]:
    """
    Generate a grid of candidate top-left positions within the available material.
    Pruned to positions where the part bounding box could potentially fit.
    """
    mat_bounds = available_material.bounds
    mat_min_x, mat_min_y, mat_max_x, mat_max_y = mat_bounds
    part_w = part_bounds[2] - part_bounds[0]
    part_h = part_bounds[3] - part_bounds[1]

    positions = []
    x = mat_min_x
    while x + part_w <= mat_max_x + grid_step_mm:
        y = mat_min_y
        while y + part_h <= mat_max_y + grid_step_mm:
            positions.append((x, y))
            y += grid_step_mm
        x += grid_step_mm

    return positions


def try_place_part_greedy(
    part_polygon: Polygon,
    available_material: Union[Polygon, MultiPolygon],
    checker: CollisionChecker,
    config: NestingConfig,
    grid_step_mm: float = 5.0,
) -> Optional[PlacementResult]:
    """
    Attempt to place a part using greedy bottom-left placement.
    Tries all allowed rotations and returns first valid placement.
    """
    from .models import PlacementResult

    effective = apply_kerf_and_clearance(part_polygon, config.kerf_mm, config.clearance_mm)
    effective_bounds = effective.bounds
    part_w = effective_bounds[2] - effective_bounds[0]
    part_h = effective_bounds[3] - effective_bounds[1]

    mat_bounds = available_material.bounds
    mat_min_x, mat_min_y, mat_max_x, mat_max_y = mat_bounds

    # Bottom-left fill: scan rows first (y increasing), then x
    y = mat_min_y
    while y + part_h <= mat_max_y + 0.1:
        x = mat_min_x
        while x + part_w <= mat_max_x + 0.1:
            candidate = place_part_at(effective, x, y)
            if checker.is_placement_valid(candidate, available_material):
                # Place the actual part polygon at same offset
                actual_placed = place_part_at(part_polygon, x, y)
                placed_bounds = actual_placed.bounds
                cx = placed_bounds[0]
                cy = placed_bounds[1]
                return PlacementResult(
                    part_id=part_polygon.__class__.__name__,
                    instance_id="",
                    polygon_mm=actual_placed,
                    x_mm=cx,
                    y_mm=cy,
                    rotation_deg=0.0,
                    area_mm2=part_polygon.area,
                )
            x += grid_step_mm
        y += grid_step_mm

    return None


def place_part_with_rotations(
    part: PartGeometry,
    instance_id: str,
    available_material: Union[Polygon, MultiPolygon],
    checker: CollisionChecker,
    config: NestingConfig,
    grid_step_mm: float = 5.0,
) -> Optional[PlacementResult]:
    """Try all allowed rotations and return the best (first valid) placement."""
    for angle in part.allowed_rotations:
        rotated = rotate_part(part.base_polygon, angle)
        effective = apply_kerf_and_clearance(rotated, config.kerf_mm, config.clearance_mm)
        eff_bounds = effective.bounds
        part_w = eff_bounds[2] - eff_bounds[0]
        part_h = eff_bounds[3] - eff_bounds[1]

        mat_bounds = available_material.bounds
        mat_min_x, mat_min_y, mat_max_x, mat_max_y = mat_bounds

        y = mat_min_y
        while y + part_h <= mat_max_y + 0.1:
            x = mat_min_x
            while x + part_w <= mat_max_x + 0.1:
                candidate = place_part_at(effective, x, y)
                if checker.is_placement_valid(candidate, available_material):
                    actual = place_part_at(rotated, x, y)
                    actual_bounds = actual.bounds
                    checker.add_polygon(candidate)
                    return PlacementResult(
                        part_id=part.part_id,
                        instance_id=instance_id,
                        polygon_mm=actual,
                        x_mm=actual_bounds[0],
                        y_mm=actual_bounds[1],
                        rotation_deg=angle,
                        area_mm2=part.area_mm2,
                    )
                x += grid_step_mm
            y += grid_step_mm

    return None
