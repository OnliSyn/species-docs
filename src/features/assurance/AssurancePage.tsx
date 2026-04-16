'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatUsdcDisplay } from '@/lib/amount';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

/* ── Types ──────────────────────────────────────────────── */

interface ReconciliationRun {
  id: string;
  timestamp: string;
  status: 'pass' | 'fail';
  variance: bigint;
}

interface RiskAlert {
  id: string;
  severity: 'warning' | 'info' | 'critical';
  message: string;
  timestamp: string;
}

/* ── Mock Data ──────────────────────────────────────────── */

const ASSURANCE_BALANCE = 950_000_000_000n;
const TOTAL_OUTSTANDING = 1_000_000_000_000n;
const COVERAGE_PERCENT = Number((ASSURANCE_BALANCE * 100n) / TOTAL_OUTSTANDING);

// 30-day coverage history
function generateCoverageHistory() {
  const data = [];
  const base = new Date('2026-03-05');
  const values = [
    92, 93, 91, 90, 88, 85, 82, 78, 75, 72,
    68, 65, 60, 55, 52, 48, 50, 55, 60, 65,
    70, 75, 80, 85, 88, 90, 92, 93, 94, 95,
  ];
  for (let i = 0; i < 30; i++) {
    const date = new Date(base);
    date.setDate(base.getDate() + i);
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      coverage: values[i],
    });
  }
  return data;
}

const COVERAGE_HISTORY = generateCoverageHistory();

const RECONCILIATION_HISTORY: ReconciliationRun[] = [
  { id: 'r1', timestamp: '2026-04-03T12:00:00Z', status: 'pass', variance: 0n },
  { id: 'r2', timestamp: '2026-04-02T12:00:00Z', status: 'pass', variance: 0n },
  { id: 'r3', timestamp: '2026-04-01T12:00:00Z', status: 'pass', variance: 0n },
  { id: 'r4', timestamp: '2026-03-31T12:00:00Z', status: 'fail', variance: 250_000_000n },
  { id: 'r5', timestamp: '2026-03-30T12:00:00Z', status: 'pass', variance: 0n },
];

const RISK_ALERTS: RiskAlert[] = [
  { id: 'a1', severity: 'warning', message: 'Coverage dropped below 50% threshold', timestamp: '2026-03-15T14:30:00Z' },
  { id: 'a2', severity: 'info', message: 'Reconciliation variance detected — auto-resolved', timestamp: '2026-03-10T12:00:00Z' },
  { id: 'a3', severity: 'critical', message: 'Coverage dropped below 25% — emergency reserve activated', timestamp: '2026-03-12T08:15:00Z' },
  { id: 'a4', severity: 'info', message: 'Reserve replenishment completed', timestamp: '2026-03-20T16:00:00Z' },
];

