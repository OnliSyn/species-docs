'use client';

import { useEffect } from 'react';
import { useTabStore } from '@/stores/tab-store';
import type { UIMessage } from 'ai';

// Detect if a journey is in progress by scanning assistant messages
function isJourneyActive(messages: UIMessage[]): boolean {
  if (messages.length === 0) return false;

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return false;

  const text = lastAssistant.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join(' ')
    .toLowerCase() || '';

  // Journey is active if the last assistant message asks for confirmation
  if (text.includes('type **confirm**') || text.includes('type confirm')) return true;

  // Journey is active if processing is happening
  if (text.includes('processing deposit') || text.includes('processing through species pipeline')) return true;

  // Journey complete — unlock
  if (text.includes('order complete') || text.includes('deposit complete') ||
      text.includes('transfer complete') || text.includes('withdrawal complete') ||
      text.includes('order cancelled') || text.includes('how else can i help')) return false;

  return false;
}

const JOURNEY_KEYWORDS: { keyword: string; journey: 'buy' | 'sell' | 'transfer' | 'redeem' | 'fund' }[] = [
  { keyword: 'buy', journey: 'buy' },
  { keyword: 'sell', journey: 'sell' },
  { keyword: 'transfer', journey: 'transfer' },
  { keyword: 'redeem', journey: 'redeem' },
  { keyword: 'fund', journey: 'fund' },
];

export function useJourneyTracker(messages: UIMessage[]) {
  const setChatLocked = useTabStore((s) => s.setChatLocked);
  const chatLocked = useTabStore((s) => s.chatLocked);
  const chatMode = useTabStore((s) => s.chatMode);
  const setDevJourney = useTabStore((s) => s.setDevJourney);

  useEffect(() => {
    isJourneyActive(messages);
    // Don't lock during confirmation waits — user needs to type "confirm"
    // Only lock during processing phases
    const lastText = [...messages].reverse().find(m => m.role === 'assistant')?.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text).join(' ').toLowerCase() || '';

    const hasProcessing = lastText.includes('processing deposit') ||
      lastText.includes('processing through') ||
      lastText.includes('submitted! processing');

    const hasCompletion = lastText.includes('order complete') ||
      lastText.includes('deposit complete') ||
      lastText.includes('transfer complete') ||
      lastText.includes('withdrawal complete') ||
      lastText.includes('order cancelled') ||
      lastText.includes('how else can i help');

    // Lock only if processing is happening AND completion hasn't arrived yet
    setChatLocked(hasProcessing && !hasCompletion);
  }, [messages, setChatLocked]);

  // In develop mode, scan last assistant message for journey keywords → update canvas
  useEffect(() => {
    if (chatMode !== 'develop' || messages.length === 0) return;

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;

    const text = lastAssistant.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join(' ')
      .toLowerCase() || '';

    for (const { keyword, journey } of JOURNEY_KEYWORDS) {
      if (text.includes(keyword)) {
        setDevJourney(journey);
        return;
      }
    }
  }, [messages, chatMode, setDevJourney]);

  return { chatLocked };
}
