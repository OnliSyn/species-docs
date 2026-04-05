'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { RightPanel } from '@/components/RightPanel';
import { AssurancePage } from '@/features/assurance/AssurancePage';

export default function Assurance() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<AssurancePage />}
      rightPanel={<RightPanel />}
    />
  );
}
