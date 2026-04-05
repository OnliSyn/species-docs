// ── @marketsb/sim — Entry point ──

export { createMarketSBSim } from './server.js';
export type { MarketSBSim, CreateSimOptions } from './server.js';
export type {
  SimState,
  SimConfig,
  VirtualAccountState,
  DepositState,
  WithdrawalState,
  TransferRecord,
  OracleEntry,
  LifecycleStep,
} from './state.js';

// If run directly (not imported), start on default port 4001
const isDirectRun =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js');

if (isDirectRun) {
  const { createMarketSBSim } = await import('./server.js');

  const port = parseInt(process.env.MARKETSB_SIM_PORT || '4001', 10);
  const sim = createMarketSBSim({
    port,
    seedData: 'development',
    depositLifecycleDelayMs: 2000,
    withdrawalLifecycleDelayMs: 3000,
    sendoutApprovalThresholdUsd: 10_000_000_000n,
  });

  await sim.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await sim.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await sim.stop();
    process.exit(0);
  });
}
