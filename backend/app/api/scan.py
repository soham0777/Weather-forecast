from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from ..services.scan_service import scan_image

router = APIRouter()


@router.post("/scan")
async def scan_bed(file: UploadFile = File(...)):
    """
    Scan the laser bed from an uploaded camera image.
    Detects bed boundary, sheet boundary, dimensions, and existing cut-outs.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 50MB)")

    result = scan_image(content)
    return JSONResponse(content=result)


@router.post("/scan/demo")
async def scan_demo(scenario: str = "sheet_with_circles"):
    """
    Run scan on a built-in demo image for testing.
    Scenarios: fresh_sheet, sheet_with_circles, sheet_with_mixed_holes, partial_sheet
    """
    from ..services.demo_service import get_demo_scan_result
    result = get_demo_scan_result(scenario)
    return JSONResponse(content=result)
