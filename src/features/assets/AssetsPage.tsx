'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatUsdcDisplay, formatSpecieCount } from '@/lib/amount';
import { useOracleLedger } from '@/hooks/use-virtual-accounts';

/* ── Types ──────────────────────────────────────────────── */

interface AuditEvent {
  event: string;
  timestamp: string;
  source: string;
}

interface VirtualAccount {
  id: string;
  name: string;
  subtype: 'funding' | 'species' | 'assurance';
  balance: bigint;
  status: 'active' | 'frozen';
  lastUpdated: string;
  depositAddress?: string;
  specieCount?: number;
  coveragePercent?: number;
  auditTrail: AuditEvent[];
}

interface SpecieGenome {
  id: string;
  genomeId: string;
  createdAt: string;
  lastTransfer: string;
  status: 'active' | 'in-transit';
}

/* ── Mock Data ──────────────────────────────────────────── */

const MOCK_ACCOUNTS: VirtualAccount[] = [
  {
    id: 'va-fund-01',
    name: 'Primary Funding',
    subtype: 'funding',
    balance: 12_450_000_000n,
    status: 'active',
    lastUpdated: '2026-04-03T14:30:00Z',
    depositAddress: '0x1a2B3c4D5e6F7890AbCdEf1234567890aBcDeF12',
    auditTrail: [
      { event: 'deposit_credited', timestamp: '2026-04-03T14:30:00Z', source: 'FundingSB' },
      { event: 'balance_verified', timestamp: '2026-04-03T14:32:00Z', source: 'Oracle' },
      { event: 'withdrawal_processed', timestamp: '2026-04-02T10:15:00Z', source: 'FundingSB' },
      { event: 'deposit_credited', timestamp: '2026-04-01T09:00:00Z', source: 'FundingSB' },
      { event: 'account_created', timestamp: '2026-03-15T08:00:00Z', source: 'Oracle' },
    ],
  },
  {
    id: 'va-spec-01',
    name: 'Species Holdings',
    subtype: 'species',
    balance: 8_500_000_000n,
    status: 'active',
    lastUpdated: '2026-04-03T15:00:00Z',
    specieCount: 8500,
    auditTrail: [
      { event: 'species_minted', timestamp: '2026-04-03T15:00:00Z', source: 'MarketSB' },
      { event: 'species_transferred_in', timestamp: '2026-04-02T12:30:00Z', source: 'MarketSB' },
      { event: 'species_burned', timestamp: '2026-04-01T16:45:00Z', source: 'MarketSB' },
      { event: 'settlement_verified', timestamp: '2026-04-01T16:50:00Z', source: 'Oracle' },
      { event: 'account_created', timestamp: '2026-03-15T08:00:00Z', source: 'Oracle' },
    ],
  },
  {
    id: 'va-assur-01',
    name: 'Assurance Reserve',
    subtype: 'assurance',
    balance: 950_000_000_000n,
    status: 'active',
    lastUpdated: '2026-04-03T12:00:00Z',
    coveragePercent: 95,
    auditTrail: [
      { event: 'reconciliation_pass', timestamp: '2026-04-03T12:00:00Z', source: 'Oracle' },
      { event: 'reserve_adjusted', timestamp: '2026-04-02T12:00:00Z', source: 'FundingSB' },
      { event: 'reconciliation_pass', timestamp: '2026-04-02T12:00:00Z', source: 'Oracle' },
      { event: 'coverage_verified', timestamp: '2026-04-01T12:00:00Z', source: 'Oracle' },
      { event: 'reserve_initialized', timestamp: '2026-03-15T08:00:00Z', source: 'Oracle' },
    ],
  },
];

