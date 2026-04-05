'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { ContentFeed } from '@/components/ContentFeed';

export default function HomePage() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<ChatPanel />}
      rightPanel={<ContentFeed />}
    />
  );
}
