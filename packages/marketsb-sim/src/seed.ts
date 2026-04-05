// ── @marketsb/sim — Development seed data ──

import type { SimState, VirtualAccountState, DepositState, OracleEntry } from './state.js';
import { createEmptyState } from './state.js';

function makeVA(
  vaId: string,
  ownerRef: string,
  subtype: VirtualAccountState['subtype'],
  tbCode: number,
  posted: bigint,
  depositAddress: string = '',
): VirtualAccountState {
  return {
    vaId,
    ownerRef,
    subtype,
    tbCode,
    posted,
    pending: 0n,
    depositAddress: depositAddress || `0x${vaId.replace(/[^a-z0-9]/g, '').slice(0, 40)}`,
    currency: 'USDC',
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-04-03T11:55:00.000Z',
  };
}

export function seedDevelopment(): SimState {
  const state = createEmptyState();

  // ── System accounts ──
  const systemAccounts: VirtualAccountState[] = [
    makeVA('treasury-100', 'system', 'system', 100, 50_000_000_000_000n),    // $50,000,000
    makeVA('settlement-200', 'system', 'system', 200, 5_000_000_000_000n),   // $5,000,000
    makeVA('operating-300', 'system', 'system', 300, 1_250_000_000_000n),    // $1,250,000
    makeVA('pending-deposit-400', 'system', 'system', 400, 0n),
    makeVA('pending-withdrawal-450', 'system', 'system', 450, 0n),
  ];

  for (const va of systemAccounts) {
    state.virtualAccounts.set(va.vaId, va);
  }

  // ── User: Alex Morgan (user-001) ──
  const alexFunding = makeVA(
    'va-funding-user-001',
    'user-001',
    'funding',
    500,
    12_450_000_000n,  // $12,450
    '0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2',
  );
  const alexSpecies = makeVA(
    'va-species-user-001',
    'user-001',
    'species',
    510,
    8_500_000_000n,  // $8,500
  );
  const alexAssurance = makeVA(
    'va-assurance-user-001',
    'user-001',
    'assurance',
    520,
    950_000_000_000n,  // $950,000
  );

  state.virtualAccounts.set(alexFunding.vaId, alexFunding);
  state.virtualAccounts.set(alexSpecies.vaId, alexSpecies);
  state.virtualAccounts.set(alexAssurance.vaId, alexAssurance);

  // ── Historical deposits ──
  const deposits: DepositState[] = [
    {
      depositId: 'dep-001',
      vaId: 'va-funding-user-001',
      amount: 5_000_000_000n,
      status: 'registered',
      lifecycle: [
        { state: 'detected', timestamp: '2026-03-01T10:00:00.000Z' },
        { state: 'compliance_pending', timestamp: '2026-03-01T10:00:02.000Z' },
        { state: 'compliance_passed', timestamp: '2026-03-01T10:00:05.000Z' },
        { state: 'credited', timestamp: '2026-03-01T10:00:06.000Z' },
        { state: 'registered', timestamp: '2026-03-01T10:00:06.500Z' },
      ],
      txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
      chain: 'base',
      oracleRef: 'fo-dep-001',
    },
    {
      depositId: 'dep-002',
      vaId: 'va-funding-user-001',
      amount: 3_000_000_000n,
      status: 'registered',
      lifecycle: [
        { state: 'detected', timestamp: '2026-03-10T14:00:00.000Z' },
        { state: 'compliance_pending', timestamp: '2026-03-10T14:00:02.000Z' },
        { state: 'compliance_passed', timestamp: '2026-03-10T14:00:04.000Z' },
        { state: 'credited', timestamp: '2026-03-10T14:00:05.000Z' },
        { state: 'registered', timestamp: '2026-03-10T14:00:05.500Z' },
      ],
      txHash: '0xdef789abc012def789abc012def789abc012def789abc012def789abc012def7',
      chain: 'base',
      oracleRef: 'fo-dep-002',
    },
    {
      depositId: 'dep-003',
      vaId: 'va-funding-user-001',
      amount: 2_500_000_000n,
      status: 'registered',
      lifecycle: [
        { state: 'detected', timestamp: '2026-03-20T09:30:00.000Z' },
        { state: 'compliance_pending', timestamp: '2026-03-20T09:30:01.000Z' },
        { state: 'compliance_passed', timestamp: '2026-03-20T09:30:03.000Z' },
        { state: 'credited', timestamp: '2026-03-20T09:30:04.000Z' },
        { state: 'registered', timestamp: '2026-03-20T09:30:04.500Z' },
      ],
      txHash: '0x111222333444555666777888999aaabbbcccdddeeefff000111222333444555',
      chain: 'base',
      oracleRef: 'fo-dep-003',
    },
    {
      depositId: 'dep-004',
      vaId: 'va-funding-user-001',
      amount: 1_950_000_000n,
      status: 'credited',
      lifecycle: [
        { state: 'detected', timestamp: '2026-04-01T08:00:00.000Z' },
        { state: 'compliance_pending', timestamp: '2026-04-01T08:00:01.000Z' },
        { state: 'compliance_passed', timestamp: '2026-04-01T08:00:03.000Z' },
        { state: 'credited', timestamp: '2026-04-01T08:00:04.000Z' },
      ],
      txHash: '0xfff000eee111ddd222ccc333bbb444aaa555999888777666555444333222111',
      chain: 'base',
      oracleRef: 'fo-dep-004',
    },
  ];

  for (const dep of deposits) {
    state.deposits.set(dep.depositId, dep);
  }

  // ── Oracle entries for deposits ──
  const oracleEntries: OracleEntry[] = [
    {
      entryId: 'fo-dep-001',
      vaId: 'va-funding-user-001',
      type: 'deposit_credited',
      amount: 5_000_000_000n,
      balanceBefore: 0n,
      balanceAfter: 5_000_000_000n,
      ref: 'dep-001',
      timestamp: '2026-03-01T10:00:06.000Z',
    },
    {
      entryId: 'fo-dep-002',
      vaId: 'va-funding-user-001',
      type: 'deposit_credited',
      amount: 3_000_000_000n,
      balanceBefore: 5_000_000_000n,
      balanceAfter: 8_000_000_000n,
      ref: 'dep-002',
      timestamp: '2026-03-10T14:00:05.000Z',
    },
    {
      entryId: 'fo-dep-003',
      vaId: 'va-funding-user-001',
      type: 'deposit_credited',
      amount: 2_500_000_000n,
      balanceBefore: 8_000_000_000n,
      balanceAfter: 10_500_000_000n,
      ref: 'dep-003',
      timestamp: '2026-03-20T09:30:04.000Z',
    },
    {
      entryId: 'fo-dep-004',
      vaId: 'va-funding-user-001',
      type: 'deposit_credited',
      amount: 1_950_000_000n,
      balanceBefore: 10_500_000_000n,
      balanceAfter: 12_450_000_000n,
      ref: 'dep-004',
      timestamp: '2026-04-01T08:00:04.000Z',
    },
  ];

  for (const entry of oracleEntries) {
    const existing = state.oracleLog.get(entry.vaId) ?? [];
    existing.push(entry);
    state.oracleLog.set(entry.vaId, existing);
  }

  // ── System wallet balances ──
  state.systemWallets = {
    incoming: 25_000_000_000_000n,  // $25,000,000
    market: 10_000_000_000_000n,    // $10,000,000
    outgoing: 2_000_000_000_000n,   // $2,000,000
    operating: 1_250_000_000_000n,  // $1,250,000
  };

  return state;
}

