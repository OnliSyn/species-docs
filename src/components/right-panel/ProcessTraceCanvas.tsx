'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { useOnliChat } from '@/features/chat/hooks/useOnliChat';

// ── Tool display name + system mapping ──────────────────────────────

type SystemTag = 'SM' | 'MB' | 'OC';

const SYSTEM_COLORS: Record<SystemTag, string> = {
  SM: '#6B6B6B',
  MB: '#2775CA',
  OC: '#16A34A',
};

const TOOL_META: Record<string, { display: string; system: SystemTag }> = {
  journey_confirm:       { display: 'Journey Confirm',    system: 'SM' },
  journey_execute:       { display: 'Journey Execute',    system: 'SM' },
  get_funding_balance:   { display: 'Funding Balance',    system: 'MB' },
  get_asset_balance:     { display: 'Asset Balance',      system: 'MB' },
  get_species_balance:   { display: 'Species Balance',    system: 'OC' },
  get_vault_balance:     { display: 'Vault Balance',      system: 'OC' },
  get_recent_transactions: { display: 'Transactions',     system: 'MB' },
  get_deposit_status:    { display: 'Deposit Status',     system: 'MB' },
  get_assurance_coverage: { display: 'Assurance Coverage', system: 'MB' },
  get_marketplace_stats: { display: 'Marketplace Stats',  system: 'SM' },
  submit_buy_order:      { display: 'Buy Order',          system: 'SM' },
  submit_sell_order:     { display: 'Sell Order',         system: 'SM' },
  submit_transfer_order: { display: 'Transfer Order',     system: 'SM' },
  transfer_usdc:         { display: 'Transfer USDC',      system: 'MB' },
  transfer_specie:       { display: 'Transfer Specie',    system: 'OC' },
  transfer_between_accounts: { display: 'Account Transfer', system: 'MB' },
  request_withdrawal:    { display: 'Withdrawal',         system: 'MB' },
  simulate_deposit:      { display: 'Simulate Deposit',   system: 'MB' },
  simulate_withdrawal:   { display: 'Simulate Withdrawal', system: 'MB' },
};

function getToolMeta(toolName: string): { display: string; system: SystemTag } {
  if (TOOL_META[toolName]) return TOOL_META[toolName];
  // Auto-format: snake_case → Title Case
  const display = toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { display, system: 'SM' };
}

// ── Trace entry type ────────────────────────────────────────────────

interface TraceEntry {
  id: string;
  toolName: string;
  displayName: string;
  system: SystemTag;
  status: 'pending' | 'done' | 'error';
  input?: Record<string, unknown>;
  output?: unknown;
  messageIdx: number;
}

// ── Component ───────────────────────────────────────────────────────

export function ProcessTraceCanvas() {
  const { messages, status } = useOnliChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  const traceEntries = useMemo<TraceEntry[]>(() => {
    const entries: TraceEntry[] = [];
    messages.forEach((msg, msgIdx) => {
      if (msg.role !== 'assistant') return;
      for (const part of msg.parts) {
        const p = part as Record<string, unknown>;
        const t = String(p.type || '');
        if (t !== 'tool-invocation' && !t.startsWith('tool-')) continue;

        const toolName = String(p.toolName || 'unknown');
        const meta = getToolMeta(toolName);
        const state = String(p.state || '');

        let entryStatus: TraceEntry['status'] = 'pending';
        if (state === 'output-available') {
          entryStatus = 'done';
          // Check for error in output
          const out = p.output as Record<string, unknown> | undefined;
          if (out && (out.error || out.code === 'error')) {
            entryStatus = 'error';
          }
        }

        entries.push({
          id: String(p.toolCallId || `${msg.id}-${entries.length}`),
          toolName,
          displayName: meta.display,
          system: meta.system,
          status: entryStatus,
          input: p.input as Record<string, unknown> | undefined,
          output: entryStatus !== 'pending' ? p.output : undefined,
          messageIdx: msgIdx,
        });
      }
    });
    return entries;
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [traceEntries.length]);

  const isProcessing = status === 'submitted' || status === 'streaming';

  if (traceEntries.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-[#1A1A1A] text-center px-6">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 2v7h7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Send a message in chat to see<br />the process trace here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">
          Process Trace
        </span>
        <span className="text-[9px] font-mono text-white/30">
          {traceEntries.length} call{traceEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Trace log */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5">
        {traceEntries.map((entry) => (
          <TraceRow key={entry.id} entry={entry} />
        ))}

        {/* Streaming indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 py-2 px-2">
            <span className="w-2 h-2 rounded-full bg-[#C5DE8A] animate-pulse" />
            <span className="text-[10px] text-white/40">Processing...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Individual trace row ────────────────────────────────────────────

function TraceRow({ entry }: { entry: TraceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = SYSTEM_COLORS[entry.system];

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        {/* Status icon */}
        <div className="w-4 flex-shrink-0 flex justify-center">
          {entry.status === 'pending' && (
            <span className="w-2.5 h-2.5 rounded-full bg-[#C5DE8A] animate-pulse" />
          )}
          {entry.status === 'done' && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="6" fill="#C5DE8A" />
              <path d="M3 6l2 2 4-4" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {entry.status === 'error' && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="6" fill="#E74C3C" />
              <path d="M4 4l4 4M8 4l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* System badge */}
        <span
          className="flex-shrink-0 text-[8px] font-bold font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {entry.system}
        </span>

        {/* Tool name */}
        <span className="flex-1 text-[11px] text-white/80 truncate">
          {entry.displayName}
        </span>

        {/* Expand indicator */}
        {(entry.input != null || entry.output != null) && (
          <svg
            width="10" height="10" viewBox="0 0 12 12" fill="none"
            className={`text-white/20 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (entry.input != null || entry.output != null) && (
        <div className="ml-6 mr-2 mb-1 space-y-1">
          {entry.input && Object.keys(entry.input).length > 0 && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-white/30">Input</span>
              <pre className="text-[9px] font-mono text-white/40 mt-0.5 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(entry.input, null, 2)}
              </pre>
            </div>
          )}
          {entry.output != null && (
            <div>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-white/30">Output</span>
              <pre className="text-[9px] font-mono text-white/40 mt-0.5 whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                {JSON.stringify(entry.output, replaceBigInt, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function replaceBigInt(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