const MOCK_GENOMES: SpecieGenome[] = [
  { id: 'g1', genomeId: '0xA3F8...7C2E', createdAt: '2026-03-20T10:00:00Z', lastTransfer: '2026-04-03T15:00:00Z', status: 'active' },
  { id: 'g2', genomeId: '0x9B1D...4F8A', createdAt: '2026-03-21T14:30:00Z', lastTransfer: '2026-04-02T12:30:00Z', status: 'active' },
  { id: 'g3', genomeId: '0x5E7C...2A9B', createdAt: '2026-03-22T09:15:00Z', lastTransfer: '2026-04-01T16:45:00Z', status: 'in-transit' },
  { id: 'g4', genomeId: '0x2D4F...8E1C', createdAt: '2026-03-25T11:00:00Z', lastTransfer: '2026-03-30T09:00:00Z', status: 'active' },
  { id: 'g5', genomeId: '0x8A6E...3B7D', createdAt: '2026-03-27T16:45:00Z', lastTransfer: '2026-03-29T14:20:00Z', status: 'active' },
  { id: 'g6', genomeId: '0xF1C9...6D4E', createdAt: '2026-03-28T08:30:00Z', lastTransfer: '2026-04-03T11:00:00Z', status: 'active' },
  { id: 'g7', genomeId: '0x7B2A...9F5C', createdAt: '2026-03-30T13:00:00Z', lastTransfer: '2026-04-02T10:15:00Z', status: 'in-transit' },
  { id: 'g8', genomeId: '0x4E8D...1A3F', createdAt: '2026-04-01T07:00:00Z', lastTransfer: '2026-04-03T08:45:00Z', status: 'active' },
];

const SUBTYPE_STYLES: Record<VirtualAccount['subtype'], { bg: string; text: string; label: string; icon: string }> = {
  funding: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Funding', icon: '$' },
  species: { bg: 'bg-green-100', text: 'text-green-700', label: 'Species', icon: 'S' },
  assurance: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Assurance', icon: 'A' },
};

/* ── Helpers ─────────────────────────────────────────────── */

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/* ── VA Detail Drawer ────────────────────────────────────── */

