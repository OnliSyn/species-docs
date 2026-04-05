'use client';

import { BalanceCard, TransactionList, DepositStatusCard, AssuranceCoverageCard, MarketStatsCard, VaultCard } from './tool-ui';

interface ToolResultRendererProps {
  toolName: string;
  output: unknown;
}

export function ToolResultRenderer({ toolName, output }: ToolResultRendererProps) {
  // Unwrap AI SDK output format: { type: 'text', value: '...' } or raw string/object
  let raw = output;
  if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    raw = (raw as Record<string, unknown>).value;
  }
  // If it's an array of output parts, take the first text value
  if (Array.isArray(raw)) {
    const textPart = raw.find((p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text');
    if (textPart) raw = (textPart as Record<string, unknown>).value;
  }
  const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;

  switch (toolName) {
    case 'get_funding_balance':
    case 'get_asset_balance':
    case 'get_species_balance':
    case 'get_assurance_balance':
      return <BalanceCard data={data} />;

    case 'get_recent_transactions':
      return <TransactionList data={data} />;

    case 'get_deposit_status':
      return <DepositStatusCard data={data} />;

    case 'get_assurance_coverage':
      return <AssuranceCoverageCard data={data} />;

    case 'get_marketplace_stats':
      return <MarketStatsCard data={data} />;

    case 'get_vault_balance':
      return <VaultCard data={data} />;

    default:
      // Unknown tool -- show raw JSON
      return (
        <div className="my-1 px-2 py-1 rounded bg-[var(--color-bg-card)] text-[10px] font-mono text-[var(--color-text-secondary)] overflow-x-auto">
          <span className="font-semibold">{toolName}:</span> {JSON.stringify(data, null, 2).substring(0, 200)}
        </div>
      );
  }
}
