import uuid
from typing import List, Optional
from pathlib import Path
from shapely.geometry import Polygon

from ..cad.dxf_reader import extract_polygons_from_dxf, validate_part_polygons
from ..geometry.polygon_utils import points_to_shapely, subtract_cutouts
from ..geometry.boolean_ops import compute_available_material
from ..nesting.models import PartGeometry, NestingConfig, NestingResult
from ..nesting.optimizer import optimize_nesting
from ..cad.svg_exporter import generate_preview_svg
from ..schemas.optimization import OptimizationConfig


def run_optimization(
    dxf_path: str,
    sheet_polygon_mm: List,
    cutouts_mm: List,
    quantities: dict,
    config: OptimizationConfig,
) -> dict:
    """
    Full optimization pipeline:
    1. Load DXF parts
    2. Compute available material
    3. Run nesting optimizer
    4. Return structured result
    """
    job_id = str(uuid.uuid4())[:8]

    # Load parts from DXF
    raw_parts = extract_polygons_from_dxf(dxf_path)
    valid_parts, errors = validate_part_polygons(raw_parts)

    if not valid_parts:
        return {
            "success": False,
            "job_id": job_id,
            "message": f"No valid parts extracted from DXF. Errors: {'; '.join(errors)}",
            "required_parts": 0,
            "placed_parts": 0,
        }

    # Build PartGeometry objects
    part_geometries = []
    for p in valid_parts:
        qty = quantities.get(p["id"], 1)
        allowed_rotations = list(range(0, 360, int(config.rotation_step_deg)))
        pg = PartGeometry(
            part_id=p["id"],
            base_polygon=p["polygon"],
            quantity=qty,
            allowed_rotations=allowed_rotations,
            area_mm2=p["area_mm2"],
            perimeter_mm=p["perimeter_mm"],
        )
        part_geometries.append(pg)

    # Compute available material
    sheet_poly = points_to_shapely(sheet_polygon_mm) if sheet_polygon_mm else None
    if sheet_poly is None:
        return {
            "success": False,
            "job_id": job_id,
            "message": "Invalid sheet geometry. Please re-scan the bed.",
        }

    cutout_polys = []
    for c in cutouts_mm:
        cp = points_to_shapely(c.get("polygon_mm", c) if isinstance(c, dict) else c)
        if cp:
            cutout_polys.append(cp)

    available = compute_available_material(sheet_poly, cutout_polys)

    nest_config = NestingConfig(
        kerf_mm=config.kerf_mm,
        clearance_mm=config.clearance_mm,
        edge_margin_mm=config.edge_margin_mm,
        rotation_step_deg=config.rotation_step_deg,
        max_time_seconds=config.max_time_seconds,
    )

    # Run optimizer
    result: NestingResult = optimize_nesting(part_geometries, available, nest_config)

    # Generate SVG preview
    sheet_pts = list(sheet_poly.exterior.coords) if sheet_poly else []
    cutout_pts_list = [list(cp.exterior.coords) for cp in cutout_polys]
    placements_for_svg = [
        {"polygon_mm": p.polygon_mm, "part_id": p.part_id}
        for p in result.placements
    ]
    preview_svg = generate_preview_svg(sheet_pts, cutout_pts_list, placements_for_svg)

    placements_serialized = [
        {
            "part_id": p.part_id,
            "instance_id": p.instance_id,
            "x_mm": round(p.x_mm, 2),
            "y_mm": round(p.y_mm, 2),
            "rotation_deg": p.rotation_deg,
            "area_mm2": round(p.area_mm2, 2),
            "polygon_coords": list(p.polygon_mm.exterior.coords),
        }
        for p in result.placements
    ]

    return {
        "success": result.success,
        "job_id": job_id,
        "required_parts": result.required_count,
        "placed_parts": result.placed_count,
        "unplaced_parts": result.required_count - result.placed_count,
        "utilization_percent": result.utilization_percent,
        "waste_percent": result.waste_percent,
        "waste_area_mm2": result.waste_area_mm2,
        "cutting_distance_mm": result.cutting_distance_mm,
        "placements": placements_serialized,
        "preview_svg": preview_svg,
        "dxf_parts_found": len(valid_parts),
        "validation_errors": errors,
        "message": result.message,
    }
