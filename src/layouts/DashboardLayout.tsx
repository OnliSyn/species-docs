'use client';

import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
}

export function DashboardLayout({ leftPanel, centerPanel, rightPanel }: DashboardLayoutProps) {
  return (
    <div className="h-screen overflow-hidden bg-[var(--color-bg-outer)] p-3 flex gap-3">
      {/* Left Panel */}
      <div className="w-[280px] flex-shrink-0 bg-white rounded-[var(--radius-panel)] overflow-hidden flex flex-col">
        {leftPanel}
      </div>

      {/* Center Panel — chat */}
      <div className="flex-1 bg-white rounded-[var(--radius-panel)] overflow-hidden flex flex-col min-w-0">
        {centerPanel}
      </div>

      {/* Right Panel — content feed */}
      <div className="w-[340px] flex-shrink-0 bg-white rounded-[var(--radius-panel)] overflow-hidden flex flex-col">
        {rightPanel}
      </div>
    </div>
  );
}
