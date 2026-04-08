'use client';

const BLOG_POSTS = [
  {
    id: '1',
    title: 'Understanding Actual Possession in Digital Assets',
    excerpt: 'Why Onli\'s approach to ownership fundamentally differs from blockchain-based systems.',
    date: 'Mar 28, 2026',
    readTime: '8 min',
  },
  {
    id: '2',
    title: 'The Cashier Model: How MarketSB Settles Transactions',
    excerpt: 'A deep dive into how atomic double-entry accounting ensures atomic settlements.',
    date: 'Mar 15, 2026',
    readTime: '12 min',
  },
  {
    id: '3',
    title: 'Species Marketplace: From Order to Ownership',
    excerpt: 'Walking through the complete pipeline from EventRequest to asset delivery.',
    date: 'Feb 22, 2026',
    readTime: '10 min',
  },
  {
    id: '4',
    title: 'Genomes, Genes, and Vaults: The Trinity of Onli',
    excerpt: 'How three architectural primitives enable true digital uniqueness.',
    date: 'Feb 8, 2026',
    readTime: '6 min',
  },
];

export function BlogsPanel() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        Recent Posts
      </h3>
      {BLOG_POSTS.map((post) => (
        <button
          key={post.id}
          className="w-full text-left rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] hover:bg-[var(--color-bg-card)] transition-colors"
        >
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {post.title}
          </h4>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-2">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime} read</span>
          </div>
        </button>
      ))}
    </div>
  );
}
