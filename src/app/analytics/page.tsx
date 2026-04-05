'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { RightPanel } from '@/components/RightPanel';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';

export default function Analytics() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<AnalyticsPage />}
      rightPanel={<RightPanel />}
    />
  );
}
