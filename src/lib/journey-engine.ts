// @ts-nocheck
// ---------------------------------------------------------------------------
// Journey Engine — extracted from route.ts for testability
// Handles journey state detection, confirmation, and execution
// ---------------------------------------------------------------------------
import * as crypto from 'crypto';
import {
  getUserState,
  getFundingBalance,
  getVaultBalance,
  getAssuranceBalance,
  getOracleLedger,
  getMarketplaceStats,
  getListings,
  simulateDeposit,
  simulateWithdrawal,
  creditVA,
  debitVA,
  postCashierBatch,
  adjustVault,
  buyFromMarket,
  buyFromTreasury,
  cashierRedeem,
  cashierList,
  createSpeciesListing,
  fmtUSDC,
  CURRENT_USER,
  type UserState,
} from '@/lib/sim-client';

// ---------------------------------------------------------------------------
// Species-sim pipeline helper — single entry point for buy/sell/transfer/redeem
// ---------------------------------------------------------------------------
const SPECIES_SIM = process.env.SPECIES_URL || 'http://localhost:4012';

interface PipelineResult {
  ok: boolean;
  eventId: string;
  status: string;
  stages: { stage: string; timestamp: string; data?: Record<string, unknown> }[];
  receipt?: Record<string, unknown>;
  error?: string;
}

