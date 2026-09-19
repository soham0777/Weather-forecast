from pydantic import BaseModel
from typing import List, Optional


class Placement(BaseModel):
    part_id: str
    instance_id: str
    x_mm: float
    y_mm: float
    rotation_deg: float
    area_mm2: float


class OptimizationResult(BaseModel):
    job_id: str
    success: bool
    required_parts: int
    placed_parts: int
    unplaced_parts: int
    utilization_percent: float
    waste_percent: float
    waste_area_mm2: float
    cutting_distance_mm: float
    placements: List[Placement] = []
    layouts_count: int = 1
    message: str = ""
    preview_svg: Optional[str] = None


class OptimizationConfig(BaseModel):
    max_time_seconds: int = 30
    rotation_step_deg: float = 45.0
    population_size: int = 50
    generations: int = 100
    kerf_mm: float = 0.2
    clearance_mm: float = 1.0
    edge_margin_mm: float = 5.0
