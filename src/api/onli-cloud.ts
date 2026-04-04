import type { VaultBalance, TransferReceipt } from '@/types';

const ONLI_CLOUD_URL = import.meta.env.VITE_ONLI_CLOUD_API_URL || 'http://localhost:3003';

async function onliCloudFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${ONLI_CLOUD_URL}${path}`);
  if (!response.ok) throw new Error('Onli Cloud API error');
  return response.json();
}

export async function getVaultBalance(userId: string): Promise<VaultBalance> {
  return onliCloudFetch(`/vaults/${userId}/balance`);
}

export async function getTransferReceipt(receiptId: string): Promise<TransferReceipt> {
  return onliCloudFetch(`/transfers/${receiptId}/receipt`);
}
