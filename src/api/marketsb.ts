import type { VirtualAccount, Deposit, Withdrawal, Transfer, OracleEvent, ReconciliationStatus, MarketSBError } from '@/types';

const MARKETSB_BASE_URL = import.meta.env.VITE_MARKETSB_API_URL || 'http://localhost:3001';

class MarketSBApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: MarketSBError
  ) {
    super(body.message);
    this.name = 'MarketSBApiError';
  }
}

async function marketsbFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { useAuthStore } = await import('@/stores/auth-store');
  const token = useAuthStore.getState().platformToken;

  const response = await fetch(`${MARKETSB_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'unknown', message: response.statusText }));
    throw new MarketSBApiError(response.status, body);
  }

  return response.json();
}

// === READ Operations ===

export async function getVirtualAccount(vaId: string): Promise<VirtualAccount> {
  return marketsbFetch(`/virtual-accounts/${vaId}`);
}

export async function listVirtualAccounts(ownerRef: string): Promise<VirtualAccount[]> {
  return marketsbFetch(`/virtual-accounts?owner_ref=${ownerRef}`);
}

export async function getDepositStatus(depositId: string): Promise<Deposit> {
  return marketsbFetch(`/deposits/${depositId}`);
}

export async function getWithdrawalStatus(withdrawalId: string): Promise<Withdrawal> {
  return marketsbFetch(`/withdrawals/${withdrawalId}`);
}

export async function getOracleLedger(vaId: string): Promise<OracleEvent[]> {
  return marketsbFetch(`/oracle/virtual-accounts/${vaId}/ledger`);
}

export async function getReconciliationStatus(): Promise<ReconciliationStatus> {
  return marketsbFetch('/reconciliation/status');
}

// === WRITE Operations ===

export async function createTransfer(params: {
  source_va_id: string;
  destination_va_id: string;
  amount: string;
  idempotency_key: string;
}): Promise<Transfer> {
  return marketsbFetch('/transfers', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function requestWithdrawal(params: {
  va_id: string;
  destination: string;
  amount: string;
  idempotency_key: string;
}): Promise<Withdrawal> {
  return marketsbFetch('/withdrawals', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function verifyOracle(vaId: string): Promise<{ verified: boolean; details: unknown }> {
  return marketsbFetch(`/oracle/virtual-accounts/${vaId}/verify`, { method: 'POST' });
}

export async function runReconciliation(): Promise<ReconciliationStatus> {
  return marketsbFetch('/reconciliation/run', { method: 'POST' });
}

export { MarketSBApiError };
