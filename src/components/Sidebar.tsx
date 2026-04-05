'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Onli Synth', path: '/', icon: 'home' },
  { label: 'Assets', path: '/assets', icon: 'wallet' },
  { label: 'Transactions', path: '/transactions', icon: 'list' },
  { label: 'Assurance', path: '/assurance', icon: 'shield' },
  { label: 'Contacts', path: '/contacts', icon: 'users' },
  { label: 'Analytics', path: '/analytics', icon: 'chart' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
];

export function Sidebar() {
  const currentPath = usePathname();

  return (
    <div className="flex flex-col h-full p-4">
      {/* Brand header */}
      <div className="mb-8">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Onli Synth</h1>
        <div className="mt-2 flex gap-1">
          <button className="px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-cta-primary)] text-white">
            OnliCloud
          </button>
          <button className="px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]">
            Onli AI
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              'block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentPath === item.path
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent-green)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Version */}
      <div className="mt-auto pt-4 text-xs text-[var(--color-text-secondary)]">
        Built v0.1.0
      </div>
    </div>
  );
}
