export type WorkflowStep = 'idle' | 'scanning' | 'scanned' | 'job_loaded' | 'optimizing' | 'optimized' | 'exported';

export interface BedInfo {
  width_mm: number;
  height_mm: number;
}

export interface SheetInfo {
  polygon_mm: [number, number][];
  width_mm: number;
  height_mm: number;
  area_mm2: number;
}

export interface CutoutInfo {
  id: string;
  type: 'circle' | 'rectangle' | 'polygon';
  polygon_mm: [number, number][];
  area_mm2: number;
  centroid_mm: [number, number];
  circularity: number;
}

export interface ScanResult {
  success: boolean;
  confidence: number;
  demo_mode?: boolean;
  scenario?: string;
  bed?: BedInfo;
  sheet?: SheetInfo;
  cutouts: CutoutInfo[];
  available_area_mm2: number;
  total_cutout_area_mm2: number;
  visualization_b64?: string;
  message: string;
}

export interface PartInfo {
  id: string;
  area_mm2: number;
  perimeter_mm: number;
  bounding_box: [number, number, number, number];
  width_mm: number;
  height_mm: number;
}

export interface JobResult {
  job_id: string;
  filename: string;
  file_path: string;
  parts_detected: number;
  parts: PartInfo[];
  validation_errors: string[];
  status: 'ready' | 'error';
  message: string;
}

export interface PlacementInfo {
  part_id: string;
  instance_id: string;
  x_mm: number;
  y_mm: number;
  rotation_deg: number;
  area_mm2: number;
  polygon_coords: [number, number][];
}

export interface OptimizationResult {
  success: boolean;
  demo_mode?: boolean;
  job_id: string;
  required_parts: number;
  placed_parts: number;
  unplaced_parts: number;
  utilization_percent: number;
  waste_percent: number;
  waste_area_mm2: number;
  cutting_distance_mm: number;
  placements: PlacementInfo[];
  preview_svg?: string;
  dxf_parts_found: number;
  validation_errors: string[];
  message: string;
}

export interface PartQuantity {
  part_id: string;
  quantity: number;
}
