// ── Bootstrap cashier spec accounts + config from sim defaults ──

import type { SimState, VirtualAccountState } from './state.js';
import { createEmptyState } from './state.js';
import type { CashierAccount, CashierRuntimeConfig, CashierSystemUser } from './cashier-types.js';
import { CASHIER_VA } from './cashier-types.js';
import { USERS, vaIds } from './seed.js';

const DEFAULT_LISTING_FEE = 50n * 1_000_000n; // $50 in 6dp — spec says 50.00 default listing
const DEFAULT_LIQUIDITY_BPS = 100n; // 1.00%

function nowIso() {
  return new Date().toISOString();
}

function makeFeeVa(vaId: string, name: string, tbCode: number): VirtualAccountState {
  const t = nowIso();
  return {
    vaId,
    ownerRef: 'system',
    subtype: 'system',
    tbCode,
    posted: 0n,
    pending: 0n,
    depositAddress: `0x${vaId.replace(/[^a-z0-9]/g, '').slice(0, 40)}`,
    currency: 'USDC',
    status: 'active',
    createdAt: t,
    updatedAt: t,
  };
}

/** Well-known master account ids */
export const CASHIER_MASTER_IDS = {
  incoming: 'acc-master-incoming',
  market: 'acc-master-market',
  outgoing: 'acc-master-outgoing',
  operating: 'acc-master-operating',
} as const;

export const CASHIER_SUB_IDS = {
  listingFee: 'acc-sub-listing-fee',
  liquidityFee: 'acc-sub-liquidity-fee',
  assurance: 'acc-sub-assurance',
} as const;

/**
 * Ensures fee VAs exist and cashier runtime + account registry is populated.
 * Idempotent; safe to call after seedBase / seedDevelopment.
 */
