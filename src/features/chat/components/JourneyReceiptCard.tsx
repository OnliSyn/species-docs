'use client';

interface ReceiptLine {
  label: string;
  value: string;
}

interface JourneyReceiptCardProps {
  type: 'fund' | 'buy' | 'sell' | 'transfer' | 'sendout';
  title: string;             // "ORDER COMPLETE" or "DEPOSIT COMPLETE"
  eventId?: string;
  batchId?: string;
  lines: ReceiptLine[];
  oracleVerified?: boolean;
  timestamp: string;
  warning?: string;          // e.g., "This transaction is final and irreversible"
}

const TYPE_ICONS: Record<string, string> = {
  fund: '\u{1F4B0}',
  buy: '\u{1F33F}',
  sell: '\u{1F4E4}',
  transfer: '\u2194',
  sendout: '\u{1F4B8}',
};

export function JourneyReceiptCard({ type, title, eventId, batchId, lines, oracleVerified, timestamp, warning }: JourneyReceiptCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-accent-green)] p-4 shadow-[var(--shadow-card)] my-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{TYPE_ICONS[type]}</span>
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent-green)]">
          {title}
        </h4>
      </div>

      {(eventId || batchId) && (
        <div className="mb-3 space-y-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
          {eventId && <p>Event: {eventId}</p>}
          {batchId && <p>Batch: {batchId}</p>}
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        {lines.map((line, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">{line.label}</span>
            <span className="font-medium">{line.value}</span>
          </div>
        ))}
      </div>

      {oracleVerified !== undefined && (
        <div className="flex items-center gap-1.5 text-xs mb-2">
          <span className={oracleVerified ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-amber)]'}>
            {oracleVerified ? '\u2713' : '\u26A0'}
          </span>
          <span className="text-[var(--color-text-secondary)]">
            Oracle: {oracleVerified ? 'Verified' : 'Pending verification'}
          </span>
        </div>
      )}

      {warning && (
        <p className="text-[10px] text-[var(--color-text-secondary)] italic mb-2">{warning}</p>
      )}

      <p className="text-[10px] text-[var(--color-text-secondary)] text-right">{timestamp}</p>
    </div>
  );
}
