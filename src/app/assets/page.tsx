'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { RightPanel } from '@/components/RightPanel';
import { AssetsPage } from '@/features/assets/AssetsPage';

export default function Assets() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<AssetsPage />}
      rightPanel={<RightPanel />}
    />
  );
}
