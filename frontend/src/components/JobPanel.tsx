import React, { useRef } from 'react';
import type { JobResult, PartQuantity } from '../types';

interface Props {
  jobResult: JobResult | null;
  quantities: PartQuantity[];
  onFileUpload: (file: File) => void;
  onQuantityChange: (partId: string, qty: number) => void;
  isLoading: boolean;
  error: string | null;
}

export function JobPanel({
  jobResult,
  quantities,
  onFileUpload,
  onQuantityChange,
  isLoading,
  error,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  }

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="text-xs font-semibold text-muted tracking-widest uppercase">Job File</div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isLoading ? 'border-accent bg-accent/10' : 'border-border hover:border-accent hover:bg-accent/5'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,.svg"
          className="hidden"
          onChange={handleFileInput}
        />
        {isLoading ? (
          <div>
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-xs text-accent">Processing DXF...</div>
          </div>
        ) : jobResult ? (
          <div>
            <div className="text-success text-lg mb-1">✓</div>
            <div className="text-text text-sm font-semibold">{jobResult.filename}</div>
            <div className="text-muted text-xs">{jobResult.parts_detected} parts detected</div>
            <div className="text-muted text-xs mt-1">Click to change file</div>
          </div>
        ) : (
          <div>
            <div className="text-2xl mb-2">📂</div>
            <div className="text-text text-sm">Drop DXF file here</div>
            <div className="text-muted text-xs mt-1">or click to browse</div>
            <div className="text-muted text-xs">.dxf, .svg supported</div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-danger/20 border border-danger rounded px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {jobResult?.parts && jobResult.parts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted tracking-wider">QUANTITIES</div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {jobResult.parts.map((part) => {
              const qty = quantities.find((q) => q.part_id === part.id)?.quantity ?? 1;
              return (
                <div
                  key={part.id}
                  className="flex items-center gap-2 bg-bed rounded px-2 py-1.5"
                >
                  <div className="flex-1">
                    <div className="text-xs text-text font-semibold">{part.id}</div>
                    <div className="text-xs text-muted">
                      {part.width_mm.toFixed(0)} × {part.height_mm.toFixed(0)} mm
                      · {part.area_mm2.toFixed(0)} mm²
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onQuantityChange(part.id, Math.max(0, qty - 1))}
                      className="w-6 h-6 bg-panel border border-border rounded text-muted hover:text-text hover:border-accent text-xs"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-text">{qty}</span>
                    <button
                      onClick={() => onQuantityChange(part.id, qty + 1)}
                      className="w-6 h-6 bg-panel border border-border rounded text-muted hover:text-text hover:border-accent text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-muted">Total instances</span>
            <span className="text-text font-bold">
              {quantities.reduce((s, q) => s + q.quantity, 0)}
            </span>
          </div>
        </div>
      )}

      {jobResult?.validation_errors && jobResult.validation_errors.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-warning font-semibold">Warnings</div>
          {jobResult.validation_errors.map((e, i) => (
            <div key={i} className="text-xs text-warning">{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
