"""Tests for nesting optimizer."""
import math
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.geometry.polygon_utils import points_to_shapely
from app.nesting.models import PartGeometry, NestingConfig
from app.nesting.optimizer import optimize_nesting, sort_parts_for_nesting, expand_part_instances
from app.nesting.scoring import calculate_utilization, calculate_cutting_distance, score_layout


class TestSortParts:
    def test_sort_largest_first(self):
        big = PartGeometry("big", points_to_shapely([(0,0),(100,0),(100,100),(0,100)]), 1)
        small = PartGeometry("small", points_to_shapely([(0,0),(10,0),(10,10),(0,10)]), 1)
        medium = PartGeometry("medium", points_to_shapely([(0,0),(50,0),(50,50),(0,50)]), 1)
        sorted_parts = sort_parts_for_nesting([small, medium, big])
        assert sorted_parts[0].part_id == "big"
        assert sorted_parts[-1].part_id == "small"


class TestExpandInstances:
    def test_expand_quantities(self):
        part = PartGeometry("A", points_to_shapely([(0,0),(10,0),(10,10),(0,10)]), 3)
        instances = expand_part_instances([part])
        assert len(instances) == 3
        assert all(inst[0].part_id == "A" for inst in instances)


class TestScoring:
    def test_utilization_full(self):
        p = points_to_shapely([(0,0),(100,0),(100,100),(0,100)])
        from app.nesting.models import PlacementResult
        pr = PlacementResult("A", "A_0", p, 0, 0, 0, 10000)
        result = calculate_utilization([pr], 10000)
        assert abs(result["utilization_percent"] - 100.0) < 0.1
        assert abs(result["waste_percent"] - 0.0) < 0.1

    def test_utilization_half(self):
        p = points_to_shapely([(0,0),(50,0),(50,100),(0,100)])  # 5000
        from app.nesting.models import PlacementResult
        pr = PlacementResult("A", "A_0", p, 0, 0, 0, 5000)
        result = calculate_utilization([pr], 10000)
        assert abs(result["utilization_percent"] - 50.0) < 0.1

    def test_cutting_distance(self):
        p = points_to_shapely([(0,0),(10,0),(10,10),(0,10)])
        from app.nesting.models import PlacementResult
        pr = PlacementResult("A", "A_0", p, 0, 0, 0, 100)
        dist = calculate_cutting_distance([pr])
        assert abs(dist - 40.0) < 0.5  # square perimeter = 40mm


class TestOptimizer:
    def test_place_single_part(self):
        sheet = points_to_shapely([(0,0),(500,0),(500,500),(0,500)])
        part = PartGeometry(
            "square",
            points_to_shapely([(0,0),(50,0),(50,50),(0,50)]),
            1,
            allowed_rotations=[0],
        )
        config = NestingConfig(
            kerf_mm=0, clearance_mm=0, edge_margin_mm=0,
            max_time_seconds=10
        )
        result = optimize_nesting([part], sheet, config)
        assert result.placed_count == 1
        assert result.required_count == 1

    def test_place_multiple_parts(self):
        sheet = points_to_shapely([(0,0),(1000,0),(1000,500),(0,500)])
        part = PartGeometry(
            "sq",
            points_to_shapely([(0,0),(80,0),(80,80),(0,80)]),
            5,
            allowed_rotations=[0],
        )
        config = NestingConfig(
            kerf_mm=0.2, clearance_mm=1.0, edge_margin_mm=2.0,
            max_time_seconds=15
        )
        result = optimize_nesting([part], sheet, config)
        assert result.placed_count >= 1
        assert result.placed_count <= 5

    def test_part_too_large_for_sheet(self):
        sheet = points_to_shapely([(0,0),(100,0),(100,100),(0,100)])
        big_part = PartGeometry(
            "big",
            points_to_shapely([(0,0),(200,0),(200,200),(0,200)]),
            1,
            allowed_rotations=[0],
        )
        config = NestingConfig(max_time_seconds=5)
        result = optimize_nesting([big_part], sheet, config)
        assert result.placed_count == 0
        assert result.unplaced_parts == ["big_inst00"]

    def test_no_parts_returns_success(self):
        sheet = points_to_shapely([(0,0),(100,0),(100,100),(0,100)])
        config = NestingConfig()
        result = optimize_nesting([], sheet, config)
        assert result.success
        assert result.placed_count == 0