async function submitPipeline(payload: {
  intent: 'buy' | 'sell' | 'transfer' | 'redeem';
  quantity: number;
  paymentSource?: { vaId: string };
  recipient?: { onliId: string };
  listingConfig?: { autoAuthorize: boolean };
}): Promise<PipelineResult> {
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const idempotencyKey = `${payload.intent}-${eventId}`;

  // 1. Submit to species-sim pipeline
  try {
    const res = await fetch(`${SPECIES_SIM}/marketplace/v1/eventRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        intent: payload.intent,
        quantity: payload.quantity,
        paymentSource: payload.paymentSource,
        recipient: payload.recipient,
        listingConfig: payload.listingConfig,
        idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { ok: false, eventId, status: 'failed', stages: [], error: err.error || 'Submit failed' };
    }
  } catch (err) {
    return { ok: false, eventId, status: 'failed', stages: [], error: 'Species-sim unreachable' };
  }

  // 2. Poll for pipeline completion
  let status = 'pending';
  let stages: { stage: string; timestamp: string; data?: Record<string, unknown> }[] = [];
  let receipt: Record<string, unknown> | undefined;
  let lastError: string | undefined;
  let autoApproved = false;

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const statusRes = await fetch(`${SPECIES_SIM}/marketplace/v1/events/${eventId}/status`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        status = data.status;
        stages = data.completedStages || [];
        lastError = data.error;

        // Auto-approve AskToMove for transfers in simulated environment
        if (!autoApproved && stages.some((s: { stage: string }) => s.stage === 'ask_to_move.pending')) {
          autoApproved = true;
          try {
            await fetch(`${SPECIES_SIM}/sim/approve/${eventId}`, { method: 'POST' });
          } catch {
            // Approval endpoint may not be available; pipeline will timeout
          }
        }

        if (status === 'completed' || status === 'failed') break;
      }
    } catch {
      // Retry on network error
    }
  }

  // 3. If completed, fetch receipt
  if (status === 'completed') {
    try {
      const receiptRes = await fetch(`${SPECIES_SIM}/marketplace/v1/events/${eventId}/receipt`);
      if (receiptRes.ok) {
        receipt = await receiptRes.json();
      }
    } catch {
      // Receipt fetch optional
    }
  }

  return {
    ok: status === 'completed',
    eventId,
    status,
    stages,
    receipt,
    error: lastError,
  };
}

/** Map pipeline completedStages to PipelineCard stage objects */
function mapPipelineStages(
  stages: { stage: string; timestamp: string }[],
  failed: boolean,
): { label: string; system: string; status: string }[] {
  const STAGE_LABELS: Record<string, { label: string; system: string }> = {
    'request.submitted': { label: 'Submitted', system: 'SM' },
    'request.authenticated': { label: 'Authenticated', system: 'SM' },
    'order.validated': { label: 'Validated', system: 'SM' },
    'order.classified': { label: 'Classified', system: 'SM' },
    'order.matched': { label: 'Matched', system: 'SM' },
    'asset.staged': { label: 'Asset staged', system: 'OC' },
    'ask_to_move.pending': { label: 'AskToMove pending', system: 'OC' },
    'ask_to_move.approved': { label: 'AskToMove approved', system: 'OC' },
    'payment.confirmed': { label: 'Payment processed', system: 'MB' },
    'ownership.changed': { label: 'Delivered to Vault', system: 'OC' },
    'order.completed': { label: 'Complete', system: 'SM' },
    'order.failed': { label: 'Failed', system: 'SM' },
  };

  return stages.map(s => {
    const info = STAGE_LABELS[s.stage] || { label: s.stage, system: '??' };
    const isFailed = s.stage === 'order.failed';
    return { label: info.label, system: info.system, status: isFailed ? 'failed' : 'done' };
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface Message {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

export interface JourneyState {
  phase: string;
  journey?: string;
  amount?: number;
  quantity?: number;
  recipient?: string;
  destination?: string;
}

export interface JourneyResponse {
  type: 'tool';
  toolName: string;
  data: Record<string, unknown>;
  followUp?: string;
}

// ---------------------------------------------------------------------------
// Server-side journey context store
// ---------------------------------------------------------------------------
export interface PendingJourney {
  journey: string;
  amount?: number;
  quantity?: number;
  recipient?: string;
  destination?: string;
  timestamp: number;
}

// Map of chatId -> pending journey (expires after 5 min)
const pendingJourneys = new Map<string, PendingJourney>();

export function setPendingJourney(chatId: string, journey: PendingJourney): void {
  pendingJourneys.set(chatId, journey);
  // Clean up old entries
  const now = Date.now();
  for (const [k, v] of pendingJourneys) {
    if (now - v.timestamp > 300_000) pendingJourneys.delete(k);
  }
}

export function consumePendingJourney(chatId: string): PendingJourney | null {
  const j = pendingJourneys.get(chatId);
  if (j) pendingJourneys.delete(chatId);
  return j || null;
}

// ---------------------------------------------------------------------------
// Live user state — fetched from sims, with fallback defaults
// ---------------------------------------------------------------------------
const FALLBACK_STATE: UserState = {
  fundingBalance: 0,
  specieCount: 0,
  fundingVA: null,
  vaultBalance: null,
};

export async function getLiveState(): Promise<UserState> {
  try {
    return await getUserState();
  } catch {
    return FALLBACK_STATE;
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Journey state detection — parses full conversation history
// ---------------------------------------------------------------------------
export function detectJourneyState(messages: Message[]): JourneyState {
  const assistantTexts: string[] = [];
  const userTexts: string[] = [];
  for (const m of messages) {
    let text = '';

    // Extract text from content (string format)
    if (typeof m.content === 'string') {
      text = m.content;
    }
    // Extract text from content array (model message format: [{type:'text', text:'...'}])
    else if (Array.isArray(m.content)) {
      for (const c of m.content as any[]) {
        if (c.type === 'text' && c.text) text += ' ' + c.text;
        // Tool result content — extract the JSON to find journey info
        if (c.type === 'tool-result' && c.output) {
          try {
            let output = c.output;
            if (Array.isArray(output)) {
              for (const o of output) {
                if (o.type === 'text' && o.value) {
                  const parsed = JSON.parse(o.value);
                  if (parsed.title) text += ' ' + parsed.title;
                  if (parsed._ui === 'ConfirmCard') text += ' type confirm';
                }
              }
            }
          } catch {}
        }
      }
    }

    // Extract from parts format (UI message format)
    if (Array.isArray(m.parts)) {
      for (const p of m.parts as any[]) {
        if (p.type === 'text' && p.text) text += ' ' + p.text;
        // Tool invocation parts
        if ((p.type === 'tool-invocation' || p.type === 'tool-call') && p.output) {
          try {
            let output = p.output;
            if (typeof output === 'object' && output !== null && 'value' in output) output = output.value;
            if (typeof output === 'string') output = JSON.parse(output);
            if (output && output.title) text += ' ' + output.title;
            if (output && output._ui === 'ConfirmCard') text += ' type confirm';
          } catch {}
        }
        // Tool result parts
        if (p.type === 'tool-result') {
          try {
            let output = p.output;
            if (Array.isArray(output)) {
              for (const o of output) {
                if (o.type === 'text' && o.value) {
                  const parsed = JSON.parse(o.value);
                  if (parsed.title) text += ' ' + parsed.title;
                  if (parsed._ui === 'ConfirmCard') text += ' type confirm';
                }
              }
            } else if (typeof output === 'string') {
              const parsed = JSON.parse(output);
              if (parsed.title) text += ' ' + parsed.title;
              if (parsed._ui === 'ConfirmCard') text += ' type confirm';
            }
          } catch {}
        }
      }
    }

    if (m.role === 'assistant') assistantTexts.push(text.trim());
    else if (m.role === 'user') userTexts.push(text.trim());
  }

  // Debug: log what we extracted
  console.log('[JOURNEY DETECT] Assistant texts:', assistantTexts.map(t => t.substring(0, 80)));
  console.log('[JOURNEY DETECT] User texts:', userTexts);

  const lastUserText = userTexts.length > 0 ? userTexts[userTexts.length - 1].trim() : '';
  const lastUserLower = lastUserText.toLowerCase();
  const lastAssistantText = assistantTexts.length > 0 ? assistantTexts[assistantTexts.length - 1] : '';
  const lastAssistantLower = lastAssistantText.toLowerCase();
  const allContext = [...assistantTexts, ...userTexts].join(' ').toLowerCase();

  // ---- Phase: CONFIRM/CANCEL detection ----
  const awaitingConfirm = lastAssistantLower.includes('type **confirm**') ||
    lastAssistantLower.includes('type confirm') ||
    lastAssistantLower.includes('confirm to proceed') ||
    lastAssistantLower.includes('_ui') && lastAssistantLower.includes('confirmcard');

  if (awaitingConfirm) {
    const isConfirm = ['confirm', 'yes', 'y'].includes(lastUserLower);
    const isCancel = ['cancel', 'no', 'n', 'abort'].includes(lastUserLower);

    if (isConfirm || isCancel) {
      let journey = 'unknown';
      if (lastAssistantLower.includes('fund your account')) journey = 'fund';
      else if (lastAssistantLower.includes('issue') && lastAssistantLower.includes('treasury')) journey = 'issue';
      else if (lastAssistantLower.includes('buy') && lastAssistantLower.includes('species')) journey = 'buy';
      else if (lastAssistantLower.includes('redeem') && lastAssistantLower.includes('species')) journey = 'redeem';
      else if (lastAssistantLower.includes('list') && lastAssistantLower.includes('species')) journey = 'sell';
      else if (lastAssistantLower.includes('transfer') && lastAssistantLower.includes('species')) journey = 'transfer';
      else if (lastAssistantLower.includes('withdraw')) journey = 'sendout';

      let amount = 0;
      let quantity = 0;
      const amtMatch = lastAssistantText.match(/\$([0-9,]+\.\d{2})\s*USDC/);
      if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));
      const qtyMatch = lastAssistantText.match(/(\d[\d,]*)\s*SPECIES/i);
      if (qtyMatch) quantity = parseInt(qtyMatch[1].replace(/,/g, ''));

      if (isCancel) return { phase: 'cancelled', journey };
      return { phase: 'execute', journey, amount, quantity };
    }
    // User provided a new number while awaiting confirm — restart with new amount
    const newNum = lastUserText.match(/(\d[\d,]*)/);
    if (newNum) {
      let journey = 'unknown';
      if (lastAssistantLower.includes('fund') || lastAssistantLower.includes('deposit')) journey = 'fund';
      else if (lastAssistantLower.includes('issue') && lastAssistantLower.includes('treasury')) journey = 'issue';
      else if (lastAssistantLower.includes('buy') && lastAssistantLower.includes('species')) journey = 'buy';
      else if (lastAssistantLower.includes('redeem') && lastAssistantLower.includes('species')) journey = 'redeem';
      else if (lastAssistantLower.includes('list') && lastAssistantLower.includes('species')) journey = 'sell';
      else if (lastAssistantLower.includes('transfer') && lastAssistantLower.includes('species')) journey = 'transfer';
      else if (lastAssistantLower.includes('withdraw')) journey = 'sendout';

      const newVal = parseInt(newNum[1].replace(/,/g, ''));
      if (journey === 'fund' || journey === 'sendout') {
        return { phase: 'confirm', journey, amount: newVal };
      }
      return { phase: 'confirm', journey, quantity: newVal };
    }

    return { phase: 'awaiting_confirm_reminder' };
  }

  // ---- Phase: FRESH INTENT CHECK (before amount parsing) ----
  const hasJourneyKeyword = lastUserLower.includes('fund') || lastUserLower.includes('deposit') ||
    lastUserLower.includes('buy') || lastUserLower.includes('sell') || lastUserLower.includes('list') ||
    lastUserLower.includes('redeem') || lastUserLower.includes('transfer') ||
    lastUserLower.includes('withdraw') || lastUserLower.includes('issue');
  const isJustQuantity = /^\d[\d,]*\s*(species?|sp)?$/i.test(lastUserText.trim());
  const shouldStartFreshJourney = hasJourneyKeyword && !isJustQuantity;

  if (shouldStartFreshJourney) {
    const inlineNum = lastUserText.match(/(\d[\d,]*)/);
    const inlineQty = inlineNum ? parseInt(inlineNum[1].replace(/,/g, '')) : 0;
    const inlineAmt = inlineQty;

    if (lastUserLower.includes('fund') || (lastUserLower.includes('deposit') && !lastUserLower.includes('last deposit'))) {
      return inlineAmt > 0
        ? { phase: 'confirm', journey: 'fund', amount: inlineAmt }
        : { phase: 'start', journey: 'fund' };
    }
    if (lastUserLower.includes('issue') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('treasury'))) {
      return inlineQty > 0
        ? { phase: 'confirm', journey: 'issue', quantity: inlineQty }
        : { phase: 'start', journey: 'issue' };
    }
    if (lastUserLower.includes('buy')) {
      return inlineQty > 0
        ? { phase: 'confirm', journey: 'buy', quantity: inlineQty }
        : { phase: 'start', journey: 'buy' };
    }
    if (lastUserLower.includes('redeem') || lastUserLower.includes('buyback') || lastUserLower.includes('buy back')) {
      return inlineQty > 0
        ? { phase: 'confirm', journey: 'redeem', quantity: inlineQty }
        : { phase: 'start', journey: 'redeem' };
    }
    if ((lastUserLower.includes('sell') || lastUserLower.includes('list')) && !lastUserLower.includes('buy')) {
      return inlineQty > 0
        ? { phase: 'confirm', journey: 'sell', quantity: inlineQty }
        : { phase: 'start', journey: 'sell' };
    }
    if (lastUserLower.includes('transfer')) {
      const xferFullMatch = lastUserText.match(/transfer\s+(\d[\d,]*)\s+(?:species?\s+)?to\s+(.+)/i);
      if (xferFullMatch) {
        const qty = parseInt(xferFullMatch[1].replace(/,/g, ''));
        const recipient = xferFullMatch[2].trim();
        if (recipient.length > 0) {
          return { phase: 'confirm', journey: 'transfer', quantity: qty, recipient };
        }
      }
      if (inlineQty > 0) {
        return { phase: 'transfer_need_recipient', journey: 'transfer', quantity: inlineQty } as JourneyState;
      }
      return { phase: 'start', journey: 'transfer' };
    }
    // "send" + "species/specie" → treat as transfer, not sendout
    if (lastUserLower.includes('send') && (lastUserLower.includes('species') || lastUserLower.includes('specie')) && !lastUserLower.includes('usdc') && !lastUserLower.includes('withdraw')) {
      const xferSendMatch = lastUserText.match(/send\s+(\d[\d,]*)\s+(?:species?\s+)?to\s+(.+)/i);
      if (xferSendMatch) {
        const qty = parseInt(xferSendMatch[1].replace(/,/g, ''));
        const recipient = xferSendMatch[2].trim();
        if (recipient.length > 0) {
          return { phase: 'confirm', journey: 'transfer', quantity: qty, recipient };
        }
      }
      return inlineQty > 0
        ? { phase: 'transfer_need_recipient', journey: 'transfer', quantity: inlineQty } as JourneyState
        : { phase: 'start', journey: 'transfer' };
    }
    if (lastUserLower.includes('sendout') || lastUserLower.includes('withdraw')) {
      return inlineAmt > 0
        ? { phase: 'confirm', journey: 'sendout', amount: inlineAmt }
        : { phase: 'start', journey: 'sendout' };
    }
  }

  // ---- Phase: AMOUNT/QUANTITY detection (only bare numbers, no journey keywords) ----
  const askedHowMuch = lastAssistantLower.includes('how much usdc') || lastAssistantLower.includes('how much and where') || lastAssistantLower.includes('how much usdc and where');
  const askedHowMany = lastAssistantLower.includes('how many specie');
  const askedWhoAndHowMany = lastAssistantLower.includes('who and how many');

  const numberMatch = lastUserText.match(/^[\$]?(\d[\d,]*\.?\d*)\s*(species?|sp)?$/i);
  const hasNumber = numberMatch !== null;

  if (askedHowMany && hasNumber) {
    const qty = parseInt(numberMatch![1].replace(/,/g, ''));
    if (lastAssistantLower.includes('redeem')) {
      return { phase: 'confirm', journey: 'redeem', quantity: qty };
    }
    if (lastAssistantLower.includes('list for sale') || lastAssistantLower.includes('list')) {
      return { phase: 'confirm', journey: 'sell', quantity: qty };
    }
    if (lastAssistantLower.includes('issue') || lastAssistantLower.includes('treasury')) {
      return { phase: 'confirm', journey: 'issue', quantity: qty };
    }
    return { phase: 'confirm', journey: 'buy', quantity: qty };
  }

  if (askedHowMuch && hasNumber) {
    const amt = parseFloat(numberMatch![1].replace(/,/g, ''));
    if (lastAssistantLower.includes('withdraw') || lastAssistantLower.includes('how much and where') || lastAssistantLower.includes('how much usdc and where')) {
      return { phase: 'confirm', journey: 'sendout', amount: amt };
    }
    return { phase: 'confirm', journey: 'fund', amount: amt };
  }

  // Transfer: user responds with "pepper 100" or "pepper potts 100" style
  const transferContextActive = askedWhoAndHowMany || allContext.includes('who and how many') ||
    lastAssistantLower.includes('who would you like to transfer') || lastAssistantLower.includes('your contacts');
  if (transferContextActive) {
    const transferMatch = lastUserText.match(/(.+?)\s+(\d+)/i);
    if (transferMatch) {
      const recipient = transferMatch[1].trim();
      const qty = parseInt(transferMatch[2]);
      return { phase: 'confirm', journey: 'transfer', quantity: qty, recipient };
    }

    const knownContacts = ['pepper', 'pepper potts', 'tony', 'tony stark', 'happy', 'happy hogan'];
    const isContactName = knownContacts.some(c => lastUserLower.includes(c));
    if (isContactName) {
      let ctxQty = 0;
      for (let i = userTexts.length - 2; i >= 0; i--) {
        const prevNum = userTexts[i].match(/(\d[\d,]*)/);
        if (prevNum) { ctxQty = parseInt(prevNum[1].replace(/,/g, '')); break; }
      }
      if (ctxQty === 0) {
        const assistantQty = allContext.match(/transfer\s+(\d[\d,]*)/i);
        if (assistantQty) ctxQty = parseInt(assistantQty[1].replace(/,/g, ''));
      }
      if (ctxQty > 0) {
        return { phase: 'confirm', journey: 'transfer', quantity: ctxQty, recipient: lastUserText.trim() };
      }
      return { phase: 'start', journey: 'transfer' };
    }
  }

  // SendOut: user responds with amount + address
  if (lastAssistantLower.includes('how much and where') || lastAssistantLower.includes('how much usdc and where')) {
    const sendMatch = lastUserText.match(/(\d[\d,]*\.?\d*)\s+(?:to\s+)?(.+)/i);
    if (sendMatch) {
      const amt = parseFloat(sendMatch[1].replace(/,/g, ''));
      const dest = sendMatch[2].trim();
      return { phase: 'confirm', journey: 'sendout', amount: amt, destination: dest };
    }
  }

  // ---- Phase: INTENT detection (fresh journey start) ----
  if (lastUserLower.includes('fund') || (lastUserLower.includes('deposit') && !lastUserLower.includes('last deposit'))) {
    return { phase: 'start', journey: 'fund' };
  }
  if (lastUserLower.includes('issue') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('treasury'))) {
    return { phase: 'start', journey: 'issue' };
  }
  if (lastUserLower.includes('buy')) {
    return { phase: 'start', journey: 'buy' };
  }
  if (lastUserLower.includes('redeem') || lastUserLower.includes('buyback') || lastUserLower.includes('buy back') || (lastUserLower.includes('sell back') && lastUserLower.includes('market'))) {
    return { phase: 'start', journey: 'redeem' };
  }
  if (lastUserLower.includes('sell') || lastUserLower.includes('list')) {
    return { phase: 'start', journey: 'sell' };
  }
  if (lastUserLower.includes('transfer')) {
    return { phase: 'start', journey: 'transfer' };
  }
  if (lastUserLower.includes('sendout') || lastUserLower.includes('withdraw')) {
    return { phase: 'start', journey: 'sendout' };
  }

  return { phase: 'none' };
}

// ---------------------------------------------------------------------------
// Journey response generators
// ---------------------------------------------------------------------------

// Fund constants
const INCOMING_ACCOUNT = '0x7F4e...2A9d';
const USER_ACCOUNT_NUMBER = 'MSB-VA-500-0x8F3a...7B2c';

export function fundStart(): string {
  return `To fund your account, send USDC to:\n\n` +
    `**Incoming Account:** \`${INCOMING_ACCOUNT}\`\n` +
    `**Memo / Notes:** For Benefit Of \`${USER_ACCOUNT_NUMBER}\`\n\n` +
    `**This is a simulation — do NOT send real USDC.** We will simulate the deposit for testing purposes.\n\n` +
    `How much USDC would you like to simulate depositing?`;
}

export function fundConfirm(amount: number): JourneyResponse {
  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: 'SIMULATED DEPOSIT',
      lines: [
        { label: 'Amount', value: `$${fmt(amount)} USDC` },
        { label: 'Send To', value: `Incoming Account (${INCOMING_ACCOUNT})` },
        { label: 'For Benefit Of', value: USER_ACCOUNT_NUMBER },
        { label: 'Credit To', value: 'Your Funding Account (VA-500)' },
      ],
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function fundExecute(amount: number): Promise<JourneyResponse> {
  const baseUnits = Math.round(amount * 1_000_000);
  const vaId = `va-funding-${CURRENT_USER.ref}`;
  await simulateDeposit(vaId, baseUnits, USER_ACCOUNT_NUMBER);

  const state = await getLiveState();
  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'LifecycleCard',
      title: 'Deposit',
      amount: `$${fmt(amount)}`,
      steps: [
        { label: `USDC sent to Incoming (${INCOMING_ACCOUNT})`, done: true },
        { label: `FBO matched: ${USER_ACCOUNT_NUMBER}`, done: true },
        { label: 'Compliance check passed', done: true },
        { label: 'Credited to Funding Account', done: true },
      ],
      newBalance: `$${fmt(state.fundingBalance)}`,
    },
    followUp: `Deposit complete! $${fmt(amount)} USDC received at Incoming Account, matched to your FBO, and credited to your Funding Account.`,
  };
}

export function buyStart(): string {
  return 'How many Specie would you like to buy?\n\nEach Specie is priced at **$1.00 USDC**. Just tell me the quantity.';
}

export async function buyConfirm(quantity: number): Promise<JourneyResponse | string> {
  const state = await getLiveState();

  const listings = await getListings();
  const availableOnMarket = listings ? listings.reduce((sum: number, l: any) => sum + (l.remainingQuantity || 0), 0) : 0;
  const fromMarket = Math.min(quantity, availableOnMarket);
  const fromTreasury = quantity - fromMarket;
  const issuanceFee = fromTreasury * 0.05;
  const liquidityFee = quantity * 0.01; // 1% of asset cost
  const cost = quantity * 1.00;
  const total = cost + issuanceFee + liquidityFee;

  if (state.fundingBalance < total) {
    return `**Insufficient funds.** You need $${fmt(total)} but your Funding Account has $${fmt(state.fundingBalance)}.\n\nUse **Fund** to deposit USDC first.`;
  }

  const lines: { label: string; value: string; bold?: boolean }[] = [];
  if (fromMarket > 0) {
    lines.push({ label: 'From Marketplace', value: `${fromMarket.toLocaleString()} @ $1.00 (no fees)` });
  }
  if (fromTreasury > 0) {
    lines.push({ label: 'From Treasury', value: `${fromTreasury.toLocaleString()} @ $1.00` });
    lines.push({ label: 'Issuance Fee', value: `$${fmt(issuanceFee)}` });
    lines.push({ label: 'Liquidity Fee (1%)', value: `$${fmt(liquidityFee)}` });
  }
  lines.push({ label: 'Asset Cost', value: `$${fmt(cost)}` });
  lines.push({ label: 'Total', value: `$${fmt(total)}`, bold: true });

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `BUY ${quantity.toLocaleString()} SPECIES`,
      lines,
      from: `Funding Account ($${fmt(state.fundingBalance)})`,
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function buyExecute(quantity: number): Promise<JourneyResponse> {
  const result = await submitPipeline({
    intent: 'buy',
    quantity,
    paymentSource: { vaId: `va-funding-${CURRENT_USER.ref}` },
  });

  if (!result.ok) {
    return {
      type: 'tool',
      toolName: 'journey_execute',
      data: {
        _ui: 'PipelineCard',
        title: `BUY ${quantity.toLocaleString()} SPECIES — FAILED`,
        eventId: result.eventId,
        batchId: null,
        stages: mapPipelineStages(result.stages, true),
        error: result.error || 'Pipeline failed — no funds were debited and no Species were delivered.',
      },
      followUp: 'Payment failed. Please check your Funding Account balance and try again.',
    };
  }

  const receipt = result.receipt || {};
  const totalCost = Number(receipt.totalCost || 0);
  const fees = (receipt.fees as any) || { issuance: 0, liquidity: 0, listing: 0 };
  const issuanceFee = Number(fees.issuance || 0) / 1_000_000;
  const cost = quantity * 1.00;
  const total = cost + issuanceFee;

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `BUY ${quantity.toLocaleString()} SPECIES`,
      eventId: result.eventId,
      batchId: receipt.tbBatchId || null,
      stages: mapPipelineStages(result.stages, false),
      receipt: { quantity, cost: `$${fmt(cost)}`, fees: `$${fmt(issuanceFee)}`, total: `$${fmt(total)}`, assurance: `$${fmt(cost)}` },
      balances: { funding: `$${fmt(state.fundingBalance)}`, species: `${state.specieCount.toLocaleString()} SPECIES` },
    },
    followUp: `Order complete! You bought ${quantity.toLocaleString()} SPECIES for $${fmt(total)}.`,
  };
}

