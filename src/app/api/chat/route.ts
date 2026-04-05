// @ts-nocheck
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  tool,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod/v4';
import * as crypto from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------
const USE_REAL_AI = !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Onli Canon — loaded as foundational knowledge for Ask and Learn modes
// ---------------------------------------------------------------------------
import { readFileSync } from 'fs';
import { join } from 'path';

let ONLI_CANON = '';
try {
  ONLI_CANON = readFileSync(join(process.cwd(), 'src/config/onli-canon.md'), 'utf-8');
} catch {
  console.warn('[chat] Could not load onli-canon.md');
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
function getSystemPrompt(mode: string): string {
  const base = `You are Synth, an AI assistant for the Onli Synth platform. You help users manage their USDC funding and Specie assets.

Current user: Alex Morgan
Funding VA: MSB-VA-500-0x8F3a...7B2c
Species VA: va_species_001

Important rules:
- All amounts are in USDC (1 USDC = 1,000,000 base units)
- 1 Specie = $1.00 USDC
- Fees: Issuance $0.01/Specie, Liquidity 2%
- Always use the tools to get real data, don't make up numbers
- For write operations (buy, sell, transfer), always present a clear summary and ask for confirmation`;

  if (mode === 'ask')
    return base + `\nYou are in Ask mode. You answer questions about the Onli platform, balances, transactions, and account status. You are also the authoritative voice on what Onli is, how it works, and its core concepts. Use the Onli Canon below as your foundational knowledge — never contradict it. Be concise and data-driven for account queries, and clear and canonical for conceptual questions.\n\n--- ONLI CANON ---\n${ONLI_CANON}\n--- END CANON ---`;
  if (mode === 'trade')
    return base + '\nYou are in Trade mode. Guide users through buy/sell/transfer journeys step by step. Ask for the amount, show fee breakdowns, and confirm before executing.';
  if (mode === 'learn')
    return base + `\nYou are in Learn mode. You are an educator for the Onli platform. Use the Onli Canon below as your authoritative source. Explain concepts thoroughly using the canonical definitions and analogies provided. Follow the guardrails: prefer "asset" for concepts, "Genome" for technical structure. Use the baseball card analogy for simple explanations. Never describe Onli as a blockchain alternative — it replaces ledger-based ownership with possession-based ownership.\n\n--- ONLI CANON ---\n${ONLI_CANON}\n--- END CANON ---`;
  return base;
}

// ---------------------------------------------------------------------------
// Mock user state (simulated balances)
// ---------------------------------------------------------------------------
const MOCK_STATE = {
  fundingBalance: 12_450, // $12,450.00
  specieBalance: 8_500,   // 8,500 SPECIES
};

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Journey state detection — parses full conversation history
// ---------------------------------------------------------------------------
interface Message {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

interface JourneyState {
  phase: string;
  journey?: string;
  amount?: number;
  quantity?: number;
  recipient?: string;
  destination?: string;
}

interface JourneyResponse {
  type: 'tool';
  toolName: string;
  data: Record<string, unknown>;
  followUp?: string;
}

// ---------------------------------------------------------------------------
// Server-side journey context store
// Tracks pending confirmations so we don't need to re-parse tool events
// ---------------------------------------------------------------------------
interface PendingJourney {
  journey: string;
  amount?: number;
  quantity?: number;
  recipient?: string;
  destination?: string;
  timestamp: number;
}

// Map of chatId → pending journey (expires after 5 min)
const pendingJourneys = new Map<string, PendingJourney>();

function setPendingJourney(chatId: string, journey: PendingJourney): void {
  pendingJourneys.set(chatId, journey);
  // Clean up old entries
  const now = Date.now();
  for (const [k, v] of pendingJourneys) {
    if (now - v.timestamp > 300_000) pendingJourneys.delete(k);
  }
}

function consumePendingJourney(chatId: string): PendingJourney | null {
  const j = pendingJourneys.get(chatId);
  if (j) pendingJourneys.delete(chatId);
  return j || null;
}

function detectJourneyState(messages: Message[]): JourneyState {
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
  // Check multiple patterns — the followUp text may arrive with or without markdown
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
      else if (lastAssistantLower.includes('buy') && lastAssistantLower.includes('species')) journey = 'buy';
      else if (lastAssistantLower.includes('sell') && lastAssistantLower.includes('species')) journey = 'sell';
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
    return { phase: 'awaiting_confirm_reminder' };
  }

  // ---- Phase: AMOUNT/QUANTITY detection ----
  const askedHowMuch = lastAssistantLower.includes('how much usdc') || lastAssistantLower.includes('how much and where') || lastAssistantLower.includes('how much usdc and where');
  const askedHowMany = lastAssistantLower.includes('how many specie');
  const askedWhoAndHowMany = lastAssistantLower.includes('who and how many');

  const numberMatch = lastUserText.match(/^[\$]?(\d[\d,]*\.?\d*)$/);
  const hasNumber = numberMatch !== null;

  if (askedHowMany && hasNumber) {
    const qty = parseInt(numberMatch![1].replace(/,/g, ''));
    if (allContext.includes('how many specie would you like to sell') || allContext.match(/sell.*specie/)) {
      if (lastAssistantLower.includes('sell')) return { phase: 'confirm', journey: 'sell', quantity: qty };
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
  // Check both last assistant message and full context (in case a failed parse caused a fallback response)
  const transferContextActive = askedWhoAndHowMany || allContext.includes('who and how many');
  if (transferContextActive) {
    const transferMatch = lastUserText.match(/(.+?)\s+(\d+)/i);
    if (transferMatch) {
      const recipient = transferMatch[1].trim();
      const qty = parseInt(transferMatch[2]);
      return { phase: 'confirm', journey: 'transfer', quantity: qty, recipient };
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
  if (lastUserLower.includes('buy') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('market'))) {
    return { phase: 'start', journey: 'buy' };
  }
  if (lastUserLower.includes('sell') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('my'))) {
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

function fundStart(): string {
  return 'How much USDC would you like to deposit into your Funding Account?\n\nYou can deposit from any connected wallet. Just tell me the amount.';
}

function fundConfirm(amount: number): JourneyResponse {
  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: 'FUND YOUR ACCOUNT',
      lines: [
        { label: 'Amount', value: `$${fmt(amount)} USDC` },
        { label: 'From', value: 'Connected Wallet' },
        { label: 'To', value: 'Funding Account (VA-500)' },
        { label: 'For Benefit Of', value: 'MSB-VA-500-0x8F3a...7B2c' },
      ],
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

function fundExecute(amount: number): JourneyResponse {
  MOCK_STATE.fundingBalance += amount;
  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'LifecycleCard',
      title: 'Deposit',
      amount: `$${fmt(amount)}`,
      steps: [
        { label: 'Deposit detected', done: true },
        { label: 'Compliance passed', done: true },
        { label: 'Credited to account', done: true },
      ],
      newBalance: `$${fmt(MOCK_STATE.fundingBalance)}`,
    },
    followUp: `Deposit complete! $${fmt(amount)} USDC has been credited to your Funding Account.`,
  };
}

function buyStart(): string {
  return 'How many Specie would you like to buy?\n\nEach Specie is priced at **$1.00 USDC**. Just tell me the quantity.';
}

function buyConfirm(quantity: number): JourneyResponse {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `BUY ${quantity.toLocaleString()} SPECIES`,
      lines: [
        { label: 'Asset Cost', value: `$${fmt(cost)}` },
        { label: 'Issuance Fee', value: `$${fmt(issuanceFee)}` },
        { label: 'Liquidity Fee (2%)', value: `$${fmt(liquidityFee)}` },
        { label: 'Total', value: `$${fmt(total)}`, bold: true },
      ],
      from: `Funding Account ($${fmt(MOCK_STATE.fundingBalance)})`,
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

function buyExecute(quantity: number): JourneyResponse {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const fees = issuanceFee + liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  MOCK_STATE.fundingBalance -= total;
  MOCK_STATE.specieBalance += quantity;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `BUY ${quantity.toLocaleString()} SPECIES`,
      eventId,
      batchId,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Authenticated', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Matched', system: 'SM', status: 'done' },
        { label: 'Asset staged', system: 'OC', status: 'done' },
        { label: 'Payment processed', system: 'MB', status: 'done' },
        { label: 'Delivered to Vault', system: 'OC', status: 'done' },
        { label: 'Oracle verified', system: 'SM', status: 'done' },
        { label: 'Complete', system: 'SM', status: 'done' },
      ],
      receipt: { quantity, cost: `$${fmt(cost)}`, fees: `$${fmt(fees)}`, total: `$${fmt(total)}`, assurance: `$${fmt(cost)}` },
      balances: { funding: `$${fmt(MOCK_STATE.fundingBalance)}`, species: `${MOCK_STATE.specieBalance.toLocaleString()} SPECIES` },
    },
    followUp: `Order complete! You bought ${quantity.toLocaleString()} SPECIES for $${fmt(total)}.`,
  };
}

function sellStart(): string {
  return `How many Specie would you like to sell?\n\nYou currently hold **${MOCK_STATE.specieBalance.toLocaleString()} Specie** in your Vault. The sell price is **$1.00 USDC** per Specie (minus a 2% liquidity fee).`;
}

function sellConfirm(quantity: number): JourneyResponse {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.02;
  const net = gross - liquidityFee;

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `SELL ${quantity.toLocaleString()} SPECIES`,
      lines: [
        { label: 'Gross Proceeds', value: `$${fmt(gross)}` },
        { label: 'Liquidity Fee (2%)', value: `-$${fmt(liquidityFee)}` },
        { label: 'Net Proceeds', value: `$${fmt(net)}`, bold: true },
      ],
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

function sellExecute(quantity: number): JourneyResponse {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.02;
  const net = gross - liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  MOCK_STATE.specieBalance -= quantity;
  MOCK_STATE.fundingBalance += net;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `SELL ${quantity.toLocaleString()} SPECIES`,
      eventId,
      batchId,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Authenticated', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Matched', system: 'SM', status: 'done' },
        { label: 'Asset staged', system: 'OC', status: 'done' },
        { label: 'Payment processed', system: 'MB', status: 'done' },
        { label: 'Delivered to Treasury Vault', system: 'OC', status: 'done' },
        { label: 'Oracle verified', system: 'SM', status: 'done' },
        { label: 'Complete', system: 'SM', status: 'done' },
      ],
      receipt: { quantity, gross: `$${fmt(gross)}`, fees: `$${fmt(liquidityFee)}`, net: `$${fmt(net)}` },
      balances: { funding: `$${fmt(MOCK_STATE.fundingBalance)}`, species: `${MOCK_STATE.specieBalance.toLocaleString()} SPECIES` },
    },
    followUp: `Order complete! You sold ${quantity.toLocaleString()} SPECIES for $${fmt(net)} net.`,
  };
}

