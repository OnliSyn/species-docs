import { createSpeciesSim } from './server.js';
export { createSpeciesSim };
export type { CreateSpeciesSimOptions, SpeciesSim } from './server.js';
export type {
  SpeciesSimState,
  SpeciesSimConfig,
  StageDelays,
  OrderState,
  ListingState,
  MatchFill,
  MatchResult,
  VaultEvent,
  AssetOracleEntry,
  AskToMoveRequest,
} from './state.js';

// ── Direct execution ───────────────────────────────────────────────────────

const isDirectRun =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js');

if (isDirectRun) {
  (async () => {
    const port = parseInt(process.env.PORT ?? '4002', 10);
    const marketsbUrl = process.env.MARKETSB_URL ?? 'http://localhost:4001/api/v1';

    const sim = createSpeciesSim({ port, marketsbUrl });
    await sim.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n[@species/sim] Shutting down...');
      await sim.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })();
}