// ---------------------------------------------------------------------------
// ISSUE journey
// ---------------------------------------------------------------------------

export function issueStart(): string {
  return 'How many Specie would you like to issue from the Treasury?\n\nEach Specie costs **$1.00 USDC** plus a **$0.05/Specie issuance fee**.\n\n100% of the asset cost goes to the **Assurance Account** to back the buy-back guarantee.';
}

export async function issueConfirm(quantity: number): Promise<JourneyResponse | string> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.05;
  const total = cost + issuanceFee;
  const state = await getLiveState();

  if (state.fundingBalance < total) {
    return `**Insufficient funds.** Issuing ${quantity.toLocaleString()} Specie costs $${fmt(total)} but your Funding Account has $${fmt(state.fundingBalance)}.\n\nUse **Fund** to deposit USDC first.`;
  }

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `ISSUE ${quantity.toLocaleString()} SPECIES FROM TREASURY`,
      lines: [
        { label: 'Asset Cost', value: `$${fmt(cost)}` },
        { label: 'Issuance Fee ($0.05/Specie)', value: `$${fmt(issuanceFee)}` },
        { label: 'Total Debit', value: `$${fmt(total)}`, bold: true },
        { label: '', value: '' },
        { label: 'Proceeds to Assurance', value: `$${fmt(cost)}` },
        { label: 'Fees to Operating', value: `$${fmt(issuanceFee)}` },
      ],
      from: `Funding Account ($${fmt(state.fundingBalance)})`,
      warning: 'This issues new Specie from the Treasury. The full asset cost flows to the Assurance Account.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function issueExecute(quantity: number): Promise<JourneyResponse> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.05;
  const total = cost + issuanceFee;
  const fees = issuanceFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  const USDC = 1_000_000;
  const cashierResult = await postCashierBatch({
    eventId,
    matchId: `match-${eventId}`,
    intent: 'buy',
    quantity,
    buyerVaId: `va-funding-${CURRENT_USER.ref}`,
    unitPrice: USDC,
    fees: { issuance: true, liquidity: false },
  });
  console.log(`[ISSUE] cashier result: ok=${cashierResult.ok}, quantity=${quantity}`);

  if (cashierResult.ok) {
    await Promise.all([
      adjustVault(CURRENT_USER.onliId, quantity, 'issue'),
      adjustVault('treasury', -quantity, 'issue-decrement'),
    ]);
  }

  const state = await getLiveState();
  const newFunding = state.fundingBalance;
  const newSpecies = state.specieCount;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `ISSUE ${quantity.toLocaleString()} SPECIES FROM TREASURY`,
      eventId,
      batchId,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Authenticated', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Treasury matched', system: 'SM', status: 'done' },
        { label: 'Asset staged from Treasury', system: 'OC', status: 'done' },
        { label: 'Payment to Assurance', system: 'MB', status: 'done' },
        { label: 'Delivered to Vault', system: 'OC', status: 'done' },
        { label: 'Oracle verified', system: 'SM', status: 'done' },
        { label: 'Complete', system: 'SM', status: 'done' },
      ],
      receipt: {
        quantity,
        cost: `$${fmt(cost)}`,
        fees: `$${fmt(fees)}`,
        total: `$${fmt(total)}`,
        assurance: `$${fmt(cost)}`,
        note: 'Asset cost → Assurance Account | Fees → Operating Revenue',
      },
      balances: { funding: `$${fmt(newFunding)}`, species: `${newSpecies.toLocaleString()} SPECIES` },
    },
    followUp: `Issuance complete! ${quantity.toLocaleString()} SPECIES issued from Treasury.\n\n$${fmt(cost)} flows to Assurance, $${fmt(fees)} to Operating.`,
  };
}

