from typing import List, Tuple
from shapely.geometry import Polygon
from shapely.strtree import STRtree


class CollisionChecker:
    """Efficient spatial collision detection using STR tree indexing."""

    def __init__(self):
        self._placed: List[Polygon] = []
        self._tree: STRtree = None

    def reset(self):
        self._placed = []
        self._tree = None

    def add_polygon(self, poly: Polygon):
        self._placed.append(poly)
        self._tree = STRtree(self._placed)

    def check_collision(self, candidate: Polygon) -> bool:
        """Return True if candidate overlaps any already-placed polygon."""
        if not self._placed:
            return False
        # Fast bounding box precheck
        candidate_bounds = candidate.bounds
        nearby_indices = self._tree.query(candidate)
        for idx in nearby_indices:
            placed = self._placed[idx]
            if candidate.intersects(placed) and not candidate.touches(placed):
                return True
        return False

    def check_inside_boundary(self, candidate: Polygon, boundary: Polygon) -> bool:
        """Return True if candidate is fully inside the boundary."""
        return boundary.contains(candidate)

    def check_avoids_cutouts(self, candidate: Polygon, cutouts: List[Polygon]) -> bool:
        """Return True if candidate does not overlap any cut-out."""
        for cutout in cutouts:
            if candidate.intersects(cutout) and not candidate.touches(cutout):
                return False
        return True

    def is_placement_valid(
        self,
        candidate: Polygon,
        available_material: Polygon,
        cutouts: List[Polygon] = None,
    ) -> bool:
        """
        Full validity check for a candidate placement:
        1. Inside available material
        2. No overlap with placed parts
        3. No overlap with cut-outs
        """
        if not self.check_inside_boundary(candidate, available_material):
            return False
        if self.check_collision(candidate):
            return False
        if cutouts and not self.check_avoids_cutouts(candidate, cutouts):
            return False
        return True
