'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTabStore } from '@/stores/tab-store';

// ---------------------------------------------------------------------------
// Parse userSystem.md — prompts grouped by mode
// ---------------------------------------------------------------------------
const WELCOME_MESSAGE = 'Welcome to Onli Ai. Your intelligent assistant for managing digital assets, exploring the Onli ecosystem, and trading on the Species Marketplace.';

const SYSTEM_PROMPTS: Record<string, string[]> = {
  ask: [
    'What is the definition of Onli?',
    'Give me an interesting fact about Onli',
  ],
  trade: [
    'What is my current funding balance?',
    'What is the assurance balance and buy back guarantee ratio?',
    'Show me my last 5 transactions',
    'What are the current market statistics?',
  ],
  learn: [
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

const POLL_INTERVAL = 30_000; // 30 seconds

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
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[useSystemChat] fetch failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount + mode switch
  useEffect(() => {
    setDismissedIds(new Set()); // clear dismissals on mode switch
    fetchCards(chatMode);

    // Polling
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchCards(chatMode), POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
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
