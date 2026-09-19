import React, { useState, useRef } from 'react';
import { StatusBar } from '../components/StatusBar';
import { BedViewer } from '../components/BedViewer';
import { MaterialPanel } from '../components/MaterialPanel';
import { JobPanel } from '../components/JobPanel';
import { OptimizationPanel } from '../components/OptimizationPanel';
import type {
  WorkflowStep,
  ScanResult,
  JobResult,
  OptimizationResult,
  PartQuantity,
} from '../types';
import {
  scanBed,
  scanDemo,
  uploadJob,
  runOptimization,
  runDemoOptimization,
  exportCuttingFile,
  getDownloadUrl,
} from '../services/api';

export function SmartNest() {
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [material, setMaterial] = useState('Aluminum');
  const [thickness, setThickness] = useState('2');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);
  const [optimResult, setOptimResult] = useState<OptimizationResult | null>(null);
  const [quantities, setQuantities] = useState<PartQuantity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isJobLoading, setIsJobLoading] = useState(false);
  const [optimProgress, setOptimProgress] = useState('');
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  const scanFileRef = useRef<HTMLInputElement>(null);

  function clearError() {
    setError(null);
  }

  async function handleScanUpload(file: File) {
    setError(null);
    setStep('scanning');
    setScanResult(null);
    try {
      const result = await scanBed(file);
      setScanResult(result);
      setStep(result.success ? 'scanned' : 'idle');
      if (!result.success) setError(result.message);
    } catch (e: any) {
      setError(e.message);
      setStep('idle');
    }
  }

  async function handleDemoScan(scenario: string) {
    setError(null);
    setStep('scanning');
    setScanResult(null);
    try {
      const result = await scanDemo(scenario);
      setScanResult(result);
      setStep('scanned');
    } catch (e: any) {
      setError(e.message);
      setStep('idle');
    }
  }

  async function handleJobUpload(file: File) {
    setJobError(null);
    setIsJobLoading(true);
    try {
      const result = await uploadJob(file);
      setJobResult(result);
      setQuantities(result.parts.map((p) => ({ part_id: p.id, quantity: 1 })));
      setStep('job_loaded');
      if (result.status === 'error') setJobError(result.message);
    } catch (e: any) {
      setJobError(e.message);
    } finally {
      setIsJobLoading(false);
    }
  }

  function handleQuantityChange(partId: string, qty: number) {
    setQuantities((prev) =>
      prev.map((q) => (q.part_id === partId ? { ...q, quantity: qty } : q))
    );
  }

  async function handleOptimize() {
    if (!scanResult || !scanResult.sheet || !jobResult) return;
    setError(null);
    setOptimResult(null);
    setStep('optimizing');
    setOptimProgress('Analysing available material...');

    try {
      const qtyMap: Record<string, number> = {};
      quantities.forEach((q) => {
        qtyMap[q.part_id] = q.quantity;
      });

      setTimeout(() => setOptimProgress('Generating candidate placements...'), 500);
      setTimeout(() => setOptimProgress('Running nesting algorithm...'), 2000);
      setTimeout(() => setOptimProgress('Scoring layouts...'), 5000);

      const result = await runOptimization({
        dxf_file_path: jobResult.file_path,
        sheet_polygon_mm: scanResult.sheet.polygon_mm,
        cutouts_mm: scanResult.cutouts,
        quantities: qtyMap,
        config: {
          max_time_seconds: 30,
          rotation_step_deg: 45,
          kerf_mm: 0.2,
          clearance_mm: 1.0,
          edge_margin_mm: 5.0,
        },
      });
      setOptimResult(result);
      setStep('optimized');
    } catch (e: any) {
      setError(e.message);
      setStep('job_loaded');
    }
  }

  async function handleDemoOptimize() {
    setError(null);
    setOptimResult(null);
    setStep('optimizing');
    setOptimProgress('Running demo optimization...');
    try {
      const result = await runDemoOptimization();
      setOptimResult(result);
      setStep('optimized');
    } catch (e: any) {
      setError(e.message);
      setStep(scanResult ? 'scanned' : 'idle');
    }
  }

  async function handleExport() {
    if (!optimResult || !scanResult?.sheet) return;
    setError(null);
    try {
      const result = await exportCuttingFile({
        job_id: optimResult.job_id,
        placements: optimResult.placements,
        sheet_polygon_mm: scanResult.sheet.polygon_mm,
        cutouts_mm: scanResult.cutouts,
      });
      setExportJobId(result.job_id);
      setStep('exported');
      // Auto-trigger download
      const link = document.createElement('a');
      link.href = getDownloadUrl(result.job_id);
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const canScan = step !== 'scanning' && step !== 'optimizing';
  const canAddJob = step === 'scanned' || step === 'job_loaded' || step === 'optimized';
  const canOptimize = (step === 'job_loaded' || step === 'optimized') && jobResult && scanResult;
  const canExport = step === 'optimized' && optimResult;
  const isDemoMode = !scanResult || scanResult.demo_mode;

  return (
    <div className="min-h-screen bg-bed flex flex-col text-text">
      <StatusBar step={step} cameraConnected={!isDemoMode} />

      <main className="flex-1 flex flex-col gap-4 p-4 max-w-[1600px] mx-auto w-full">
        {error && (
          <div className="bg-danger/20 border border-danger rounded-lg px-4 py-3 text-sm text-danger flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError} className="text-danger hover:text-text ml-4">✕</button>
          </div>
        )}

        <div className="flex gap-4 flex-1">
          {/* Left: bed viewer (main area) */}
          <div className="flex-1 min-w-0">
            <BedViewer
              scanResult={scanResult}
              optimizationResult={optimResult}
              isScanning={step === 'scanning'}
            />
          </div>

          {/* Right: control panels */}
          <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto">
            <MaterialPanel
              scanResult={scanResult}
              material={material}
              thickness={thickness}
              onMaterialChange={setMaterial}
              onThicknessChange={setThickness}
            />

            <JobPanel
              jobResult={jobResult}
              quantities={quantities}
              onFileUpload={handleJobUpload}
              onQuantityChange={handleQuantityChange}
              isLoading={isJobLoading}
              error={jobError}
            />

            <OptimizationPanel
              result={optimResult}
              isOptimizing={step === 'optimizing'}
              progress={optimProgress}
            />
          </div>
        </div>

        {/* Bottom action bar: the 5-click workflow */}
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* SCAN */}
            <input
              ref={scanFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleScanUpload(f);
              }}
            />
            <ActionButton
              label="1  SCAN BED"
              sublabel="Upload image"
              active={step === 'idle'}
              done={step !== 'idle' && step !== 'scanning'}
              loading={step === 'scanning'}
              disabled={!canScan}
              onClick={() => scanFileRef.current?.click()}
            />

            <div className="text-muted text-lg">→</div>

            {/* Demo Scan */}
            <ActionButton
              label="DEMO SCAN"
              sublabel="Use sample"
              variant="secondary"
              active={step === 'idle'}
              done={false}
              loading={false}
              disabled={!canScan}
              onClick={() => handleDemoScan('sheet_with_circles')}
            />

            <div className="text-muted text-lg">→</div>

            {/* ADD JOB */}
            <ActionButton
              label="2  ADD JOB"
              sublabel="DXF / SVG"
              active={step === 'scanned'}
              done={step === 'job_loaded' || step === 'optimizing' || step === 'optimized' || step === 'exported'}
              loading={isJobLoading}
              disabled={!canAddJob}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.dxf,.svg';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleJobUpload(f);
                };
                input.click();
              }}
            />

            <div className="text-muted text-lg">→</div>

            {/* OPTIMIZE */}
            <ActionButton
              label="3  OPTIMIZE"
              sublabel="Auto-nest parts"
              active={step === 'job_loaded'}
              done={step === 'optimized' || step === 'exported'}
              loading={step === 'optimizing'}
              disabled={!canOptimize && step !== 'scanned'}
              onClick={scanResult && jobResult ? handleOptimize : (scanResult ? handleDemoOptimize : () => {})}
            />

            {(!jobResult && step === 'scanned') && (
              <>
                <div className="text-muted text-lg">→</div>
                <ActionButton
                  label="DEMO OPTIMIZE"
                  sublabel="Sample result"
                  variant="secondary"
                  active={step === 'scanned'}
                  done={false}
                  loading={step === 'optimizing'}
                  disabled={step !== 'scanned'}
                  onClick={handleDemoOptimize}
                />
              </>
            )}

            <div className="text-muted text-lg">→</div>

            {/* EXPORT */}
            <ActionButton
              label="4  EXPORT"
              sublabel="Download DXF"
              active={step === 'optimized'}
              done={step === 'exported'}
              loading={false}
              disabled={!canExport}
              variant={canExport ? 'primary' : 'default'}
              onClick={handleExport}
            />

            {step === 'exported' && exportJobId && (
              <a
                href={getDownloadUrl(exportJobId)}
                download
                className="flex items-center gap-2 bg-success hover:bg-success/80 text-white rounded-lg px-4 py-3 text-sm font-bold transition-colors"
              >
                ⬇ DOWNLOAD CUTTING FILE
              </a>
            )}
          </div>

          {optimResult && (
            <div className="mt-3 pt-3 border-t border-border flex gap-6 text-xs text-muted">
              <span>Job: <strong className="text-text">{optimResult.job_id}</strong></span>
              <span>Parts: <strong className="text-success">{optimResult.placed_parts}/{optimResult.required_parts}</strong></span>
              <span>Utilization: <strong className="text-accent">{optimResult.utilization_percent.toFixed(1)}%</strong></span>
              <span>Waste: <strong className="text-warning">{optimResult.waste_percent.toFixed(1)}%</strong></span>
              <span>Cut Distance: <strong className="text-text">{(optimResult.cutting_distance_mm / 1000).toFixed(1)} m</strong></span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ActionButton({
  label,
  sublabel,
  active,
  done,
  loading,
  disabled,
  onClick,
  variant = 'default',
}: {
  label: string;
  sublabel: string;
  active: boolean;
  done: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'secondary';
}) {
  const base = 'flex flex-col items-center justify-center rounded-lg px-5 py-3 min-w-[110px] font-bold text-sm tracking-wide transition-all border ';

  let cls = base;
  if (loading) {
    cls += 'border-accent bg-accent/20 text-accent cursor-wait';
  } else if (done) {
    cls += 'border-success bg-success/20 text-success';
  } else if (active && !disabled) {
    cls += 'border-accent bg-accent text-white hover:bg-accent/80 cursor-pointer shadow-lg shadow-accent/20';
  } else if (variant === 'primary' && !disabled) {
    cls += 'border-success bg-success text-white hover:bg-success/80 cursor-pointer';
  } else if (variant === 'secondary' && !disabled) {
    cls += 'border-border bg-panel text-muted hover:text-text hover:border-accent cursor-pointer';
  } else if (disabled) {
    cls += 'border-border bg-bed text-muted cursor-not-allowed opacity-40';
  } else {
    cls += 'border-border bg-panel text-muted hover:border-accent hover:text-text cursor-pointer';
  }

  return (
    <button className={cls} onClick={onClick} disabled={disabled || loading}>
      <div className="flex items-center gap-1.5">
        {loading && (
          <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
        )}
        {done && !loading && <span>✓</span>}
        {label}
      </div>
      <div className="text-xs font-normal opacity-70 mt-0.5">{sublabel}</div>
    </button>
  );
}
