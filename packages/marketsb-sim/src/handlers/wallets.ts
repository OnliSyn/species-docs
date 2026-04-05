// ── Wallets handler ──
// GET /wallets → WalletBalanceDTO[]
// GET /wallets/:id/balance → WalletBalanceDTO

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

type WalletId = 'incoming' | 'market' | 'outgoing' | 'operating';

const WALLET_LABELS: Record<WalletId, string> = {
  incoming: 'Incoming USDC Wallet',
  market: 'Market Operations Wallet',
  outgoing: 'Outgoing USDC Wallet',
  operating: 'Operating Revenue Wallet',
};

function toWalletDTO(id: WalletId, balance: bigint) {
  return {
    walletId: id,
    label: WALLET_LABELS[id],
    balance,
    currency: 'USDC',
  };
}

export function createWalletsRouter(state: SimState): Router {
  const router = Router();

  // GET /wallets
  router.get('/', (_req: Request, res: Response) => {
    if (state.errorInjections.get('wallets')) {
      state.errorInjections.delete('wallets');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on wallets' });
      return;
    }

    const wallets = (Object.keys(WALLET_LABELS) as WalletId[]).map((id) =>
      toWalletDTO(id, state.systemWallets[id]),
    );

    res.json(serializeBigints(wallets));
  });

  // GET /wallets/:id/balance
  router.get('/:id/balance', (req: Request, res: Response) => {
    if (state.errorInjections.get('wallets')) {
      state.errorInjections.delete('wallets');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on wallets' });
      return;
    }

    const id = req.params.id as WalletId;
    if (!(id in WALLET_LABELS)) {
      res.status(404).json({ code: 'not_found', message: `Wallet ${id} not found. Valid: ${Object.keys(WALLET_LABELS).join(', ')}` });
      return;
    }

    res.json(serializeBigints(toWalletDTO(id, state.systemWallets[id])));
  });

  return router;
}
