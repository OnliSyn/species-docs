'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Source references — "24 Analyzed sources" pattern
// ---------------------------------------------------------------------------
interface Source {
  id: string;
  title: string;
  description: string;
}

const SOURCES: Source[] = [
  { id: '1', title: 'Onli Cloud API Reference', description: 'Asset issuance, transfer, and vault management endpoints' },
  { id: '2', title: 'Species Marketplace SDK', description: 'Order submission, pipeline tracking, and event streaming' },
  { id: '3', title: 'MarketSB Integration Guide', description: 'TigerBeetle virtual accounts, deposits, and withdrawals' },
  { id: '4', title: 'Genome Data Structures', description: 'Tensor-based container architecture and state management' },
  { id: '5', title: 'Gene Authentication', description: 'Credential binding, authorization, and ownership transfer' },
  { id: '6', title: 'Vault Security Model', description: 'Possession-based storage and access control patterns' },
];

// ---------------------------------------------------------------------------
// Code snippet — example API call
// ---------------------------------------------------------------------------
const CODE_EXAMPLE = `import { OnliCloud } from '@onli/sdk';

const client = new OnliCloud({
  apiKey: process.env.ONLI_API_KEY,
});

// Issue a new Specie asset
const asset = await client.assets.issue({
  genome: 'genome-001',
  gene: userGene,
  vault: userVault,
  quantity: 1000,
});

// Transfer to another vault
await client.assets.transfer({
  assetId: asset.id,
  fromVault: userVault,
  toVault: recipientVault,
  gene: userGene,
});`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CanvasTab() {
  const [showAllSources, setShowAllSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const visibleSources = showAllSources ? SOURCES : SOURCES.slice(0, 4);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_EXAMPLE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Sources card */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-3">
          {SOURCES.length} Analyzed sources
        </h3>
        <div className="space-y-2">
          {visibleSources.map((source) => (
            <div
              key={source.id}
              className="rounded-[var(--radius-button)] bg-[var(--color-bg-card)] px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                {source.title}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                {source.description}
              </p>
            </div>
          ))}
        </div>
        {SOURCES.length > 4 && (
          <button
            onClick={() => setShowAllSources((v) => !v)}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mt-3 transition-colors"
          >
            {showAllSources ? 'Show less' : 'See all'}
          </button>
        )}
      </div>

      {/* Code block */}
      <div className="rounded-[var(--radius-card)] overflow-hidden">
        <div className="bg-[#1A1A1A] p-5 text-[13px] leading-relaxed font-mono overflow-x-auto">
          <pre className="text-white/90">
            {CODE_EXAMPLE.split('\n').map((line, i) => {
              // Simple keyword highlighting
              let highlighted = line
                .replace(/\b(import|from|const|await|new)\b/g, '<kw>$1</kw>')
                .replace(/\b(process)\b/g, '<var>$1</var>')
                .replace(/'([^']+)'/g, "'<str>$1</str>'");

              return (
                <div key={i} dangerouslySetInnerHTML={{
                  __html: highlighted
                    .replace(/<kw>/g, '<span style="color:#C586C0">')
                    .replace(/<\/kw>/g, '</span>')
                    .replace(/<var>/g, '<span style="color:#4FC1FF">')
                    .replace(/<\/var>/g, '</span>')
                    .replace(/<str>/g, '<span style="color:#CE9178">')
                    .replace(/<\/str>/g, '</span>')
                }} />
              );
            })}
          </pre>
        </div>

        {/* Action bar */}
        <div className="bg-white border border-[var(--color-border)] border-t-0 rounded-b-[var(--radius-card)] px-4 py-2.5 flex items-center justify-center gap-6">
          <button
            onClick={handleCopy}
            className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium">
            Edit code
          </button>
          <button className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium">
            Rewrite
          </button>
          <button className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors font-medium">
            Share
          </button>
        </div>
      </div>

      {/* Whitepaper excerpt */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          WHITEPAPER
        </span>
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-2 leading-snug">
          The Physics of Finance: A First Principles Approach to Digital Ownership
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
          An asset is property owned. For something to qualify as an asset, it must have the right of exclusion and the right of disposition. Onli enforces these rights at the data level, making true digital ownership possible for the first time.
        </p>
        <button className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mt-3 transition-colors font-medium">
          Read full paper
        </button>
      </div>
    </div>
  );
}
