import type { VirtualAccount, Deposit, Withdrawal, Transfer, OracleEvent, ReconciliationStatus, MarketSBError } from '@/types';
import { IS_MOCK_MARKETSB, withMockFallback } from './mock-interceptor';
import {
  MOCK_VIRTUAL_ACCOUNTS,
  MOCK_DEPOSITS,
  MOCK_WITHDRAWALS,
  MOCK_TRANSFERS as _MOCK_TRANSFERS,
  MOCK_ORACLE_EVENTS,
  MOCK_RECONCILIATION_STATUS,
} from '@/lib/mock-data';

const MARKETSB_BASE_URL = '/api/v1';

class MarketSBApiError extends Error {
  readonly status: number;
  readonly body: MarketSBError;

  constructor(status: number, body: MarketSBError) {
    super(body.message);
    this.name = 'MarketSBApiError';
    this.status = status;
    this.body = body;
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
  const mock = MOCK_VIRTUAL_ACCOUNTS.find((a) => a.id === vaId) ?? MOCK_VIRTUAL_ACCOUNTS[0];
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/virtual-accounts/${vaId}`), mock);
}

export async function listVirtualAccounts(ownerRef: string): Promise<VirtualAccount[]> {
  const mock = MOCK_VIRTUAL_ACCOUNTS.filter((a) => a.owner_ref === ownerRef);
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/virtual-accounts?owner_ref=${ownerRef}`), mock);
}

export async function getDepositStatus(depositId: string): Promise<Deposit> {
  const mock = MOCK_DEPOSITS.find((d) => d.id === depositId) ?? MOCK_DEPOSITS[0];
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/deposits/${depositId}`), mock);
}

export async function getWithdrawalStatus(withdrawalId: string): Promise<Withdrawal> {
  const mock = MOCK_WITHDRAWALS.find((w) => w.id === withdrawalId) ?? MOCK_WITHDRAWALS[0];
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/withdrawals/${withdrawalId}`), mock);
}

export async function getOracleLedger(vaId: string): Promise<OracleEvent[]> {
  const mock = MOCK_ORACLE_EVENTS.filter((e) => e.va_id === vaId);
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/oracle/virtual-accounts/${vaId}/ledger`), mock);
}

export async function getReconciliationStatus(): Promise<ReconciliationStatus> {
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch('/reconciliation/status'), MOCK_RECONCILIATION_STATUS);
}

// === WRITE Operations ===

export async function createTransfer(params: {
  source_va_id: string;
  destination_va_id: string;
  amount: string;
  idempotency_key: string;
}): Promise<Transfer> {
  const mockTransfer: Transfer = {
    id: `txfr_mock_${Date.now()}`,
    source_va_id: params.source_va_id,
    destination_va_id: params.destination_va_id,
    amount: params.amount,
    idempotency_key: params.idempotency_key,
    status: 'completed',
    created_at: new Date().toISOString(),
  };
  return withMockFallback(
    IS_MOCK_MARKETSB,
    () => marketsbFetch('/transfers', { method: 'POST', body: JSON.stringify(params) }),
    mockTransfer,
  );
}

export async function requestWithdrawal(params: {
  va_id: string;
  destination: string;
  amount: string;
  idempotency_key: string;
}): Promise<Withdrawal> {
  const mockWithdrawal: Withdrawal = {
    id: `wd_mock_${Date.now()}`,
    va_id: params.va_id,
    amount: params.amount,
    destination: params.destination,
    status: 'requested',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return withMockFallback(
    IS_MOCK_MARKETSB,
    () => marketsbFetch('/withdrawals', { method: 'POST', body: JSON.stringify(params) }),
    mockWithdrawal,
  );
}

export interface CashierAuditEvent {
  eventId: string;
  type: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export async function getAuditEvents(type?: string): Promise<CashierAuditEvent[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('limit', '100');
  const qs = params.toString();
  return withMockFallback(IS_MOCK_MARKETSB, () => marketsbFetch(`/cashier/audit/events?${qs}`), []);
}

export async function verifyOracle(vaId: string): Promise<{ verified: boolean; details: unknown }> {
  return withMockFallback(
    IS_MOCK_MARKETSB,
    () => marketsbFetch(`/oracle/virtual-accounts/${vaId}/verify`, { method: 'POST' }),
    { verified: true, details: { checked_at: new Date().toISOString() } },
  );
}

export async function runReconciliation(): Promise<ReconciliationStatus> {
  return withMockFallback(
    IS_MOCK_MARKETSB,
    () => marketsbFetch('/reconciliation/run', { method: 'POST' }),
    { ...MOCK_RECONCILIATION_STATUS, last_run: new Date().toISOString(), status: 'running' },
  );
}

export { MarketSBApiError };
