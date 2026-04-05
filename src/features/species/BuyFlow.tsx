'use client';

import { useState } from 'react';
import { ConfirmationCard } from '@/components/ConfirmationCard';
import { OrderStepper } from '@/components/OrderStepper';
import { useOrderFlow } from './hooks/useOrderFlow';
import { formatUsdcDisplay, previewBuyFees } from '@/lib/amount';

interface BuyFlowProps {
  quantity: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function BuyFlow({ quantity, onComplete, onCancel }: BuyFlowProps) {
  const { orderState, startOrder, cancelOrder, resetOrder } = useOrderFlow();
  const [confirmStatus, setConfirmStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');
  const fees = previewBuyFees(quantity);

  const handleConfirm = () => {
    setConfirmStatus('confirmed');
    startOrder('buy', quantity);
  };

  const handleCancel = () => {
    setConfirmStatus('cancelled');
    cancelOrder();
    onCancel();
  };

  // Order complete
  if (orderState.currentStage === 'order.completed') {
    return (
      <div className="space-y-4">
        <OrderStepper currentStage={orderState.currentStage} />
        <div className="text-center p-4">
          <p className="text-sm font-semibold text-[var(--color-accent-green)]">
            Order Complete!
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {quantity} SPECIES purchased successfully
          </p>
          <button
            onClick={() => { resetOrder(); onComplete(); }}
            className="mt-3 px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Order in progress
  if (orderState.isActive) {
    return <OrderStepper currentStage={orderState.currentStage} error={orderState.error} />;
  }

  // Confirmation pending
  return (
    <ConfirmationCard
      title={`Buy ${quantity.toLocaleString()} SPECIES`}
      lines={[
        { label: 'Quantity', value: `${quantity.toLocaleString()} SPECIES` },
        { label: 'Unit Price', value: '$1.00' },
        { label: 'Asset Cost', value: formatUsdcDisplay(fees.assetCost) },
        { label: 'Issuance Fee', value: formatUsdcDisplay(fees.issuanceFee) },
        { label: 'Liquidity Fee', value: formatUsdcDisplay(fees.liquidityFee) },
        { label: 'Total', value: formatUsdcDisplay(fees.totalCost) },
      ]}
      system="asset"
      status={confirmStatus === 'pending' ? 'pending' : confirmStatus === 'confirmed' ? 'confirmed' : 'cancelled'}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