const SEVERITY_STYLES: Record<RiskAlert['severity'], { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-[#E74C3C]/15', text: 'text-[#E74C3C]', label: 'Critical' },
  warning: { bg: 'bg-[#FFCE73]/20', text: 'text-[#8a6d00]', label: 'Warning' },
  info: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Info' },
};

/* ── Page ────────────────────────────────────────────────── */

export function AssurancePage() {
  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcile = () => {
    setIsReconciling(true);
    setTimeout(() => setIsReconciling(false), 2000);
  };

  const statusLabel = COVERAGE_PERCENT >= 80 ? 'Healthy' : COVERAGE_PERCENT >= 50 ? 'Adequate' : COVERAGE_PERCENT >= 25 ? 'Low' : 'Critical';
  const statusColor = COVERAGE_PERCENT >= 80 ? 'bg-[#C5DE8A]/30 text-[#3d6b00]' : COVERAGE_PERCENT >= 50 ? 'bg-[#FFCE73]/30 text-[#8a6d00]' : 'bg-[#E74C3C]/20 text-[#E74C3C]';
  const barColor = COVERAGE_PERCENT >= 80 ? '#C5DE8A' : COVERAGE_PERCENT >= 50 ? '#FFCE73' : '#E74C3C';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Assurance</h1>

      {/* Coverage Overview */}
      <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Coverage Overview</h3>
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Assurance Balance</p>
            <p className="text-2xl font-bold">{formatUsdcDisplay(ASSURANCE_BALANCE)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold">{formatUsdcDisplay(TOTAL_OUTSTANDING)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Coverage Ratio</p>
            <p className="text-2xl font-bold">{COVERAGE_PERCENT}%</p>
          </div>
        </div>

        {/* Large coverage bar */}
        <div className="w-full h-4 rounded-full bg-[var(--color-bg-card)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${COVERAGE_PERCENT}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--color-text-secondary)]">0%</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">25%</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">50%</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">75%</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">100%</span>
        </div>
      </div>

      {/* Coverage History Chart */}
      <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Coverage History (30 Days)</h3>
        <div className="h-64 min-h-[16rem] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={COVERAGE_HISTORY} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}
                formatter={(value) => [`${value}%`, 'Coverage']}
              />
              <ReferenceLine y={50} stroke="#FFCE73" strokeDasharray="6 3" label={{ value: '50% Threshold', position: 'right', fontSize: 10, fill: '#8a6d00' }} />
              <ReferenceLine y={25} stroke="#E74C3C" strokeDasharray="6 3" label={{ value: '25% Threshold', position: 'right', fontSize: 10, fill: '#E74C3C' }} />
              <Line type="monotone" dataKey="coverage" stroke="#6B8E23" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reconciliation */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Reconciliation</h3>
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white transition-opacity',
                isReconciling ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90',
              )}
            >
              {isReconciling ? 'Running...' : 'Run Reconciliation'}
            </button>
          </div>

          {/* Last run summary */}
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-[var(--color-bg-card)]">
            <div>
              <p className="text-[10px] text-[var(--color-text-secondary)] mb-0.5">Last Run</p>
              <p className="text-xs font-medium">{new Date(RECONCILIATION_HISTORY[0].timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-secondary)] mb-0.5">Status</p>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                RECONCILIATION_HISTORY[0].status === 'pass' ? 'bg-[#C5DE8A]/30 text-[#3d6b00]' : 'bg-[#E74C3C]/20 text-[#E74C3C]',
              )}>
                {RECONCILIATION_HISTORY[0].status === 'pass' ? 'Pass' : 'Fail'}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-secondary)] mb-0.5">Variance</p>
              <p className="text-xs font-medium">{formatUsdcDisplay(RECONCILIATION_HISTORY[0].variance)}</p>
            </div>
          </div>

          {/* History table */}
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] px-2 py-1">
              <span>Timestamp</span>
              <span>Status</span>
              <span>Variance</span>
            </div>
            {RECONCILIATION_HISTORY.map((run) => (
              <div key={run.id} className="grid grid-cols-3 gap-2 text-xs px-2 py-2 rounded hover:bg-[var(--color-bg-card)] transition-colors">
                <span className="text-[var(--color-text-secondary)]">{new Date(run.timestamp).toLocaleDateString()}</span>
                <span>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    run.status === 'pass' ? 'bg-[#C5DE8A]/30 text-[#3d6b00]' : 'bg-[#E74C3C]/20 text-[#E74C3C]',
                  )}>
                    {run.status === 'pass' ? 'Pass' : 'Fail'}
                  </span>
                </span>
                <span className={cn('font-mono', run.variance > 0n ? 'text-[#E74C3C]' : '')}>{formatUsdcDisplay(run.variance)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Risk Alerts</h3>
          <div className="space-y-3">
            {RISK_ALERTS.map((alert) => {
              const style = SEVERITY_STYLES[alert.severity];
              return (
                <div key={alert.id} className={cn('flex items-start gap-3 p-3 rounded-lg', style.bg)}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5', style.text, alert.severity === 'critical' ? 'bg-[#E74C3C]/20' : alert.severity === 'warning' ? 'bg-[#FFCE73]/30' : 'bg-blue-100')}>
                    {alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '!' : 'i'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[10px] font-semibold', style.text)}>{style.label}</span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">{new Date(alert.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