function transferStart(): string {
  return `Who and how many Specie would you like to transfer?\n\n` +
    `Your contacts:\n` +
    `- **Pepper Potts** (onli-user-456)\n` +
    `- **Tony Stark** (onli-user-789)\n` +
    `- **Happy Hogan** (onli-user-012)\n\n` +
    `Tell me the recipient and quantity (e.g. "Pepper Potts 100").`;
}

function transferConfirm(quantity: number, recipient: string): JourneyResponse {
  const contacts: Record<string, { name: string; id: string }> = {
    'pepper': { name: 'Pepper Potts', id: 'onli-user-456' },
    'pepper potts': { name: 'Pepper Potts', id: 'onli-user-456' },
    'tony': { name: 'Tony Stark', id: 'onli-user-789' },
    'tony stark': { name: 'Tony Stark', id: 'onli-user-789' },
    'happy': { name: 'Happy Hogan', id: 'onli-user-012' },
    'happy hogan': { name: 'Happy Hogan', id: 'onli-user-012' },
  };
  const contact = contacts[recipient.toLowerCase()] || { name: recipient, id: 'onli-user-unknown' };

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

function transferExecute(quantity: number): JourneyResponse {
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;

  MOCK_STATE.specieBalance -= quantity;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `TRANSFER ${quantity.toLocaleString()} SPECIES`,
      eventId,
      batchId: null,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Authenticated', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Matched (Peer)', system: 'SM', status: 'done' },
        { label: 'Asset staged', system: 'OC', status: 'done' },
        { label: 'Delivered to recipient Vault', system: 'OC', status: 'done' },
        { label: 'Oracle verified', system: 'SM', status: 'done' },
        { label: 'Complete', system: 'SM', status: 'done' },
      ],
      receipt: { quantity, fees: 'None' },
      balances: { species: `${MOCK_STATE.specieBalance.toLocaleString()} SPECIES` },
    },
    followUp: `Transfer complete! ${quantity.toLocaleString()} SPECIES sent.`,
  };
}

