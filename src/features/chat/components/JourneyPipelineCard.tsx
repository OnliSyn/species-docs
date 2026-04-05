'use client';

import { cn } from '@/lib/utils';

export type PipelineStageStatus = 'pending' | 'active' | 'done' | 'error' | 'waiting';

export interface PipelineStageConfig {
  label: string;
  system: 'SM' | 'MB' | 'OC';  // Species Marketplace, MarketSB, Onli Cloud
  status: PipelineStageStatus;
  message?: string;  // e.g., "Check your OnliYou app"
}

interface JourneyPipelineCardProps {
  title: string;        // "BUY 1,000 SPECIES"
  stages: PipelineStageConfig[];
  error?: string | null;
}

const SYSTEM_COLORS: Record<string, string> = {
  SM: 'text-[var(--color-text-secondary)]',
  MB: 'text-blue-500',
  OC: 'text-emerald-600',
};

export function JourneyPipelineCard({ title, stages, error }: JourneyPipelineCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        {title}
      </h4>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Status icon */}
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
              stage.status === 'done' && 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]',
              stage.status === 'active' && 'bg-[var(--color-cta-primary)] text-white animate-pulse',
              stage.status === 'waiting' && 'bg-[var(--color-accent-amber)] text-white animate-pulse',
              stage.status === 'error' && 'bg-[var(--color-accent-red)] text-white',
              stage.status === 'pending' && 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
            )}>
              {stage.status === 'done' ? '✓' : stage.status === 'error' ? '✕' : ''}
            </div>

            {/* Label + system */}
            <div className="flex-1 flex items-center gap-2">
              <span className={cn(
                'text-xs',
                stage.status === 'done' || stage.status === 'active' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
                stage.status === 'active' && 'font-medium',
              )}>
                {stage.label}
              </span>
              <span className={cn('text-[9px] font-mono', SYSTEM_COLORS[stage.system])}>
                {stage.system}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Waiting message */}
      {stages.some(s => s.status === 'waiting') && (
        <div className="mt-3 px-3 py-2 rounded-[var(--radius-input)] bg-[var(--color-accent-amber)]/10 text-xs text-[var(--color-text-primary)]">
          {stages.find(s => s.status === 'waiting')?.message || 'Waiting for authorization...'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 px-3 py-2 rounded-[var(--radius-input)] bg-[var(--color-accent-red)]/10 text-xs text-[var(--color-accent-red)]">
          {error}
        </div>
      )}
    </div>
  );
}
