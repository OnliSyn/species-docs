'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useTabStore } from '@/stores/tab-store';
import { useMemo } from 'react';

export function useOnliChat() {
  const chatMode = useTabStore((s) => s.chatMode);

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
  });

  return chat;
}
