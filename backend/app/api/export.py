import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List

from ..cad.dxf_exporter import export_optimized_layout

router = APIRouter()

EXPORT_DIR = Path(__file__).parent.parent.parent.parent / "data" / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


class ExportRequest(BaseModel):
    job_id: str
    placements: List[dict]
    sheet_polygon_mm: List
    cutouts_mm: List = []


@router.post("/export")
async def export_cutting_file(request: ExportRequest):
    """
    Export the optimized nesting layout as a machine-ready DXF file.
    Validates all geometry before allowing export.
    """
    from shapely.geometry import Polygon

    # Validation
    errors = _validate_export(request)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    output_path = str(EXPORT_DIR / f"optimized_{request.job_id}.dxf")

    # Rebuild Shapely polygons from placement data
    placement_polys = []
    for p in request.placements:
        coords = p.get("polygon_coords", [])
        if len(coords) >= 3:
            poly = Polygon(coords)
            placement_polys.append({
                "polygon_mm": poly,
                "part_id": p.get("part_id", ""),
            })

    export_optimized_layout(
        placements=placement_polys,
        sheet_polygon_mm=request.sheet_polygon_mm,
        cutouts_mm=[c.get("polygon_mm", c) if isinstance(c, dict) else c for c in request.cutouts_mm],
        output_path=output_path,
    )

    return JSONResponse(content={
        "success": True,
        "job_id": request.job_id,
        "export_path": output_path,
        "filename": f"optimized_{request.job_id}.dxf",
        "message": "Cutting file ready for download.",
    })


@router.get("/export/{job_id}/download")
async def download_export(job_id: str):
    """Download the exported DXF cutting file."""
    file_path = EXPORT_DIR / f"optimized_{job_id}.dxf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found. Run optimization first.")

    return FileResponse(
        path=str(file_path),
        filename=f"bansali_smartnest_{job_id}.dxf",
        media_type="application/octet-stream",
    )


def _validate_export(request: ExportRequest) -> List[str]:
    errors = []
    if not request.placements:
        errors.append("No placements to export")
    if not request.sheet_polygon_mm:
        errors.append("Sheet polygon is missing")
    for i, p in enumerate(request.placements):
        if not p.get("polygon_coords"):
            errors.append(f"Placement {i} missing polygon coordinates")
    return errors
