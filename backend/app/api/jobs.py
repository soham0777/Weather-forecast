import os
import uuid
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse

from ..cad.dxf_reader import extract_polygons_from_dxf, validate_part_polygons

router = APIRouter()

UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload-job")
async def upload_job(
    file: UploadFile = File(...),
):
    """
    Upload a DXF file and extract part geometries.
    Returns detected parts with dimensions and areas.
    """
    if not file.filename.lower().endswith((".dxf", ".svg")):
        raise HTTPException(status_code=400, detail="Only DXF and SVG files are supported")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    job_id = str(uuid.uuid4())[:8]
    safe_name = f"{job_id}_{os.path.basename(file.filename)}"
    save_path = UPLOAD_DIR / safe_name
    with open(save_path, "wb") as f:
        f.write(content)

    raw_parts = extract_polygons_from_dxf(str(save_path))
    valid_parts, errors = validate_part_polygons(raw_parts)

    parts_info = [
        {
            "id": p["id"],
            "area_mm2": p["area_mm2"],
            "perimeter_mm": p["perimeter_mm"],
            "bounding_box": list(p["bounding_box"]),
            "width_mm": round(p["bounding_box"][2] - p["bounding_box"][0], 2),
            "height_mm": round(p["bounding_box"][3] - p["bounding_box"][1], 2),
        }
        for p in valid_parts
    ]

    return JSONResponse(content={
        "job_id": job_id,
        "filename": file.filename,
        "file_path": str(save_path),
        "parts_detected": len(valid_parts),
        "parts": parts_info,
        "validation_errors": errors,
        "status": "ready" if valid_parts else "error",
        "message": f"{len(valid_parts)} parts detected from DXF file." if valid_parts
                   else f"No valid parts found. Errors: {'; '.join(errors)}",
    })


@router.get("/job/{job_id}")
async def get_job(job_id: str):
    """Get job status and details."""
    return JSONResponse(content={"job_id": job_id, "status": "unknown", "message": "Job lookup not implemented yet"})