function AccountDetailDrawer({
  account,
  onClose,
}: {
  account: VirtualAccount;
  onClose: () => void;
}) {
  const style = SUBTYPE_STYLES[account.subtype];
  const { data: oracleEntries } = useOracleLedger(account.id);
  const liveTrail: AuditEvent[] | null = oracleEntries && oracleEntries.length > 0
    ? oracleEntries.map((e: { event_type?: string; type?: string; timestamp: string }) => ({
        event: e.event_type ?? e.type ?? 'unknown',
        timestamp: e.timestamp,
        source: 'Oracle',
      }))
    : null;
  const displayTrail = liveTrail ?? account.auditTrail;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-[var(--color-border)] shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Account Detail</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] transition-colors"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Icon + Name */}
          <div className="flex items-center gap-3 mb-6">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold', style.bg, style.text)}>
              {style.icon}
            </div>
            <div>
              <p className="text-sm font-semibold">{account.name}</p>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', style.bg, style.text)}>
                {style.label}
              </span>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Balance</p>
            <p className="text-2xl font-bold">{formatUsdcDisplay(account.balance)}</p>
          </div>

          {/* Specie count */}
          {account.subtype === 'species' && account.specieCount != null && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Specie Count</p>
              <p className="text-sm font-medium">{formatSpecieCount(account.specieCount)}</p>
            </div>
          )}

          {/* Coverage bar */}
          {account.subtype === 'assurance' && account.coveragePercent != null && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Coverage</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-[var(--color-bg-card)] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      account.coveragePercent >= 80 ? 'bg-[#C5DE8A]' : account.coveragePercent >= 50 ? 'bg-[#FFCE73]' : 'bg-[#E74C3C]',
                    )}
                    style={{ width: `${account.coveragePercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold">{account.coveragePercent}%</span>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Status</p>
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00] capitalize">
              {account.status}
            </span>
          </div>

          {/* Deposit address */}
          {account.depositAddress && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Deposit Address</p>
              <code className="text-xs font-mono bg-[var(--color-bg-card)] px-3 py-1.5 rounded block break-all">
                {account.depositAddress}
              </code>
              <div className="mt-3 w-24 h-24 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center">
                <span className="text-[10px] text-[var(--color-text-secondary)]">QR Placeholder</span>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Last Updated</p>
            <p className="text-sm">{new Date(account.lastUpdated).toLocaleString()}</p>
          </div>

          {/* Oracle Audit Trail */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">Oracle Audit Trail</p>
            <div className="relative pl-4 border-l-2 border-[var(--color-border)] space-y-3">
              {displayTrail.map((evt, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-cta-primary)]" />
                  <p className="text-sm font-mono font-medium">{evt.event}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {new Date(evt.timestamp).toLocaleString()} &middot; {evt.source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Account Card ────────────────────────────────────────── */

function AccountCard({
  account,
  onClick,
}: {
  account: VirtualAccount;
  onClick: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const style = SUBTYPE_STYLES[account.subtype];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (account.depositAddress) {
      await navigator.clipboard.writeText(account.depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={onClick}
      className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)] flex flex-col cursor-pointer hover:bg-[var(--color-bg-card)] transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold', style.bg, style.text)}>
            {style.icon}
          </div>
          <h3 className="text-sm font-semibold">{account.name}</h3>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', style.bg, style.text)}>
          {style.label}
        </span>
      </div>

      {/* Balance */}
      <p className="text-2xl font-bold mb-1">{formatUsdcDisplay(account.balance)}</p>

      {/* Subtype-specific content */}
      {account.subtype === 'funding' && account.depositAddress && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">Deposit:</span>
          <code className="text-xs font-mono bg-[var(--color-bg-card)] px-2 py-0.5 rounded">
            {truncateAddress(account.depositAddress)}
          </code>
          <button
            onClick={handleCopy}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Copy address"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            )}
          </button>
        </div>
      )}

      {account.subtype === 'species' && account.specieCount != null && (
        <div className="mt-1">
          <p className="text-sm text-[var(--color-text-secondary)]">{formatSpecieCount(account.specieCount)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            USDC equivalent: {formatUsdcDisplay(account.balance)}
          </p>
        </div>
      )}

      {account.subtype === 'assurance' && account.coveragePercent != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Coverage</span>
            <span className="text-xs font-semibold">{account.coveragePercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--color-bg-card)] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                account.coveragePercent >= 80 ? 'bg-[#C5DE8A]' : account.coveragePercent >= 50 ? 'bg-[#FFCE73]' : 'bg-[#E74C3C]',
              )}
              style={{ width: `${account.coveragePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 flex items-center justify-between">
        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#C5DE8A]/20 text-[#3d6b00] capitalize">
          {account.status}
        </span>
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          Updated {new Date(account.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/* ── Genome Card ─────────────────────────────────────────── */

function GenomeCard({ genome }: { genome: SpecieGenome }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-2">
        <code className="text-xs font-mono font-semibold text-[var(--color-text-primary)]">{genome.genomeId}</code>
        <span
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
            genome.status === 'active' ? 'bg-[#C5DE8A]/30 text-[#3d6b00]' : 'bg-[#FFCE73]/30 text-[#8a6d00]',
          )}
        >
          {genome.status === 'active' ? 'Active' : 'In Transit'}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-[var(--color-text-secondary)]">Created</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">{new Date(genome.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-[var(--color-text-secondary)]">Last Transfer</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">{new Date(genome.lastTransfer).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */

export function AssetsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const selectedAccount = selectedAccountId
    ? MOCK_ACCOUNTS.find((a) => a.id === selectedAccountId) ?? null
    : null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Assets</h1>
        <button
          disabled
          className="px-4 py-2 text-sm font-semibold rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          + Create VA
        </button>
      </div>

      {/* Virtual Accounts */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">Virtual Accounts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {MOCK_ACCOUNTS.map((account) => (
          <AccountCard key={account.id} account={account} onClick={() => setSelectedAccountId(account.id)} />
        ))}
      </div>

      {/* Onli Vault */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">Onli Vault</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">Specie genome records held in your vault.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {MOCK_GENOMES.map((genome) => (
          <GenomeCard key={genome.id} genome={genome} />
        ))}
      </div>

      {/* Detail Drawer */}
      {selectedAccount && (
        <AccountDetailDrawer account={selectedAccount} onClose={() => setSelectedAccountId(null)} />
      )}
    </div>
  );
}
