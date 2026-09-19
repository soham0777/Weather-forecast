"""Tests for pixel-to-millimeter coordinate transforms."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.vision.coordinate_transform import (
    build_scale_transform,
    pixel_to_mm_scale,
    mm_to_pixel_scale,
)


class TestScaleTransform:
    def test_build_transform(self):
        t = build_scale_transform(3000, 6000, 1500, 3000)
        assert t["scale_x"] == 0.5
        assert t["scale_y"] == 0.5

    def test_pixel_to_mm(self):
        t = build_scale_transform(3000, 6000, 1500, 3000)
        pts = [(0, 0), (3000, 0), (3000, 6000), (0, 6000)]
        result = pixel_to_mm_scale(pts, t)
        assert result[0] == (0.0, 0.0)
        assert result[1] == (1500.0, 0.0)
        assert result[2] == (1500.0, 3000.0)

    def test_mm_to_pixel(self):
        t = build_scale_transform(3000, 6000, 1500, 3000)
        pts = [(0.0, 0.0), (1500.0, 3000.0)]
        result = mm_to_pixel_scale(pts, t)
        assert abs(result[0][0] - 0.0) < 0.01
        assert abs(result[1][0] - 3000.0) < 0.01
        assert abs(result[1][1] - 6000.0) < 0.01

    def test_round_trip(self):
        t = build_scale_transform(1000, 2000, 500, 1000)
        original = [(250, 500), (750, 1500)]
        mm_pts = pixel_to_mm_scale(original, t)
        back = mm_to_pixel_scale(mm_pts, t)
        for (ox, oy), (bx, by) in zip(original, back):
            assert abs(ox - bx) < 0.001
            assert abs(oy - by) < 0.001