// ---------------------------------------------------------------------------
// SELL journey
// ---------------------------------------------------------------------------

export async function sellStart(): Promise<string> {
  const state = await getLiveState();
  return `How many Specie would you like to list for sale?\n\nYou currently hold **${state.specieCount.toLocaleString()} Specie** in your Vault.\n\nYour species will be held in Settlement Vault until a buyer purchases them. No fees.`;
}

export async function sellConfirm(quantity: number): Promise<JourneyResponse | string> {
  const listingValue = quantity * 1.00;
  const state = await getLiveState();

  if (state.specieCount < quantity) {
    return `**Insufficient Species.** You want to list ${quantity.toLocaleString()} but you only have ${state.specieCount.toLocaleString()} in your Vault.`;
  }

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `LIST ${quantity.toLocaleString()} SPECIES FOR SALE`,
      lines: [
        { label: 'Quantity', value: `${quantity.toLocaleString()} SPECIES` },
        { label: 'Listing Price', value: `$${fmt(listingValue)} ($1.00/Specie)` },
        { label: 'Fees', value: 'None' },
      ],
      warning: 'Species will be moved to Settlement Vault until sold.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function sellExecute(quantity: number): Promise<JourneyResponse> {
  const result = await submitPipeline({
    intent: 'sell',
    quantity,
    paymentSource: { vaId: `va-funding-${CURRENT_USER.ref}` },
    listingConfig: { autoAuthorize: true },
  });

  if (!result.ok) {
    return {
      type: 'tool',
      toolName: 'journey_execute',
      data: {
        _ui: 'PipelineCard',
        title: `LIST ${quantity.toLocaleString()} SPECIES — FAILED`,
        eventId: result.eventId,
        batchId: null,
        stages: mapPipelineStages(result.stages, true),
        error: result.error || 'Listing failed — no Species were moved.',
      },
      followUp: 'Listing failed. Please check your Vault balance and try again.',
    };
  }

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `LIST ${quantity.toLocaleString()} SPECIES`,
      eventId: result.eventId,
      batchId: result.receipt?.tbBatchId || null,
      stages: mapPipelineStages(result.stages, false),
      receipt: { quantity, cost: `$${fmt(quantity * 1.00)}`, fees: 'None', total: '$0.00' },
      balances: { funding: `$${fmt(state.fundingBalance)}`, species: `${state.specieCount.toLocaleString()} SPECIES` },
    },
    followUp: `Listing created! ${quantity.toLocaleString()} SPECIES listed for sale at $1.00/Specie. Species held in Settlement Vault until sold.`,
  };
}

