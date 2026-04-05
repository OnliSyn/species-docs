import type {
  VirtualAccount,
  Deposit,
  Withdrawal,
  Transfer,
  OracleEvent,
  ReconciliationStatus,
  MarketplaceStats,
  EventReceipt,
  VaultBalance,
} from '@/types';

// === Identity Constants ===

export const MOCK_USER_ID = 'user_001';
export const MOCK_FUNDING_VA_ID = 'va_funding_001';
export const MOCK_SPECIES_VA_ID = 'va_species_001';
export const MOCK_ASSURANCE_VA_ID = 'va_assurance_001';

// === Virtual Accounts ===

export const MOCK_VIRTUAL_ACCOUNTS: VirtualAccount[] = [
  {
    id: MOCK_FUNDING_VA_ID,
    owner_ref: MOCK_USER_ID,
    display_name: 'Primary Funding',
    subtype: 'funding',
    deposit_address: '0x742d35Cc6634C0532925a3b844Bc7e0199f01E23',
    status: 'active',
    balance: {
      account_id: MOCK_FUNDING_VA_ID,
      account_code: 500,
      subtype: 'funding',
      posted_balance: '12450000000',
      pending_balance: '0',
      posted_debits: '15000000000',
      posted_credits: '27450000000',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-04-03T14:30:00Z',
  },
  {
    id: MOCK_SPECIES_VA_ID,
    owner_ref: MOCK_USER_ID,
    display_name: 'Species Holdings',
    subtype: 'species',
    status: 'active',
    balance: {
      account_id: MOCK_SPECIES_VA_ID,
      account_code: 500,
      subtype: 'species',
      posted_balance: '8500000000',
      pending_balance: '0',
      posted_debits: '0',
      posted_credits: '8500000000',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-04-03T15:00:00Z',
  },
  {
    id: MOCK_ASSURANCE_VA_ID,
    owner_ref: MOCK_USER_ID,
    display_name: 'Assurance Reserve',
    subtype: 'assurance',
    status: 'active',
    balance: {
      account_id: MOCK_ASSURANCE_VA_ID,
      account_code: 500,
      subtype: 'assurance',
      posted_balance: '950000000000',
      pending_balance: '0',
      posted_debits: '0',
      posted_credits: '950000000000',
    },
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-04-03T12:00:00Z',
  },
];

// === Deposits ===

export const MOCK_DEPOSITS: Deposit[] = [
  {
    id: 'dep_001',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '5000000000',
    status: 'credited',
    tx_hash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
    confirmations: 12,
    required_confirmations: 12,
    created_at: '2026-03-28T09:15:00Z',
    updated_at: '2026-03-28T09:45:00Z',
  },
  {
    id: 'dep_002',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '2500000000',
    status: 'credited',
    tx_hash: '0xdef789abc012345678901234567890abcdef1234567890abcdef123456789012',
    confirmations: 12,
    required_confirmations: 12,
    created_at: '2026-04-01T11:30:00Z',
    updated_at: '2026-04-01T12:00:00Z',
  },
  {
    id: 'dep_003',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '4950000000',
    status: 'credited',
    tx_hash: '0x123456789abcdef012345678901234567890abcdef1234567890abcdef012345',
    confirmations: 12,
    required_confirmations: 12,
    created_at: '2026-04-03T08:00:00Z',
    updated_at: '2026-04-03T08:30:00Z',
  },
  {
    id: 'dep_004',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '1000000000',
    status: 'awaiting_confirmations',
    tx_hash: '0x456789abcdef012345678901234567890abcdef1234567890abcdef012345678',
    confirmations: 4,
    required_confirmations: 12,
    created_at: '2026-04-04T10:00:00Z',
    updated_at: '2026-04-04T10:05:00Z',
  },
];

// === Withdrawals ===

export const MOCK_WITHDRAWALS: Withdrawal[] = [
  {
    id: 'wd_001',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '3000000000',
    destination: '0x9876543210abcdef9876543210abcdef98765432',
    status: 'confirmed',
    tx_hash: '0x789abcdef012345678901234567890abcdef1234567890abcdef012345678901',
    created_at: '2026-03-30T14:00:00Z',
    updated_at: '2026-03-30T14:45:00Z',
  },
  {
    id: 'wd_002',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '2000000000',
    destination: '0xfedcba0987654321fedcba0987654321fedcba09',
    status: 'confirmed',
    tx_hash: '0xabcdef012345678901234567890abcdef1234567890abcdef012345678901234',
    created_at: '2026-04-02T16:30:00Z',
    updated_at: '2026-04-02T17:15:00Z',
  },
  {
    id: 'wd_003',
    va_id: MOCK_FUNDING_VA_ID,
    amount: '500000000',
    destination: '0x1111222233334444555566667777888899990000',
    status: 'broadcast',
    tx_hash: '0xcdef012345678901234567890abcdef1234567890abcdef0123456789012345ab',
    created_at: '2026-04-04T09:00:00Z',
    updated_at: '2026-04-04T09:10:00Z',
  },
];

// === Transfers ===

export const MOCK_TRANSFERS: Transfer[] = [
  {
    id: 'txfr_001',
    source_va_id: MOCK_FUNDING_VA_ID,
    destination_va_id: MOCK_SPECIES_VA_ID,
    amount: '5000000000',
    idempotency_key: 'idem_txfr_001',
    status: 'completed',
    created_at: '2026-03-20T10:00:00Z',
  },
  {
    id: 'txfr_002',
    source_va_id: MOCK_FUNDING_VA_ID,
    destination_va_id: MOCK_SPECIES_VA_ID,
    amount: '3500000000',
    idempotency_key: 'idem_txfr_002',
    status: 'completed',
    created_at: '2026-03-25T14:30:00Z',
  },
  {
    id: 'txfr_003',
    source_va_id: MOCK_FUNDING_VA_ID,
    destination_va_id: MOCK_ASSURANCE_VA_ID,
    amount: '950000000000',
    idempotency_key: 'idem_txfr_003',
    status: 'completed',
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    id: 'txfr_004',
    source_va_id: MOCK_SPECIES_VA_ID,
    destination_va_id: MOCK_FUNDING_VA_ID,
    amount: '1000000000',
    idempotency_key: 'idem_txfr_004',
    status: 'completed',
    created_at: '2026-04-03T11:00:00Z',
  },
];

// === Oracle Events ===

export const MOCK_ORACLE_EVENTS: OracleEvent[] = [
  {
    id: 'oevt_001',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'specie.minted',
    data: { quantity: 2000, price: '1000000', total: '2000000000' },
    timestamp: '2026-03-20T10:05:00Z',
  },
  {
    id: 'oevt_002',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'specie.minted',
    data: { quantity: 1500, price: '1000000', total: '1500000000' },
    timestamp: '2026-03-22T14:20:00Z',
  },
  {
    id: 'oevt_003',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'specie.transferred',
    data: { quantity: 500, from: MOCK_USER_ID, to: 'user_002' },
    timestamp: '2026-03-25T09:00:00Z',
  },
  {
    id: 'oevt_004',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'specie.minted',
    data: { quantity: 3000, price: '1000000', total: '3000000000' },
    timestamp: '2026-03-28T11:30:00Z',
  },
  {
    id: 'oevt_005',
    va_id: MOCK_FUNDING_VA_ID,
    event_type: 'deposit.credited',
    data: { amount: '5000000000', tx_hash: '0xabc123...' },
    timestamp: '2026-03-28T09:45:00Z',
  },
  {
    id: 'oevt_006',
    va_id: MOCK_FUNDING_VA_ID,
    event_type: 'withdrawal.confirmed',
    data: { amount: '3000000000', destination: '0x9876...' },
    timestamp: '2026-03-30T14:45:00Z',
  },
  {
    id: 'oevt_007',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'specie.minted',
    data: { quantity: 2000, price: '1000000', total: '2000000000' },
    timestamp: '2026-04-01T16:00:00Z',
  },
  {
    id: 'oevt_008',
    va_id: MOCK_ASSURANCE_VA_ID,
    event_type: 'assurance.topped_up',
    data: { amount: '50000000000', new_total: '950000000000' },
    timestamp: '2026-04-02T08:00:00Z',
  },
  {
    id: 'oevt_009',
    va_id: MOCK_FUNDING_VA_ID,
    event_type: 'deposit.credited',
    data: { amount: '4950000000', tx_hash: '0x123456...' },
    timestamp: '2026-04-03T08:30:00Z',
  },
  {
    id: 'oevt_010',
    va_id: MOCK_SPECIES_VA_ID,
    event_type: 'reconciliation.passed',
    data: { variance: '0', checked_at: '2026-04-03T12:00:00Z' },
    timestamp: '2026-04-03T12:00:00Z',
  },
];

// === Reconciliation ===

export const MOCK_RECONCILIATION_STATUS: ReconciliationStatus = {
  last_run: '2026-04-03T12:00:00Z',
  status: 'pass',
  variance: '0',
  details: {
    accounts_checked: 3,
    total_posted: '971450000000',
    expected: '971450000000',
  },
};

// === Marketplace Stats ===

export const MOCK_MARKETPLACE_STATS: MarketplaceStats = {
  total_orders: 1_247,
  orders_today: 38,
  average_order_size: '2850000000',
  unique_users: 312,
  total_volume: '3554950000000',
};

// === Order Receipt ===

export const MOCK_ORDER_RECEIPT: EventReceipt = {
  event_id: 'evt_mock_001',
  intent: 'buy',
  quantity: 100,
  fees: {
    issuance: '500000',
    liquidity: '250000',
    total: '750000',
  },
  status: 'completed',
  timestamp: '2026-04-03T15:00:00Z',
};

// === Vault Balance ===

export const MOCK_VAULT_BALANCE: VaultBalance = {
  user_id: MOCK_USER_ID,
  vault_id: 'vault_001',
  specie_count: 8500,
  last_updated: '2026-04-03T15:00:00Z',
};
