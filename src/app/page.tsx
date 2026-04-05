'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';

export default function HomePage() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<ChatPanel />}
      rightPanel={<RightPanel />}
    />
  );
}
