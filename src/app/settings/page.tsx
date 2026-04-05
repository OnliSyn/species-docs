'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ContentFeed } from '@/components/ContentFeed';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function Settings() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<SettingsPage />}
      rightPanel={<ContentFeed />}
    />
  );
}
