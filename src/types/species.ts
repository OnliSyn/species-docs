export type OrderIntent = 'buy' | 'sell' | 'transfer';

export interface EventRequest {
  intent: OrderIntent;
  quantity: number;
  payment_source?: {
    va_id: string;
  };
  recipient?: {
    onli_identity: string;
    vault_address: string;
  };
  idempotency_key: string;
}

export interface Fill {
  quantity: number;
  price: string;
  counterparty: string;
}

export interface ValidationResult {
  check: string;
  passed: boolean;
  message?: string;
}

export interface EventReceipt {
  event_id: string;
  intent: OrderIntent;
  quantity: number;
  fees: {
    issuance: string;
    liquidity: string;
    total: string;
  };
  status: 'completed' | 'failed';
  timestamp: string;
}

export type PipelineStage =
  | 'order.received'
  | 'order.validated'
  | 'order.classified'
  | 'order.matched'
  | 'asset.staged'
  | 'ledger.posted'
  | 'ownership.changed'
  | 'order.completed'
  | 'order.failed';

export interface PipelineEvent {
  type: PipelineStage;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface MarketplaceStats {
  total_orders: number;
  orders_today: number;
  average_order_size: string;
  unique_users: number;
  total_volume: string;
}
