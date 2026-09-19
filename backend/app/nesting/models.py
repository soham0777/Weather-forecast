from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from shapely.geometry import Polygon


@dataclass
class PartGeometry:
    part_id: str
    base_polygon: Polygon
    quantity: int
    allowed_rotations: List[float] = field(default_factory=lambda: [0, 45, 90, 135, 180, 225, 270, 315])
    area_mm2: float = 0.0
    perimeter_mm: float = 0.0

    def __post_init__(self):
        if self.area_mm2 == 0.0:
            self.area_mm2 = self.base_polygon.area
        if self.perimeter_mm == 0.0:
            self.perimeter_mm = self.base_polygon.exterior.length


@dataclass
class PlacementResult:
    part_id: str
    instance_id: str
    polygon_mm: Polygon
    x_mm: float
    y_mm: float
    rotation_deg: float
    area_mm2: float

    @property
    def centroid(self) -> Tuple[float, float]:
        c = self.polygon_mm.centroid
        return (c.x, c.y)


@dataclass
class NestingConfig:
    kerf_mm: float = 0.2
    clearance_mm: float = 1.0
    edge_margin_mm: float = 5.0
    rotation_step_deg: float = 45.0
    max_time_seconds: int = 30
    population_size: int = 20
    generations: int = 50
    use_convex_hull_approx: bool = False


@dataclass
class NestingResult:
    placements: List[PlacementResult] = field(default_factory=list)
    unplaced_parts: List[str] = field(default_factory=list)
    required_count: int = 0
    placed_count: int = 0
    utilization_percent: float = 0.0
    waste_percent: float = 0.0
    waste_area_mm2: float = 0.0
    cutting_distance_mm: float = 0.0
    success: bool = False
    message: str = ""