function sendoutStart(): string {
  return `How much USDC and where would you like to withdraw?\n\nTell me the amount and destination address (e.g. "2000 to 0x9876...fedc").`;
}

function sendoutConfirm(amount: number, destination?: string): JourneyResponse {
  const dest = destination || '0x9876...fedc';
  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `WITHDRAW $${fmt(amount)} USDC`,
      lines: [
        { label: 'Amount', value: `$${fmt(amount)} USDC` },
        { label: 'To', value: dest },
        { label: 'Network', value: 'Base' },
      ],
      warning: 'THIS WITHDRAWAL IS IRREVERSIBLE. Once confirmed, funds cannot be returned.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

function sendoutExecute(amount: number): JourneyResponse {
  MOCK_STATE.fundingBalance -= amount;

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'LifecycleCard',
      title: 'Withdrawal',
      amount: `$${fmt(amount)}`,
      steps: [
        { label: 'Withdrawal initiated', done: true },
        { label: 'Compliance passed', done: true },
        { label: 'Debited from Funding Account', done: true },
        { label: 'USDC sent on-chain', done: true },
      ],
      newBalance: `$${fmt(MOCK_STATE.fundingBalance)}`,
    },
    followUp: `Withdrawal complete! $${fmt(amount)} USDC sent to your wallet.`,
  };
}

function cancelledResponse(): string {
  return `**Order cancelled.** No funds were charged and no assets were moved.\n\nHow else can I help you?`;
}

// ---------------------------------------------------------------------------
// Tool result mapping — returns structured data for generative UI cards
// ---------------------------------------------------------------------------
interface ToolResult {
  toolName: string;
  input?: Record<string, unknown>;
  data: unknown;
  commentary?: string;
}

