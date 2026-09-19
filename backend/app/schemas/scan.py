from pydantic import BaseModel
from typing import List, Optional, Tuple


class PolygonCoords(BaseModel):
    points: List[Tuple[float, float]]


class CutoutInfo(BaseModel):
    id: str
    type: str  # circle, rectangle, polygon
    area_mm2: float
    centroid_x_mm: float
    centroid_y_mm: float
    polygon: PolygonCoords


class ScanResult(BaseModel):
    success: bool
    confidence: float
    bed: Optional[dict] = None
    sheet: Optional[dict] = None
    cutouts: List[CutoutInfo] = []
    available_area_mm2: float = 0
    message: str = ""
    visualization_b64: Optional[str] = None


class CalibrationConfig(BaseModel):
    bed_width_mm: float = 1500
    bed_height_mm: float = 3000
    pixel_per_mm_x: float = 1.0
    pixel_per_mm_y: float = 1.0
    homography: Optional[List[List[float]]] = None
