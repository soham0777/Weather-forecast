import ezdxf
from typing import List, Tuple, Dict
from shapely.geometry import Polygon


def export_optimized_layout(
    placements: List[dict],
    sheet_polygon_mm: List[Tuple[float, float]],
    cutouts_mm: List[List[Tuple[float, float]]],
    output_path: str,
    drawing_units: str = "mm",
) -> str:
    """
    Export the optimized nesting layout as a DXF file.

    placements: list of {polygon_mm: Polygon, part_id: str, rotation_deg: float, x_mm: float, y_mm: float}
    sheet_polygon_mm: outer sheet boundary as list of (x, y) in mm
    cutouts_mm: list of existing cut-out polygons as lists of (x, y) in mm
    output_path: file path to write DXF
    """
    doc = ezdxf.new(dxfversion="R2010")
    msp = doc.modelspace()

    # Layer definitions
    doc.layers.add("SHEET_BOUNDARY", color=7)  # white
    doc.layers.add("EXISTING_CUTOUTS", color=1)  # red
    doc.layers.add("NEW_PARTS", color=3)  # green
    doc.layers.add("ANNOTATIONS", color=2)  # yellow

    # Draw sheet boundary
    if sheet_polygon_mm:
        pts = [(x, y) for x, y in sheet_polygon_mm]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        msp.add_lwpolyline(pts, dxfattribs={"layer": "SHEET_BOUNDARY", "closed": True})

    # Draw existing cut-outs
    for cutout_pts in cutouts_mm:
        if len(cutout_pts) >= 3:
            pts = [(x, y) for x, y in cutout_pts]
            if pts[0] != pts[-1]:
                pts.append(pts[0])
            msp.add_lwpolyline(pts, dxfattribs={"layer": "EXISTING_CUTOUTS", "closed": True})

    # Draw new part placements
    for placement in placements:
        poly: Polygon = placement.get("polygon_mm")
        if poly is None:
            continue
        coords = list(poly.exterior.coords)
        pts = [(x, y) for x, y in coords]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        msp.add_lwpolyline(
            pts,
            dxfattribs={"layer": "NEW_PARTS", "closed": True},
        )
        # Add label
        centroid = poly.centroid
        msp.add_text(
            placement.get("part_id", ""),
            dxfattribs={
                "layer": "ANNOTATIONS",
                "height": 5,
                "insert": (centroid.x, centroid.y),
            },
        )

    doc.saveas(output_path)
    return output_path
