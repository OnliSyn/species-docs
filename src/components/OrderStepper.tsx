'use client';

import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/types';

const STEPS: { stage: PipelineStage; label: string }[] = [
  { stage: 'order.received', label: 'Order submitted' },
  { stage: 'order.validated', label: 'Validating' },
  { stage: 'order.matched', label: 'Matched' },
  { stage: 'asset.staged', label: 'Staging asset' },
  { stage: 'ledger.posted', label: 'Processing payment' },
  { stage: 'ownership.changed', label: 'Delivering to Vault' },
  { stage: 'order.completed', label: 'Complete' },
];

interface OrderStepperProps {
  currentStage: PipelineStage;
  error?: { stage: string; message: string } | null;
}

export function OrderStepper({ currentStage, error }: OrderStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.stage === currentStage);
  const isFailed = currentStage === 'order.failed';

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">
        Order Progress
      </h3>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isErrorStep = isFailed && error?.stage === step.stage;

          return (
            <div key={step.stage} className="flex items-center gap-3">
              {/* Step indicator */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                isComplete && 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]',
                isCurrent && !isErrorStep && 'bg-[var(--color-cta-primary)] text-white animate-pulse',
                isErrorStep && 'bg-[var(--color-accent-red)] text-white',
                !isComplete && !isCurrent && !isErrorStep && 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
              )}>
                {isComplete ? '\u2713' : isErrorStep ? '\u2715' : i + 1}
              </div>

              {/* Label */}
              <span className={cn(
                'text-sm',
                isComplete && 'text-[var(--color-text-primary)]',
                isCurrent && 'text-[var(--color-text-primary)] font-medium',
                !isComplete && !isCurrent && 'text-[var(--color-text-secondary)]'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {isFailed && error && (
        <div className="mt-4 p-3 rounded-[var(--radius-input)] bg-[var(--color-accent-red)]/10 text-xs text-[var(--color-accent-red)]">
          {error.message || 'Asset could not be reserved \u2014 no funds were charged.'}
        </div>
      )}
    </div>
  );
}