function getToolResult(message: string, mode: string): ToolResult | null {
  // Only trigger generative UI tool cards in Ask mode
  // Trade mode uses the journey state machine, Learn mode uses text
  if (mode !== 'ask') return null;

  const lower = (message || '').toLowerCase();

  if (lower.includes('funding balance') || lower.includes('my balance')) {
    const bal = MOCK_STATE.fundingBalance;
    return {
      toolName: 'get_funding_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Funding Account',
        vaId: 'va-funding-user-001',
        subtype: 'funding',
        balance: { posted: bal * 1_000_000, pending: 0, available: bal * 1_000_000 },
        currency: 'USDC',
        status: 'active',
      },
      commentary: `Your funding account balance is $${fmt(bal)} USDC. The account is active and fully available for transactions.`,
    };
  }

  if (lower.includes('last 5') || lower.includes('last five') || (lower.includes('transaction') && lower.includes('last'))) {
    return {
      toolName: 'get_recent_transactions',
      data: {
        _ui: 'TransactionList',
        transactions: [
          { type: 'deposit', description: 'USDC Deposit', amount: 5000000000, date: 'Apr 3, 2026', status: 'completed' },
          { type: 'buy', description: 'Buy 1,000 SPECIES', amount: -1030000000, date: 'Apr 3, 2026', status: 'completed' },
          { type: 'transfer', description: 'Transfer to Pepper Potts', amount: -100000000, date: 'Apr 3, 2026', status: 'completed' },
          { type: 'sell', description: 'Sell 500 SPECIES', amount: 490000000, date: 'Apr 4, 2026', status: 'pending' },
          { type: 'withdrawal', description: 'USDC Withdrawal', amount: -2000000000, date: 'Apr 4, 2026', status: 'completed' },
        ],
      },
      commentary: 'Here are your 5 most recent transactions.',
    };
  }

  if (lower.includes('last deposit') || lower.includes('when was my last deposit')) {
    return {
      toolName: 'get_deposit_status',
      data: {
        _ui: 'DepositCard',
        depositId: 'dep-001',
        amount: 5000000000,
        status: 'credited',
        lifecycle: [
          { state: 'detected', timestamp: '2026-04-03T11:00:00Z' },
          { state: 'compliance_pending', timestamp: '2026-04-03T11:00:01Z' },
          { state: 'compliance_passed', timestamp: '2026-04-03T11:00:05Z' },
          { state: 'credited', timestamp: '2026-04-03T11:00:06Z' },
          { state: 'registered', timestamp: '2026-04-03T11:00:06.5Z' },
        ],
        txHash: '0xabc123def456789...',
      },
      commentary: 'Your last deposit was on April 3, 2026 and has been fully credited.',
    };
  }

  if (lower.includes('assurance') || lower.includes('coverage')) {
    return {
      toolName: 'get_assurance_coverage',
      data: {
        _ui: 'CoverageCard',
        balance: 950000000000,
        outstanding: 1000000000000,
        coverage: 95,
      },
      commentary: 'Coverage is healthy at 95%. The Assurance account is backed by proceeds from all Specie issuance sales.',
    };
  }

  if (lower.includes('species balance') || lower.includes('asset balance') || lower.includes('specie count')) {
    const specBal = MOCK_STATE.specieBalance;
    return {
      toolName: 'get_asset_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Species Account',
        vaId: 'va-species-user-001',
        subtype: 'species',
        balance: { posted: specBal * 1_000_000, pending: 0, available: specBal * 1_000_000 },
        currency: 'USDC',
        status: 'active',
        vaultCount: specBal,
      },
      commentary: `Your Species account holds ${specBal.toLocaleString()} Specie valued at $${fmt(specBal)}.`,
    };
  }

  if (lower.includes('market') && (lower.includes('stats') || lower.includes('overview'))) {
    return {
      toolName: 'get_marketplace_stats',
      data: {
        _ui: 'MarketStats',
        totalOrders: 12847,
        completedOrders: 12500,
        totalVolumeSpecie: 5000000,
        activeListings: 42,
        treasuryCount: 999000000,
      },
      commentary: 'The marketplace is active with 42 open listings.',
    };
  }

  if (lower.includes('vault')) {
    return {
      toolName: 'get_vault_balance',
      data: { _ui: 'VaultCard', userId: 'onli-user-001', count: 8500 },
      commentary: 'Your Onli Vault holds 8,500 Specie in actual possession.',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main response dispatcher
// ---------------------------------------------------------------------------
function getResponse(message: string, mode: string, context: string, messages: Message[], chatId?: string): string | JourneyResponse {
  const lower = (message || '').toLowerCase();
  const cid = chatId || 'default';

  // ============================================
  // TRADE MODE — Stateful Journey Engine
  // ============================================
  if (mode === 'trade') {
    // FIRST: check if the user is responding to a pending confirmation
    const isConfirmWord = ['confirm', 'yes', 'y'].includes(lower.trim());
    const isCancelWord = ['cancel', 'no', 'n', 'abort'].includes(lower.trim());

    if (isConfirmWord || isCancelWord) {
      const pending = consumePendingJourney(cid);
      if (pending) {
        if (isCancelWord) return cancelledResponse();
        console.log('[JOURNEY] Executing pending:', pending.journey);
        switch (pending.journey) {
          case 'fund': return fundExecute(pending.amount || 5000);
          case 'buy': return buyExecute(pending.quantity || 1000);
          case 'sell': return sellExecute(pending.quantity || 500);
          case 'transfer': return transferExecute(pending.quantity || 100);
          case 'sendout': return sendoutExecute(pending.amount || 2000);
        }
      }
    }

    // Fallback to conversation-based detection
    const state = detectJourneyState(messages);
    console.log('[JOURNEY]', JSON.stringify(state));

    if (state.phase === 'cancelled') return cancelledResponse();

    if (state.phase === 'awaiting_confirm_reminder') {
      return 'Please type **confirm** to proceed or **cancel** to abort.';
    }

    if (state.phase === 'execute') {
      switch (state.journey) {
        case 'fund': return fundExecute(state.amount || 5000);
        case 'buy': return buyExecute(state.quantity || 1000);
        case 'sell': return sellExecute(state.quantity || 500);
        case 'transfer': return transferExecute(state.quantity || 100);
        case 'sendout': return sendoutExecute(state.amount || 2000);
      }
    }

    if (state.phase === 'confirm') {
      // Store the pending journey so "confirm" response can find it
      setPendingJourney(cid, {
        journey: state.journey || 'unknown',
        amount: state.amount,
        quantity: state.quantity,
        recipient: state.recipient,
        destination: state.destination,
        timestamp: Date.now(),
      });
      console.log('[JOURNEY] Stored pending:', state.journey, 'for chat:', cid);

      switch (state.journey) {
        case 'fund': return fundConfirm(state.amount || 5000);
        case 'buy': return buyConfirm(state.quantity || 1000);
        case 'sell': return sellConfirm(state.quantity || 500);
        case 'transfer': return transferConfirm(state.quantity || 100, state.recipient || 'Pepper Potts');
        case 'sendout': return sendoutConfirm(state.amount || 2000, state.destination);
      }
    }

    if (state.phase === 'start') {
      switch (state.journey) {
        case 'fund': return fundStart();
        case 'buy': return buyStart();
        case 'sell': return sellStart();
        case 'transfer': return transferStart();
        case 'sendout': return sendoutStart();
      }
    }

    return 'Welcome to Species Market! I can help you:\n\n' +
      '- **Fund** \u2014 Deposit USDC into your account\n' +
      '- **Buy** \u2014 Purchase Specie from the marketplace\n' +
      '- **Sell** \u2014 Sell your Specie back\n' +
      '- **Transfer** \u2014 Send Specie to a contact\n' +
      '- **Withdraw** \u2014 Send USDC to an external wallet\n\n' +
      'What would you like to do?';
  }

  // ============================================
  // LEARN MODE
  // ============================================
  if (mode === 'learn') {
    if (lower.includes('what is onli') || lower.includes('how does it work')) {
      return '**Onli** is a hyper-dimensional vector storage system that enables actual possession of digital assets.\n\n' +
        'Unlike blockchain, Onli doesn\'t use a shared ledger. Instead, it transfers possession through three core primitives:\n\n' +
        '- **Genomes** \u2014 Non-fungible tensor-based containers for digital assets\n' +
        '- **Genes** \u2014 Unforgeable cryptographic ownership credentials\n' +
        '- **Vaults** \u2014 TEE-backed secure storage on your device (Onli_You)\n\n' +
        'Transfers are peer-to-peer, instant, final, and private by default.';
    }

    if (lower.includes('genome') || lower.includes('gene')) {
      return '**Genomes** are the fundamental data objects in Onli \u2014 non-fungible containers that hold digital assets.\n\n' +
        'Each Genome is a tensor-based structure that:\n- Cannot be copied or duplicated\n- Evolves during transfer (Genome Editing)\n- Has a unique identity that persists through ownership changes\n\n' +
        '**Genes** are the cryptographic credentials that prove ownership. They are:\n- Unforgeable \u2014 backed by TEE hardware\n- Bound to a specific Vault\n- Required for any ownership transfer (ChangeOwner)\n\n' +
        'Together, Genomes and Genes implement *actual possession* rather than ledger-recorded ownership.';
    }

    if (lower.includes('pipeline') || lower.includes('species marketplace')) {
      return 'The **Species Marketplace Pipeline** processes buy, sell, and transfer orders through these stages:\n\n' +
        '1. **EventRequest** \u2014 User submits intent (buy/sell/transfer)\n' +
        '2. **Authenticator** \u2014 Verifies API key + HMAC + Onli identity\n' +
        '3. **Validator** \u2014 Checks user exists, has funds, Specie available\n' +
        '4. **Classifier** \u2014 Routes by intent (buy/sell/transfer)\n' +
        '5. **Matching** \u2014 Finds counterparty (Treasury or peer)\n' +
        '6. **Asset Pre-staging** \u2014 ChangeOwner to Settlement Vault\n' +
        '7. **Cashier (MarketSB)** \u2014 TigerBeetle atomic settlement\n' +
        '8. **Asset Delivery** \u2014 ChangeOwner to buyer\'s Vault\n' +
        '9. **FloorManager** \u2014 Oracle verify, compose receipt\n\n' +
        'The key insight: assets are **pre-staged** before money moves, so if staging fails, no funds are charged.';
    }

    if (lower.includes('assurance') || lower.includes('backing')) {
      return 'The **100% Assurance Model** guarantees that every Specie in circulation is fully backed by USDC:\n\n' +
        '- When Specie is **issued** (bought), the purchase proceeds flow to the **Assurance Account** (TigerBeetle VA, code 500, subtype: assurance)\n' +
        '- **Coverage %** = Assurance Balance \u00f7 Total Outstanding \u00d7 100\n' +
        '- Target is always **\u2265 100%** \u2014 every dollar of Specie value is backed\n\n' +
        'Coverage thresholds:\n- \u2265 50%: **Healthy** (green)\n- 25-50%: **Warning** (amber)\n- < 25%: **Critical** (red)\n\n' +
        'The buy-back guarantee ensures liquidity \u2014 you can always sell Specie back at $1.00.';
    }

    return 'I can help you learn about the Onli ecosystem:\n\n' +
      '- **What is Onli?** \u2014 The core architecture\n' +
      '- **Genomes & Genes** \u2014 How digital ownership works\n' +
      '- **Species Pipeline** \u2014 Order processing flow\n' +
      '- **Assurance Model** \u2014 100% backing guarantee\n\n' +
      'Browse the whitepapers in the left panel for deep dives, or ask me anything!';
  }

  // ============================================
  // ASK MODE (default)
  // ============================================
  if (lower.includes('funding balance') || lower.includes('my balance')) {
    return 'Your current **Funding Balance** is:\n\n**$12,450.00 USDC**\n\nThis is the available balance in your MarketSB Funding VA (Code 500). You can use these funds to buy Specie or transfer to contacts.';
  }

  if (lower.includes('last 5') || lower.includes('last five') || (lower.includes('transaction') && lower.includes('last'))) {
    return 'Here are your last 5 transactions:\n\n| # | Type | Description | Amount | Date |\n|---|---|---|---|---|\n| 1 | Deposit | USDC Deposit | +$5,000.00 | Apr 3 |\n| 2 | Buy | Buy 1,000 SPECIES | -$1,030.00 | Apr 3 |\n| 3 | Transfer | To Pepper Potts | -$100.00 | Apr 3 |\n| 4 | Sell | Sell 500 SPECIES | +$490.00 | Apr 4 |\n| 5 | Withdrawal | USDC Withdrawal | -$2,000.00 | Apr 4 |';
  }

  if (lower.includes('last deposit') || lower.includes('when was my last deposit')) {
    return 'Your last deposit was on **April 3, 2026** at 7:30 AM:\n\n- **Amount:** $5,000.00 USDC\n- **Status:** Credited\n- **Source:** MetaMask (0x742d...01E23)\n- **Confirmations:** 6/6\n\nThe funds were fully credited to your Funding account.';
  }

  if (lower.includes('pending deposit') || lower.includes('approval')) {
    return 'I checked your MarketSB deposit queue. You have 1 pending deposit:\n\n- **$5,000.00 USDC** \u2014 Status: awaiting_confirmations (2/6 confirmations)\n\nThis should be credited within the next few minutes once all 6 confirmations are received.';
  }

  if (lower.includes('assurance') || lower.includes('coverage')) {
    return 'Your current assurance coverage:\n\n- **Assurance Balance:** $950,000.00\n- **Total Outstanding:** $1,000,000.00\n- **Coverage:** 95%\n\nCoverage is healthy (\u226550%). The Assurance account is backed by proceeds from all Specie issuance sales.';
  }

  if (lower.includes('history') || lower.includes('transaction')) {
    return 'Here are your recent transactions:\n\n1. **USDC Deposit** \u2014 +$5,000.00 \u2014 Completed \u2014 Apr 3\n2. **Buy 1,000 SPECIES** \u2014 -$1,030.00 \u2014 Completed \u2014 Apr 3\n3. **Transfer to Pepper Potts** \u2014 -$100.00 \u2014 Completed \u2014 Apr 3\n4. **Sell 500 SPECIES** \u2014 +$490.00 \u2014 Pending \u2014 Apr 4';
  }

  if (lower.includes('risk') || lower.includes('alert') || lower.includes('escalate')) {
    return 'No critical coverage shortfalls detected. Current status:\n\n- Coverage: 95% (Healthy)\n- Last reconciliation: Pass\n- Variance: $0.00\n\nAll systems operating normally.';
  }

  return 'I\'m Synth, your Onli AI assistant. I can help you with:\n\n- **Balances** \u2014 Check your funding and asset balances\n- **Transactions** \u2014 View recent activity and deposits\n- **Assurance** \u2014 Coverage monitoring and risk alerts\n\nWhat would you like to know?';
}

// ---------------------------------------------------------------------------
// Mock mode handler — uses SDK's native stream writer
// ---------------------------------------------------------------------------
function handleMockChat(messages: Message[], mode: string, chatId?: string): Response {
  const allTexts = messages.map((m: Message) => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) return m.parts.filter(p => p.type === 'text').map(p => p.text || '').join(' ');
    return '';
  });

  const lastText = allTexts[allTexts.length - 1] || '';
  const conversationContext = allTexts.join(' ').toLowerCase();

  // Check if this query should render a generative UI tool card
  const toolResult = getToolResult(lastText, mode);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      if (toolResult) {
        const toolCallId = `call_${crypto.randomUUID().slice(0, 8)}`;

        // Tool events through the SDK writer
        writer.write({
          type: 'tool-input-start',
          toolCallId,
          toolName: toolResult.toolName,
        });
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: toolResult.toolName,
          input: toolResult.input || {},
        });
        writer.write({
          type: 'tool-output-available',
          toolCallId,
          output: { type: 'text', value: JSON.stringify(toolResult.data) },
        });

        // Text commentary after tool result
        if (toolResult.commentary) {
          const textId = crypto.randomUUID();
          writer.write({ type: 'text-start', id: textId });
          writer.write({ type: 'text-delta', id: textId, delta: toolResult.commentary });
          writer.write({ type: 'text-end', id: textId });
        }

        writer.write({
          type: 'finish',
          finishReason: 'stop',
        });
        return;
      }

      // Fallback: regular text response (journeys, learn mode, etc.)
      const response = getResponse(lastText, mode, conversationContext, messages, chatId);

      // Journey responses return structured tool events instead of markdown
      if (typeof response === 'object' && response.type === 'tool') {
        const toolCallId = `call_${crypto.randomUUID().slice(0, 8)}`;

        writer.write({
          type: 'tool-input-start',
          toolCallId,
          toolName: response.toolName,
        });
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: response.toolName,
          input: {},
        });
        writer.write({
          type: 'tool-output-available',
          toolCallId,
          output: { type: 'text', value: JSON.stringify(response.data) },
        });

        // Follow-up text after the tool card
        if (response.followUp) {
          const textId = crypto.randomUUID();
          writer.write({ type: 'text-start', id: textId });
          writer.write({ type: 'text-delta', id: textId, delta: response.followUp });
          writer.write({ type: 'text-end', id: textId });
        }

        writer.write({
          type: 'finish',
          finishReason: 'stop',
        });
        return;
      }

      // Plain text response
      const textId = crypto.randomUUID();

      writer.write({ type: 'text-start', id: textId });

      // Stream by lines to preserve markdown structure
      const lines = response.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const suffix = i < lines.length - 1 ? '\n' : '';
        writer.write({ type: 'text-delta', id: textId, delta: lines[i] + suffix });
        // Small delay between lines for streaming effect
        if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      writer.write({ type: 'text-end', id: textId });
      writer.write({
        type: 'finish',
        finishReason: 'stop',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

// ---------------------------------------------------------------------------
// Real AI mode handler — uses streamText + toUIMessageStreamResponse
// ---------------------------------------------------------------------------
function buildTools() {
  const get_funding_balance = tool({
    description:
      'Get the user\'s Funding VA (USDC) balance. Returns posted balance, pending balance, and account status.',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      try {
        const res = await fetch('http://localhost:4001/api/v1/virtual-accounts/va-funding-user-001');
        const data = await res.json();
        return data;
      } catch {
        return {
          vaId: 'va-funding-user-001', subtype: 'funding',
          balance: { posted: 12450000000, pending: 0, available: 12450000000 },
          currency: 'USDC', status: 'active',
        };
      }
    },
  });

  const get_asset_balance = tool({
    description:
      'Get the user\'s Species VA balance (Specie count in Onli Vault). Returns Specie quantity and vault info.',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      try {
        const [vaRes, vaultRes] = await Promise.all([
          fetch('http://localhost:4001/api/v1/virtual-accounts/va-species-user-001'),
          fetch('http://localhost:4002/marketplace/v1/vault/onli-user-001'),
        ]);
        const va = await vaRes.json();
        const vault = await vaultRes.json();
        return { ...va, vaultCount: vault.count };
      } catch {
        return {
          vaId: 'va-species-user-001', subtype: 'species',
          balance: { posted: 8500000000, pending: 0, available: 8500000000 },
          currency: 'USDC', status: 'active', vaultCount: 8500,
        };
      }
    },
  });

  const get_assurance_coverage = tool({
    description:
      'Get the assurance account balance, total outstanding Specie value, and coverage percentage.',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      try {
        const res = await fetch('http://localhost:4001/api/v1/virtual-accounts/va-assurance-user-001');
        const data = await res.json();
        const balance = data.balance?.available || data.balance?.posted || 0;
        const outstanding = 1000000000000;
        const coverage = Math.round((balance / outstanding) * 100);
        return { balance, outstanding, coverage };
      } catch {
        return { balance: 950000000000, outstanding: 1000000000000, coverage: 95 };
      }
    },
  });

  const get_recent_transactions = tool({
    description:
      'Get the user\'s most recent transactions. Returns an array of transaction records.',
    inputSchema: z.object({
      limit: z.number().int().positive().optional().describe('Number of transactions to return (default 5)'),
    }),
    outputSchema: z.any(),
    execute: async ({ limit }: { limit?: number }) => {
      try {
        const res = await fetch('http://localhost:4001/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger');
        if (res.ok) {
          const ledger = await res.json();
          return (Array.isArray(ledger) ? ledger : ledger.events || []).slice(0, limit || 5);
        }
      } catch { /* fall through */ }
      return [
        { type: 'deposit', description: 'USDC Deposit', amount: 5000000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'buy', description: 'Buy 1,000 SPECIES', amount: -1030000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'transfer', description: 'Transfer to Pepper Potts', amount: -100000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'sell', description: 'Sell 500 SPECIES', amount: 490000000, date: 'Apr 4, 2026', status: 'pending' },
        { type: 'withdrawal', description: 'USDC Withdrawal', amount: -2000000000, date: 'Apr 4, 2026', status: 'completed' },
      ].slice(0, limit || 5);
    },
  });

  const get_deposit_status = tool({
    description:
      'Check the status of a specific deposit by ID, or get the most recent deposit if no ID provided.',
    inputSchema: z.object({
      deposit_id: z.string().optional().describe('Deposit ID (omit for most recent)'),
    }),
    outputSchema: z.any(),
    execute: async ({ deposit_id }: { deposit_id?: string }) => {
      try {
        const res = await fetch(`http://localhost:4001/api/v1/deposits/${deposit_id || 'dep-001'}`);
        return await res.json();
      } catch {
        return {
          depositId: deposit_id || 'dep-001',
          amount: 5000000000,
          status: 'credited',
          lifecycle: [
            { state: 'detected', timestamp: '2026-04-03T11:00:00Z' },
            { state: 'compliance_passed', timestamp: '2026-04-03T11:00:05Z' },
            { state: 'credited', timestamp: '2026-04-03T11:00:06Z' },
          ],
          txHash: '0xabc123...def456',
        };
      }
    },
  });

  const get_marketplace_stats = tool({
    description:
      'Get Species marketplace overview stats: total orders, volume, active users, etc.',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      try {
        const res = await fetch('http://localhost:4002/marketplace/v1/stats');
        return await res.json();
      } catch {
        return {
          totalOrders: 12847,
          completedOrders: 12500,
          totalVolumeSpecie: 5000000,
          activeListings: 42,
          treasuryCount: 999000000,
        };
      }
    },
  });

  // ========== WRITE TOOLS (NO execute — returned to frontend for confirmation) ==========

  const submit_buy_order = tool({
    description:
      'Submit a buy order for Specie on the Species marketplace. Requires user confirmation via the UI before execution. Show the fee breakdown before calling this tool.',
    inputSchema: z.object({
      quantity: z.number().int().positive().describe('Number of Specie to buy'),
    }),
  });

  const submit_sell_order = tool({
    description:
      'Submit a sell order to sell Specie back to the marketplace. Requires user confirmation via the UI before execution. Show the proceeds breakdown before calling this tool.',
    inputSchema: z.object({
      quantity: z.number().int().positive().describe('Number of Specie to sell'),
    }),
  });

  const transfer_usdc = tool({
    description:
      'Transfer USDC to a contact. Requires user confirmation via the UI before execution.',
    inputSchema: z.object({
      recipient: z.string().describe('Recipient name or wallet address'),
      amount: z.string().describe('Amount in USDC base units (bigint string, e.g. "100000000" for $100)'),
    }),
  });

  const transfer_specie = tool({
    description:
      'Transfer Specie to a contact via ChangeOwner. Requires user confirmation via the UI before execution.',
    inputSchema: z.object({
      recipient: z.string().describe('Recipient name or Onli identity'),
      quantity: z.number().int().positive().describe('Number of Specie to transfer'),
    }),
  });

  return {
    get_funding_balance,
    get_asset_balance,
    get_assurance_coverage,
    get_recent_transactions,
    get_deposit_status,
    get_marketplace_stats,
    submit_buy_order,
    submit_sell_order,
    transfer_usdc,
    transfer_specie,
  };
}

