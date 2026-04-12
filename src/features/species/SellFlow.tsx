'use client';

import { useState } from 'react';
import { ConfirmationCard } from '@/components/ConfirmationCard';
import { OrderStepper } from '@/components/OrderStepper';
import { useOrderFlow } from './hooks/useOrderFlow';
import { formatUsdcDisplay, USDC_SCALE } from '@/lib/amount';

interface SellFlowProps {
  quantity: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function SellFlow({ quantity, onComplete, onCancel }: SellFlowProps) {
  const { orderState, startOrder, cancelOrder, resetOrder } = useOrderFlow();
  const [confirmStatus, setConfirmStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');

  const listingValue = BigInt(quantity) * USDC_SCALE;

  const handleConfirm = () => {
    setConfirmStatus('confirmed');
    startOrder('sell', quantity);
  };

  const handleCancel = () => {
    setConfirmStatus('cancelled');
    cancelOrder();
    onCancel();
  };

  if (orderState.currentStage === 'order.completed') {
    return (
      <div className="space-y-4">
        <OrderStepper currentStage={orderState.currentStage} />
        <div className="text-center p-4">
          <p className="text-sm font-semibold text-[var(--color-accent-green)]">Sell Complete!</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {quantity} SPECIES listed for {formatUsdcDisplay(listingValue)}
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

  if (orderState.isActive) {
    return <OrderStepper currentStage={orderState.currentStage} error={orderState.error} />;
  }

  return (
    <ConfirmationCard
      title={`Sell ${quantity.toLocaleString()} SPECIES`}
      lines={[
        { label: 'Quantity', value: `${quantity.toLocaleString()} SPECIES` },
        { label: 'Listing Price', value: `${formatUsdcDisplay(listingValue)} ($1.00/Specie)` },
        { label: 'Fees', value: 'None' },
      ]}
      system="asset"
      status={confirmStatus === 'pending' ? 'pending' : confirmStatus === 'confirmed' ? 'confirmed' : 'cancelled'}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
