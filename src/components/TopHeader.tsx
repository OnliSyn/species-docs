'use client';

export function TopHeader() {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-white/80 backdrop-blur-md sticky top-0 z-10">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search wallets, assets, contacts..."
          className="w-full px-4 py-2 rounded-[var(--radius-input)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-green)]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-accent-green)] text-[var(--color-text-primary)]">
          Premium
        </button>
        <button className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          Settings
        </button>
        <button className="text-sm text-[var(--color-accent-red)] hover:opacity-80">
          Log Out
        </button>
        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)]" />
      </div>
    </header>
  );
}
