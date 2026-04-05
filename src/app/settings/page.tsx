'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { RightPanel } from '@/components/RightPanel';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function Settings() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<SettingsPage />}
      rightPanel={<RightPanel />}
    />
  );
}
