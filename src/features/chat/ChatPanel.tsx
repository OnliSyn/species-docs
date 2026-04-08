'use client';

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useTabStore, type ChatMode } from '@/stores/tab-store';
import { useOnliChat } from './hooks/useOnliChat';
import { useSpeechToText } from './hooks/useSpeechToText';
import { useJourneyTracker } from './hooks/useJourneyTracker';
import { VoiceWave } from './components/VoiceWave';
import { HelloGreeting } from './components/HelloGreeting';
import { PipelineWalkthrough } from './components/PipelineWalkthrough';
import type { UIMessage } from 'ai';

const MODE_LABELS: Record<ChatMode, string> = {
  ask: 'Ask',
  trade: 'Trade',
  develop: 'Develop',
};

export function ChatPanel({ coverDismissed = true }: { coverDismissed?: boolean }) {
  const { chatMode, setChatMode, chatLocked, setRightPanelTab, setDevJourney } = useTabStore();
  const { messages, sendMessage, setMessages, status } = useOnliChat();
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
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const [showHello, setShowHello] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleHelloComplete = useCallback(() => {
    setShowHello(false);
  }, []);

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close mode menu on outside click
  useEffect(() => {
    if (!modeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modeMenuOpen]);

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
      badge: 'ONLI AI',
      title: 'Ask Synth',
      subtitle: 'I can answer questions about Onli, check your balances, and explain how digital ownership works. What would you like to know?',
      actions: [
        { label: 'What is Species?', seed: 'What is Species?' },
        { label: 'What is Onli?', seed: 'What is Onli?' },
        { label: 'How do I trade?', seed: 'How do I trade?' },
      ],
    },
    trade: {
      badge: 'SPECIES MARKET',
      title: 'Trade',
      subtitle: 'Fund your account, buy and sell Species, transfer to contacts, or redeem through the MarketMaker.',
      actions: [
        { label: 'Fund', seed: 'fund my account' },
        { label: 'Buy', seed: 'buy species from the market' },
        { label: 'Sell', seed: 'list my species for sale' },
        { label: 'Transfer', seed: 'transfer species to a contact' },
        { label: 'Redeem', seed: 'redeem my species' },
      ],
    },
    develop: {
      badge: 'DEVELOPER',
      title: 'Welcome to Species',
      subtitle: 'Learn how the 9-stage pipeline works behind the scenes. Ask about any journey to see the full API flow.',
      actions: [
        { label: 'How does a Buy work?', seed: 'Walk me through the Buy journey' },
        { label: 'How does a Sell work?', seed: 'Walk me through the Sell journey' },
        { label: 'How does a Transfer work?', seed: 'Walk me through the Transfer journey' },
      ],
    },
  };

  const currentMode = modeConfig[chatMode];
  const isVoiceActive = voiceState === 'listening' || voiceState === 'requesting';

  return (
    <div className="relative flex flex-col h-full">
      {/* New chat button */}
      {messages.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-3 pb-1 flex justify-end">
          <button
            onClick={() => setMessages([])}
            className="px-3 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-full transition-colors"
          >
            New Chat
          </button>
        </div>
      )}
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {messages.length === 0 ? (
          showHello && coverDismissed && chatMode === 'ask' ? (
            <HelloGreeting onComplete={handleHelloComplete} />
          ) :
          /* Welcome state — mode-specific */
          <div className="flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto h-full">
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
                  onClick={() => {
                    sendMessage({ text: action.seed });
                    if (chatMode === 'develop') {
                      setRightPanelTab('canvas');
                      // Map seed to devJourney for canvas sync
                      const jMap: Record<string, 'buy' | 'sell' | 'transfer' | 'redeem' | 'fund'> = {
                        'buy': 'buy', 'sell': 'sell', 'transfer': 'transfer', 'redeem': 'redeem', 'fund': 'fund',
                      };
                      const key = Object.keys(jMap).find(k => action.seed.toLowerCase().includes(k));
                      if (key) setDevJourney(jMap[key]);
                    }
                  }}
                  className="px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-sidebar)] transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
            {chatMode === 'ask' && (
              <button
                onClick={() => setRightPanelTab('canvas')}
                className="mt-4 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors underline underline-offset-2"
              >
                Don&apos;t know what to ask?
              </button>
            )}
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

                      // Show journey confirm/execute card summaries inline
                      if (toolPart.state === 'output-available' && toolPart.output) {
                        let output = toolPart.output as Record<string, unknown>;
                        if (typeof output === 'object' && output !== null && 'value' in output) {
                          try { output = JSON.parse(String(output.value)); } catch { /* keep */ }
                        }
                        const ui = (output as Record<string, unknown>)?._ui as string;
                        if (ui === 'ConfirmCard' || ui === 'PipelineCard' || ui === 'LifecycleCard') {
                          const data = output as Record<string, unknown>;
                          const title = String(data.title || '');
                          const lines = (data.lines as Array<{ label: string; value: string; bold?: boolean }>) || [];
                          const warning = data.warning as string | undefined;
                          return (
                            <div key={i} className="my-2 rounded-[var(--radius-button)] border border-[var(--color-border)] bg-white p-3 text-xs">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-2">
                                {title}
                              </p>
                              {lines.map((line, li) => (
                                <div key={li} className="flex justify-between py-0.5">
                                  <span className="text-[var(--color-text-secondary)]">{line.label}</span>
                                  <span className={line.bold ? 'font-bold' : ''}>{line.value}</span>
                                </div>
                              ))}
                              {warning && (
                                <p className="mt-2 text-[10px] text-[var(--color-accent-red)] bg-[var(--color-accent-red)]/10 rounded px-2 py-1">
                                  {warning}
                                </p>
                              )}
                            </div>
                          );
                        }
                      }

                      // Loading state
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
            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[var(--radius-card)] bg-[var(--color-bg-card)] px-4 py-3 animate-pulse">
                  <div className="h-3 w-48 bg-[var(--color-border)] rounded mb-2" />
                  <div className="h-3 w-36 bg-[var(--color-border)] rounded mb-2" />
                  <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
                </div>
              </div>
            )}
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
        /* Floating glassmorphic input bar */
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-2 z-10">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 backdrop-blur-xl pl-3 pr-1.5 py-1.5"
            style={{
              boxShadow: '0px 16px 48px rgba(0,0,0,0.10), 0px 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            {/* Mode dropdown */}
            <div ref={modeMenuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setModeMenuOpen((v) => !v)}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#8F8F8F] hover:text-[#0A0A0A] transition-colors cursor-pointer px-1"
              >
                {MODE_LABELS[chatMode]}
                <ChevronDown className={cn('h-3 w-3 transition-transform', modeMenuOpen && 'rotate-180')} strokeWidth={2.5} />
              </button>
              {modeMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[110px] rounded-[12px] bg-white/90 backdrop-blur-lg p-1 shadow-[0px_12px_40px_rgba(0,0,0,0.12)] border border-white/50 z-20">
                  {(Object.entries(MODE_LABELS) as [ChatMode, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setChatMode(key); setModeMenuOpen(false); }}
                      className={cn(
                        'w-full rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-[#171717] text-left hover:bg-[#F0F0F0] transition-colors',
                        chatMode === key && 'bg-[#F0F0F0] font-bold',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input field — darker off-white */}
            <div className="flex-1 min-w-0 rounded-full bg-[#EAEAEA] px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={chatLocked
                  ? 'Journey in progress...'
                  : chatMode === 'trade'
                    ? 'Fund, Buy, Sell, Transfer, or SendOut...'
                    : chatMode === 'develop'
                      ? 'Ask about Onli concepts and architecture...'
                      : 'Ask about your balances, transactions, or account...'}
                className={cn(
                  'w-full text-[14px] bg-transparent focus:outline-none text-[#0A0A0A] placeholder:text-[#B0B0B0]',
                  chatLocked && 'opacity-60 cursor-not-allowed',
                )}
                disabled={chatLocked}
              />
            </div>

            {/* Mic button */}
            <button
              type="button"
              disabled={chatLocked}
              onClick={handleMicClick}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                chatLocked ? 'opacity-50 cursor-not-allowed text-[#B0B0B0]' : 'text-[#8F8F8F] hover:text-[#0A0A0A] hover:bg-[#EAEAEA]',
              )}
              aria-label="Start voice input"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4C10.3431 4 9 5.34315 9 7V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V7C15 5.34315 13.6569 4 12 4Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 11C19 14.866 15.866 18 12 18C8.13401 18 5 14.866 5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 18V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || chatLocked || !input.trim()}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                isLoading || chatLocked || !input.trim()
                  ? 'bg-[#D5D5D5] text-[#999]'
                  : 'bg-[#0A0A0A] text-white hover:opacity-90',
              )}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
