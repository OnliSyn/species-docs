'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTabStore } from '@/stores/tab-store';

// ---------------------------------------------------------------------------
// Parse userSystem.md — prompts grouped by mode
// ---------------------------------------------------------------------------
const WELCOME_MESSAGE = 'Your assistant for digital assets, the Onli ecosystem, and the Species Marketplace.';

const SYSTEM_PROMPTS: Record<string, string[]> = {
  ask: [
    'Give me an interesting fact about Onli',
    'How do I get started with Onli?',
  ],
  trade: [
    'What is my current funding balance?',
    'What is my trading account balance?',
    'What are the current market statistics?',
    'Show me my last 5 transactions',
  ],
  develop: [
    'What is a Genome in the Onli system?',
    'Explain the Species marketplace pipeline',
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SystemCard {
  id: string;
  ui: string;
  data: Record<string, unknown>;
  toolName: string;
  commentary: string;
  prompt: string;
}

interface UseSystemChatReturn {
  cards: SystemCard[];
  isLoading: boolean;
  dismissedIds: Set<string>;
  dismissCard: (id: string) => void;
  restoreCard: (id: string) => void;
  refreshNow: () => void;
  welcomeMessage: string;
}

const POLL_INTERVAL = 5_000; // 5 seconds — fast enough for post-journey balance updates

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSystemChat(): UseSystemChatReturn {
  const chatMode = useTabStore((s) => s.chatMode);
  const [cards, setCards] = useState<SystemCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const failCountRef = useRef(0);

  const fetchCards = useCallback(async (mode: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const prompts = SYSTEM_PROMPTS[mode] || [];
    if (prompts.length === 0) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/system-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompts }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`system-chat ${res.status}`);

      const json = await res.json();
      const results = json.results as Array<{
        toolName: string;
        data: Record<string, unknown>;
        commentary: string;
      }>;

      const newCards: SystemCard[] = results.map((r, i) => ({
        id: `${mode}-${r.toolName}-${i}`,
        ui: String(r.data._ui || ''),
        data: r.data,
        toolName: r.toolName,
        commentary: r.commentary,
        prompt: prompts[i] || '',
      }));

      setCards(newCards);
      failCountRef.current = 0; // reset on success
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[useSystemChat] fetch failed:', err);
        failCountRef.current += 1;

        // After 5 consecutive failures, stop polling
        if (failCountRef.current >= 5 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          console.warn('[useSystemChat] Stopped polling after 5 consecutive failures');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount + mode switch
  useEffect(() => {
    setDismissedIds(new Set()); // clear dismissals on mode switch
    failCountRef.current = 0; // reset fail count on mode switch
    fetchCards(chatMode);

    // Polling with exponential backoff
    if (intervalRef.current) clearInterval(intervalRef.current);

    const startPolling = () => {
      const delay = Math.min(
        POLL_INTERVAL * Math.pow(2, failCountRef.current),
        60_000,
      );
      intervalRef.current = setTimeout(() => {
        fetchCards(chatMode).then(() => {
          if (failCountRef.current < 5) {
            startPolling();
          }
        });
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };
    startPolling();

    // Listen for journey-complete events (fired from chat after mutations)
    const handleRefresh = () => fetchCards(chatMode);
    window.addEventListener('synth:balance-changed', handleRefresh);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>);
        intervalRef.current = null;
      }
      abortRef.current?.abort();
      window.removeEventListener('synth:balance-changed', handleRefresh);
    };
  }, [chatMode, fetchCards]);

  const dismissCard = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const restoreCard = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const refreshNow = useCallback(() => {
    fetchCards(chatMode);
  }, [chatMode, fetchCards]);

  return { cards, isLoading, dismissedIds, dismissCard, restoreCard, refreshNow, welcomeMessage: WELCOME_MESSAGE };
}
