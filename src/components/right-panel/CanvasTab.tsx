'use client';

import { useState } from 'react';
import { useTabStore } from '@/stores/tab-store';
import { ProcessTraceCanvas } from './ProcessTraceCanvas';

// =============================================================================
// ASK MODE — Guided walkthrough that sends questions to chat
// =============================================================================

interface WalkthroughItem {
  question: string;
}

interface WalkthroughSection {
  title: string;
  items: WalkthroughItem[];
}

const WALKTHROUGH: WalkthroughSection[] = [
  {
    title: 'Getting Started',
    items: [
      { question: 'What is a Species?' },
      { question: 'What is Onli?' },
      { question: 'What is the paradigm shift?' },
      { question: 'What is an asset?' },
    ],
  },
  {
    title: 'How It Works',
    items: [
      { question: 'What is a Genome?' },
      { question: 'What is a Gene?' },
      { question: 'What is a Vault?' },
      { question: 'What is actual possession vs custodial?' },
      { question: 'How are Species used for learning Onli?' },
    ],
  },
  {
    title: 'Go Deeper',
    items: [
      { question: 'Why isn\'t a blockchain enough?' },
      { question: 'Why is a key proof of access and not ownership?' },
      { question: 'What are Appliances?' },
      { question: 'What makes something property?' },
      { question: 'Why does ownership matter in an economy?' },
      { question: 'Why hasn\'t this problem been solved before?' },
      { question: 'What can you build with Onli?' },
    ],
  },
];

function sendToChat(question: string) {
  // Find the chat input, set its value, and submit
  const input = document.querySelector('input[placeholder]') as HTMLInputElement | null;
  if (!input) return;

  // React-compatible value setter
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSet) {
    nativeSet.call(input, question);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Submit the form after a tick
  setTimeout(() => {
    const form = input.closest('form');
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
  }, 50);
}

