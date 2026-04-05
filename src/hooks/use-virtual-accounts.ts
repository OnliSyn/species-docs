'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as marketsb from '@/api/marketsb';
import * as species from '@/api/species';
import * as onliCloud from '@/api/onli-cloud';
import type { EventRequest } from '@/types';

// === MarketSB Hooks ===

export function useVirtualAccount(vaId: string | null) {
  return useQuery({
    queryKey: ['virtual-account', vaId],
    queryFn: () => marketsb.getVirtualAccount(vaId!),
    enabled: !!vaId,
  });
}

export function useVirtualAccounts(ownerRef: string | null) {
  return useQuery({
    queryKey: ['virtual-accounts', ownerRef],
    queryFn: () => marketsb.listVirtualAccounts(ownerRef!),
    enabled: !!ownerRef,
  });
}

export function useDepositStatus(depositId: string | null) {
  return useQuery({
    queryKey: ['deposit', depositId],
    queryFn: () => marketsb.getDepositStatus(depositId!),
    enabled: !!depositId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'credited' || status === 'failed') return false;
      return 5000; // Poll every 5s until terminal state
    },
  });
}

export function useWithdrawalStatus(withdrawalId: string | null) {
  return useQuery({
    queryKey: ['withdrawal', withdrawalId],
    queryFn: () => marketsb.getWithdrawalStatus(withdrawalId!),
    enabled: !!withdrawalId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'confirmed' || status === 'failed') return false;
      return 5000;
    },
  });
}

export function useOracleLedger(vaId: string | null) {
  return useQuery({
    queryKey: ['oracle-ledger', vaId],
    queryFn: () => marketsb.getOracleLedger(vaId!),
    enabled: !!vaId,
  });
}

export function useReconciliationStatus() {
  return useQuery({
    queryKey: ['reconciliation-status'],
    queryFn: marketsb.getReconciliationStatus,
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marketsb.createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
    },
  });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marketsb.requestWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
    },
  });
}

// === Species Hooks ===

export function useSubmitOrder() {
  return useMutation({
    mutationFn: (request: EventRequest) => species.submitOrder(request),
  });
}

export function useOrderReceipt(eventId: string | null) {
  return useQuery({
    queryKey: ['order-receipt', eventId],
    queryFn: () => species.getOrderReceipt(eventId!),
    enabled: !!eventId,
  });
}

export function useMarketplaceStats() {
  return useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: species.getMarketplaceStats,
    staleTime: 60_000,
  });
}

// === Onli Cloud Hooks ===

export function useVaultBalance(userId: string | null) {
  return useQuery({
    queryKey: ['vault-balance', userId],
    queryFn: () => onliCloud.getVaultBalance(userId!),
    enabled: !!userId,
  });
}

// === Dual-System Cross-Reference ===

export function useAssetBalance(speciesVaId: string | null, userId: string | null) {
  const speciesVA = useVirtualAccount(speciesVaId);
  const vault = useVaultBalance(userId);

  const financialBalance = speciesVA.data?.balance?.posted_balance
    ? BigInt(speciesVA.data.balance.posted_balance)
    : 0n;
  const possessionCount = vault.data?.specie_count ?? 0;
  const expectedFinancial = BigInt(possessionCount) * 1_000_000n;
  const isReconciled = financialBalance === expectedFinancial;

  return {
    financialBalance,
    possessionCount,
    isReconciled,
    isLoading: speciesVA.isLoading || vault.isLoading,
    error: speciesVA.error || vault.error,
  };
}
