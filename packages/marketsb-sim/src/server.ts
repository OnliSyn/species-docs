// ── @marketsb/sim — Express server factory ──

import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
import type { SimState, SimConfig } from './state.js';
import { DEFAULT_CONFIG } from './state.js';
import { seedDevelopment, seedTest } from './seed.js';
import { createEmptyState } from './state.js';
import { createAccountsRouter } from './handlers/accounts.js';
import { createDepositsRouter } from './handlers/deposits.js';
import { createWithdrawalsRouter } from './handlers/withdrawals.js';
import { createTransfersRouter } from './handlers/transfers.js';
import { createCashierRouter } from './handlers/cashier.js';
import { createOracleRouter } from './handlers/oracle.js';
import { createReconciliationRouter } from './handlers/reconciliation.js';
import { createWalletsRouter } from './handlers/wallets.js';
import { createControlRouter } from './control.js';
import { createCashierSpecRouter } from './handlers/cashier-spec.js';

export interface MarketSBSim {
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): SimState;
  getApp(): express.Express;
}

export interface CreateSimOptions {
  port?: number;
  seedData?: 'development' | 'test' | 'empty';
  depositLifecycleDelayMs?: number;
  withdrawalLifecycleDelayMs?: number;
  sendoutApprovalThresholdUsd?: bigint | number;
  useStrictCashierPostBatch?: boolean;
}

export function createMarketSBSim(options: CreateSimOptions = {}): MarketSBSim {
  const config: SimConfig = {
    port: options.port ?? DEFAULT_CONFIG.port,
    seedData: options.seedData ?? DEFAULT_CONFIG.seedData,
    depositLifecycleDelayMs: options.depositLifecycleDelayMs ?? DEFAULT_CONFIG.depositLifecycleDelayMs,
    withdrawalLifecycleDelayMs: options.withdrawalLifecycleDelayMs ?? DEFAULT_CONFIG.withdrawalLifecycleDelayMs,
    sendoutApprovalThresholdUsd:
      options.sendoutApprovalThresholdUsd !== undefined
        ? BigInt(options.sendoutApprovalThresholdUsd)
        : DEFAULT_CONFIG.sendoutApprovalThresholdUsd,
    useStrictCashierPostBatch:
      options.useStrictCashierPostBatch ?? DEFAULT_CONFIG.useStrictCashierPostBatch,
  };

  // Initialize state from seed
  let state: SimState;
  if (config.seedData === 'development') {
    state = seedDevelopment();
  } else if (config.seedData === 'test') {
    state = seedTest();
  } else {
    state = createEmptyState();
  }

  state.useStrictCashierPostBatch = config.useStrictCashierPostBatch;

  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: '@marketsb/sim', timestamp: new Date().toISOString() });
  });

  // ── API v1 routes ──
  const api = express.Router();

  api.use(createCashierSpecRouter(state));

  api.use('/virtual-accounts', createAccountsRouter(state));
  api.use('/deposits', createDepositsRouter(state));
  api.use('/withdrawals', createWithdrawalsRouter(state, config));
  api.use('/transfers', createTransfersRouter(state));
  api.use('/cashier', createCashierRouter(state));
  api.use('/oracle', createOracleRouter(state));
  api.use('/reconciliation', createReconciliationRouter(state));
  api.use('/wallets', createWalletsRouter(state));

  app.use('/api/v1', api);

  // ── Control panel ──
  app.use(
    '/sim',
    createControlRouter(
      () => state,
      (newState) => {
        // Replace all state references
        state.virtualAccounts = newState.virtualAccounts;
        state.deposits = newState.deposits;
        state.withdrawals = newState.withdrawals;
        state.transfers = newState.transfers;
        state.oracleLog = newState.oracleLog;
        state.systemWallets = newState.systemWallets;
        state.idempotencyKeys = newState.idempotencyKeys;
        state.errorInjections = newState.errorInjections;
        state.cashier = newState.cashier;
        state.cashierAccounts = newState.cashierAccounts;
        state.cashierTransactions = newState.cashierTransactions;
        state.cashierReceipts = newState.cashierReceipts;
        state.cashierOracleEntries = newState.cashierOracleEntries;
        state.cashierSystemUsers = newState.cashierSystemUsers;
        state.cashierIdempotency = newState.cashierIdempotency;
        state.auditEvents = newState.auditEvents;
        state.useStrictCashierPostBatch = config.useStrictCashierPostBatch;
      },
      config,
    ),
  );

  let server: Server | null = null;

  return {
    async start() {
      return new Promise<void>((resolve) => {
        server = app.listen(config.port, () => {
          const base = `http://localhost:${config.port}`;
          console.log(`@marketsb/sim running on ${base}/api/v1`);
          console.log(`  Oracle: ${base}/api/v1/oracle/ledger | ${base}/api/v1/oracle/virtual-accounts/:vaId/ledger`);
          console.log(`  Seed: ${config.seedData}`);
          console.log(`  VAs: ${state.virtualAccounts.size}`);
          console.log(`  Deposits: ${state.deposits.size}`);
          console.log(`  Control panel: ${base}/sim/state`);
          resolve();
        });
      });
    },

    async stop() {
      return new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => {
          if (err) reject(err);
          else {
            console.log('@marketsb/sim stopped');
            resolve();
          }
        });
      });
    },

    getState() {
      return state;
    },

    getApp() {
      return app;
    },
  };
}
