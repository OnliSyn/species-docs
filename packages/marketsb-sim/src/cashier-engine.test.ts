import { describe, expect, it, beforeEach } from 'vitest';
import { seedTest } from './seed.js';
import { resetCashierEngineCounters } from './cashier-engine.js';
import { creditAccount, executeList, executeRedeem, executeTrade } from './cashier-engine.js';
import { CASHIER_SUB_IDS } from './cashier-bootstrap.js';

describe('cashier engine', () => {
  beforeEach(() => {
    resetCashierEngineCounters();
  });

  it('executes trade between bootstrapped user funding accounts', () => {
    const state = seedTest();
    const pepper = 'acc-user-funding-user-456';
    const alex = 'acc-user-funding-user-001';

    creditAccount(state, pepper, '100.00');
    const tx = executeTrade(state, {
      senderAccountId: pepper,
      receiverAccountId: alex,
      amountStr: '25.50',
      currency: 'USD',
      metadata: { test: true },
    });

    expect(tx.state).toBe('RECEIPTED');
    expect(tx.type).toBe('TRADE');
    expect(state.cashierReceipts.size).toBeGreaterThanOrEqual(1);
    expect(state.cashierOracleEntries.size).toBeGreaterThanOrEqual(1);
  });

  it('executes list fee to listing sub-account', () => {
    const state = seedTest();
    const pepper = 'acc-user-funding-user-456';
    creditAccount(state, pepper, '100.00');

    const tx = executeList(state, {
      senderAccountId: pepper,
      receiverAccountId: CASHIER_SUB_IDS.listingFee,
      currency: 'USD',
    });

    expect(tx.state).toBe('RECEIPTED');
    expect(tx.type).toBe('LIST');
  });

  it('executes atomic redeem (fee + assurance payout)', () => {
    const state = seedTest();
    const pepper = 'acc-user-funding-user-456';
    creditAccount(state, pepper, '200.00');
    creditAccount(state, CASHIER_SUB_IDS.assurance, '500.00');

    const { feeTx, payoutTx, redeemGroupId } = executeRedeem(state, {
      sellerAccountId: pepper,
      liquidityFeeSubAccountId: CASHIER_SUB_IDS.liquidityFee,
      assuranceSubAccountId: CASHIER_SUB_IDS.assurance,
      redeemAmountStr: '100.00',
      currency: 'USD',
    });

    expect(redeemGroupId).toBeDefined();
    expect(feeTx.state).toBe('RECEIPTED');
    expect(payoutTx.state).toBe('RECEIPTED');
  });
});
