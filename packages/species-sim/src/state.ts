// ── Types ──────────────────────────────────────────────────────────────────

export interface VaultEvent {
  type: 'credit' | 'debit';
  count: number;
  from: string;
  to: string;
  eventId: string;
  timestamp: string;
}

export interface AssetOracleEntry {
  id: string;
  eventId: string;
  type: 'change_owner' | 'ask_to_move' | 'listing_escrow' | 'listing_release';
  from: string;
  to: string;
  count: number;
  timestamp: string;
}

export interface AskToMoveRequest {
  requestId: string;
  onliId: string;
  quantity: number;
  eventId: string;
  expiresAt: number; // epoch ms
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  resolve: ((approved: boolean) => void) | null;
}

export interface MatchFill {
  matchId: string;
  counterparty: string; // 'treasury' | listing seller onliId
  /** Present when counterparty is a listing seller (secondary market). */
  sellerOnliId?: string;
  listingId?: string;
  quantity: number;
}

export interface MatchResult {
  fills: MatchFill[];
  totalMatched: number;
}

export interface OrderState {
  eventId: string;
  intent: 'buy' | 'sell' | 'transfer' | 'redeem';
  quantity: number;
  status: 'accepted' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currentStage: string;
  completedStages: { stage: string; timestamp: string; data?: Record<string, unknown> }[];
  /** Set for buy orders after matching (vault delivery target). */
  buyerOnliId?: string;
  paymentSource?: { vaId: string };
  recipient?: { onliId: string };
  listingConfig?: { autoAuthorize: boolean };
  idempotencyKey: string;
  matches?: MatchFill[];
  tbBatchId?: string;
  oracleRefs?: { fundingOracle?: string; assetOracle?: string };
  totalCost?: number;
  fees?: { issuance: number; liquidity: number; listing: number };
  createdAt: string;
  error?: string;
}

export interface ListingState {
  listingId: string;
  sellerOnliId: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number; // base units
  status: 'active' | 'filled' | 'cancelled';
  createdAt: string;
}

export interface StageDelays {
  authenticated: number;
  validated: number;
  classified: number;
  matched: number;
  assetStaged: number;
  paymentConfirmed: number;
  ownershipChanged: number;
  completed: number;
  [key: string]: number;
}

export interface SpeciesSimConfig {
  port: number;
  marketsbUrl: string;
  pipelineDelays: StageDelays;
  askToMoveTimeoutSeconds: number;
}

export interface SpeciesSimState {
  // Pipeline
  orders: Map<string, OrderState>;
  listings: Map<string, ListingState>;
  idempotencyKeys: Set<string>;

  // Sim-Onli
  vaults: {
    treasury: { count: number };
    sellerLocker: { count: number };
    marketMaker: { count: number };
    /** Main vault + optional sender locker (canon TRANSFER_EXECUTION staging). */
    users: Map<string, { count: number; lockerCount: number; history: VaultEvent[] }>;
  };
  pendingAskToMove: Map<string, AskToMoveRequest>;
  assetOracleLog: AssetOracleEntry[];

  // Config
  errorInjections: Map<string, boolean>; // stage → fail
  stageDelays: StageDelays;
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createEmptyState(delays: StageDelays): SpeciesSimState {
  return {
    orders: new Map(),
    listings: new Map(),
    idempotencyKeys: new Set(),
    vaults: {
      treasury: { count: 0 },
      sellerLocker: { count: 0 },
      marketMaker: { count: 0 },
      users: new Map(),
    },
    pendingAskToMove: new Map(),
    assetOracleLog: [],
    errorInjections: new Map(),
    stageDelays: { ...delays },
  };
}
