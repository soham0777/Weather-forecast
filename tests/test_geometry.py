"""Tests for computational geometry operations."""
import math
import pytest
from shapely.geometry import Polygon

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.geometry.polygon_utils import (
    points_to_shapely,
    compute_area,
    compute_perimeter,
    subtract_cutouts,
    buffer_polygon,
    rotate_polygon,
    polygons_overlap,
    polygon_fits_inside,
)
from app.geometry.boolean_ops import (
    compute_available_material,
    calculate_utilization,
    get_all_available_regions,
)
from app.geometry.collision import CollisionChecker


class TestPolygonUtils:
    def test_rectangle_area(self):
        rect = points_to_shapely([(0, 0), (100, 0), (100, 50), (0, 50)])
        assert rect is not None
        assert abs(compute_area(rect) - 5000.0) < 0.01

    def test_circle_area(self):
        r = 50
        pts = [(r * math.cos(a * math.pi / 180), r * math.sin(a * math.pi / 180)) for a in range(360)]
        circle = points_to_shapely(pts)
        expected = math.pi * r * r
        assert abs(compute_area(circle) - expected) < 10  # ~0.1% tolerance for polygon approx

    def test_polygon_too_few_points_returns_none(self):
        result = points_to_shapely([(0, 0), (1, 0)])
        assert result is None

    def test_perimeter_of_unit_square(self):
        sq = points_to_shapely([(0, 0), (1, 0), (1, 1), (0, 1)])
        assert abs(compute_perimeter(sq) - 4.0) < 0.01

    def test_subtract_cutouts(self):
        sheet = points_to_shapely([(0, 0), (1000, 0), (1000, 1000), (0, 1000)])
        hole = points_to_shapely([(100, 100), (200, 100), (200, 200), (100, 200)])
        remaining = subtract_cutouts(sheet, [hole])
        assert remaining is not None
        expected_area = 1_000_000 - 10_000
        assert abs(remaining.area - expected_area) < 1.0

    def test_subtract_no_cutouts(self):
        sheet = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        remaining = subtract_cutouts(sheet, [])
        assert abs(remaining.area - 10_000) < 0.01

    def test_buffer_polygon_expand(self):
        sq = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        buffered = buffer_polygon(sq, 1.0)
        assert buffered.area > 100

    def test_polygons_overlap_true(self):
        a = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        b = points_to_shapely([(5, 5), (15, 5), (15, 15), (5, 15)])
        assert polygons_overlap(a, b)

    def test_polygons_overlap_false(self):
        a = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        b = points_to_shapely([(20, 20), (30, 20), (30, 30), (20, 30)])
        assert not polygons_overlap(a, b)

    def test_polygon_fits_inside(self):
        outer = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        inner = points_to_shapely([(10, 10), (50, 10), (50, 50), (10, 50)])
        assert polygon_fits_inside(inner, outer)

    def test_polygon_does_not_fit_outside(self):
        outer = points_to_shapely([(0, 0), (50, 0), (50, 50), (0, 50)])
        inner = points_to_shapely([(10, 10), (80, 10), (80, 80), (10, 80)])
        assert not polygon_fits_inside(inner, outer)


class TestBooleanOps:
    def test_available_material_basic(self):
        sheet = points_to_shapely([(0, 0), (1000, 0), (1000, 1000), (0, 1000)])
        c1 = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        c2 = points_to_shapely([(200, 200), (300, 200), (300, 300), (200, 300)])
        available = compute_available_material(sheet, [c1, c2])
        expected = 1_000_000 - 10_000 - 10_000
        assert abs(available.area - expected) < 5.0

    def test_available_material_no_cutouts(self):
        sheet = points_to_shapely([(0, 0), (500, 0), (500, 500), (0, 500)])
        available = compute_available_material(sheet, [])
        assert abs(available.area - 250_000) < 0.01

    def test_utilization_calculation(self):
        p1 = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        p2 = points_to_shapely([(200, 0), (300, 0), (300, 100), (200, 100)])
        util, waste = calculate_utilization([p1, p2], 50_000)
        # Placed: 20000, available: 50000 → 40% util
        assert abs(util - 40.0) < 0.1
        assert abs(waste - 60.0) < 0.1

    def test_utilization_full_coverage(self):
        p = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        util, waste = calculate_utilization([p], 10_000)
        assert abs(util - 100.0) < 0.1
        assert abs(waste - 0.0) < 0.1


class TestCollisionChecker:
    def test_no_collision_empty_bed(self):
        checker = CollisionChecker()
        candidate = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        assert not checker.check_collision(candidate)

    def test_collision_detected(self):
        checker = CollisionChecker()
        placed = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        checker.add_polygon(placed)
        candidate = points_to_shapely([(5, 5), (15, 5), (15, 15), (5, 15)])
        assert checker.check_collision(candidate)

    def test_no_collision_adjacent(self):
        checker = CollisionChecker()
        placed = points_to_shapely([(0, 0), (10, 0), (10, 10), (0, 10)])
        checker.add_polygon(placed)
        candidate = points_to_shapely([(10, 0), (20, 0), (20, 10), (10, 10)])
        # Touching (not overlapping) - should not be a collision
        assert not checker.check_collision(candidate)

    def test_inside_boundary(self):
        checker = CollisionChecker()
        boundary = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        inner = points_to_shapely([(10, 10), (50, 10), (50, 50), (10, 50)])
        assert checker.check_inside_boundary(inner, boundary)

    def test_outside_boundary(self):
        checker = CollisionChecker()
        boundary = points_to_shapely([(0, 0), (50, 0), (50, 50), (0, 50)])
        outside = points_to_shapely([(60, 60), (80, 60), (80, 80), (60, 80)])
        assert not checker.check_inside_boundary(outside, boundary)

    def test_placement_valid(self):
        checker = CollisionChecker()
        material = points_to_shapely([(0, 0), (200, 0), (200, 200), (0, 200)])
        candidate = points_to_shapely([(10, 10), (50, 10), (50, 50), (10, 50)])
        assert checker.is_placement_valid(candidate, material)

    def test_placement_invalid_outside(self):
        checker = CollisionChecker()
        material = points_to_shapely([(0, 0), (100, 0), (100, 100), (0, 100)])
        outside = points_to_shapely([(110, 10), (150, 10), (150, 50), (110, 50)])
        assert not checker.is_placement_valid(outside, material)