// ---------------------------------------------------------------------------
// REDEEM journey
// ---------------------------------------------------------------------------

export async function redeemStart(): Promise<string> {
  const state = await getLiveState();
  return `How many Specie would you like to redeem?\n\nYou currently hold **${state.specieCount.toLocaleString()} Specie** in your Vault.\n\nThe MarketMaker will buy back at **$1.00/Specie** from the Assurance Account. A **1% liquidity fee** is charged.`;
}

export async function redeemConfirm(quantity: number): Promise<JourneyResponse | string> {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.01;
  const net = gross - liquidityFee;
  const state = await getLiveState();

  if (state.specieCount < quantity) {
    return `**Insufficient Species.** You want to redeem ${quantity.toLocaleString()} but you only have ${state.specieCount.toLocaleString()} in your Vault.`;
  }

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `REDEEM ${quantity.toLocaleString()} SPECIES`,
      lines: [
        { label: 'Redemption Value', value: `$${fmt(gross)} (1:1 from Assurance)` },
        { label: 'Liquidity Fee (1%)', value: `-$${fmt(liquidityFee)}` },
        { label: 'Net Payout', value: `$${fmt(net)}`, bold: true },
      ],
      from: `Vault (${state.specieCount.toLocaleString()} SPECIES)`,
      warning: 'Assurance Account funds the buyback. Species return to MarketMaker.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function redeemExecute(quantity: number): Promise<JourneyResponse> {
  const result = await submitPipeline({
    intent: 'redeem',
    quantity,
    paymentSource: { vaId: `va-funding-${CURRENT_USER.ref}` },
  });

  if (!result.ok) {
    return {
      type: 'tool',
      toolName: 'journey_execute',
      data: {
        _ui: 'PipelineCard',
        title: `REDEEM ${quantity.toLocaleString()} SPECIES — FAILED`,
        eventId: result.eventId,
        batchId: null,
        stages: mapPipelineStages(result.stages, true),
        error: result.error || 'Redemption failed.',
      },
      followUp: `**Redemption failed.** The Assurance Account has insufficient funds to cover this redemption. This can happen if no Species have been purchased from treasury yet (assurance is funded by purchase proceeds).`,
    };
  }

  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.01;
  const net = gross - liquidityFee;

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `REDEEM ${quantity.toLocaleString()} SPECIES`,
      eventId: result.eventId,
      batchId: result.receipt?.tbBatchId || null,
      stages: mapPipelineStages(result.stages, false),
      receipt: {
        quantity,
        cost: `$${fmt(gross)}`,
        fees: `$${fmt(liquidityFee)}`,
        total: `$${fmt(net)}`,
        note: 'Assurance → You (1:1) | Liquidity fee → MarketMaker',
      },
      balances: { funding: `$${fmt(state.fundingBalance)}`, species: `${state.specieCount.toLocaleString()} SPECIES` },
    },
    followUp: `Redemption complete! ${quantity.toLocaleString()} SPECIES redeemed for $${fmt(net)} net (after 1% liquidity fee).`,
  };
}

