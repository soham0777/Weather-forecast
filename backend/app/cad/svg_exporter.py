from typing import List, Tuple
from shapely.geometry import Polygon
import math


def polygons_to_svg_path(polygon: Polygon) -> str:
    coords = list(polygon.exterior.coords)
    if not coords:
        return ""
    d = f"M {coords[0][0]:.2f},{coords[0][1]:.2f}"
    for x, y in coords[1:]:
        d += f" L {x:.2f},{y:.2f}"
    d += " Z"
    for interior in polygon.interiors:
        icoords = list(interior.coords)
        if icoords:
            d += f" M {icoords[0][0]:.2f},{icoords[0][1]:.2f}"
            for x, y in icoords[1:]:
                d += f" L {x:.2f},{y:.2f}"
            d += " Z"
    return d


def generate_preview_svg(
    sheet_polygon_mm: List[Tuple[float, float]],
    cutouts_mm: List[List[Tuple[float, float]]],
    placements: List[dict],
    svg_width_px: int = 900,
    svg_height_px: int = 600,
) -> str:
    """Generate SVG preview of the optimized nesting layout."""
    if not sheet_polygon_mm:
        return "<svg></svg>"

    all_x = [p[0] for p in sheet_polygon_mm]
    all_y = [p[1] for p in sheet_polygon_mm]
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)

    sheet_w = max_x - min_x
    sheet_h = max_y - min_y
    if sheet_w == 0 or sheet_h == 0:
        return "<svg></svg>"

    margin = 20
    scale_x = (svg_width_px - 2 * margin) / sheet_w
    scale_y = (svg_height_px - 2 * margin) / sheet_h
    scale = min(scale_x, scale_y)

    def transform_point(x, y):
        px = margin + (x - min_x) * scale
        py = margin + (y - min_y) * scale
        return px, py

    def pts_to_svg_polygon(pts):
        transformed = [transform_point(x, y) for x, y in pts]
        return " ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in transformed)

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width_px}" height="{svg_height_px}" viewBox="0 0 {svg_width_px} {svg_height_px}">',
        '<rect width="100%" height="100%" fill="#1a1a2e"/>',
    ]

    # Sheet boundary
    sheet_pts = pts_to_svg_polygon(sheet_polygon_mm)
    lines.append(f'<polygon points="{sheet_pts}" fill="#2a3f5f" stroke="#4a90d9" stroke-width="2"/>')

    # Existing cut-outs
    for cutout in cutouts_mm:
        c_pts = pts_to_svg_polygon(cutout)
        lines.append(f'<polygon points="{c_pts}" fill="#3d1f1f" stroke="#e74c3c" stroke-width="1.5"/>')

    # Placed parts
    colors = ["#27ae60", "#2ecc71", "#1abc9c", "#16a085"]
    for i, placement in enumerate(placements):
        poly: Polygon = placement.get("polygon_mm")
        if poly is None:
            continue
        pts = list(poly.exterior.coords)
        p_pts = pts_to_svg_polygon(pts)
        color = colors[i % len(colors)]
        lines.append(
            f'<polygon points="{p_pts}" fill="{color}" fill-opacity="0.7" stroke="#ffffff" stroke-width="0.8"/>'
        )

    lines.append("</svg>")
    return "\n".join(lines)
