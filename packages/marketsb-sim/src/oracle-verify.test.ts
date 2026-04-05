import { describe, expect, it } from 'vitest';
import { verifyVaOracleLedger } from './oracle-verify.js';
import type { OracleEntry } from './state.js';

describe('verifyVaOracleLedger', () => {
  it('validates a contiguous chain', () => {
    const entries: OracleEntry[] = [
      {
        entryId: 'a',
        vaId: 'v1',
        type: 'credit',
        amount: 100n,
        balanceBefore: 0n,
        balanceAfter: 100n,
        ref: 'r1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        entryId: 'b',
        vaId: 'v1',
        type: 'debit',
        amount: 30n,
        balanceBefore: 100n,
        balanceAfter: 70n,
        ref: 'r2',
        timestamp: '2026-01-01T00:01:00.000Z',
      },
    ];
    const r = verifyVaOracleLedger(70n, entries);
    expect(r.isValid).toBe(true);
    expect(r.finalComputedBalance).toBe(70n);
  });

  it('detects a broken chain', () => {
    const entries: OracleEntry[] = [
      {
        entryId: 'a',
        vaId: 'v1',
        type: 'credit',
        amount: 100n,
        balanceBefore: 0n,
        balanceAfter: 100n,
        ref: 'r1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        entryId: 'b',
        vaId: 'v1',
        type: 'debit',
        amount: 30n,
        balanceBefore: 50n,
        balanceAfter: 20n,
        ref: 'r2',
        timestamp: '2026-01-01T00:01:00.000Z',
      },
    ];
    const r = verifyVaOracleLedger(20n, entries);
    expect(r.isValid).toBe(false);
    expect(r.detail).toBeDefined();
  });
});
