import React from 'react';
import type { ScanResult } from '../types';

interface Props {
  scanResult: ScanResult | null;
  material: string;
  thickness: string;
  onMaterialChange: (v: string) => void;
  onThicknessChange: (v: string) => void;
}

function fmt(n: number, decimals = 1): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function mm2_to_m2(mm2: number): string {
  return (mm2 / 1_000_000).toFixed(3);
}

export function MaterialPanel({
  scanResult,
  material,
  thickness,
  onMaterialChange,
  onThicknessChange,
}: Props) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
      <div className="text-xs font-semibold text-muted tracking-widest uppercase">Material</div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted block mb-1">Type</label>
          <select
            value={material}
            onChange={(e) => onMaterialChange(e.target.value)}
            className="w-full bg-bed border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option>Aluminum</option>
            <option>Steel</option>
            <option>Stainless Steel</option>
            <option>Mild Steel</option>
            <option>Acrylic</option>
            <option>Plywood</option>
            <option>Copper</option>
            <option>Brass</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">Thickness (mm)</label>
          <select
            value={thickness}
            onChange={(e) => onThicknessChange(e.target.value)}
            className="w-full bg-bed border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            {['1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        {scanResult ? (
          <>
            <StatRow
              label="Sheet"
              value={scanResult.sheet
                ? `${fmt(scanResult.sheet.width_mm)} × ${fmt(scanResult.sheet.height_mm)} mm`
                : '—'}
              highlight
            />
            <StatRow
              label="Sheet Area"
              value={scanResult.sheet ? `${mm2_to_m2(scanResult.sheet.area_mm2)} m²` : '—'}
            />
            <StatRow
              label="Existing Cut-outs"
              value={String(scanResult.cutouts.length)}
            />
            {scanResult.total_cutout_area_mm2 > 0 && (
              <StatRow
                label="Removed Area"
                value={`${mm2_to_m2(scanResult.total_cutout_area_mm2)} m²`}
                color="text-danger"
              />
            )}
            <StatRow
              label="Available Material"
              value={`${mm2_to_m2(scanResult.available_area_mm2)} m²`}
              color="text-success"
              highlight
            />
            <div className="pt-1">
              <div className="text-xs text-muted mb-1">Detection</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-bed rounded-full h-1.5">
                  <div
                    className="bg-success h-1.5 rounded-full"
                    style={{ width: `${(scanResult.confidence * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-xs text-success">
                  {(scanResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted text-xs text-center py-4">
            Scan the bed to measure<br />available material
          </div>
        )}
      </div>

      {scanResult?.sheet && (
        <div className="pt-1 text-xs">
          <div className="text-xs text-muted mb-1">Bed Configuration</div>
          <div className="text-muted">
            Bed: {scanResult.bed?.width_mm ?? 1500} × {scanResult.bed?.height_mm ?? 3000} mm
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight = false,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className={`flex justify-between items-center ${highlight ? 'bg-bed rounded px-2 py-1' : ''}`}>
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold ${color ?? 'text-text'}`}>{value}</span>
    </div>
  );
}
