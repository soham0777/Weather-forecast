# Bansali SmartNest - vision + nesting core

**SEE. MEASURE. OPTIMIZE. CUT.** Camera image of the laser bed -> measured material map in machine
millimetres -> DXF parts nested into the material that actually exists -> validated cutting DXF.

This folder is the tested algorithm core (Python). The FastAPI backend and the React operator
screen from the project brief will wrap these functions. Nothing here drives the laser: the output
is a DXF the operator loads into the machine's CAM software.

> Accuracy numbers below come from synthetic scenes with exactly known geometry. They show the
> algorithms are correct. They do **not** show the camera setup at Bansali is good enough. Validate on
> real machine images first (phase 19 of the brief).

## Files

| File | Purpose |
|---|---|
| `smartnest_vision.py` | calibration (clicks / ArUco / lens model), orthographic resampling, segmentation, sub-pixel sheet and cut-out geometry, quality score, operator corrections, material-map DXF |
| `smartnest_cad.py` | DXF part import (LINE/ARC chaining, LWPOLYLINE bulges, CIRCLE, SPLINE, ELLIPSE, blocks, units), validation, quantity detection, cutting-DXF export with true arcs, read-back validation, SVG preview |
| `smartnest_nesting.py` | No-Fit-Polygon / inner-fit kernel, bottom-left placement with rotations, kerf, clearance and edge margins, evolutionary search with a time limit, utilization/waste/remnant metrics, export gate |
| `smartnest_synthetic.py` | photorealistic synthetic beds (posed camera, lens distortion, slats, glare, noise, JPEG) with ground truth |
| `SmartNest_Colab.ipynb` | the 5-click workflow in Google Colab (built by `make_notebook.py`; modules embedded) |
| `benchmark_original_vs_optimized.py` | your original notebook algorithm vs this one on the same images -> `BENCHMARK.md` |
| `tests/` | 48 tests: maths, geometry, DXF, every scenario against ground truth, nesting constraints |

## Run it

**Colab:** upload `SmartNest_Colab.ipynb`, then Runtime -> Run all. `CAPTURE_MODE='demo'` works without a
camera. Switch to `webcam` or `upload` with `CALIBRATION_MODE='click_corners'` for your own bed.

**Locally:**
```bash
pip install "opencv-python-headless>=4.8" "shapely>=2.1" "ezdxf>=1.1" numpy pytest nbformat
pytest -q                                   # 48 tests, about 1 minute
python benchmark_original_vs_optimized.py   # writes BENCHMARK.md
python make_notebook.py                     # rebuilds the Colab notebook after editing a module
```
Tested with OpenCV 4.10 and 5.0, NumPy 2.2 and 2.4, and Shapely 2.1.

## What changed compared with the Colab prototype

| Problem in the prototype | Consequence | Fix |
|---|---|---|
| Ortho image mapped the bed onto `w-1` pixels, converted back with `*2.0` | every length about 0.13% short (2 mm over 1500 mm) | exact pixel-centre convention, `px = mm/s - 0.5` |
| Fixed 2 mm/px ortho | throws away half the resolution of a 1920 px camera on a 1500 mm bed | resolution follows the camera (for example 1.0 mm/px on a 1500 x 950 bed) |
| Only 4 corner points | a homography through 4 points fits them exactly, so its error is invisible | N-point calibration with a measured residual; ArUco markers make it automatic and self-checking |
| No lens-distortion model | on a wide-angle webcam: 27 mm hole-position error, sheet 82 mm too long (measured) | optional chessboard lens model folded into one cached remap |
| `cv2.cornerSubPix` on clicked corners | built for chessboard saddles; can slide along a bed edge | kept, but a point that moves more than 2 px keeps the click |
| Cut-outs searched inside a 24 mm eroded sheet mask | holes near the sheet edge clipped or missed; edge notches invisible | one segmentation, contour hierarchy: holes = voids inside the outline, notches = part of the outline |
| Voids under 150 px (600 mm2) skipped | a D25 bolt hole is treated as solid metal, and a part can be nested over it | every void that survives morphology is excluded (the safe direction) |
| Global threshold `mean_metal - 45` | breaks with vignetting, glare and dark steel | Otsu on luminance or empty-bed reference difference; sub-pixel 50% edge refinement on local levels |
| Raw `contourArea` and `minAreaRect` | area about 0.35% low, rotated dimensions about 1 px high | half-pixel correction, then median-of-edge dimensions |
| Usable = sheet area minus sum of hole areas | wrong when holes overlap or break the edge; no geometry for nesting | `material = sheet.difference(unary_union(cutouts))` (Shapely), MultiPolygon-safe |
| Circle test `circularity >= 0.85` on pixel contours | small circles misclassified; radius taken from area | least-squares circle fit with residual; rectangle and irregular classes |
| DXF written in image coordinates (y down) | cutting file mirrored top-to-bottom on the machine | Y-up millimetres, true CIRCLE entities, file re-read and compared before release |
| No confidence | operator cannot tell a good scan from a bad one | edge-support, separability and ambiguity score, warnings, Confirm/Adjust corrections |

