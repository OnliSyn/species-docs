export interface VaultBalance {
  user_id: string;
  vault_id: string;
  specie_count: number;
  last_updated: string;
}

export interface TransferReceipt {
  receipt_id: string;
  from_vault: string;
  to_vault: string;
  specie_count: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
}
