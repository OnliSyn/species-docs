'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useTabStore } from '@/stores/tab-store';
import { useOnliChat } from './hooks/useOnliChat';
import { useSpeechToText } from './hooks/useSpeechToText';
import { useJourneyTracker } from './hooks/useJourneyTracker';
import { VoiceWave } from './components/VoiceWave';
import type { UIMessage } from 'ai';

export function ChatPanel() {
  const { chatMode, chatLocked } = useTabStore();
  const { messages, sendMessage, status } = useOnliChat();
  useJourneyTracker(messages);
  const {
    voiceState,
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
    getAnalyserData,
  } = useSpeechToText();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send when voice transcript is finalized
  useEffect(() => {
    if (voiceState === 'processing' && transcript) {
      sendMessage({ text: transcript });
      resetTranscript();
    }
  }, [voiceState, transcript, sendMessage, resetTranscript]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput('');
  };

  const handleMicClick = () => {
    if (voiceState === 'listening' || voiceState === 'requesting') {
      stopListening();
    } else {
      startListening();
    }
  };

  // Mode-specific welcome content
  const modeConfig = {
    ask: {
      badge: 'LOGGED INTO YOUR ACCOUNT',
      title: 'Welcome',
      subtitle: 'I am Synth and I am an Onli AI that can help you with your services. To learn about Onli select Learn from the tab below. How can I help you today?',
      actions: [
        { label: 'What is my funding balance?', seed: 'What is my current funding balance?' },
        { label: 'Last 5 transactions', seed: 'Show me my last 5 transactions' },
        { label: 'When was my last deposit?', seed: 'When was my last deposit and what was the amount?' },
      ],
    },
    trade: {
      badge: 'SECURELY CONNECTED',
      title: 'Welcome to Species Market',
      subtitle: 'You are securely logged into Species Market. What would you like to do?',
      actions: [
        { label: 'Fund', seed: 'I want to fund my account with USDC' },
        { label: 'Buy', seed: 'I want to buy Specie from the market' },
        { label: 'Sell', seed: 'I want to sell my Specie' },
        { label: 'Transfer', seed: 'I want to transfer Specie to someone' },
      ],
    },
    learn: {
      badge: 'ONLI KNOWLEDGE',
      title: 'Learn about Onli',
      subtitle: 'Explore whitepapers, concepts, and the architecture behind Onli.',
      actions: [
        { label: 'What is Onli?', seed: 'What is Onli and how does it work?' },
        { label: 'Genomes & Genes', seed: 'Explain Genomes and Genes in the Onli system' },
        { label: 'Species Pipeline', seed: 'Walk me through the Species marketplace pipeline' },
        { label: 'Assurance Model', seed: 'How does the 100% assurance backing work?' },
      ],
    },
  };

  const currentMode = modeConfig[chatMode];
  const isVoiceActive = voiceState === 'listening' || voiceState === 'requesting';

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          /* Welcome state — mode-specific */
          <div className="text-center py-12 px-4 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-green)]/20 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)]" />
              {currentMode.badge}
            </div>
            <h2 className="text-[42px] font-extralight tracking-tight mb-4 text-[var(--color-text-primary)]">
              {currentMode.title}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8 leading-relaxed">
              {currentMode.subtitle}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {currentMode.actions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage({ text: action.seed })}
                  className="px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-sidebar)] transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="space-y-4">
            {messages.map((message: UIMessage) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-[var(--radius-card)] px-4 py-3',
                    message.role === 'user'
                      ? 'bg-[var(--color-cta-primary)] text-white animate-slide-in-right'
                      : 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] animate-slide-in-left',
                  )}
                >
                  {message.parts
                    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                    .map((part, i) => (
                      <MarkdownRenderer key={i} content={part.text} />
                    ))}

                  {message.parts
                    .filter((p) => {
                      const t = String((p as Record<string, unknown>).type || '');
                      return t === 'tool-invocation' || t.startsWith('tool-');
                    })
                    .map((part, i) => {
                      const toolPart = part as Record<string, unknown>;
                      if (toolPart.state === 'input-available' || toolPart.state === 'input-streaming') {
                        return (
                          <div key={i} className="my-1 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
                            Processing...
                          </div>
                        );
                      }
                      return null;
                    })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Voice wave overlay — replaces input bar when listening */}
      {isVoiceActive ? (
        <div className="p-4">
          <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
            {voiceState === 'requesting' ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-[var(--color-text-secondary)] animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-amber)] animate-pulse" />
                Requesting microphone access...
              </div>
            ) : (
              <VoiceWave
                getAnalyserData={getAnalyserData}
                interimTranscript={interimTranscript}
                onCancel={stopListening}
              />
            )}
          </div>
        </div>
      ) : (
        /* Floating input bar */
        <div className="p-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
          >
            <span className="text-[var(--color-accent-green)] text-lg flex-shrink-0">&#10024;</span>
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={chatLocked
                  ? 'Journey in progress...'
                  : chatMode === 'trade'
                    ? 'Fund, Buy, Sell, Transfer, or SendOut...'
                    : chatMode === 'learn'
                      ? 'Ask about Onli concepts and architecture...'
                      : 'Ask about your balances, transactions, or account...'}
                className={cn(
                  'w-full py-2 text-sm bg-transparent focus:outline-none',
                  chatLocked && 'opacity-60 cursor-not-allowed',
                )}
                disabled={chatLocked}
              />
              {chatLocked && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-xs">
                  &#128274;
                </span>
              )}
            </div>
            {/* Mic button */}
            <button
              type="button"
              disabled={chatLocked}
              onClick={handleMicClick}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0',
                chatLocked && 'opacity-50 cursor-not-allowed',
                'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-sidebar)]',
              )}
              aria-label="Start voice input"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || chatLocked || !input.trim()}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                isLoading || chatLocked || !input.trim()
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
                  : 'bg-[var(--color-cta-primary)] text-white hover:opacity-90',
              )}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </button>
          </form>

          {/* Voice error */}
          {voiceState === 'error' && (
            <p className="text-xs text-[var(--color-accent-red)] mt-2 px-4">{errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