export function bootstrapCashierFromState(state: SimState, opts?: { force?: boolean }): void {
  if (state.cashier?.initialized && !opts?.force) {
    return;
  }

  const t = nowIso();

  if (!state.virtualAccounts.has(CASHIER_VA.listingFee)) {
    state.virtualAccounts.set(CASHIER_VA.listingFee, makeFeeVa(CASHIER_VA.listingFee, 'listingFee', 115));
  }
  if (!state.virtualAccounts.has(CASHIER_VA.liquidityFee)) {
    state.virtualAccounts.set(CASHIER_VA.liquidityFee, makeFeeVa(CASHIER_VA.liquidityFee, 'liquidityFee', 116));
  }

  const cfg: CashierRuntimeConfig = {
    initialized: true,
    adminUsername: 'admin',
    adminPassword: 'admin',
    marketMakerUserId: 'user-market-maker',
    marketplaceOperatorUserId: 'user-marketplace-operator',
    listingFeeBaseUnits: DEFAULT_LISTING_FEE,
    liquidityFeeBps: DEFAULT_LIQUIDITY_BPS,
    oracleKeyRef: 'sim-oracle-key',
    effectiveAt: t,
  };
  state.cashier = cfg;

  const upsertUser = (u: CashierSystemUser) => {
    state.cashierSystemUsers.set(u.userId, u);
  };

  upsertUser({
    userId: cfg.marketMakerUserId,
    displayName: 'Market Maker',
    metadata: {},
    state: 'ACTIVE',
    createdAt: t,
    updatedAt: t,
  });
  upsertUser({
    userId: cfg.marketplaceOperatorUserId,
    displayName: 'Marketplace Operator',
    metadata: {},
    state: 'ACTIVE',
    createdAt: t,
    updatedAt: t,
  });

  const masters: CashierAccount[] = [
    {
      accountId: CASHIER_MASTER_IDS.incoming,
      ownerId: 'system',
      accountType: 'MASTER',
      name: 'incoming',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: {},
      balanceRef: { kind: 'systemWallet', wallet: 'incoming' },
      createdAt: t,
      updatedAt: t,
    },
    {
      accountId: CASHIER_MASTER_IDS.market,
      ownerId: 'system',
      accountType: 'MASTER',
      name: 'market',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: {},
      balanceRef: { kind: 'systemWallet', wallet: 'market' },
      createdAt: t,
      updatedAt: t,
    },
    {
      accountId: CASHIER_MASTER_IDS.outgoing,
      ownerId: 'system',
      accountType: 'MASTER',
      name: 'outgoing',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: {},
      balanceRef: { kind: 'systemWallet', wallet: 'outgoing' },
      createdAt: t,
      updatedAt: t,
    },
    {
      accountId: CASHIER_MASTER_IDS.operating,
      ownerId: 'system',
      accountType: 'MASTER',
      name: 'operating',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: {},
      balanceRef: { kind: 'systemWallet', wallet: 'operating' },
      createdAt: t,
      updatedAt: t,
    },
  ];

  const subs: CashierAccount[] = [
    {
      accountId: CASHIER_SUB_IDS.listingFee,
      ownerId: cfg.marketplaceOperatorUserId,
      accountType: 'SUBACCOUNT',
      name: 'listingFee',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: { vaId: CASHIER_VA.listingFee },
      balanceRef: { kind: 'virtualAccount', vaId: CASHIER_VA.listingFee },
      createdAt: t,
      updatedAt: t,
    },
    {
      accountId: CASHIER_SUB_IDS.liquidityFee,
      ownerId: cfg.marketMakerUserId,
      accountType: 'SUBACCOUNT',
      name: 'liquidityFee',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: { vaId: CASHIER_VA.liquidityFee },
      balanceRef: { kind: 'virtualAccount', vaId: CASHIER_VA.liquidityFee },
      createdAt: t,
      updatedAt: t,
    },
    {
      accountId: CASHIER_SUB_IDS.assurance,
      ownerId: cfg.marketMakerUserId,
      accountType: 'SUBACCOUNT',
      name: 'assurance',
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: { vaId: CASHIER_VA.assurancePool },
      balanceRef: { kind: 'virtualAccount', vaId: CASHIER_VA.assurancePool },
      createdAt: t,
      updatedAt: t,
    },
  ];

  for (const a of masters) state.cashierAccounts.set(a.accountId, a);
  for (const a of subs) state.cashierAccounts.set(a.accountId, a);

  // Register each user's funding VA as a cashier account (for trade/list/redeem demos)
  for (const user of Object.values(USERS)) {
    const ids = vaIds(user.ref);
    const accId = `acc-user-funding-${user.ref}`;
    const ca: CashierAccount = {
      accountId: accId,
      ownerId: user.ref,
      accountType: 'SUBACCOUNT',
      name: `funding-${user.ref}`,
      parentAccountId: null,
      state: 'ACTIVE',
      currency: 'USD',
      metadata: { vaId: ids.funding, displayName: user.name },
      balanceRef: { kind: 'virtualAccount', vaId: ids.funding },
      createdAt: t,
      updatedAt: t,
    };
    state.cashierAccounts.set(accId, ca);
  }
}

/** Merge cashier domain when control panel replaces state slices */
export function mergeCashierState(target: SimState, source: SimState): void {
  target.cashier = source.cashier;
  target.cashierAccounts = source.cashierAccounts;
  target.cashierTransactions = source.cashierTransactions;
  target.cashierReceipts = source.cashierReceipts;
  target.cashierOracleEntries = source.cashierOracleEntries;
  target.cashierSystemUsers = source.cashierSystemUsers;
  target.cashierIdempotency = source.cashierIdempotency;
  target.auditEvents = source.auditEvents;
  target.useStrictCashierPostBatch = source.useStrictCashierPostBatch;
}

/** For tests: empty state + bootstrap */
export function createBootstrappedEmptyState(): SimState {
  const s = createEmptyState();
  bootstrapCashierFromState(s, { force: true });
  return s;
}
