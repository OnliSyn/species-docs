'use client';

import { useSystemChat } from '@/hooks/useSystemChat';
import { hasUIComponent, getUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';
import '@/components/ai/gen-ui'; // side-effect: register all gen-ui components

export function GenUISlot() {
  const { cards, isLoading, dismissedIds, dismissCard } = useSystemChat();

  const visibleCards = cards.filter((c) => !dismissedIds.has(c.id));

  if (isLoading && cards.length === 0) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 animate-pulse"
          >
            <div className="h-2.5 w-24 bg-[var(--color-border)] rounded mb-3" />
            <div className="h-8 w-32 bg-[var(--color-border)] rounded mb-2" />
            <div className="h-2 w-16 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (visibleCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-[var(--color-text-secondary)] text-center leading-relaxed">
          This is where Generative Ui components are displayed
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      {visibleCards.map((card) => {
        if (!hasUIComponent(card.data)) {
          // Fallback: raw data display
          return (
            <div
              key={card.id}
              className="relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-3 shadow-sm"
            >
              <DismissButton onDismiss={() => dismissCard(card.id)} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-1">
                {card.toolName}
              </p>
              <pre className="text-[10px] font-mono text-[var(--color-text-secondary)] overflow-x-auto">
                {JSON.stringify(card.data, null, 2).substring(0, 300)}
              </pre>
            </div>
          );
        }

        const Component = getUIComponent(card.ui) as React.ComponentType<GenUIProps>;
        return (
          <div key={card.id} className="relative animate-slide-in-left">
            <DismissButton onDismiss={() => dismissCard(card.id)} />
            <Component data={card.data} />
          </div>
        );
      })}
    </div>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-sidebar)] transition-colors"
      aria-label="Dismiss card"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 1l6 6M7 1l-6 6" />
      </svg>
    </button>
  );
}
