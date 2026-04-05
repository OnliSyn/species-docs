'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PipelineStage, OrderIntent } from '@/types';

interface OrderState {
  isActive: boolean;
  eventId: string | null;
  intent: OrderIntent | null;
  quantity: number;
  currentStage: PipelineStage;
  error: { stage: string; message: string } | null;
}

const INITIAL_STATE: OrderState = {
  isActive: false,
  eventId: null,
  intent: null,
  quantity: 0,
  currentStage: 'order.received',
  error: null,
};

// Simulated pipeline progression for demo
const PIPELINE_STAGES: PipelineStage[] = [
  'order.received',
  'order.validated',
  'order.classified',
  'order.matched',
  'asset.staged',
  'ledger.posted',
  'ownership.changed',
  'order.completed',
];

export function useOrderFlow() {
  const [orderState, setOrderState] = useState<OrderState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startOrder = useCallback((intent: OrderIntent, quantity: number) => {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setOrderState({
      isActive: true,
      eventId,
      intent,
      quantity,
      currentStage: 'order.received',
      error: null,
    });

    // Simulate pipeline progression
    let stageIndex = 0;
    timerRef.current = setInterval(() => {
      stageIndex++;
      if (stageIndex < PIPELINE_STAGES.length) {
        setOrderState(prev => ({
          ...prev,
          currentStage: PIPELINE_STAGES[stageIndex],
        }));
      }

      if (stageIndex >= PIPELINE_STAGES.length - 1) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1500);
  }, []);

  const cancelOrder = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOrderState(INITIAL_STATE);
  }, []);

  const resetOrder = useCallback(() => {
    setOrderState(INITIAL_STATE);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    orderState,
    startOrder,
    cancelOrder,
    resetOrder,
  };
}
