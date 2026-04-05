'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ContentFeed } from '@/components/ContentFeed';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';

export default function Analytics() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<AnalyticsPage />}
      rightPanel={<ContentFeed />}
    />
  );
}
