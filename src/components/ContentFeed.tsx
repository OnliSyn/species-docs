'use client';

import { cn } from '@/lib/utils';
import type { FeedCard } from '@/types/feed';

// ---------------------------------------------------------------------------
// Placeholder feed data — future: fetch from API
// ---------------------------------------------------------------------------
const FEED_CARDS: FeedCard[] = [
  {
    id: 'onli-dev',
    variant: 'featured',
    category: 'INFO',
    title: 'Go beyond vibe code and fragile prototypes',
    body: 'build real economies with programmable assets, and production-grade appliances.',
  },
  {
    id: 'onli-network',
    variant: 'accent',
    title: 'The Onli One Network',
    body: 'AN epheremal software defined network by Owners and for Owners. Powered by Onli You.',
  },
  {
    id: 'welcome-video',
    variant: 'dark',
    category: 'Hot in March',
    title: 'Welcome Video',
    body: 'Bossa nova, house, uk garage, smooth vocals, airy vocals, jazz, funk',
    meta: { author: 'By AlienPixels', followers: 'Follow', comments: '32k' },
  },
  {
    id: 'ai-article',
    variant: 'article',
    category: 'NEWS',
    title: 'Advancing creativity with artificial intelligence',
    body: 'Transform your ideas into stunning visuals with HorizonAI \u2014 the cutting-edge image generator designed specifically for imaginative thinkers.',
    actions: [{ label: 'Watch launch video' }, { label: 'Explore' }],
  },
];

// ---------------------------------------------------------------------------
// Card renderers by variant
// ---------------------------------------------------------------------------

function FeaturedCard({ card }: { card: FeedCard }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-5 shadow-sm">
      <div className="mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          {card.category}
        </span>
      </div>
      <h3 className="text-xl font-light text-[var(--color-text-primary)] leading-snug">
        <span className="font-bold">{card.title}</span>
        {card.body && (
          <>
            {' \u2014 '}
            <span className="text-[var(--color-text-secondary)]">{card.body}</span>
          </>
        )}
      </h3>
    </div>
  );
}

function AccentCard({ card }: { card: FeedCard }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-[#D4F5A0] p-5">
      <div className="flex items-center gap-4">
        {/* O.4 logo */}
        <div className="flex items-center gap-1">
          <div className="w-14 h-14 rounded-full border-[3px] border-[var(--color-text-primary)] flex items-center justify-center">
            <span className="text-xl font-light">O</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold">.4</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9l-3 1.5.5-3.5L1 4.5 4.5 4z" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-[var(--color-text-primary)]">{card.title}</h3>
          <p className="text-xs text-[var(--color-text-primary)]/70 mt-0.5 leading-relaxed">{card.body}</p>
        </div>
      </div>
    </div>
  );
}

function DarkCard({ card }: { card: FeedCard }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-[#1A1A1A] p-5 text-white">
      <div className="flex gap-4">
        {/* Video thumbnail placeholder */}
        <div className="w-32 h-24 rounded-xl bg-gradient-to-br from-rose-400 to-pink-600 flex-shrink-0 flex items-end justify-center pb-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex items-center gap-3 text-white/80">
            <button className="text-xs">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1l8 5-8 5V1z" /></svg>
            </button>
            <div className="w-16 h-1 rounded-full bg-white/30">
              <div className="w-10 h-1 rounded-full bg-white" />
            </div>
            <button className="text-xs">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M10 1l-8 5 8 5V1z" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[10px] text-white/60 mb-1">
            <span className="text-orange-400">{card.category}</span>
            {card.meta?.author && <span>{card.meta.author}</span>}
          </div>
          <h3 className="font-bold text-sm mb-1">{card.title}</h3>
          <p className="text-[11px] text-white/50 leading-relaxed">{card.body}</p>
          <div className="flex gap-2 mt-3">
            <button className="px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium hover:bg-white/10 transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="3" r="2" /><path d="M1 9a4 4 0 018 0" /></svg>
              Follow
            </button>
            <button className="px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium hover:bg-white/10 transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M1 4a4 4 0 018 0c0 3-4 5-4 5S1 7 1 4z" /></svg>
              {card.meta?.comments || '0'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ card }: { card: FeedCard }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
            {card.category}
          </span>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-2 leading-snug">{card.title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">{card.body}</p>
          {card.actions && (
            <div className="flex gap-2 mt-3">
              {card.actions.map((a) => (
                <button
                  key={a.label}
                  className="px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[10px] font-medium hover:bg-[var(--color-bg-card)] transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Thumbnail placeholder */}
        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-purple-200 to-violet-400 flex-shrink-0" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed container
// ---------------------------------------------------------------------------
const CARD_RENDERERS: Record<string, React.ComponentType<{ card: FeedCard }>> = {
  featured: FeaturedCard,
  accent: AccentCard,
  dark: DarkCard,
  article: ArticleCard,
};

export function ContentFeed() {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {FEED_CARDS.map((card) => {
        const Renderer = CARD_RENDERERS[card.variant] || ArticleCard;
        return <Renderer key={card.id} card={card} />;
      })}
    </div>
  );
}
