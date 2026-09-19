# Bansali SmartNest

**Vision-Based Intelligent Laser Cutting & Material Optimization Platform**

> SEE. MEASURE. OPTIMIZE. CUT.

## Overview

Bansali SmartNest uses a camera mounted over the laser-cutting bed to:

1. Detect the machine boundary and the actual sheet boundary
2. Calculate available material area
3. Identify previously cut regions
4. Create a digital map of remaining usable material
5. Automatically nest required parts for maximum yield and minimum waste
6. Export a machine-ready DXF cutting file

**Core principle:** _"We do not optimize an ideal sheet. We optimize the material that actually exists on the machine."_

## Architecture

```
CAMERA
  ↓
Camera Calibration + Perspective Correction (OpenCV)
  ↓
Laser-Bed Boundary Detection
  ↓
Sheet Boundary Detection (Canny + Contours)
  ↓
Existing Cut-Out Detection (Contour Hierarchy + Hough Circles)
  ↓
Pixel → Millimeter Transform (Homography/Scale)
  ↓
Digital Material Map (Shapely Polygon)
  ↓
  Sheet Polygon − Union(Cut-Outs) = Available Material
  ↓
DXF Part Import (ezdxf)
  ↓
Nesting Optimizer (Greedy Bottom-Left + Rotation + Scoring)
  ↓
Validated Optimized Layout
  ↓
DXF Export (ezdxf)
  ↓
LASER CUTTER
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python + FastAPI + Pydantic |
| Computer Vision | OpenCV + NumPy |
| Geometry | Shapely |
| CAD | ezdxf |
| Testing | pytest |

## 5-Click Workflow

1. **SCAN BED** — Upload a camera image. System detects bed, sheet, dimensions, cut-outs.
2. **CONFIRM MATERIAL** — Select material type and thickness.
3. **ADD JOB** — Upload DXF file with parts and set quantities.
4. **OPTIMIZE** — System automatically nests parts, minimizes waste.
5. **EXPORT** — Download the machine-ready DXF cutting file.

## Project Structure

```
laser-nesting/
├── backend/
│   └── app/
│       ├── vision/          # Camera calibration, edge detection, sheet/cutout detection
│       ├── geometry/        # Polygon math, boolean ops, collision detection
│       ├── nesting/         # Optimizer, placement, scoring
│       ├── cad/             # DXF reader/exporter, SVG preview
│       ├── services/        # Scan service, optimization service, demo mode
│       ├── api/             # FastAPI routes
│       └── schemas/         # Pydantic models
├── frontend/
│   └── src/
│       ├── components/      # StatusBar, BedViewer, MaterialPanel, JobPanel, OptimizationPanel
│       ├── pages/           # SmartNest (single screen)
│       ├── services/        # API client
│       └── types/           # TypeScript types
├── data/
│   ├── calibration/         # Camera calibration config
│   ├── test_images/         # Synthetic test scenarios
│   ├── uploads/             # Uploaded DXF files
│   └── exports/             # Generated cutting files
└── tests/                   # pytest test suite
```

## Installation

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Running Tests

```bash
python -m pytest tests/ -v
```

## Computer Vision Pipeline

### Sheet Detection

1. Preprocess: grayscale → CLAHE contrast → Gaussian blur
2. Edge detection: Canny (auto thresholds)
3. Dilation to close gaps
4. Contour extraction → filter by area/aspect ratio
5. Largest contour = sheet boundary
6. Polygon approximation for clean geometry
7. Confidence score based on solidity × area ratio

### Cut-Out Detection

1. Preprocess: bilateral filter (preserves edges)
2. Otsu threshold → invert → dark regions inside sheet
3. Morphological close + open (noise removal)
4. Contour hierarchy to find holes
5. Classify by circularity: circle (>0.85), rectangle (4 corners), polygon
6. Convert to Shapely polygons

### Pixel → Millimeter

- Simple scale: `mm = pixel × (bed_mm / image_px)`
- Homography: `perspectiveTransform(pixel_point, H)` for lens-distorted setups
- Calibrated once, stored in `data/calibration/calibration.json`

## Nesting Algorithm

**Primary objective:** Maximize required parts placed.
**Secondary objective:** Minimize material waste.

### Approach

1. Sort parts: largest area first
2. For each part, try all allowed rotations (configurable step, default 45°)
3. Bottom-left fill: scan y→x at configurable grid step
4. Validity check: inside available material + no overlap + clearance maintained
5. Multiple grid steps (15mm → 10mm → 5mm) for progressive refinement
6. Random restart with shuffled part order

### Scoring (lower = better)

```
score = unplaced_count × 100,000
      + waste_area × 1.0
      + cutting_distance × 0.001
      + fragmentation_penalty × 10
```

### Constraints

- Parts cannot overlap (Shapely intersection check)
- Parts must fit inside detected sheet boundary
- Parts must avoid existing cut-outs
- Kerf + clearance buffer applied to all parts
- Edge margin applied to sheet boundary
- All geometry validated before export

## Optimization Configuration

| Parameter | Default | Description |
|---|---|---|
| `kerf_mm` | 0.2 | Laser beam width |
| `clearance_mm` | 1.0 | Minimum gap between parts |
| `edge_margin_mm` | 5.0 | Sheet edge exclusion zone |
| `rotation_step_deg` | 45 | Rotation increment |
| `max_time_seconds` | 30 | Optimization time limit |

## Demo Mode

No camera or DXF required:
- POST `/api/scan/demo?scenario=sheet_with_circles`
- GET `/api/optimize/demo`

Available scenarios: `fresh_sheet`, `sheet_with_circles`, `sheet_with_mixed_holes`, `partial_sheet`

## Limitations (Current Prototype)

- Sheet detection works best on high-contrast sheets against a dark bed
- Camera must be roughly overhead (minimal perspective distortion without homography)
- Nesting uses greedy algorithm; not globally optimal for complex shapes
- SPLINE to polygon conversion is approximate
- No real-time camera feed (requires image upload)

## Future Integration

- Live camera feed via OpenCV VideoCapture
- Laser cutter machine API / G-code export
- AI segmentation fallback for difficult materials (reflective, dirty)
- NFP-based collision detection for irregular shapes
- Multi-sheet job planning
- Material inventory database
