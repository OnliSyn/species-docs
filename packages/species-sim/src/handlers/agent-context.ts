// ── GET /marketplace/v1/agentContext — LLM-oriented service map (mirrors MarketSB pattern)
import type { SpeciesSimConfig } from '../state.js';

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function buildSpeciesAgentContext(config: SpeciesSimConfig): Record<string, unknown> {
  const msb = config.marketsbUrl.replace(/\/$/, '');
  const speciesBase = `http://localhost:${config.port}`;
  const marketsbAgentContextUrl = joinUrl(msb, '/agentContext');

  return {
    service: 'Species',
    purpose:
      'Marketplace orchestration for specie (SPECIES) lifecycle: listings, matching, vault movements, and async order pipelines. Bridges Onli-style vaults with MarketSB funding and cashier settlement.',

    description: [
      'Species sim models the product-facing marketplace: users submit orders (buy, sell, transfer) with idempotency, receive a 202 and an eventId, then observe progress over WebSocket or poll status.',
      'Asset ownership moves through treasury → sellerLocker/marketMaker → buyer/seller user vaults, recorded in the Species asset oracle (change_owner entries).',
      'When an order reaches payment.confirmed, Species calls MarketSB POST /cashier/post-batch with intent buy or sell, buyer/seller virtual account ids, quantity, and fees. MarketSB posts debits/credits and returns tbBatchId and oracleRefs; Species stores those on the order and receipt.',
      'For the Onli AI interface: use MarketSB agentContext for cashier accounts, fees, and funding VA semantics; use this agentContext for pipeline stages, marketplace routes, WS channels, and how the two services connect.',
    ].join(' '),

    integrationWithMarketSB: {
      summary:
        'MarketSB holds USD / USDC virtual accounts and executes cashier batches; Species holds specie vault balances and the asset oracle. Both must run for end-to-end buy/sell demos.',
      marketsbApiV1Base: msb,
      marketsbAgentContextUrl: marketsbAgentContextUrl,
      cashierPostBatch: `${msb}/cashier/post-batch`,
      treasuryVaId: 'treasury-100',
      typicalVirtualAccounts: {
        funding: 'va-funding-{userRef} — user cash on MarketSB',
        species: 'va-species-{userRef} — species-linked VA on MarketSB',
        treasury: 'treasury-100 — system treasury VA (must match MarketSB seed)',
      },
      postBatchResponseFields: {
        tbBatchId: 'Batch id for receipts and cross-reference',
        oracleRefs: 'Array of funding-oracle reference strings; Species uses oracleRefs[0] as primary fundingOracle when present',
      },
    },

    marketplaceModel: {
      intents: {
        buy: 'Match (e.g. treasury or listing); stage asset; cashier post-batch; credit buyer vault',
        sell: 'Match listing; AskToMove if required; cashier post-batch; debit seller, credit counterparty',
        transfer: 'P2P move between onliIds; may require AskToMove approval (sim control)',
      },
      idempotency: 'POST /marketplace/v1/eventRequest requires idempotencyKey; duplicates return the same eventId and ws channel',
      vaults: ['treasury', 'sellerLocker', 'marketMaker', 'per-user (onliId)'],
      listings: 'GET /marketplace/v1/listings — sells can match active listings',
    },

    pipelineStages: {
      commonPrefix: [
        'request.submitted',
        'request.authenticated',
        'order.validated',
        'order.classified',
      ],
      buy: [
        'order.matched',
        'asset.staged',
        'payment.confirmed',
        'ownership.changed',
        'order.completed',
      ],
      sell: [
        'order.matched',
        'asset.staged (may include ask_to_move.pending / ask_to_move.approved)',
        'payment.confirmed',
        'ownership.changed',
        'order.completed',
      ],
      transfer: [
        'asset.staged',
        'ask_to_move.pending',
        'ask_to_move.approved',
        'ownership.changed',
        'order.completed',
      ],
    },

    orderStatuses: ['accepted', 'processing', 'completed', 'failed', 'cancelled'],

    realtime: {
      subscribePattern: 'WebSocket ws://{host}/events/{eventId}/stream after POST eventRequest',
      eventShape: { source: 'species', eventId: 'string', stage: 'string', timestamp: 'ISO', data: 'object' },
    },

    endpoints: {
      marketplaceV1: {
        base: '/marketplace/v1',
        GET_agentContext: 'GET /marketplace/v1/agentContext — this document',
        POST_eventRequest:
          'POST /marketplace/v1/eventRequest — body: eventId, intent (buy|sell|transfer), quantity, idempotencyKey, paymentSource?, recipient?, listingConfig?',
        GET_eventStatus: 'GET /marketplace/v1/events/:eventId/status',
        GET_eventReceipt: 'GET /marketplace/v1/events/:eventId/receipt — 409 until status completed',
        GET_listings: 'GET /marketplace/v1/listings',
        GET_listing: 'GET /marketplace/v1/listings/:listingId',
        GET_stats: 'GET /marketplace/v1/stats',
        GET_vault: 'GET /marketplace/v1/vault/:uid',
        GET_vaultHistory: 'GET /marketplace/v1/vault/:uid/history',
      },
      assetOracle: {
        base: '/oracle',
        GET_ledger: 'GET /oracle/ledger?limit&offset',
        GET_onliLedger: 'GET /oracle/onli/:onliId/ledger',
        GET_eventEntries: 'GET /oracle/events/:eventId/entries',
        POST_verify: 'POST /oracle/onli/:onliId/verify',
      },
      simControl: {
        POST_reset: 'POST /sim/reset',
        GET_state: 'GET /sim/state',
        GET_onli_state: 'GET /sim/onli/state',
        POST_approve: 'POST /sim/approve/:eventId — approve pending AskToMove for an event',
      },
    },

    defaultLocalBases: {
      species: speciesBase,
      nextJsRewriteHint: 'Rewrites can map /marketplace/v1/* to Species and /api/v1/* to MarketSB',
    },

    simNotes: {
      environment: `marketsbUrl is configurable (default ${msb}); SPECIES sim port defaults to ${config.port}`,
      askToMoveTimeoutSeconds: config.askToMoveTimeoutSeconds,
    },
  };
}
