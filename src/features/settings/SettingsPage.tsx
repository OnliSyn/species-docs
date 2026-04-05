'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/* ── Toggle Component ────────────────────────────────────── */

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button
        onClick={onToggle}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors',
          enabled ? 'bg-[#C5DE8A]' : 'bg-[var(--color-border)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */

export function SettingsPage() {
  const [notifications, setNotifications] = useState({
    deposits: true,
    withdrawals: true,
    orderCompleted: true,
    coverageWarnings: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Settings</h1>
      <div className="space-y-6 max-w-2xl">

        {/* Profile */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Profile</h3>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-[var(--color-cta-primary)] flex items-center justify-center text-white font-bold text-lg shrink-0">
              AM
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">Alex Morgan</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">alex.morgan@onli.com</p>
                </div>
                <button
                  disabled
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-[var(--radius-button)] px-3 py-1 opacity-50 cursor-not-allowed"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Connected Wallets */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Connected Wallets</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-card)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">M</div>
                  <div>
                    <p className="text-sm font-medium">MetaMask</p>
                    <code className="text-[10px] font-mono text-[var(--color-text-secondary)]">0x742d...01E23</code>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00]">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-card)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">C</div>
                  <div>
                    <p className="text-sm font-medium">Coinbase</p>
                    <code className="text-[10px] font-mono text-[var(--color-text-secondary)]">0x1a2b...c3d4</code>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00]">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Security</h3>

          {/* Session */}
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-card)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active Session</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Started Apr 4, 2026 &middot; 10:00 AM</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00]">Active</span>
            </div>
          </div>

          {/* 2FA */}
          <div className="mb-4 flex items-center justify-between py-2 border-b border-[var(--color-border)]">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Add an extra layer of security</p>
            </div>
            <button
              disabled
              className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-button)] border border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
            >
              Enable
            </button>
          </div>

          {/* API Keys */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">API Keys</p>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-card)]">
              <div>
                <code className="text-sm font-mono">sk-...7a2b</code>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">Created Mar 15, 2026</p>
              </div>
              <button
                disabled
                className="text-xs font-semibold px-3 py-1 rounded-[var(--radius-button)] border border-[#E74C3C]/30 text-[#E74C3C] opacity-50 cursor-not-allowed"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>

        {/* Onli Identity */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Onli Identity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Vault Status</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Onli_You verified</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00]">Active</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[var(--color-border)]">
              <div>
                <p className="text-sm font-medium">Gene Credentials</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Biometric verification complete</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#C5DE8A]" />
                <span className="text-xs font-semibold text-[#3d6b00]">Verified</span>
              </div>
            </div>
            <div className="py-2 border-t border-[var(--color-border)]">
              <p className="text-sm font-medium mb-1">Identity Reference</p>
              <code className="text-xs font-mono bg-[var(--color-bg-card)] px-3 py-1.5 rounded block">
                onli:identity:0x8F3a...7B2c
              </code>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Notifications</h3>
          <div className="space-y-1">
            <Toggle label="Deposit Alerts" enabled={notifications.deposits} onToggle={() => toggleNotification('deposits')} />
            <Toggle label="Withdrawal Alerts" enabled={notifications.withdrawals} onToggle={() => toggleNotification('withdrawals')} />
            <Toggle label="Order Completed" enabled={notifications.orderCompleted} onToggle={() => toggleNotification('orderCompleted')} />
            <Toggle label="Coverage Warnings" enabled={notifications.coverageWarnings} onToggle={() => toggleNotification('coverageWarnings')} />
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Webhook URL</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value="https://hooks.example.com/onli"
                className="flex-1 text-xs font-mono bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--radius-input)] px-3 py-2"
              />
              <button
                disabled
                className="text-xs font-semibold px-3 py-2 rounded-[var(--radius-button)] border border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Network */}
        <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">Network</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Base (v1)</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Layer 2 network</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#C5DE8A]/30 text-[#3d6b00]">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