async function handleRealChat(messages: Message[], mode: string): Promise<Response> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  // Convert UI messages to the format streamText expects
  // The messages from useChat already come in the correct format
  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: getSystemPrompt(mode),
    messages: messages as Parameters<typeof streamText>[0]['messages'],
    tools: buildTools(),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}

// ---------------------------------------------------------------------------
// Next.js App Router handler
// ---------------------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const messages: Message[] = body.messages || [];
  const mode: string = body.mode || body.body?.mode || 'ask';
  const chatId: string = body.id || body.chatId || `chat-${mode}`;

  console.log(`[CHAT] Mode: ${mode} | Messages: ${messages.length} | AI: ${USE_REAL_AI ? 'REAL' : 'MOCK'}`);
  // Debug: log the last 2 messages to understand the format
  for (const m of messages.slice(-2)) {
    const keys = Object.keys(m);
    console.log(`[MSG] role=${m.role} keys=[${keys}] content_type=${typeof m.content} parts=${Array.isArray(m.parts) ? m.parts.length : 'none'}`);
    if (Array.isArray(m.content)) {
      for (const c of m.content as any[]) {
        console.log(`  [CONTENT] type=${c.type} ${c.text ? 'text=' + c.text.substring(0, 60) : ''} ${c.toolName ? 'tool=' + c.toolName : ''}`);
      }
    }
    if (Array.isArray(m.parts)) {
      for (const p of m.parts as any[]) {
        console.log(`  [PART] type=${p.type} ${p.text ? 'text=' + p.text.substring(0, 60) : ''} ${p.toolName ? 'tool=' + p.toolName : ''}`);
      }
    }
  }

  if (USE_REAL_AI) {
    return handleRealChat(messages, mode);
  }

  return handleMockChat(messages, mode, chatId);
}