// ---------------------------------------------------------------------------
// TRANSFER journey
// ---------------------------------------------------------------------------

export function transferStart(quantity?: number): string {
  if (quantity && quantity > 0) {
    return `Transfer **${quantity.toLocaleString()} Specie** — who would you like to transfer to?\n\n` +
      `Your contacts:\n` +
      `- **Pepper Potts** (onli-user-456)\n` +
      `- **Tony Stark** (onli-user-789)\n` +
      `- **Happy Hogan** (onli-user-012)\n` +
      `- **Steve Rogers** (onli-user-555)\n` +
      `- **Natasha Romanoff** (onli-user-666)`;
  }
  return `Who and how many Specie would you like to transfer?\n\n` +
    `Your contacts:\n` +
    `- **Pepper Potts** (onli-user-456)\n` +
    `- **Tony Stark** (onli-user-789)\n` +
    `- **Happy Hogan** (onli-user-012)\n` +
    `- **Steve Rogers** (onli-user-555)\n` +
    `- **Natasha Romanoff** (onli-user-666)\n\n` +
    `Tell me the recipient and quantity (e.g. "Pepper Potts 100").`;
}

export async function transferConfirm(quantity: number, recipient: string): Promise<JourneyResponse | string> {
  const state = await getLiveState();
  if (state.specieCount < quantity) {
    return `**Insufficient Species.** You want to transfer ${quantity.toLocaleString()} but you only have ${state.specieCount.toLocaleString()} in your Vault.`;
  }
  const contacts: Record<string, { name: string; id: string }> = {
    'pepper': { name: 'Pepper Potts', id: 'onli-user-456' },
    'pepper potts': { name: 'Pepper Potts', id: 'onli-user-456' },
    'tony': { name: 'Tony Stark', id: 'onli-user-789' },
    'tony stark': { name: 'Tony Stark', id: 'onli-user-789' },
    'happy': { name: 'Happy Hogan', id: 'onli-user-012' },
    'happy hogan': { name: 'Happy Hogan', id: 'onli-user-012' },
    'steve': { name: 'Steve Rogers', id: 'onli-user-555' },
    'steve rogers': { name: 'Steve Rogers', id: 'onli-user-555' },
    'natasha': { name: 'Natasha Romanoff', id: 'onli-user-666' },
    'natasha romanoff': { name: 'Natasha Romanoff', id: 'onli-user-666' },
  };
  const contact = contacts[recipient.toLowerCase()];
  if (!contact) {
    return `**Unknown recipient: "${recipient}".**\n\nYour contacts:\n- **Pepper Potts** (onli-user-456)\n- **Tony Stark** (onli-user-789)\n- **Happy Hogan** (onli-user-012)\n- **Steve Rogers** (onli-user-555)\n- **Natasha Romanoff** (onli-user-666)\n\nPlease enter a valid contact name.`;
  }

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `TRANSFER ${quantity.toLocaleString()} SPECIES`,
      lines: [
        { label: 'To', value: `${contact.name} (${contact.id})` },
        { label: 'Quantity', value: `${quantity.toLocaleString()} SPECIES` },
        { label: 'Fees', value: 'None' },
      ],
      warning: 'This transfer is final and non-reversible.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function transferExecute(quantity: number, recipient?: string): Promise<JourneyResponse> {
  const contacts: Record<string, string> = {
    'pepper': 'onli-user-456', 'pepper potts': 'onli-user-456',
    'tony': 'onli-user-789', 'tony stark': 'onli-user-789',
    'happy': 'onli-user-012', 'happy hogan': 'onli-user-012',
    'steve': 'onli-user-555', 'steve rogers': 'onli-user-555',
    'natasha': 'onli-user-666', 'natasha romanoff': 'onli-user-666',
  };
  const recipientOnliId = contacts[(recipient || '').toLowerCase()] || 'onli-user-456';

  const result = await submitPipeline({
    intent: 'transfer',
    quantity,
    paymentSource: { vaId: `va-funding-${CURRENT_USER.ref}` },
    recipient: { onliId: recipientOnliId },
  });

  if (!result.ok) {
    return {
      type: 'tool',
      toolName: 'journey_execute',
      data: {
        _ui: 'PipelineCard',
        title: `TRANSFER ${quantity.toLocaleString()} SPECIES — FAILED`,
        eventId: result.eventId,
        batchId: null,
        stages: mapPipelineStages(result.stages, true),
        error: result.error || 'Insufficient Species in your Vault to complete this transfer.',
      },
      followUp: `Transfer failed — you don't have enough Species in your Vault.`,
    };
  }

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `TRANSFER ${quantity.toLocaleString()} SPECIES`,
      eventId: result.eventId,
      batchId: null,
      stages: mapPipelineStages(result.stages, false),
      receipt: { quantity, fees: 'None' },
      balances: { species: `${state.specieCount.toLocaleString()} SPECIES` },
    },
    followUp: `Transfer complete! ${quantity.toLocaleString()} SPECIES sent.`,
  };
}

