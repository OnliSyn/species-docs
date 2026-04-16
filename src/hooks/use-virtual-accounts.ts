'use client';

import { useEffect } from 'react';
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

/** Aggregated portfolio fields from GET /api/trade-panel (sim state — no client money math). */
export interface TradePanelTruth {
  ok: true;
  userRef: string;
  onliId: string;
  fundingPosted: string;
  speciesVaPosted: string;
  vaultSpecieCount: number;
  assuranceGlobalPosted: string;
  circulationSpecieCount: number;
  circulationValuePosted: string;
  coveragePercent: number;
  timestamp: string;
}

export function useTradePanelTruth(userRef: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['trade-panel', userRef],
    queryFn: async () => {
      const res = await fetch(`/api/trade-panel?userRef=${encodeURIComponent(userRef!)}`);
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || 'trade-panel request failed');
      }
      return body as TradePanelTruth;
    },
    enabled: !!userRef,
  });

  useEffect(() => {
    if (!userRef) return;
    const onBalanceChanged = () => {
      void queryClient.invalidateQueries({ queryKey: ['trade-panel', userRef] });
    };
    window.addEventListener('synth:balance-changed', onBalanceChanged);
    return () => window.removeEventListener('synth:balance-changed', onBalanceChanged);
  }, [queryClient, userRef]);

  return query;
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

export function useAuditEvents(type?: string) {
  return useQuery({
    queryKey: ['audit-events', type],
    queryFn: () => marketsb.getAuditEvents(type),
  });
}

export function useVerifyOracle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vaId: string) => marketsb.verifyOracle(vaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
      queryClient.invalidateQueries({ queryKey: ['oracle-ledger'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['trade-panel'] });
    },
  });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marketsb.requestWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['trade-panel'] });
    },
  });
}

// === Species Hooks ===

export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: EventRequest) => species.submitOrder(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['trade-panel'] });
    },
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

// === Asset Balance (vault count via species proxy — prefer useTradePanelTruth for full panel) ===

export function useAssetBalance(userId: string | null) {
  const vault = useVaultBalance(userId);

  const possessionCount = vault.data?.specie_count ?? 0;

  return {
    possessionCount,
    isLoading: vault.isLoading,
    error: vault.error,
  };
}