Measured effect (see `BENCHMARK.md`): sheet-area error went from -0.5% to -1.1% (and +25% on dark steel)
to under 0.05%. The D25 bolt hole the original skipped is now found, and circle diameters are within
0.6 mm (the original was out by up to 3.8 mm).

## Accuracy on synthetic ground truth (1.8 mm/px camera resolution)

- sheet and usable area: within 0.05% (0.13% for dark steel with an empty-bed reference)
- sheet length and width: within 0.2 mm; circle diameter within 0.6 mm; rectangle sides within 0.4 mm
- boundary error: median 0.1 mm, 99th percentile up to 1.4 mm, worst case 3.1 mm where an edge runs exactly
  along a bright slat. `usable_region(uncertainty_mm=3.0)` covers this; a test checks that after this margin no
  usable area lies outside the true material in any scene.

## Nesting engine

- **Kernel:** parts are split into convex pieces, and the No-Fit Polygon is the union of the convex hulls of
  their Minkowski sums. It is exact, and a test checks it against brute-force overlap tests. The inner-fit
  region inside the scanned material (holes included) comes from sweeping the part along every material edge.
- **Placement:** candidate positions are the vertices of `IFP - union(NFP)`. The score is bottom-left towards
  the machine origin, which leaves one large remnant. Each chosen position is re-checked with exact Shapely
  containment and distance tests.
- **Constraints:** part gap >= kerf + clearance; part to sheet edge or existing cut-out >= kerf/2 + edge margin
  + measurement uncertainty; per-part allowed rotations; symmetric rotations are skipped automatically.
- **Search:** four seed orders (area, diagonal, irregularity, small-first), then evolutionary mutation of the
  sequence until `max_time_s` or no improvement. The best valid layout is always returned.
- **Objective:** parts placed first, then unplaced area, then compactness (reusable remnant), then cut length.
- **Output:** a `27 of 30`-style message, utilization, waste split into reusable remnant and scrap, cut
  length, pierces, rapid-travel estimate, and a JSON placement list.
- **Export gate:** sheet, cut-outs, parts, inside-sheet, edge margins, no-overlap, clearance and machine bounds
  are all checked, then the written DXF is re-read and compared. Any failure disables export.

## Known limitations

- Validated on synthetic images only. Real glare, dirt, burrs and bent sheets are still untested.
- Sheet thickness parallax is not corrected: the camera sees the top face, the homography is for the bed plane
  (about t x distance-from-camera-axis / camera height, roughly 1-2 mm at the bed edge for 3 mm sheet).
- In intensity mode, dark mild steel on bright slats needs the empty-bed reference image.
- Parts are not nested inside other parts' holes, and there is no common-line cutting yet.
- The optimizer ranks layouts by part count first, so with too many parts it prefers several small parts
  over one large one. Weights are in `NestConfig`.