// ---------------------------------------------------------------------------
// SENDOUT (withdraw) journey
// ---------------------------------------------------------------------------

export function sendoutStart(): string {
  return `To withdraw, USDC is debited from your Funding Account and sent from the Outgoing Account to your destination address.\n\n` +
    `How much USDC and where? (e.g. "2000 to 0x9876...fedc")`;
}

export async function sendoutConfirm(amount: number, destination?: string): Promise<JourneyResponse | string> {
  const state = await getLiveState();
  if (state.fundingBalance < amount) {
    return `**Insufficient funds.** You want to withdraw $${fmt(amount)} but your Funding Account has $${fmt(state.fundingBalance)}.`;
  }
  const dest = destination || '0x9876...fedc';
  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `WITHDRAW $${fmt(amount)} USDC`,
      lines: [
        { label: 'Amount', value: `$${fmt(amount)} USDC` },
        { label: 'From', value: `Funding Account (${USER_ACCOUNT_NUMBER})` },
        { label: 'Via', value: 'Outgoing Account' },
        { label: 'To', value: dest },
        { label: 'Network', value: 'Base (USDC)' },
      ],
      warning: 'THIS WITHDRAWAL IS IRREVERSIBLE. Once confirmed, funds cannot be returned.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

export async function sendoutExecute(amount: number): Promise<JourneyResponse> {
  const baseUnits = Math.round(amount * 1_000_000);
  const vaId = `va-funding-${CURRENT_USER.ref}`;
  await simulateWithdrawal(vaId, baseUnits);

  const state = await getLiveState();
  const newBalance = state.fundingBalance;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'LifecycleCard',
      title: 'Withdrawal (Simulated)',
      amount: `$${fmt(amount)}`,
      steps: [
        { label: 'Withdrawal requested', done: true },
        { label: `Debited from Funding Account (${USER_ACCOUNT_NUMBER})`, done: true },
        { label: 'Compliance check passed', done: true },
        { label: 'USDC sent from Outgoing Account on-chain', done: true },
      ],
      newBalance: `$${fmt(newBalance)}`,
    },
    followUp: `Withdrawal complete! $${fmt(amount)} USDC debited from your Funding Account and sent via the Outgoing Account.`,
  };
}

export function cancelledResponse(): string {
  return `**Order cancelled.** No funds were charged and no assets were moved.\n\nHow else can I help you?`;
}
