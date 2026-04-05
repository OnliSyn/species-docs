'use client';

import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Profile',
    icon: '👤',
    fields: ['Display Name', 'Email', 'Avatar', 'Linked Wallets'],
  },
  {
    title: 'Security',
    icon: '🔒',
    fields: ['Session Management', 'Two-Factor Auth', 'API Keys'],
  },
  {
    title: 'Onli Identity',
    icon: '🧬',
    fields: ['Vault Status', 'Gene Credentials', 'Identity Verification'],
  },
  {
    title: 'Notifications',
    icon: '🔔',
    fields: ['Deposit Alerts', 'Withdrawal Alerts', 'Order Completed', 'Webhook Config'],
  },
];

export function SettingsPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === section.title ? null : section.title)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-bg-card)] transition-colors"
          >
            <span className="text-base">{section.icon}</span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-1">
              {section.title}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {expanded === section.title ? '▲' : '▼'}
            </span>
          </button>
          {expanded === section.title && (
            <div className="px-4 pb-4 space-y-2">
              {section.fields.map((field) => (
                <div
                  key={field}
                  className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">{field}</span>
                  <span className="text-xs text-[var(--color-text-primary)]">—</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
