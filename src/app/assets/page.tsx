'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ContentFeed } from '@/components/ContentFeed';
import { AssetsPage } from '@/features/assets/AssetsPage';

export default function Assets() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<AssetsPage />}
      rightPanel={<ContentFeed />}
    />
  );
}
