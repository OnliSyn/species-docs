import type { VaultBalance, TransferReceipt } from '@/types';
import { IS_MOCK_ONLI_CLOUD, withMockFallback } from './mock-interceptor';
import { MOCK_VAULT_BALANCE } from '@/lib/mock-data';

const ONLI_CLOUD_URL = '/marketplace/v1';

async function onliCloudFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${ONLI_CLOUD_URL}${path}`);
  if (!response.ok) throw new Error('Onli Cloud API error');
  return response.json();
}

export async function getVaultBalance(userId: string): Promise<VaultBalance> {
  return withMockFallback(
    IS_MOCK_ONLI_CLOUD,
    () => onliCloudFetch(`/vault/${userId}`),
    { ...MOCK_VAULT_BALANCE, user_id: userId },
  );
}

export async function getTransferReceipt(receiptId: string): Promise<TransferReceipt> {
  const mockReceipt: TransferReceipt = {
    receipt_id: receiptId,
    from_vault: 'vault_001',
    to_vault: 'vault_002',
    specie_count: 100,
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
  return withMockFallback(
    IS_MOCK_ONLI_CLOUD,
    () => onliCloudFetch(`/transfers/${receiptId}/receipt`),
    mockReceipt,
  );
}
