'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useQueryClient } from '@tanstack/react-query';
import { useTabStore } from '@/stores/tab-store';
import { useMemo } from 'react';

export function useOnliChat() {
  const chatMode = useTabStore((s) => s.chatMode);
  const queryClient = useQueryClient();

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/chat',
      body: { mode: chatMode },
    }),
    [chatMode],
  );

  const chat = useChat({
    id: `chat-${chatMode}`,
    transport,
    onFinish: () => {
      // Journey + tools mutate MarketSB/Species sim state after the stream ends.
      // Invalidate money queries directly (CustomEvent alone can race TanStack v5 + default staleTime).
      void queryClient.invalidateQueries({ queryKey: ['trade-panel'] });
      void queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
      void queryClient.invalidateQueries({ queryKey: ['vault-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['oracle-ledger'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('synth:balance-changed'));
      }
    },
  });

  return chat;
}
