'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FeedCard } from '@/types/feed';

// ---------------------------------------------------------------------------
// Ad/info feed data — future: fetch from ad pipeline API
// ---------------------------------------------------------------------------
const INFO_CARDS: FeedCard[] = [
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
    category: 'FEATURED',
    title: 'Onli Symplr',
    body: 'Watch the introduction to Onli — what it is, how it works, and why it matters.',
    meta: { author: 'Onli' },
    videoUrl: 'https://vimeo.com/795552637',
  },
  {
    id: 'onli-you-ad',
    variant: 'ad',
    category: 'SPONSOR',
    title: 'Onli You',
    body: 'Your identity. Your data. Your terms.',
    image: '/images/onli-you-twins.jpg',
    actions: [{ label: 'Visit onli.you', href: 'https://www.onli.you' }],
  },
];

// ---------------------------------------------------------------------------
// Card renderers
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
    <div className="rounded-[var(--radius-card)] bg-[#D4F5A0] p-5 py-[30px]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="w-14 h-14 rounded-full border-[3px] border-[var(--color-text-primary)] flex items-center justify-center">
            <span className="text-xl font-light">O</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold">.4</span>
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

// ---------------------------------------------------------------------------
// Fullscreen video overlay
// ---------------------------------------------------------------------------
function VideoOverlay({ title, videoUrl, onClose }: { title: string; videoUrl: string; onClose: () => void }) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Convert Vimeo URL to embeddable format
  let embedUrl = videoUrl;
  if (videoUrl.includes('vimeo.com/manage/videos/')) {
    const id = videoUrl.match(/\/videos\/(\d+)/)?.[1];
    embedUrl = id ? `https://player.vimeo.com/video/${id}` : videoUrl;
  } else if (videoUrl.includes('vimeo.com/showcase')) {
    embedUrl = videoUrl; // showcase URLs work in iframe
  } else if (videoUrl.includes('vimeo.com/')) {
    const id = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
    embedUrl = id ? `https://player.vimeo.com/video/${id}` : videoUrl;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Video container */}
      <div
        className="w-[90vw] max-w-[960px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>
        <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Dark card (video) — premium product-card style
// ---------------------------------------------------------------------------
function DarkCard({ card }: { card: FeedCard }) {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <>
      <div
        onClick={() => card.videoUrl && setShowVideo(true)}
        className="rounded-[28px] bg-white p-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer group border border-[var(--color-border)]"
      >
        <div className="flex flex-col rounded-[22px] bg-white px-4 pt-4 pb-3">
          {/* Title area */}
          <div className="shrink-0 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-black/40">
                {card.category}
              </span>
              {card.meta?.author && (
                <span className="text-[9px] text-black/30">{card.meta.author}</span>
              )}
            </div>
            <h3 className="text-[22px] leading-[0.95] font-normal tracking-[-0.04em] text-black/85">
              {card.title}
            </h3>
            <p className="mt-1 text-[12px] leading-snug font-normal text-black/45">
              {card.body}
            </p>
          </div>

          {/* Video thumbnail area */}
          <div className="relative overflow-hidden rounded-[18px] bg-[#1A1A1A] h-[160px]">
            {/* Vimeo thumbnail or gradient fallback */}
            {card.videoUrl && (() => {
              const id = card.videoUrl!.match(/\/(\d+)/)?.[1];
              return id ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://vumbnail.com/${id}.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : null;
            })()}
            <div className="absolute inset-0 bg-black/40" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white shadow-[0_8px_22px_rgba(0,0,0,0.18)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg viewBox="0 0 24 24" className="h-5 w-5 ml-0.5" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" fill="#1A1A1A" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVideo && card.videoUrl && (
        <VideoOverlay
          title={card.title}
          videoUrl={card.videoUrl}
          onClose={() => setShowVideo(false)}
        />
      )}
    </>
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
                <button key={a.label} className="px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[10px] font-medium hover:bg-[var(--color-bg-card)] transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-purple-200 to-violet-400 flex-shrink-0" />
      </div>
    </div>
  );
}

