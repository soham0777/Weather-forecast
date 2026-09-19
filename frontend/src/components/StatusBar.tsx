import React from 'react';
import type { WorkflowStep } from '../types';

interface Props {
  step: WorkflowStep;
  cameraConnected: boolean;
}

const steps: { key: WorkflowStep; label: string; num: number }[] = [
  { key: 'scanned', label: 'SCAN BED', num: 1 },
  { key: 'job_loaded', label: 'ADD JOB', num: 2 },
  { key: 'optimized', label: 'OPTIMIZE', num: 3 },
  { key: 'exported', label: 'EXPORT', num: 4 },
];

const stepOrder: WorkflowStep[] = ['idle', 'scanning', 'scanned', 'job_loaded', 'optimizing', 'optimized', 'exported'];

function stepIndex(s: WorkflowStep): number {
  return stepOrder.indexOf(s);
}

export function StatusBar({ step, cameraConnected }: Props) {
  const current = stepIndex(step);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-panel border-b border-border">
      <div className="flex items-center gap-3">
        <div className="text-accent font-bold text-xl tracking-wider">BANSALI</div>
        <div className="text-muted text-sm">|</div>
        <div className="text-text font-semibold text-sm tracking-widest">SMARTNEST</div>
        <div className="text-muted text-xs ml-2">SEE. MEASURE. OPTIMIZE. CUT.</div>
      </div>

      <div className="flex items-center gap-6">
        {steps.map((s) => {
          const isDone = current > stepOrder.indexOf(s.key);
          const isActive = current === stepOrder.indexOf(s.key) ||
            (s.key === 'scanned' && (step === 'scanning' || step === 'scanned')) ||
            (s.key === 'optimized' && step === 'optimizing');
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${isDone ? 'bg-success text-white' : isActive ? 'bg-accent text-white' : 'bg-border text-muted'}`}>
                {isDone ? '✓' : s.num}
              </div>
              <span className={`text-xs font-semibold tracking-wider
                ${isDone ? 'text-success' : isActive ? 'text-accent' : 'text-muted'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${cameraConnected ? 'bg-success' : 'bg-muted'}`} />
          <span className="text-muted">Camera {cameraConnected ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-muted">System Ready</span>
        </div>
      </div>
    </header>
  );
}