export function seedTest(): SimState {
  const state = createEmptyState();

  // Minimal: system accounts + one user
  state.virtualAccounts.set('treasury-100', makeVA('treasury-100', 'system', 'system', 100, 10_000_000_000_000n));
  state.virtualAccounts.set('settlement-200', makeVA('settlement-200', 'system', 'system', 200, 1_000_000_000_000n));
  state.virtualAccounts.set('operating-300', makeVA('operating-300', 'system', 'system', 300, 0n));
  state.virtualAccounts.set('pending-deposit-400', makeVA('pending-deposit-400', 'system', 'system', 400, 0n));
  state.virtualAccounts.set('pending-withdrawal-450', makeVA('pending-withdrawal-450', 'system', 'system', 450, 0n));

  state.virtualAccounts.set('va-funding-user-001', makeVA('va-funding-user-001', 'user-001', 'funding', 500, 10_000_000_000n));
  state.virtualAccounts.set('va-species-user-001', makeVA('va-species-user-001', 'user-001', 'species', 510, 0n));
  state.virtualAccounts.set('va-assurance-user-001', makeVA('va-assurance-user-001', 'user-001', 'assurance', 520, 0n));

  state.systemWallets = {
    incoming: 10_000_000_000_000n,
    market: 5_000_000_000_000n,
    outgoing: 500_000_000_000n,
    operating: 0n,
  };

  return state;
}