function AskCanvas() {
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">Understanding Species</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Tap a question to ask Synth
        </p>
      </div>

      {WALKTHROUGH.map((section) => (
        <div key={section.title}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)] mb-2">
            {section.title}
          </p>
          <div className="space-y-1.5">
            {section.items.map((item) => (
              <button
                key={item.question}
                onClick={() => sendToChat(item.question)}
                className="w-full text-left rounded-xl bg-[var(--color-bg-card)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-sidebar)] transition-colors"
              >
                {item.question}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// TRADE MODE — Code view (full height, scrollable)
// =============================================================================

const CODE_EXAMPLES: { label: string; code: string }[] = [
  {
    label: 'Buy',
    code: `// 1. Submit buy order to Species pipeline
POST /marketplace/v1/eventRequest
{
  "eventId": "evt-abc123",
  "intent": "buy",
  "quantity": 1000,
  "idempotencyKey": "buy-1000-abc"
}
// → 202 Accepted { eventId, wsChannel }

// 2. Pipeline stages (WebSocket):
//    submitted → authenticated → validated
//    → matched (listings first, treasury fallback)
//    → asset.staged (settlement escrow)
//    → payment.confirmed (cashier checkout)
//    → ownership.changed (vault delivery)
//    → completed

// 3. Cashier settles the payment:
POST /api/v1/cashier/post-batch
{
  "intent": "buy",
  "quantity": 1000,
  "buyerVaId": "va-funding-user-001",
  "unitPrice": "1000000",
  "fees": { "issuance": true, "liquidity": true }
}
// → 5 atomic transfers:
//    buyer → treasury (asset cost)
//    buyer → operating (issuance fee)
//    buyer → operating (liquidity fee)
//    treasury → assurance (backing)
//    treasury → buyer species VA (credit)`,
  },
  {
    label: 'List',
    code: `// 1. Charge listing fee via Cashier
POST /api/v1/transactions/list
{
  "senderAccountId": "acc-user-funding-user-001",
  "receiverAccountId": "acc-sub-listing-fee",
  "currency": "USD"
}
// → Flat $50 listing fee deducted

// 2. Create listing (species → escrow)
POST /sim/create-listing
{
  "sellerOnliId": "onli-user-001",
  "quantity": 5000,
  "unitPrice": 1000000
}
// → Species moved to settlement vault
// → Listing active on marketplace
// → Buyers can match against this listing`,
  },
  {
    label: 'Redeem',
    code: `// MarketMaker buyback via Assurance
POST /api/v1/transactions/redeem
{
  "sellerAccountId": "acc-user-funding-user-001",
  "liquidityFeeSubAccountId": "acc-sub-liquidity-fee",
  "assuranceSubAccountId": "acc-sub-assurance",
  "redeemAmount": "1000.00",
  "currency": "USD"
}
// Two atomic transfers:
//   1. seller → liquidityFee (1% fee)
//   2. assurance → seller ($1000 at 1:1)
//
// Then species return to MarketMaker:
//   user vault:  -1000 species
//   treasury:    +1000 species
//
// Assurance is DEBITED — this is the
// buy-back guarantee in action.`,
  },
  {
    label: 'Transfer',
    code: `// P2P transfer between vaults
// No fees — direct asset movement

// 1. Species sim handles the pipeline:
POST /marketplace/v1/eventRequest
{
  "eventId": "evt-xfer-001",
  "intent": "transfer",
  "quantity": 100,
  "recipient": { "onliId": "onli-user-456" },
  "idempotencyKey": "xfer-001"
}

// 2. Pipeline stages:
//    submitted → authenticated → validated
//    → asset.staged
//    → ask_to_move.pending (owner approval)
//    → ask_to_move.approved
//    → ownership.changed
//    → completed

// 3. No cashier call — no money moves.
// The asset itself transfers between vaults.`,
  },
];

function TradeCanvas() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const example = CODE_EXAMPLES[activeIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(example.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Oracle info banner */}
      <div className="flex-shrink-0 mb-3 flex items-center gap-2 rounded-lg bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/20 px-3 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] flex-shrink-0" />
        <p className="text-[10px] text-[var(--color-text-secondary)] leading-snug">
          Oracle ledger entries are recorded for every transaction
        </p>
      </div>

      <div className="flex-shrink-0 mb-2">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Transaction Reference</h3>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          How transactions flow through the system
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-0.5 bg-[var(--color-bg-card)] rounded-lg mb-2">
        {CODE_EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setActiveIdx(i); setCopied(false); }}
            className={`flex-1 px-2 py-1 text-[9px] font-semibold rounded-md transition-all ${
              i === activeIdx
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Code block — fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">
        <div className="flex-1 bg-[#1A1A1A] p-4 text-[11px] leading-relaxed font-mono overflow-y-auto">
          <pre className="text-white/80 whitespace-pre-wrap">
            {example.code.split('\n').map((line, i) => {
              const trimmed = line.trimStart();
              const isComment = trimmed.startsWith('//');
              const isEndpoint = /^(POST|GET|PATCH|DELETE)\s/.test(trimmed);
              return (
                <div key={`${activeIdx}-${i}`} className={
                  isComment ? 'text-[#6A9955]'
                  : isEndpoint ? 'text-[#C586C0] font-semibold'
                  : 'text-white/80'
                }>
                  {line || '\u00A0'}
                </div>
              );
            })}
          </pre>
        </div>
        <div className="flex-shrink-0 bg-white border border-[var(--color-border)] border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-center">
          <button
            onClick={handleCopy}
            className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LEARN MODE — Whitepapers with descriptions and read links
// =============================================================================

interface Whitepaper {
  id: string;
  title: string;
  description: string;
  category: string;
}

const WHITEPAPERS: Whitepaper[] = [
  {
    id: 'physics-of-finance',
    category: 'FOUNDATION',
    title: 'The Physics of Finance',
    description: 'A first principles approach to digital ownership. Why exclusion and disposition are the two rights that make property real.',
  },
  {
    id: 'uniqueness-quantification',
    category: 'FOUNDATION',
    title: 'The Uniqueness-Quantification Problem',
    description: 'Digital data is copyable by default. Without enforcing singularity at the data level, ownership is impossible.',
  },
  {
    id: 'genome-architecture',
    category: 'TECHNICAL',
    title: 'Genome Architecture',
    description: 'Tensor-based containers that hold singular digital objects. Genomes evolve in state rather than being duplicated.',
  },
  {
    id: 'possession-model',
    category: 'TECHNICAL',
    title: 'Actual Possession in Digital Systems',
    description: 'From ledger records to physical-like ownership. How Onli makes the asset reside in your Vault, not a third-party table.',
  },
  {
    id: 'species-marketplace',
    category: 'PROTOCOL',
    title: 'Species Marketplace Protocol',
    description: 'The 9-stage pipeline for atomic asset settlement. Pre-staging, cashier checkout, and vault delivery in under 100ms.',
  },
  {
    id: 'assurance-model',
    category: 'ECONOMICS',
    title: 'The 100% Assurance Model',
    description: 'Full backing, buy-back guarantee, and market stability. Every Specie in circulation is backed 1:1 by USDC.',
  },
  {
    id: 'appliance-framework',
    category: 'DEVELOPER',
    title: 'Building Appliances on Onli Cloud',
    description: 'Applications that orchestrate but never own. How to build on Onli without taking custody of user assets.',
  },
];

function LearnCanvas() {
  return (
    <div className="space-y-4">
      <div className="mb-1">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Whitepapers</h3>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          Deep dives into Onli architecture and economics
        </p>
      </div>

      <div className="space-y-2.5">
        {WHITEPAPERS.map((wp) => (
          <div
            key={wp.id}
            className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
          >
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
              {wp.category}
            </span>
            <h4 className="text-[12px] font-bold text-[var(--color-text-primary)] mt-1 leading-snug">
              {wp.title}
            </h4>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {wp.description}
            </p>
            <button className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mt-2 transition-colors font-medium">
              Read full paper &rarr;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// LEARN MODE — Trace + Whitepapers toggle
// =============================================================================

// Map devJourney store value to CODE_EXAMPLES index
const DEV_JOURNEY_MAP: Record<string, number> = {
  buy: 0,
  sell: 1,
  redeem: 2,
  transfer: 3,
};

function DevelopCanvas() {
  const devJourney = useTabStore((s) => s.devJourney);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Sync with devJourney from chat
  const targetIdx = devJourney ? (DEV_JOURNEY_MAP[devJourney] ?? 0) : null;
  if (targetIdx !== null && targetIdx !== activeIdx) {
    setActiveIdx(targetIdx);
  }

  const example = CODE_EXAMPLES[activeIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(example.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // If no journey selected yet, show prompt
  if (!devJourney) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-card)] flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M16 18l2-2-2-2M8 18l-2-2 2-2M14 4l-4 16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">API Reference</p>
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
          Ask about a journey in chat to see the API calls here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-2">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">API Reference</h3>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          API calls for the {example.label.toLowerCase()} journey
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-0.5 bg-[var(--color-bg-card)] rounded-lg mb-2">
        {CODE_EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setActiveIdx(i); setCopied(false); }}
            className={`flex-1 px-2 py-1 text-[9px] font-semibold rounded-md transition-all ${
              i === activeIdx
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden">
        <div className="flex-1 bg-[#1A1A1A] p-4 text-[11px] leading-relaxed font-mono overflow-y-auto">
          <pre className="text-white/80 whitespace-pre-wrap">
            {example.code.split('\n').map((line, i) => {
              const trimmed = line.trimStart();
              const isComment = trimmed.startsWith('//');
              const isEndpoint = /^(POST|GET|PATCH|DELETE)\s/.test(trimmed);
              return (
                <div key={`dev-${activeIdx}-${i}`} className={
                  isComment ? 'text-[#6A9955]'
                  : isEndpoint ? 'text-[#C586C0] font-semibold'
                  : 'text-white/80'
                }>
                  {line || '\u00A0'}
                </div>
              );
            })}
          </pre>
        </div>
        <div className="flex-shrink-0 bg-white border border-[var(--color-border)] border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-center">
          <button
            onClick={handleCopy}
            className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Canvas — switches content based on chat mode
// =============================================================================

export function CanvasTab({ mode }: { mode?: string }) {
  if (mode === 'trade') return <TradeCanvas />;
  if (mode === 'develop') return <DevelopCanvas />;
  return <AskCanvas />;
}
