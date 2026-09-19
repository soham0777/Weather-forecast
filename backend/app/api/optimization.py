import json
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

from ..services.optimization_service import run_optimization
from ..schemas.optimization import OptimizationConfig

router = APIRouter()


class OptimizeRequest(BaseModel):
    dxf_file_path: str
    sheet_polygon_mm: List
    cutouts_mm: List = []
    quantities: dict = {}
    config: OptimizationConfig = OptimizationConfig()


@router.post("/optimize")
async def optimize(request: OptimizeRequest):
    """
    Run the nesting optimization algorithm.
    Places parts on available material, minimizing waste.
    """
    if not request.dxf_file_path:
        raise HTTPException(status_code=400, detail="DXF file path is required")

    if not request.sheet_polygon_mm:
        raise HTTPException(status_code=400, detail="Sheet polygon is required. Please scan the bed first.")

    result = run_optimization(
        dxf_path=request.dxf_file_path,
        sheet_polygon_mm=request.sheet_polygon_mm,
        cutouts_mm=request.cutouts_mm,
        quantities=request.quantities,
        config=request.config,
    )

    return JSONResponse(content=result)


@router.get("/optimize/demo")
async def optimize_demo():
    """Run optimization on demo data."""
    from ..services.demo_service import get_demo_optimization_result
    result = get_demo_optimization_result()
    return JSONResponse(content=result)
