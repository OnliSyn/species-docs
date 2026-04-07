'use client';

import { useState, useEffect } from 'react';
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
// Trade mode: Marketplace news
// ---------------------------------------------------------------------------
const TRADE_POSTS: BlogPost[] = [
  {
    id: 'market-update',
    category: 'MARKET UPDATE',
    title: 'Species Marketplace: Real-Time Settlement with TigerBeetle',
    excerpt: 'Every transaction settles in under 100ms using the TigerBeetle financial accounting engine. No batch processing. No delays.',
    body: `The Species Marketplace uses TigerBeetle as its settlement engine, capable of processing up to 10 million transfers per second.\n\nEvery buy, sell, and transfer order flows through a 9-stage pipeline that tracks the asset from submission to Oracle verification. At each step, the system maintains full accountability.\n\nThe MarketSB cashier handles all USDC movements with integer arithmetic — no floating point, no rounding errors. Fees are calculated in base units and distributed atomically across up to 5 TigerBeetle transfers per transaction.`,
    date: 'Apr 6, 2026',
    readTime: '4 min read',
    hero: true,
  },
  {
    id: 'assurance-model',
    category: 'ASSURANCE',
    title: 'The 100% Buy Back Guarantee',
    excerpt: 'Every Specie sold is backed by the assurance pool. Holders can always redeem at the guaranteed ratio.',
    body: `The assurance model is designed so that every outstanding Specie is fully covered by the assurance balance.\n\nWhen you redeem, the MarketMaker pays 1:1 from the assurance pool, minus a 1% liquidity fee. This creates a floor of confidence that traditional digital asset markets cannot provide.\n\nThe coverage ratio is tracked in real-time and visible in the Assurance dashboard.`,
    date: 'Apr 3, 2026',
    readTime: '3 min read',
  },
  {
    id: 'fee-structure',
    category: 'TRADING',
    title: 'Understanding Marketplace Fees',
    excerpt: 'Buy and transfer are fee-free. Sell listings have no fee. Only redemption carries a 1% liquidity fee.',
    body: `The fee structure is simple: Buy from the marketplace — no fee. Transfer to a contact — no fee. List for sale — no fee (your Specie is escrowed until sold).\n\nRedemption through the MarketMaker carries a 1% liquidity fee, which goes to the assurance pool to maintain full coverage.\n\nAll fees are calculated in integer base units (1 USDC = 1,000,000 units) to ensure precision.`,
    date: 'Mar 30, 2026',
    readTime: '3 min read',
  },
];

// ---------------------------------------------------------------------------
// Develop mode: Whitepapers
// ---------------------------------------------------------------------------
const DEVELOP_POSTS: BlogPost[] = [
  {
    id: 'wp-physics',
    category: 'WHITEPAPER',
    title: 'The Physics of Finance: Why Digital Assets Need Physical Properties',
    excerpt: 'How Onli applies physical scarcity principles to digital containers, solving the fundamental copyability problem.',
    body: `Digital data is copyable at near-zero cost. This property makes it excellent for communication but terrible for ownership.\n\nOnli solves this by enforcing singularity at the data level. A Genome cannot be duplicated — it can only exist in one Vault at a time, bound to one Gene.\n\nThis paper explores why every previous attempt to create digital scarcity has failed at the fundamental level, and how Onli's approach differs by working at the asset layer rather than the permission or ledger layer.`,
    date: 'Mar 2026',
    readTime: '18 min read',
    hero: true,
  },
  {
    id: 'wp-uqp',
    category: 'WHITEPAPER',
    title: 'The Uniqueness-Quantification Problem',
    excerpt: 'The core problem Onli solves: making digital data behave as singular, ownable objects.',
    body: `The Uniqueness-Quantification Problem states that digital data, being copyable by nature, cannot serve as the basis for ownership unless singularity is enforced at the structural level.\n\nBlockchains attempted to solve this with consensus-based ledgers, but a ledger entry is a claim about ownership — not ownership itself.\n\nOnli solves UQP by making the container itself singular. The Genome is a tensor-based structure that cannot be duplicated, only transferred.`,
    date: 'Mar 2026',
    readTime: '14 min read',
  },
  {
    id: 'wp-genome',
    category: 'WHITEPAPER',
    title: 'Genome Architecture: Tensor-Based Digital Containers',
    excerpt: 'Technical specification for the multi-dimensional data structures that underpin Onli assets.',
    body: `A Genome is arranged using tensor-based structures — multi-dimensional data containers that generalize scalars, vectors, and matrices into higher dimensions.\n\nThis paper covers the mathematical foundations, the state evolution model, and the binding protocol between Genomes, Genes, and Vaults.`,
    date: 'Feb 2026',
    readTime: '22 min read',
  },
  {
    id: 'wp-possession',
    category: 'WHITEPAPER',
    title: 'Actual Possession in Digital Systems',
    excerpt: 'Defining what it means to truly possess a digital asset vs holding a custodial claim.',
    body: `Actual possession means the asset resides in your Vault and is bound to your Gene. You hold it, control it, and can transfer or destroy it.\n\nCustodial possession means a third party holds the asset and gives you a ledger entry. Your rights depend on their honesty and solvency.\n\nThis paper formalizes the distinction and proves why actual possession is the only model compatible with true digital ownership.`,
    date: 'Feb 2026',
    readTime: '12 min read',
  },
];

const MODE_POSTS: Record<string, BlogPost[]> = {
  ask: BLOG_POSTS,
  trade: TRADE_POSTS,
  develop: DEVELOP_POSTS,
};

// ---------------------------------------------------------------------------
// Blog roll
// ---------------------------------------------------------------------------
export function BlogTab({ mode = 'ask' }: { mode?: string }) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  // Reset article view when mode changes
  useEffect(() => { setSelectedPost(null); }, [mode]);

  if (selectedPost) {
    return <ArticleView post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  const posts = MODE_POSTS[mode] || BLOG_POSTS;
  const heroPost = posts.find((p) => p.hero);
  const articles = posts.filter((p) => !p.hero);

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
