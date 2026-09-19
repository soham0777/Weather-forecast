import React from 'react';
import type { OptimizationResult } from '../types';

interface Props {
  result: OptimizationResult | null;
  isOptimizing: boolean;
  progress: string;
}

function Metric({ label, value, color = 'text-text', large = false }: {
  label: string;
  value: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div className="bg-bed rounded-lg px-3 py-2">
      <div className="text-xs text-muted mb-0.5">{label}</div>
      <div className={`font-bold ${large ? 'text-2xl' : 'text-lg'} ${color}`}>{value}</div>
    </div>
  );
}

export function OptimizationPanel({ result, isOptimizing, progress }: Props) {
  if (isOptimizing) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-muted tracking-widest uppercase">Optimization</div>
        <div className="text-center py-6">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-text text-sm font-semibold">Running Optimizer</div>
          <div className="text-muted text-xs mt-1">{progress || 'Calculating best layout...'}</div>
          <div className="mt-3 text-xs text-muted">
            NFP-based greedy nesting with<br />rotation and clearance constraints
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-muted tracking-widest uppercase">Optimization</div>
        <div className="text-center py-6 text-muted text-xs">
          <div className="text-3xl mb-2">⚙️</div>
          Scan the bed and add a job,<br />then click OPTIMIZE
        </div>
      </div>
    );
  }

  const placedRatio = result.placed_parts / Math.max(result.required_parts, 1);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted tracking-widest uppercase">Results</div>
        {result.success ? (
          <div className="text-xs text-success font-semibold bg-success/20 px-2 py-0.5 rounded">ALL PLACED</div>
        ) : (
          <div className="text-xs text-warning font-semibold bg-warning/20 px-2 py-0.5 rounded">PARTIAL</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Parts Placed"
          value={`${result.placed_parts} / ${result.required_parts}`}
          color={result.success ? 'text-success' : 'text-warning'}
          large
        />
        <Metric
          label="Utilization"
          value={`${result.utilization_percent.toFixed(1)}%`}
          color="text-accent"
          large
        />
        <Metric
          label="Waste"
          value={`${result.waste_percent.toFixed(1)}%`}
          color={result.waste_percent < 15 ? 'text-success' : 'text-warning'}
        />
        <Metric
          label="Cut Distance"
          value={`${(result.cutting_distance_mm / 1000).toFixed(1)} m`}
        />
      </div>

      {/* Utilization bar */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Material Utilization</span>
          <span className="text-accent">{result.utilization_percent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-bed rounded-full h-2">
          <div
            className="bg-accent h-2 rounded-full transition-all"
            style={{ width: `${result.utilization_percent}%` }}
          />
        </div>
      </div>

      {/* Parts placed bar */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Parts Fitted</span>
          <span className={result.success ? 'text-success' : 'text-warning'}>
            {result.placed_parts}/{result.required_parts}
          </span>
        </div>
        <div className="w-full bg-bed rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${result.success ? 'bg-success' : 'bg-warning'}`}
            style={{ width: `${(placedRatio * 100).toFixed(0)}%` }}
          />
        </div>
      </div>

      {result.unplaced_parts > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded px-3 py-2 text-xs text-warning">
          {result.unplaced_parts} part(s) could not fit within the available material.
          Consider using a fresh sheet.
        </div>
      )}

      {result.message && (
        <div className="text-xs text-muted">{result.message}</div>
      )}
    </div>
  );
}
