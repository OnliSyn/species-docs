'use client';

import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ContentFeed } from '@/components/ContentFeed';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

export default function Transactions() {
  return (
    <DashboardLayout
      leftPanel={<OnliAiPanel />}
      centerPanel={<TransactionsPage />}
      rightPanel={<ContentFeed />}
    />
  );
}
