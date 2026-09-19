from pydantic import BaseModel
from typing import List, Optional


class PartSpec(BaseModel):
    part_id: str
    quantity: int
    allowed_rotations: List[float] = [0, 45, 90, 135, 180, 225, 270, 315]


class JobRequest(BaseModel):
    job_id: Optional[str] = None
    parts: List[PartSpec] = []
    kerf_mm: float = 0.2
    clearance_mm: float = 1.0
    edge_margin_mm: float = 5.0


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, complete, error
    parts_detected: int = 0
    message: str = ""