function AdCard({ card }: { card: FeedCard }) {
  return (
    <div className="relative rounded-[var(--radius-card)] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.10)]" style={{ height: '260px' }}>
      {/* Background image */}
      {card.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.25)_40%,rgba(0,0,0,0.65)_100%)]" />
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/60 mb-1">
          {card.category}
        </span>
        <h3 className="text-lg font-bold text-white leading-snug">{card.title}</h3>
        {card.body && (
          <p className="text-[11px] text-white/70 mt-1 leading-relaxed">{card.body}</p>
        )}
        {card.actions?.[0]?.href && (
          <a
            href={card.actions[0].href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex self-start px-4 py-2 rounded-full bg-white text-[11px] font-semibold text-[#0A0A0A] hover:bg-white/90 transition-colors shadow-sm"
          >
            {card.actions[0].label}
          </a>
        )}
      </div>
    </div>
  );
}

const CARD_RENDERERS: Record<string, React.ComponentType<{ card: FeedCard }>> = {
  featured: FeaturedCard,
  accent: AccentCard,
  dark: DarkCard,
  article: ArticleCard,
  ad: AdCard,
};

// ---------------------------------------------------------------------------
// Trade mode: Marketplace info cards
// ---------------------------------------------------------------------------
const TRADE_CARDS: FeedCard[] = [
  {
    id: 'market-overview',
    variant: 'featured',
    category: 'MARKETPLACE',
    title: 'Species Marketplace',
    body: 'buy, sell, and trade Specie assets in a fully simulated 9-stage pipeline with real-time Oracle verification.',
  },
  {
    id: 'market-stats',
    variant: 'accent',
    title: 'Live Market',
    body: 'Track active listings, treasury reserves, and completed orders. All transactions settle through the MarketSB cashier.',
  },
  {
    id: 'assurance-account',
    variant: 'featured',
    category: 'ASSURANCE',
    title: 'Buy Back Guarantee',
    body: 'Every Specie is backed 1:1 by USDC in the Assurance Account. The MarketMaker guarantees redemption at $1.00 minus 1% liquidity fee.',
  },
  {
    id: 'trade-video',
    variant: 'dark',
    category: 'FEATURED',
    title: 'Species Trading',
    body: 'Watch how the marketplace pipeline works — from order submission to settlement.',
    meta: { author: 'Onli' },
    videoUrl: 'https://vimeo.com/744624297',
  },
  {
    id: 'market-journeys',
    variant: 'article',
    category: 'TRADING',
    title: 'Five ways to interact with the marketplace',
    body: 'Fund your account, Buy from listings, Sell to the market, Transfer to contacts, or Redeem through the MarketMaker.',
    actions: [{ label: 'Start trading' }],
  },
];

// ---------------------------------------------------------------------------
// Develop mode: Developer concept cards
// ---------------------------------------------------------------------------
const DEVELOP_CARDS: FeedCard[] = [
  {
    id: 'dev-genomes',
    variant: 'featured',
    category: 'CORE CONCEPTS',
    title: 'Genomes & Genes',
    body: 'tensor-based containers (Genomes) bound to control credentials (Genes) that enforce singular ownership at the data level.',
  },
  {
    id: 'dev-vaults',
    variant: 'accent',
    title: 'Vaults & Possession',
    body: 'Secure holding environments where assets physically reside. Transfer means the asset leaves one Vault and appears in another — no copy remains.',
  },
  {
    id: 'dev-onli-you-ad',
    variant: 'ad',
    category: 'SPONSOR',
    title: 'Onli You',
    body: 'Your identity. Your data. Your terms.',
    image: '/images/onli-you-twins.jpg',
    actions: [{ label: 'Visit onli.you', href: 'https://www.onli.you' }],
  },
  {
    id: 'dev-video',
    variant: 'dark',
    category: 'FEATURED',
    title: 'Onli Architecture',
    body: 'Deep dive into Genomes, Vaults, and the possession model that powers Onli.',
    meta: { author: 'Onli' },
    videoUrl: 'https://vimeo.com/801385676',
  },
];

const MODE_CARDS: Record<string, FeedCard[]> = {
  ask: INFO_CARDS,
  trade: TRADE_CARDS,
  develop: DEVELOP_CARDS,
};

export function InfoTab({ mode = 'ask' }: { mode?: string }) {
  const cards = MODE_CARDS[mode] || INFO_CARDS;
  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const Renderer = CARD_RENDERERS[card.variant] || ArticleCard;
        return <Renderer key={card.id} card={card} />;
      })}
    </div>
  );
}
