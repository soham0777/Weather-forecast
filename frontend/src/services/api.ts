import type { ScanResult, JobResult, OptimizationResult } from '../types';

const BASE = '/api';

export async function scanBed(file: File): Promise<ScanResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/scan`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
  return res.json();
}

export async function scanDemo(scenario: string = 'sheet_with_circles'): Promise<ScanResult> {
  const res = await fetch(`${BASE}/scan/demo?scenario=${scenario}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Demo scan failed: ${res.statusText}`);
  return res.json();
}

export async function uploadJob(file: File): Promise<JobResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/upload-job`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function runOptimization(payload: {
  dxf_file_path: string;
  sheet_polygon_mm: [number, number][];
  cutouts_mm: object[];
  quantities: Record<string, number>;
  config?: object;
}): Promise<OptimizationResult> {
  const res = await fetch(`${BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Optimization failed: ${res.statusText}`);
  return res.json();
}

export async function runDemoOptimization(): Promise<OptimizationResult> {
  const res = await fetch(`${BASE}/optimize/demo`);
  if (!res.ok) throw new Error(`Demo optimization failed: ${res.statusText}`);
  return res.json();
}

export async function exportCuttingFile(payload: {
  job_id: string;
  placements: object[];
  sheet_polygon_mm: [number, number][];
  cutouts_mm: object[];
}): Promise<{ success: boolean; job_id: string; filename: string; message: string }> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  return res.json();
}

export function getDownloadUrl(jobId: string): string {
  return `${BASE}/export/${jobId}/download`;
}
