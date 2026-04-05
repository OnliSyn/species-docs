'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Blog data — future: fetch from CMS/API
// ---------------------------------------------------------------------------
interface BlogPost {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  readTime: string;
  hero?: boolean;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'ownership-paradigm',
    category: 'DEEP DIVE',
    title: 'Why Possession Beats Permission: The Ownership Paradigm Shift',
    excerpt: 'Traditional digital systems provide access. Onli provides possession. Understanding this distinction is the key to understanding why digital ownership has been impossible until now.',
    body: `Traditional digital systems are built around access. You log in, you get permission, you see your balance. But you never actually hold anything.\n\nOnli changes this. In Onli, ownership is based on possession. The asset resides in your Vault, bound to your Gene. You hold it. You control it. You can transfer it or destroy it.\n\nThis is not a minor distinction. It is the difference between holding a baseball card in your hand and having a line item in someone else's spreadsheet that says you own one.\n\nA ledger can describe ownership claims, but it cannot create singular digital reality. That is why Onli replaces ledgers with possession.\n\nThe three assertions that underpin any economic system — existence, allocation, and rights — all require an owner. Without an owner, allocation cannot be established, rights cannot be exercised, and obligations cannot be assigned.\n\nOnli enforces these assertions at the data level, making true digital ownership possible for the first time.`,
    date: 'Apr 4, 2026',
    readTime: '8 min read',
    hero: true,
  },
  {
    id: 'genome-architecture',
    category: 'TECHNICAL',
    title: 'Inside the Genome: Tensor-Based Container Architecture',
    excerpt: 'A deep look at how Onli uses multi-dimensional data structures to create singular, evolving digital objects.',
    body: `A Genome is the underlying hyper-dimensional container structure that makes an asset possible in Onli. It should not be confused with the asset itself — the asset is what you talk about philosophically and commercially; the Genome is the technical substrate beneath it.\n\nGenomes are arranged using tensor-based structures. A tensor is a multi-dimensional data structure that generalizes scalars, vectors, and matrices into higher dimensions. Onli uses tensors because they support the structural model required for singular digital containers better than flat file metaphors.\n\nThe tensor model allows Onli to represent assets as structured multi-dimensional containers rather than flat files, preserve internal state and relationships in a richer way, and support evolutionary transfer logic rather than ordinary duplication logic.\n\nWhen an asset moves in Onli, the asset leaves one Vault and appears in another. The transfer is direct. The system does not rely on copying the asset and then updating a ledger to reflect a new owner. This is fundamentally different from how blockchains or traditional databases handle ownership.`,
    date: 'Apr 2, 2026',
    readTime: '12 min read',
  },
  {
    id: 'species-pipeline',
    category: 'PRODUCT',
    title: 'The 9-Stage Pipeline: How Species Marketplace Settles in Under 100ms',
    excerpt: 'From submission to oracle verification, every stage of the pipeline is designed for speed and assurance.',
    body: `The Species Marketplace pipeline processes every transaction through nine distinct stages: Submit, Authenticate, Validate, Match, Stage Asset, Process Payment, Deliver to Vault, Oracle Verify, and Complete.\n\nEach stage is tracked in real-time. The pipeline is designed so that at every step, the system maintains full accountability of where the asset is, who controls it, and what state it is in.\n\nSettlement happens in under 100 milliseconds using TigerBeetle, a purpose-built financial accounting database capable of processing up to 10 million transfers per second.\n\nThe assurance model backs every transaction. The Buy Back Guarantee ensures that holders can always redeem at the guaranteed ratio, providing a floor of confidence that traditional digital asset systems cannot match.`,
    date: 'Mar 28, 2026',
    readTime: '6 min read',
  },
  {
    id: 'private-data',
    category: 'VISION',
    title: 'The Private-Data Economy: Data as an Owned Asset',
    excerpt: 'A model where data is held and exchanged as an owned asset rather than extracted and warehoused as platform inventory.',
    body: `In the current data economy, companies collect data, store copies of it, monetize access to it, and turn the user into the product.\n\nThe private-data economy envisioned by Onli is different. Data can exist as an owned asset. The owner controls access and use. Transfer and disclosure can be direct and intentional. Value can be created without relying on permanent third-party custody of copied data.\n\nThis is possible because Onli solves the Uniqueness-Quantification Problem: digital data is normally copyable at near-zero cost, which makes ordinary digital information excellent for communication but terrible for singular ownership.\n\nBy making the asset itself singular at the data level, Onli enables a model where data is held and exchanged as an owned asset rather than extracted and warehoused as a platform resource.`,
    date: 'Mar 22, 2026',
    readTime: '5 min read',
  },
  {
    id: 'appliance-dev',
    category: 'DEVELOPER',
    title: 'Building Your First Appliance on Onli Cloud',
    excerpt: 'Step-by-step guide to creating applications that orchestrate asset interactions without taking possession.',
    body: `Appliances are applications built on Onli Cloud APIs. They are the interface layer that developers create to make the system usable in real-world workflows.\n\nAppliances can connect users to services, orchestrate transactions, enforce business logic, and request issuance, transfer, verification, or settlement actions. But Appliances do not possess the asset and cannot unilaterally move it.\n\nOnly the Owner, through the appropriate control path, can authorize movement of an owned asset. This is a fundamental design principle.\n\nTo get started, you need an Onli Cloud API key and a basic understanding of the asset lifecycle: issuance, transfer, and verification. The SDK provides typed clients for all operations, and the Species Marketplace API handles the full 9-stage pipeline for buy, sell, and transfer orders.`,
    date: 'Mar 18, 2026',
    readTime: '10 min read',
  },
];

