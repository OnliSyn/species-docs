import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// AI SDK imports (used only when ANTHROPIC_API_KEY is set)
// ---------------------------------------------------------------------------
let streamText, tool, createAnthropic, z, convertToModelMessages;
const USE_REAL_AI = !!process.env.ANTHROPIC_API_KEY;

if (USE_REAL_AI) {
  const ai = await import('ai');
  const anthropicSdk = await import('@ai-sdk/anthropic');
  const zod = await import('zod');
  streamText = ai.streamText;
  tool = ai.tool;
  convertToModelMessages = ai.convertToModelMessages;
  createAnthropic = anthropicSdk.createAnthropic;
  z = zod.z;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
function getSystemPrompt(mode) {
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
    return base + '\nYou are in Ask mode. Focus on answering questions about balances, transactions, and account status. Be concise and data-driven.';
  if (mode === 'trade')
    return base + '\nYou are in Trade mode. Guide users through buy/sell/transfer journeys step by step. Ask for the amount, show fee breakdowns, and confirm before executing.';
  if (mode === 'learn')
    return base + '\nYou are in Learn mode. Explain Onli concepts: Genomes, Genes, Vaults, the Species marketplace pipeline, atomic settlement, and the assurance model. Be educational and thorough.';
  return base;
}

/** Same semantics as `getAssuranceBalance` in src/lib/sim-client.ts (sim /sim/state only). */
async function fetchAssuranceCoverageSnapshot() {
  const marketsb = process.env.MARKETSB_URL || 'http://localhost:3101';
  const species = process.env.SPECIES_URL || 'http://localhost:3102';
  try {
    const msbStateRes = await fetch(`${marketsb}/sim/state`);
    if (!msbStateRes.ok) return null;
    const msbState = await msbStateRes.json();
    let totalAssurance = 0;
    for (const [vaId, va] of Object.entries(msbState.virtualAccounts || {})) {
      if (vaId === 'assurance-global') {
        totalAssurance += Number(va?.posted ?? 0);
      }
    }
    let circulation = 0;
    try {
      const specStateRes = await fetch(`${species}/sim/state`);
      if (specStateRes.ok) {
        const specState = await specStateRes.json();
        if (typeof specState.circulation === 'number') {
          circulation = specState.circulation;
        } else {
          const users = specState.vaults?.users;
          if (users && typeof users === 'object') {
            for (const [, vault] of Object.entries(users)) {
              circulation += Number(vault?.count ?? 0) + Number(vault?.lockerCount ?? 0);
            }
          }
          circulation += Number(specState.vaults?.sellerLocker?.count ?? 0);
        }
      }
    } catch {
      /* species sim down */
    }
    const USDC_SCALE = 1000000n;
    const circVal = BigInt(circulation) * USDC_SCALE;
    const ass = BigInt(totalAssurance);
    let coveragePercent = 100;
    if (circVal > 0n) {
      const raw = Number((ass * 100n) / circVal);
      coveragePercent = Math.min(100, Math.max(0, Math.round(raw)));
    }
    return {
      assurancePosted: totalAssurance,
      circulationSpecieCount: circulation,
      circulationValuePosted: Number(circVal),
      coveragePercent,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MCP-style tool definitions (only created when AI is active)
// ---------------------------------------------------------------------------
function buildTools() {
  if (!USE_REAL_AI) return {};

  // ========== READ TOOLS (with execute — auto-executed by Claude) ==========

  const get_funding_balance = tool({
    description:
      'Get the user\'s Funding VA (USDC) balance. Returns posted balance, pending balance, and account status.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const res = await fetch('http://localhost:3101/api/v1/virtual-accounts/va-funding-user-001');
        const data = await res.json();
        return data; // BalanceDTO — frontend renders as BalanceCard
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
    parameters: z.object({}),
    execute: async () => {
      try {
        const [vaRes, vaultRes] = await Promise.all([
          fetch('http://localhost:3101/api/v1/virtual-accounts/va-species-user-001'),
          fetch('http://localhost:3102/marketplace/v1/vault/onli-user-001'),
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
      'Assurance-global posted, user-vault circulation count, circulation USDC value ($1 × count), coverage % (capped 0–100).',
    parameters: z.object({}),
    execute: async () => {
      const snap = await fetchAssuranceCoverageSnapshot();
      if (snap) return snap;
      return {
        assurancePosted: 0,
        circulationSpecieCount: 0,
        circulationValuePosted: 0,
        coveragePercent: 100,
      };
    },
  });

  const get_recent_transactions = tool({
    description:
      'Get the user\'s most recent transactions. Returns an array of transaction records.',
    parameters: z.object({
      limit: z.number().int().positive().optional().describe('Number of transactions to return (default 5)'),
    }),
    execute: async ({ limit }) => {
      try {
        const res = await fetch('http://localhost:3101/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger');
        if (res.ok) {
          const ledger = await res.json();
          return (Array.isArray(ledger) ? ledger : ledger.events || []).slice(0, limit || 5);
        }
      } catch {}
      // Fallback: return Transaction[] matching frontend TransactionList interface
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
    parameters: z.object({
      deposit_id: z.string().optional().describe('Deposit ID (omit for most recent)'),
    }),
    execute: async ({ deposit_id }) => {
      try {
        const res = await fetch(`http://localhost:3101/api/v1/deposits/${deposit_id || 'dep-001'}`);
        return await res.json();
      } catch {
        // Fallback: DepositData matching frontend DepositStatusCard interface
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
    parameters: z.object({}),
    execute: async () => {
      try {
        const res = await fetch('http://localhost:3102/marketplace/v1/stats');
        return await res.json();
      } catch {
        // Fallback: StatsData matching frontend MarketStatsCard interface
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
    parameters: z.object({
      quantity: z.number().int().positive().describe('Number of Specie to buy'),
    }),
    // No execute — tool invocation returned to frontend for ConfirmationCard
  });

  const submit_sell_order = tool({
    description:
      'Submit a sell order to sell Specie back to the marketplace. Requires user confirmation via the UI before execution. Show the proceeds breakdown before calling this tool.',
    parameters: z.object({
      quantity: z.number().int().positive().describe('Number of Specie to sell'),
    }),
    // No execute
  });

  const transfer_usdc = tool({
    description:
      'Transfer USDC to a contact. Requires user confirmation via the UI before execution.',
    parameters: z.object({
      recipient: z.string().describe('Recipient name or wallet address'),
      amount: z.string().describe('Amount in USDC base units (bigint string, e.g. "100000000" for $100)'),
    }),
    // No execute
  });

  const transfer_specie = tool({
    description:
      'Transfer Specie to a contact via ChangeOwner. Requires user confirmation via the UI before execution.',
    parameters: z.object({
      recipient: z.string().describe('Recipient name or Onli identity'),
      quantity: z.number().int().positive().describe('Number of Specie to transfer'),
    }),
    // No execute
  });

  return {
    // Read tools (auto-executed)
    get_funding_balance,
    get_asset_balance,
    get_assurance_coverage,
    get_recent_transactions,
    get_deposit_status,
    get_marketplace_stats,
    // Write tools (confirmation required)
    submit_buy_order,
    submit_sell_order,
    transfer_usdc,
    transfer_specie,
  };
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const tools = buildTools();

// ---------------------------------------------------------------------------
// POST /api/chat — Real AI mode (Anthropic API key present)
// ---------------------------------------------------------------------------
async function handleRealChat(req, res) {
  const uiMessages = req.body.messages || [];
  const mode = req.body.mode || req.body.body?.mode || 'ask';
  console.log('[REAL AI] Mode:', mode, '| Messages:', uiMessages.length);

  // Convert UI messages (parts format) to model messages (content format)
  const modelMessages = await convertToModelMessages(uiMessages);

  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: getSystemPrompt(mode),
    messages: modelMessages,
    tools,
    maxSteps: 5,
  });

  // Use pipeUIMessageStreamToResponse for Node.js ServerResponse (Express res)
  result.pipeUIMessageStreamToResponse(res);
}

// ---------------------------------------------------------------------------
// POST /api/chat — Mock mode (no API key)
// ---------------------------------------------------------------------------
async function handleMockChat(req, res) {
  const messages = req.body.messages || [];
  const mode = req.body.mode || req.body.body?.mode || 'ask';
  console.log('[MOCK] Mode:', mode, '| Body keys:', Object.keys(req.body));

  const allTexts = messages.map(m => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) return m.parts.filter(p => p.type === 'text').map(p => p.text).join(' ');
    return '';
  });

  const lastText = allTexts[allTexts.length - 1] || '';
  const conversationContext = allTexts.join(' ').toLowerCase();

  // Check if this query should render a generative UI tool card
  const toolResult = await getToolResult(lastText, mode);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('x-vercel-ai-ui-message-stream', 'v1');
  res.setHeader('x-accel-buffering', 'no');

  if (toolResult) {
    const toolCallId = `call_${crypto.randomUUID().slice(0, 8)}`;
    const textId = crypto.randomUUID();

    // Tool input start
    res.write(`data: ${JSON.stringify({
      type: 'tool-input-start',
      toolCallId,
      toolName: toolResult.toolName,
    })}\n\n`);

    // Tool input available
    res.write(`data: ${JSON.stringify({
      type: 'tool-input-available',
      toolCallId,
      input: toolResult.input || {},
    })}\n\n`);

    // Tool output available
    res.write(`data: ${JSON.stringify({
      type: 'tool-output-available',
      toolCallId,
      output: { type: 'text', value: JSON.stringify(toolResult.data) },
    })}\n\n`);

    // Text commentary
    if (toolResult.commentary) {
      res.write(`data: ${JSON.stringify({ type: 'text-start', id: textId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'text-delta', id: textId, delta: toolResult.commentary })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'text-end', id: textId })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50 } })}\n\n`);
    res.end();
    return;
  }

  // Fallback: regular text response (journeys, learn mode, etc.)
  const response = getResponse(lastText, mode, conversationContext, messages);
  const textId = crypto.randomUUID();

  res.write(`data: ${JSON.stringify({ type: 'text-start', id: textId })}\n\n`);

  // Stream by lines to preserve markdown structure (tables, lists, etc.)
  const lines = response.split('\n');
  let lineIdx = 0;

  const interval = setInterval(() => {
    if (lineIdx < lines.length) {
      const line = lines[lineIdx];
      const suffix = lineIdx < lines.length - 1 ? '\n' : '';
      res.write(`data: ${JSON.stringify({ type: 'text-delta', id: textId, delta: line + suffix })}\n\n`);
      lineIdx++;
    } else {
      res.write(`data: ${JSON.stringify({ type: 'text-end', id: textId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50 } })}\n\n`);
      res.end();
      clearInterval(interval);
    }
  }, 20);
}

// ---------------------------------------------------------------------------
// Tool result mapping — returns structured data for generative UI cards
// ---------------------------------------------------------------------------
async function getToolResult(message, mode) {
  const lower = (message || '').toLowerCase();

  // Ask mode tool queries
  if (lower.includes('funding balance') || lower.includes('my balance')) {
    return {
      toolName: 'get_funding_balance',
      data: {
        vaId: 'va-funding-user-001',
        subtype: 'funding',
        balance: { posted: 12450000000, pending: 0, available: 12450000000 },
        currency: 'USDC',
        status: 'active',
      },
      commentary: 'Your funding account is active and fully available for transactions.',
    };
  }

  if (lower.includes('last 5') || lower.includes('last five') || (lower.includes('transaction') && lower.includes('last'))) {
    return {
      toolName: 'get_recent_transactions',
      data: [
        { type: 'deposit', description: 'USDC Deposit', amount: 5000000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'buy', description: 'Buy 1,000 SPECIES', amount: -1030000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'transfer', description: 'Transfer to Pepper Potts', amount: -100000000, date: 'Apr 3, 2026', status: 'completed' },
        { type: 'sell', description: 'Sell 500 SPECIES', amount: 490000000, date: 'Apr 4, 2026', status: 'pending' },
        { type: 'withdrawal', description: 'USDC Withdrawal', amount: -2000000000, date: 'Apr 4, 2026', status: 'completed' },
      ],
      commentary: 'Here are your 5 most recent transactions.',
    };
  }

  if (lower.includes('last deposit') || lower.includes('when was my last deposit')) {
    return {
      toolName: 'get_deposit_status',
      data: {
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
    const snap = await fetchAssuranceCoverageSnapshot();
    const data = snap ?? {
      assurancePosted: 0,
      circulationSpecieCount: 0,
      circulationValuePosted: 0,
      coveragePercent: 100,
    };
    return {
      toolName: 'get_assurance_coverage',
      data: { _ui: 'CoverageCard', ...data },
      commentary: `Coverage is at ${data.coveragePercent}%. The Assurance account is backed by proceeds from all Specie issuance sales.`,
    };
  }

  if (lower.includes('species balance') || lower.includes('asset balance') || lower.includes('specie count')) {
    return {
      toolName: 'get_asset_balance',
      data: {
        vaId: 'va-species-user-001',
        subtype: 'species',
        balance: { posted: 8500000000, pending: 0, available: 8500000000 },
        currency: 'USDC',
        status: 'active',
        vaultCount: 8500,
      },
      commentary: 'Your Species account holds 8,500 Specie valued at $8,500.00.',
    };
  }

  if (lower.includes('market') && (lower.includes('stats') || lower.includes('overview'))) {
    return {
      toolName: 'get_marketplace_stats',
      data: {
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
      data: { userId: 'onli-user-001', count: 8500 },
      commentary: 'Your Onli Vault holds 8,500 Specie in actual possession.',
    };
  }

  // No tool match — return null to fall through to text response
  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
app.post('/api/chat', (req, res) => {
  if (USE_REAL_AI) {
    handleRealChat(req, res);
  } else {
    void handleMockChat(req, res).catch((err) => {
      console.error('[MOCK CHAT]', err);
      if (!res.headersSent) res.status(500).json({ error: String(err?.message || err) });
    });
  }
});

// ---------------------------------------------------------------------------
// Mock response logic — Stateful Journey Engine
// ---------------------------------------------------------------------------

// Mock user state (simulated balances)
const MOCK_STATE = {
  fundingBalance: 12_450,  // $12,450.00
  specieBalance: 8_500,    // 8,500 SPECIES
};

// Format currency for display
function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Journey state detection — parses full conversation history
// ---------------------------------------------------------------------------
function detectJourneyState(messages) {
  // Extract all assistant and user texts separately
  const assistantTexts = [];
  const userTexts = [];
  for (const m of messages) {
    const text = typeof m.content === 'string'
      ? m.content
      : (Array.isArray(m.parts) ? m.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') : '');
    if (m.role === 'assistant') assistantTexts.push(text);
    else if (m.role === 'user') userTexts.push(text);
  }

  const lastUserText = userTexts.length > 0 ? userTexts[userTexts.length - 1].trim() : '';
  const lastUserLower = lastUserText.toLowerCase();
  const lastAssistantText = assistantTexts.length > 0 ? assistantTexts[assistantTexts.length - 1] : '';
  const lastAssistantLower = lastAssistantText.toLowerCase();
  const allContext = [...assistantTexts, ...userTexts].join(' ').toLowerCase();

  // ---- Phase: CONFIRM/CANCEL detection ----
  // If the last assistant message contains "type **confirm**", we're waiting for confirmation
  const awaitingConfirm = lastAssistantLower.includes('type **confirm**');

  if (awaitingConfirm) {
    const isConfirm = ['confirm', 'yes', 'y'].includes(lastUserLower);
    const isCancel = ['cancel', 'no', 'n', 'abort'].includes(lastUserLower);

    if (isConfirm || isCancel) {
      // Determine which journey by scanning assistant text
      let journey = 'unknown';
      if (lastAssistantLower.includes('fund your account')) journey = 'fund';
      else if (lastAssistantLower.includes('buy') && lastAssistantLower.includes('species')) journey = 'buy';
      else if (lastAssistantLower.includes('sell') && lastAssistantLower.includes('species')) journey = 'sell';
      else if (lastAssistantLower.includes('transfer') && lastAssistantLower.includes('species')) journey = 'transfer';
      else if (lastAssistantLower.includes('withdraw')) journey = 'sendout';

      // Extract amount from the confirmation card
      let amount = 0;
      let quantity = 0;
      const amtMatch = lastAssistantText.match(/\$([0-9,]+\.\d{2})\s*USDC/);
      if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));
      const qtyMatch = lastAssistantText.match(/(\d[\d,]*)\s*SPECIES/i);
      if (qtyMatch) quantity = parseInt(qtyMatch[1].replace(/,/g, ''));

      if (isCancel) return { phase: 'cancelled', journey };
      return { phase: 'execute', journey, amount, quantity };
    }
    // User said something else while awaiting confirm — re-prompt
    return { phase: 'awaiting_confirm_reminder' };
  }

  // ---- Phase: AMOUNT/QUANTITY detection ----
  // If assistant asked "how much" or "how many" and user responds with a number
  const askedHowMuch = lastAssistantLower.includes('how much usdc') || lastAssistantLower.includes('how much and where');
  const askedHowMany = lastAssistantLower.includes('how many specie');
  const askedWhoAndHowMany = lastAssistantLower.includes('who and how many');

  const numberMatch = lastUserText.match(/^[\$]?(\d[\d,]*\.?\d*)$/);
  const hasNumber = numberMatch !== null;

  if (askedHowMany && hasNumber) {
    const qty = parseInt(numberMatch[1].replace(/,/g, ''));
    // Determine if buy or sell from earlier context
    if (allContext.includes('how many specie would you like to sell') || allContext.match(/sell.*specie/)) {
      // Check if this specific "how many" was for sell
      if (lastAssistantLower.includes('sell')) return { phase: 'confirm', journey: 'sell', quantity: qty };
    }
    return { phase: 'confirm', journey: 'buy', quantity: qty };
  }

  if (askedHowMuch && hasNumber) {
    const amt = parseFloat(numberMatch[1].replace(/,/g, ''));
    if (lastAssistantLower.includes('withdraw') || lastAssistantLower.includes('how much and where')) {
      return { phase: 'confirm', journey: 'sendout', amount: amt };
    }
    return { phase: 'confirm', journey: 'fund', amount: amt };
  }

  // Transfer: user responds with "pepper 100" or "pepper potts 100" style
  if (askedWhoAndHowMany) {
    const transferMatch = lastUserText.match(/(.+?)\s+(\d+)/i);
    if (transferMatch) {
      const recipient = transferMatch[1].trim();
      const qty = parseInt(transferMatch[2]);
      return { phase: 'confirm', journey: 'transfer', quantity: qty, recipient };
    }
  }

  // SendOut: user responds with amount + address
  if (lastAssistantLower.includes('how much and where')) {
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

function fundStart() {
  return 'How much USDC would you like to deposit into your Funding Account?\n\nYou can deposit from any connected wallet. Just tell me the amount.';
}

function fundConfirm(amount) {
  const newBalance = MOCK_STATE.fundingBalance + amount;
  return `**FUND YOUR ACCOUNT**\n\n` +
    `| | |\n|---|---|\n` +
    `| Amount | $${fmt(amount)} USDC |\n` +
    `| From | Connected Wallet |\n` +
    `| To | Funding Account (VA-500) |\n` +
    `| For Benefit Of | MSB-VA-500-0x8F3a...7B2c |\n\n` +
    `Type **confirm** to proceed or **cancel** to abort.`;
}

function fundExecute(amount) {
  MOCK_STATE.fundingBalance += amount;
  return `**Processing deposit...**\n\n` +
    `✅ Deposit detected\n` +
    `✅ Compliance check passed\n` +
    `✅ Credited to Funding Account\n\n` +
    `**Deposit complete!** $${fmt(amount)} USDC has been credited to your Funding Account.\n\n` +
    `Your new balance: **$${fmt(MOCK_STATE.fundingBalance)}**`;
}

function buyStart() {
  return 'How many Specie would you like to buy?\n\nEach Specie is priced at **$1.00 USDC**. Just tell me the quantity.';
}

function buyConfirm(quantity) {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;

  return `**BUY ${quantity.toLocaleString()} SPECIES**\n\n` +
    `| Item | Amount |\n|---|---|\n` +
    `| Asset Cost | $${fmt(cost)} |\n` +
    `| Issuance Fee | $${fmt(issuanceFee)} |\n` +
    `| Liquidity Fee (2%) | $${fmt(liquidityFee)} |\n` +
    `| **Total** | **$${fmt(total)}** |\n\n` +
    `From: Funding Account ($${fmt(MOCK_STATE.fundingBalance)})\n\n` +
    `Type **confirm** to proceed or **cancel** to abort.`;
}

function buyExecute(quantity) {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const fees = issuanceFee + liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  MOCK_STATE.fundingBalance -= total;
  MOCK_STATE.specieBalance += quantity;

  return `**Order submitted! Processing through Species pipeline...**\n\n` +
    `✅ Submitted — SM\n` +
    `✅ Authenticated — SM\n` +
    `✅ Validated — SM\n` +
    `✅ Matched (Treasury) — SM\n` +
    `✅ Asset staged (Settlement Vault) — OC\n` +
    `✅ Payment processed (atomic batch) — MB\n` +
    `✅ Delivered to your Vault — OC\n` +
    `✅ Oracle verified — SM\n` +
    `✅ **Complete!**\n\n` +
    `**ORDER COMPLETE**\n` +
    `- Event: ${eventId}\n` +
    `- Batch: ${batchId}\n` +
    `- Bought: ${quantity.toLocaleString()} SPECIES\n` +
    `- Cost: $${fmt(cost)}\n` +
    `- Fees: $${fmt(fees)}\n` +
    `- Total: $${fmt(total)}\n` +
    `- Oracle: ✓ Verified\n` +
    `- Assurance: $${fmt(cost)} posted\n\n` +
    `Your new Funding balance: **$${fmt(MOCK_STATE.fundingBalance)}**\n` +
    `Your new Species balance: **${MOCK_STATE.specieBalance.toLocaleString()} SPECIES**`;
}

function sellStart() {
  return `How many Specie would you like to sell?\n\nYou currently hold **${MOCK_STATE.specieBalance.toLocaleString()} Specie** in your Vault. The sell price is **$1.00 USDC** per Specie (minus a 2% liquidity fee).`;
}

function sellConfirm(quantity) {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.02;
  const net = gross - liquidityFee;

  return `**SELL ${quantity.toLocaleString()} SPECIES**\n\n` +
    `| Item | Amount |\n|---|---|\n` +
    `| Gross Proceeds | $${fmt(gross)} |\n` +
    `| Liquidity Fee (2%) | -$${fmt(liquidityFee)} |\n` +
    `| **Net Proceeds** | **$${fmt(net)}** |\n\n` +
    `Type **confirm** to proceed or **cancel** to abort.`;
}

function sellExecute(quantity) {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.02;
  const net = gross - liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  MOCK_STATE.specieBalance -= quantity;
  MOCK_STATE.fundingBalance += net;

  return `**Order submitted! Processing through Species pipeline...**\n\n` +
    `✅ Submitted — SM\n` +
    `✅ Authenticated — SM\n` +
    `✅ Validated — SM\n` +
    `✅ Matched (Treasury) — SM\n` +
    `✅ Asset staged (Settlement Vault) — OC\n` +
    `✅ Payment processed (atomic batch) — MB\n` +
    `✅ Delivered to Treasury Vault — OC\n` +
    `✅ Oracle verified — SM\n` +
    `✅ **Complete!**\n\n` +
    `**ORDER COMPLETE**\n` +
    `- Event: ${eventId}\n` +
    `- Batch: ${batchId}\n` +
    `- Sold: ${quantity.toLocaleString()} SPECIES\n` +
    `- Gross: $${fmt(gross)}\n` +
    `- Fees: $${fmt(liquidityFee)}\n` +
    `- Net Proceeds: $${fmt(net)}\n` +
    `- Oracle: ✓ Verified\n\n` +
    `Your new Funding balance: **$${fmt(MOCK_STATE.fundingBalance)}**\n` +
    `Your new Species balance: **${MOCK_STATE.specieBalance.toLocaleString()} SPECIES**`;
}

function transferStart() {
  return `Who and how many Specie would you like to transfer?\n\n` +
    `Your contacts:\n` +
    `- **Pepper Potts** (onli-user-456)\n` +
    `- **Tony Stark** (onli-user-789)\n` +
    `- **Happy Hogan** (onli-user-012)\n\n` +
    `Tell me the recipient and quantity (e.g. "Pepper Potts 100").`;
}

function transferConfirm(quantity, recipient) {
  // Normalize recipient name
  const contacts = {
    'pepper': { name: 'Pepper Potts', id: 'onli-user-456' },
    'pepper potts': { name: 'Pepper Potts', id: 'onli-user-456' },
    'tony': { name: 'Tony Stark', id: 'onli-user-789' },
    'tony stark': { name: 'Tony Stark', id: 'onli-user-789' },
    'happy': { name: 'Happy Hogan', id: 'onli-user-012' },
    'happy hogan': { name: 'Happy Hogan', id: 'onli-user-012' },
  };
  const contact = contacts[recipient.toLowerCase()] || { name: recipient, id: 'onli-user-unknown' };

  return `**TRANSFER ${quantity.toLocaleString()} SPECIES**\n\n` +
    `| | |\n|---|---|\n` +
    `| To | ${contact.name} (${contact.id}) |\n` +
    `| Quantity | ${quantity.toLocaleString()} SPECIES |\n` +
    `| Fees | None |\n\n` +
    `⚠️ This transfer is final and non-reversible.\n\n` +
    `Type **confirm** to proceed or **cancel** to abort.`;
}

function transferExecute(quantity) {
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;

  MOCK_STATE.specieBalance -= quantity;

  return `**Order submitted! Processing transfer...**\n\n` +
    `✅ Submitted — SM\n` +
    `✅ Authenticated — SM\n` +
    `✅ Validated — SM\n` +
    `✅ Matched (Peer) — SM\n` +
    `✅ Asset staged (Settlement Vault) — OC\n` +
    `✅ Delivered to recipient Vault — OC\n` +
    `✅ Oracle verified — SM\n` +
    `✅ **Complete!**\n\n` +
    `**TRANSFER COMPLETE**\n` +
    `- Event: ${eventId}\n` +
    `- Transferred: ${quantity.toLocaleString()} SPECIES\n` +
    `- Fees: None\n` +
    `- Oracle: ✓ Verified\n\n` +
    `Your new Species balance: **${MOCK_STATE.specieBalance.toLocaleString()} SPECIES**`;
}

function sendoutStart() {
  return `How much USDC and where would you like to withdraw?\n\nTell me the amount and destination address (e.g. "2000 to 0x9876...fedc").`;
}

function sendoutConfirm(amount, destination) {
  const dest = destination || '0x9876...fedc';
  return `**WITHDRAW $${fmt(amount)} USDC**\n\n` +
    `| | |\n|---|---|\n` +
    `| Amount | $${fmt(amount)} USDC |\n` +
    `| To | ${dest} |\n` +
    `| Network | Base |\n\n` +
    `⚠️ THIS WITHDRAWAL IS IRREVERSIBLE. Once confirmed, funds cannot be returned.\n\n` +
    `Type **confirm** to proceed or **cancel** to abort.`;
}

function sendoutExecute(amount) {
  MOCK_STATE.fundingBalance -= amount;

  return `**Processing withdrawal...**\n\n` +
    `✅ Withdrawal initiated\n` +
    `✅ Compliance check passed\n` +
    `✅ Debited from Funding Account\n` +
    `✅ USDC sent on-chain\n` +
    `✅ **Withdrawal complete!**\n\n` +
    `**WITHDRAWAL COMPLETE**\n` +
    `- Amount: $${fmt(amount)} USDC\n` +
    `- Network: Base\n` +
    `- Status: Confirmed\n\n` +
    `Your new Funding balance: **$${fmt(MOCK_STATE.fundingBalance)}**`;
}

function cancelledResponse() {
  return `**Order cancelled.** No funds were charged and no assets were moved.\n\nHow else can I help you?`;
}

// ---------------------------------------------------------------------------
// Main response dispatcher
// ---------------------------------------------------------------------------
function getResponse(message, mode, context, messages) {
  const lower = (message || '').toLowerCase();

  // ============================================
  // TRADE MODE — Stateful Journey Engine
  // ============================================
  if (mode === 'trade') {
    const state = detectJourneyState(messages);
    console.log('[JOURNEY]', JSON.stringify(state));

    // --- Cancelled ---
    if (state.phase === 'cancelled') return cancelledResponse();

    // --- Awaiting confirm but user said something else ---
    if (state.phase === 'awaiting_confirm_reminder') {
      return 'Please type **confirm** to proceed or **cancel** to abort.';
    }

    // --- Execute phase (user confirmed) ---
    if (state.phase === 'execute') {
      switch (state.journey) {
        case 'fund': return fundExecute(state.amount || 5000);
        case 'buy': return buyExecute(state.quantity || 1000);
        case 'sell': return sellExecute(state.quantity || 500);
        case 'transfer': return transferExecute(state.quantity || 100);
        case 'sendout': return sendoutExecute(state.amount || 2000);
      }
    }

    // --- Confirm phase (show confirmation card) ---
    if (state.phase === 'confirm') {
      switch (state.journey) {
        case 'fund': return fundConfirm(state.amount || 5000);
        case 'buy': return buyConfirm(state.quantity || 1000);
        case 'sell': return sellConfirm(state.quantity || 500);
        case 'transfer': return transferConfirm(state.quantity || 100, state.recipient || 'Pepper Potts');
        case 'sendout': return sendoutConfirm(state.amount || 2000, state.destination);
      }
    }

    // --- Start phase (ask for amount/quantity) ---
    if (state.phase === 'start') {
      switch (state.journey) {
        case 'fund': return fundStart();
        case 'buy': return buyStart();
        case 'sell': return sellStart();
        case 'transfer': return transferStart();
        case 'sendout': return sendoutStart();
      }
    }

    // --- Trade mode fallback ---
    return 'Welcome to Species Market! I can help you:\n\n' +
      '- **Fund** — Deposit USDC into your account\n' +
      '- **Buy** — Purchase Specie from the marketplace\n' +
      '- **Sell** — Sell your Specie back\n' +
      '- **Transfer** — Send Specie to a contact\n' +
      '- **Withdraw** — Send USDC to an external wallet\n\n' +
      'What would you like to do?';
  }

  // ============================================
  // LEARN MODE
  // ============================================
  if (mode === 'learn') {
    if (lower.includes('what is onli') || lower.includes('how does it work')) {
      return '**Onli** is a hyper-dimensional vector storage system that enables actual possession of digital assets.\n\n' +
        'Unlike blockchain, Onli doesn\'t use a shared ledger. Instead, it transfers possession through three core primitives:\n\n' +
        '- **Genomes** — Non-fungible tensor-based containers for digital assets\n' +
        '- **Genes** — Unforgeable cryptographic ownership credentials\n' +
        '- **Vaults** — TEE-backed secure storage on your device (Onli_You)\n\n' +
        'Transfers are peer-to-peer, instant, final, and private by default.';
    }

    if (lower.includes('genome') || lower.includes('gene')) {
      return '**Genomes** are the fundamental data objects in Onli — non-fungible containers that hold digital assets.\n\n' +
        'Each Genome is a tensor-based structure that:\n- Cannot be copied or duplicated\n- Evolves during transfer (Genome Editing)\n- Has a unique identity that persists through ownership changes\n\n' +
        '**Genes** are the cryptographic credentials that prove ownership. They are:\n- Unforgeable — backed by TEE hardware\n- Bound to a specific Vault\n- Required for any ownership transfer (ChangeOwner)\n\n' +
        'Together, Genomes and Genes implement *actual possession* rather than ledger-recorded ownership.';
    }

    if (lower.includes('pipeline') || lower.includes('species marketplace')) {
      return 'The **Species Marketplace Pipeline** processes buy, sell, and transfer orders through these stages:\n\n' +
        '1. **EventRequest** — User submits intent (buy/sell/transfer)\n' +
        '2. **Authenticator** — Verifies API key + HMAC + Onli identity\n' +
        '3. **Validator** — Checks user exists, has funds, Specie available\n' +
        '4. **Classifier** — Routes by intent (buy/sell/transfer)\n' +
        '5. **Matching** — Finds counterparty (Treasury or peer)\n' +
        '6. **Asset Pre-staging** — ChangeOwner to Settlement Vault\n' +
        '7. **Cashier (MarketSB)** — atomic settlement\n' +
        '8. **Asset Delivery** — ChangeOwner to buyer\'s Vault\n' +
        '9. **FloorManager** — Oracle verify, compose receipt\n\n' +
        'The key insight: assets are **pre-staged** before money moves, so if staging fails, no funds are charged.';
    }

    if (lower.includes('assurance') || lower.includes('backing')) {
      return 'The **100% Assurance Model** guarantees that every Specie in circulation is fully backed by USDC:\n\n' +
        '- When Specie is **issued** (bought), the purchase proceeds flow to the **Assurance Account** (VA code 500, subtype: assurance)\n' +
        '- **Coverage %** = Assurance Balance ÷ Total Outstanding × 100\n' +
        '- Target is always **≥ 100%** — every dollar of Specie value is backed\n\n' +
        'Coverage thresholds:\n- ≥ 50%: **Healthy** (green)\n- 25-50%: **Warning** (amber)\n- < 25%: **Critical** (red)\n\n' +
        'The buy-back guarantee ensures liquidity — you can always sell Specie back at $1.00.';
    }

    return 'I can help you learn about the Onli ecosystem:\n\n' +
      '- **What is Onli?** — The core architecture\n' +
      '- **Genomes & Genes** — How digital ownership works\n' +
      '- **Species Pipeline** — Order processing flow\n' +
      '- **Assurance Model** — 100% backing guarantee\n\n' +
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
    return 'I checked your MarketSB deposit queue. You have 1 pending deposit:\n\n- **$5,000.00 USDC** — Status: awaiting_confirmations (2/6 confirmations)\n\nThis should be credited within the next few minutes once all 6 confirmations are received.';
  }

  if (lower.includes('assurance') || lower.includes('coverage')) {
    return 'Your current assurance coverage:\n\n- **Assurance Balance:** $950,000.00\n- **Total Outstanding:** $1,000,000.00\n- **Coverage:** 95%\n\nCoverage is healthy (≥50%). The Assurance account is backed by proceeds from all Specie issuance sales.';
  }

  if (lower.includes('history') || lower.includes('transaction')) {
    return 'Here are your recent transactions:\n\n1. **USDC Deposit** — +$5,000.00 — Completed — Apr 3\n2. **Buy 1,000 SPECIES** — -$1,030.00 — Completed — Apr 3\n3. **Transfer to Pepper Potts** — -$100.00 — Completed — Apr 3\n4. **Sell 500 SPECIES** — +$490.00 — Pending — Apr 4';
  }

  if (lower.includes('risk') || lower.includes('alert') || lower.includes('escalate')) {
    return 'No critical coverage shortfalls detected. Current status:\n\n- Coverage: 95% (Healthy)\n- Last reconciliation: Pass\n- Variance: $0.00\n\nAll systems operating normally.';
  }

  return 'I\'m Synth, your Onli AI assistant. I can help you with:\n\n- **Balances** — Check your funding and asset balances\n- **Transactions** — View recent activity and deposits\n- **Assurance** — Coverage monitoring and risk alerts\n\nWhat would you like to know?';
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3100;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Mode: ${USE_REAL_AI ? 'REAL AI (Anthropic Claude)' : 'MOCK (hardcoded responses)'}`);
  if (USE_REAL_AI) {
    console.log('Tools registered:', Object.keys(tools).join(', '));
  }
});
