import express from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'http';
import type { SpeciesSimState, SpeciesSimConfig, StageDelays } from './state.js';
import { seedState } from './seed.js';
import { createMarketplaceRouter } from './sim-species/handlers.js';
import { createControlRouter } from './control.js';
import { createWsServer, type WsBroadcaster } from './sim-websocket/ws-server.js';

// ── Default config ─────────────────────────────────────────────────────────

const DEFAULT_DELAYS: StageDelays = {
  authenticated: 100,
  validated: 300,
  classified: 100,
  matched: 200,
  assetStaged: 700,
  paymentConfirmed: 800,
  ownershipChanged: 800,
  completed: 200,
};

export interface CreateSpeciesSimOptions {
  port?: number;
  marketsbUrl?: string;
  pipelineDelays?: Partial<StageDelays>;
  askToMoveTimeoutSeconds?: number;
}

export interface SpeciesSim {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createSpeciesSim(options: CreateSpeciesSimOptions = {}): SpeciesSim {
  const config: SpeciesSimConfig = {
    port: options.port ?? 4002,
    marketsbUrl: options.marketsbUrl ?? 'http://localhost:4001/api/v1',
    pipelineDelays: { ...DEFAULT_DELAYS, ...options.pipelineDelays },
    askToMoveTimeoutSeconds: options.askToMoveTimeoutSeconds ?? 300,
  };

  let state: SpeciesSimState = seedState(config.pipelineDelays);
  let httpServer: HttpServer | null = null;
  let wsBroadcaster: WsBroadcaster | null = null;

  const getState = () => state;
  const setState = (s: SpeciesSimState) => {
    state = s;
  };

  // ── Express app ────────────────────────────────────────────────────────

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: '@species/sim', port: config.port });
  });

  // Marketplace API routes under /marketplace/v1
  // We need to defer the router creation because the emit function isn't available yet
  // Use a middleware that lazily binds
  app.use('/marketplace/v1', (req, res, next) => {
    if (!(app as any).__marketplaceRouter) {
      (app as any).__marketplaceRouter = createMarketplaceRouter(
        getState,
        config,
        (eventId, event) => wsBroadcaster?.emit(eventId, event),
      );
    }
    // Always use current state reference
    (app as any).__marketplaceRouter(req, res, next);
  });

  // Control panel routes
  app.use(createControlRouter(getState, setState, config));

  // ── Start / Stop ───────────────────────────────────────────────────────

  const start = (): Promise<void> => {
    return new Promise((resolve) => {
      httpServer = createServer(app);

      // Create WebSocket server attached to HTTP server
      wsBroadcaster = createWsServer(httpServer);

      // Pre-create the marketplace router now that wsBroadcaster exists
      (app as any).__marketplaceRouter = createMarketplaceRouter(
        getState,
        config,
        (eventId, event) => wsBroadcaster?.emit(eventId, event),
      );

      httpServer.listen(config.port, () => {
        console.log(`[@species/sim] Running on http://localhost:${config.port}`);
        console.log(`[@species/sim] Marketplace API: http://localhost:${config.port}/marketplace/v1`);
        console.log(`[@species/sim] WebSocket: ws://localhost:${config.port}/events/{eventId}/stream`);
        console.log(`[@species/sim] MarketSB Cashier URL: ${config.marketsbUrl}`);
        resolve();
      });
    });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      if (wsBroadcaster) {
        wsBroadcaster.close();
        wsBroadcaster = null;
      }
      if (httpServer) {
        httpServer.close(() => {
          httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  return { start, stop };
}