// ---------------------------------------------------------------------------
// Article view (push transition)
// ---------------------------------------------------------------------------
function ArticleView({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  return (
    <div className="animate-slide-in-right">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8.5 3L4.5 7l4 4" />
        </svg>
        Back to blog
      </button>

      {/* Article header */}
      <div className="rounded-t-[var(--radius-card)] h-28 bg-gradient-to-br from-[var(--color-accent-green)]/30 to-[var(--color-accent-green)]/10 flex items-end p-4">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)] bg-white/80 px-2 py-0.5 rounded">
          {post.category}
        </span>
      </div>

      {/* Article content */}
      <div className="border border-[var(--color-border)] border-t-0 rounded-b-[var(--radius-card)] bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-[var(--color-text-primary)] leading-snug">
          {post.title}
        </h2>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-text-secondary)]">
          <span>{post.date}</span>
          <span>{post.readTime}</span>
        </div>

        <div className="mt-4 space-y-3">
          {post.body.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-[12px] text-[var(--color-text-primary)] leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blog roll
// ---------------------------------------------------------------------------
export function BlogTab() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  if (selectedPost) {
    return <ArticleView post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  const heroPost = BLOG_POSTS.find((p) => p.hero);
  const articles = BLOG_POSTS.filter((p) => !p.hero);

  return (
    <div className="space-y-4 animate-slide-in-left">
      {/* Hero post */}
      {heroPost && (
        <div
          onClick={() => setSelectedPost(heroPost)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="h-36 bg-gradient-to-br from-[var(--color-accent-green)]/30 to-[var(--color-accent-green)]/10 flex items-end p-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)] bg-white/80 px-2 py-1 rounded">
              {heroPost.category}
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] leading-snug">
              {heroPost.title}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
              {heroPost.excerpt}
            </p>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-[var(--color-text-secondary)]">
              <span>{heroPost.date}</span>
              <span>{heroPost.readTime}</span>
            </div>
          </div>
        </div>
      )}

      {/* Article list */}
      <div className="space-y-1">
        {articles.map((post) => (
          <div
            key={post.id}
            onClick={() => setSelectedPost(post)}
            className="rounded-[var(--radius-button)] p-4 hover:bg-[var(--color-bg-card)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
                {post.category}
              </span>
              <span className="text-[9px] text-[var(--color-text-secondary)]">
                {post.readTime}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
              {post.title}
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 leading-relaxed line-clamp-2">
              {post.excerpt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
