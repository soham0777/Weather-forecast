import React from 'react';
import type { ScanResult, OptimizationResult } from '../types';

interface Props {
  scanResult: ScanResult | null;
  optimizationResult: OptimizationResult | null;
  isScanning: boolean;
}

export function BedViewer({ scanResult, optimizationResult, isScanning }: Props) {
  if (optimizationResult?.preview_svg) {
    return (
      <div className="relative bg-bed rounded-lg border border-border overflow-hidden h-full min-h-[400px]">
        <div className="absolute top-2 left-2 text-xs text-muted bg-panel px-2 py-1 rounded">
          OPTIMIZED LAYOUT
        </div>
        <div
          className="w-full h-full flex items-center justify-center p-4"
          dangerouslySetInnerHTML={{ __html: optimizationResult.preview_svg }}
        />
      </div>
    );
  }

  if (scanResult?.visualization_b64) {
    return (
      <div className="relative bg-bed rounded-lg border border-border overflow-hidden h-full min-h-[400px]">
        <div className="absolute top-2 left-2 text-xs text-muted bg-panel px-2 py-1 rounded z-10">
          {scanResult.demo_mode ? 'DEMO MODE' : 'LIVE BED VIEW'}
          {scanResult.confidence > 0 && (
            <span className="ml-2 text-success">
              {(scanResult.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
        <img
          src={`data:image/jpeg;base64,${scanResult.visualization_b64}`}
          alt="Bed scan"
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-2 left-2 flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-400" />
            <span className="text-muted">Sheet boundary</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-400" />
            <span className="text-muted">Cut-outs</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-bed rounded-lg border border-border overflow-hidden h-full min-h-[400px] flex items-center justify-center">
      {isScanning ? (
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-muted text-sm">Scanning laser bed...</div>
          <div className="text-muted text-xs mt-1">Detecting boundaries and cut-outs</div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-4xl mb-3">📷</div>
          <div className="text-muted text-sm">No bed scan yet</div>
          <div className="text-muted text-xs mt-1">Click SCAN BED to begin</div>
          <div className="mt-4 border border-border rounded-lg p-3 mx-6 text-left">
            <div className="text-xs text-muted font-semibold mb-2">LASER BED</div>
            <div className="border-2 border-dashed border-border rounded h-32 flex items-center justify-center">
              <span className="text-muted text-xs">Material sheet area</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
