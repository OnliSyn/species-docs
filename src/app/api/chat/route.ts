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
import {
  getFundingBalance,
  getVaultBalance,
  getAssuranceBalance,
  getOracleLedger,
  getMarketplaceStats,
  getListings,
  simulateDeposit,
  simulateWithdrawal,
  fmtUSDC,
  CURRENT_USER,
} from '@/lib/sim-client';
import { getSystemPrompt, FULL_CANON } from '@/lib/system-prompts';

const MARKETSB_ORIGIN = process.env.MARKETSB_URL || 'http://localhost:3101';
import {
  detectJourneyState,
  getLiveState,
  fmt,
  setPendingJourney,
  consumePendingJourney,
  cancelledResponse,
  fundStart,
  fundConfirm,
  fundExecute,
  issueStart,
  issueConfirm,
  issueExecute,
  buyStart,
  buyConfirm,
  buyExecute,
  sellStart,
  sellConfirm,
  sellExecute,
  redeemStart,
  redeemConfirm,
  redeemExecute,
  transferStart,
  transferConfirm,
  transferExecute,
  sendoutStart,
  sendoutConfirm,
  sendoutExecute,
  type JourneyResponse,
} from '@/lib/journey-engine';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------
const USE_REAL_AI = !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Canon Q&A — keyword-matched answers from onli-canon.md
// Covers every question in the Ask mode Canvas walkthrough
// ---------------------------------------------------------------------------
interface CanonEntry {
  keywords: string[];
  answer: string;
}

const CANON_QA: CanonEntry[] = [
  {
    keywords: ['what is onli', 'explain onli'],
    answer: '**Onli** is a possession-based system for true digital ownership.\n\nIt makes it possible for a digital asset to exist as a **one-of-one object** that is held in possession, transferred directly, and not duplicated.\n\n- Traditional digital systems are based on **access**\n- Onli is based on **possession**\n\nThat is the paradigm shift.',
  },
  {
    keywords: ["like i'm 16", 'like im 16', 'explain it simply', 'simple terms'],
    answer: 'Imagine you own a rare baseball card. If you hand it to someone, you don\'t have it anymore — they do. That\'s **possession**.\n\nIn today\'s digital world, systems write down that you "have" something, but the file can still be copied. You hold a **claim**, not the thing.\n\n**Onli** makes digital assets work like that baseball card:\n\n- If it\'s in your Vault, you have it\n- If you transfer it, it leaves your Vault\n- It appears in the other person\'s Vault\n- No duplicate remains\n\nOnli makes digital things behave like real things.',
  },
  {
    keywords: ['what problem', 'problem does onli solve', 'core problem'],
    answer: 'The core problem is the **Uniqueness-Quantification Problem**.\n\nDigital data can normally be copied infinitely at near-zero cost. That makes it excellent for communication but terrible for ownership.\n\nIf anything can be copied perfectly:\n- Scarcity breaks down\n- Possession is ambiguous\n- Ownership becomes a social claim, not a technical reality\n\nOnli solves this by making the **asset itself singular** at the data level.',
  },
  {
    keywords: ['paradigm shift', 'what is the shift'],
    answer: 'The paradigm shift is from **access** to **possession**.\n\n- **Traditional systems:** You get permission to view or use something. A platform controls access. You hold a claim in a database.\n- **Onli:** You hold the asset itself in your Vault. You control it with your Gene. Transfer means the asset physically moves.\n\n> Traditional digital systems provide access. Onli provides possession.',
  },
  {
    keywords: ['what is an asset', 'define asset'],
    answer: 'An **asset is property owned**.\n\nFor something to qualify as an asset, it must have:\n\n- **Right of exclusion** — you can prevent others from using it\n- **Right of disposition** — you can transfer, use, or destroy it\n\nIf these rights aren\'t enforceable, the thing is not truly an asset — it\'s information or a claim.\n\nFrom these come three required assertions:\n1. **Existence** — it must be a definable thing\n2. **Allocation** — it must be assignable to an owner\n3. **Rights & obligations** — the owner can exercise control',
  },
  {
    keywords: ['what makes something property', 'property'],
    answer: 'Property requires two enforceable rights:\n\n1. **Right of exclusion** — the ability to prevent others from accessing or using it\n2. **Right of disposition** — the ability to transfer, use, or destroy it\n\nWithout these, you don\'t have property — you have information or a revocable permission.\n\n> True ownership requires property with enforceable rights. Ledgers only record claims about property — they do not create property.',
  },
  {
    keywords: ['why does ownership matter', 'ownership matter in an economy'],
    answer: 'Without an owner:\n- Allocation cannot be established\n- Rights cannot be exercised\n- Obligations cannot be assigned\n\nEvery economic system depends on three assertions: that an asset **exists**, that it is **allocated** to someone, and that the owner has **rights and obligations**.\n\nOwnership is the foundation of accounting, trade, and economic coordination. Without it, there is no economy — only shared access.',
  },
  {
    keywords: ['what is a species', 'what is a specie', 'what are species'],
    answer: 'A **Specie** is a singular digital asset on the Onli platform.\n\nEach Specie:\n- Is backed **1:1 by USDC** in the Assurance Account\n- Can be bought from the Treasury or marketplace listings\n- Can be listed for sale, transferred to another user, or redeemed\n- Lives in your Vault in actual possession\n\nSpecies serve as the training asset for learning how Onli works — real ownership, real transfers, real settlement.',
  },
  {
    keywords: ['species training', 'species used for learning', 'how are species used'],
    answer: 'Species are the **training system for learning Onli**.\n\nThey give you a real asset to work with:\n- **Fund** your account with USDC\n- **Buy** Species from the marketplace\n- **List** them for sale\n- **Transfer** to another user\n- **Redeem** through the MarketMaker\n\nEvery operation uses the real infrastructure — cashier settlement, vault ownership, oracle recording. It\'s not a simulation of Onli — it IS Onli, with Species as the training asset.',
  },
  {
    keywords: ['how does onli work', 'how onli works'],
    answer: 'Onli works through four core elements:\n\n- **Asset** — the thing being owned, transferred, or used\n- **Genome** — the hyper-dimensional container structure\n- **Gene** — the credential that binds control and authorization\n- **Vault** — the secure environment where the asset is held\n\nWhen an asset transfers:\n1. It **leaves** one Vault\n2. It **appears** in another Vault\n3. The transfer is **direct** — no copy remains\n4. No ledger update substitutes for the movement\n\n> Onli works by binding a singular asset to a control credential and a secure holding environment.',
  },
  {
    keywords: ['what is an asset in onli'],
    answer: 'In Onli, an **asset** is the practical thing being owned, controlled, issued, transferred, or used.\n\nIt is:\n- Held in a **Vault** (actual possession)\n- Controlled by a **Gene** (authorization credential)\n- Built on a **Genome** (technical container)\n\nThe asset is what you talk about philosophically and commercially. The Genome is the technical structure beneath it.',
  },
  {
    keywords: ['what is a genome', 'genome'],
    answer: 'A **Genome** is the underlying hyper-dimensional container structure that makes an asset possible.\n\nA Genome is:\n- A **tensor-based data container**\n- Designed to **evolve in state** rather than be duplicated\n- The technical substrate beneath the usable asset\n\n**Key distinction:**\n- **Asset** = the thing you talk about philosophically and commercially\n- **Genome** = the technical container structure that makes it possible',
  },
  {
    keywords: ['what is a gene', 'gene'],
    answer: 'A **Gene** is the credential that binds control, authorization, and continuity of ownership.\n\nIt is:\n- **Unforgeable** — backed by TEE hardware\n- **Bound** to a specific Vault\n- **Required** for any ownership transfer (ChangeOwner)\n\nThe Gene is the cryptographic identity that determines who can use, transfer, or destroy the asset. Without the Gene, the asset cannot move.',
  },
  {
    keywords: ['what is a vault', 'vault'],
    answer: 'A **Vault** is the secure environment where your asset resides in actual possession.\n\nIt is:\n- **TEE-backed** (Trusted Execution Environment)\n- **Device-local** via Onli_You\n- The place where ownership is **physical-like** — if it\'s in your Vault, you have it\n\nPossession is meaningful because the asset resides in a controlled Vault, not as a free-floating file or database entry.',
  },
  {
    keywords: ['blockchain enough', 'why not blockchain', "isn't a blockchain"],
    answer: 'A blockchain is not enough because it is fundamentally a system of **recorded claims**.\n\nA blockchain records transactions in a shared log and uses consensus to maintain agreement about state. But:\n\n- A blockchain moves **records about ownership**\n- Onli moves **the actual asset**\n\nIn Onli: no miners, no gas model, no public chain required. The focus is the asset itself, not a shared log.\n\n> A blockchain moves records about ownership. Onli moves the actual asset.',
  },
  {
    keywords: ['ledger work', "wouldn't a ledger", 'why not a ledger'],
    answer: 'A ledger can tell you:\n- Who should own something\n- Who transferred something\n- Who has a balance\n\nBut a ledger **cannot ensure** that the underlying thing is non-duplicative.\n\nA ledger is a record of claims. It is not the thing itself. It may be useful for accounting, but it is not sufficient as the basis of true digital possession.\n\n> A ledger can describe ownership claims, but it cannot create singular digital reality.',
  },
  {
    keywords: ['actual possession', 'possession vs custodial', 'custodial'],
    answer: '**Actual possession** means the asset resides in **your Vault** and is bound to **your Gene**.\n- You hold the asset\n- You control its use\n- Your ownership is based on possession\n\n**Custodial possession** means a third party holds the asset and gives you a ledger entry.\n- They hold the asset\n- You hold a claim\n- Your rights depend on their honesty and solvency\n\n> Actual possession means you hold the asset. Custodial means someone else holds the asset and you hold a claim.',
  },
  {
    keywords: ['ledger ownership by proxy', 'ownership by proxy'],
    answer: 'A ledger represents **ownership by proxy** because:\n\n- The ledger entry is a **record**, not the asset itself\n- Control depends on the system maintaining the ledger\n- The underlying asset (if it exists as data) may still be copyable\n\nOwnership is indirect — you don\'t hold the thing, you hold a record that says you should. Your rights depend on the ledger operator honoring that record.\n\n> True ownership requires property with enforceable rights. Ledgers only record claims about property.',
  },
  {
    keywords: ['key proof of access', 'proof of access not ownership'],
    answer: 'A cryptographic key is **proof of access**, not proof of ownership.\n\nA key lets you sign transactions or authenticate to a system. But:\n- The key proves you can **access** the system\n- It does not prove you **possess** the asset\n- The asset remains in the system\'s control, not yours\n\nIn Onli, the **Gene** is different — it is bound to a Vault where the asset physically resides. The Gene proves you control the possession environment, not just an access point.',
  },
  {
    keywords: ["hasn't this problem been solved", "hasn't someone solved", 'solved before'],
    answer: 'Because most systems approached the problem from the **wrong layer**.\n\nHistorically, people tried:\n- Access control\n- Digital rights management\n- Account balances\n- Public ledgers and tokens\n- Institutional custody\n\nThese manage permissions, claims, or consensus — but none solve the deeper issue of making the **digital object itself singular**.\n\nOnli\'s insight: the solution had to be built into the **structure of the data container** and its control environment, not merely into a recordkeeping system.\n\n> Others tried to solve ownership at the permission layer. Onli solves it at the asset layer.',
  },
  {
    keywords: ['what can you build', 'build with onli', 'use cases'],
    answer: 'Onli can be used anywhere true digital ownership matters:\n\n- Digital credentials and licenses\n- Legal documents, titles, and deeds\n- Private identity data\n- Financial instruments\n- Branded currencies or commodities\n- AI-native data structures\n- Proprietary models and intellectual property\n- Controlled data exchange\n\n**The general rule:** if the digital thing needs to be owned, transferred, restricted, verified, or held in possession — Onli is the right model.\n\nVisit **https://onli.cloud/** to get started with developer access and documentation.',
  },
  {
    keywords: ['what are appliances', 'appliances'],
    answer: '**Appliances** are applications built on Onli Cloud APIs.\n\nThey are the interface layer that developers create for real-world workflows. Appliances can:\n- Connect users to services\n- Orchestrate transactions\n- Enforce business logic\n- Request issuance, transfer, or settlement\n\nBut Appliances **do not possess the asset** and cannot unilaterally move it. Only the Owner, through the appropriate control path, can authorize movement.\n\nTo get started building Appliances, visit **https://onli.cloud/** for developer registration and documentation.\n\n> Appliances orchestrate interactions but do not own or control the asset itself.',
  },
  {
    keywords: ['private-data economy', 'private data economy', 'data economy'],
    answer: 'The **private-data economy** is the idea that data itself can become a controlled asset owned by the individual.\n\nToday:\n- Companies collect, copy, and monetize your data\n- You are the product\n\nWith Onli:\n- Data exists as an **owned asset**\n- The owner controls access and use\n- Transfer is direct and intentional\n- Value is created without permanent third-party custody\n\n> The private-data economy is a model where data is owned and controlled as an asset rather than extracted and warehoused as a platform resource.',
  },
];

function matchCanonQuestion(lower: string): string | null {
  for (const entry of CANON_QA) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.answer;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Message interface (local to route)
// ---------------------------------------------------------------------------
interface Message {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

// ---------------------------------------------------------------------------
// Fund constants (needed by buildTools)
// ---------------------------------------------------------------------------
const INCOMING_ACCOUNT = '0x7F4e...2A9d';
const USER_ACCOUNT_NUMBER = 'MSB-VA-500-0x8F3a...7B2c';

// ---------------------------------------------------------------------------
// Tool result mapping — returns structured data for generative UI cards
// ---------------------------------------------------------------------------
interface ToolResult {
  toolName: string;
  input?: Record<string, unknown>;
  data: unknown;
  commentary?: string;
}

async function getToolResult(message: string, mode: string): Promise<ToolResult | null> {
  // Only trigger generative UI tool cards in Ask mode
  // Trade mode uses the journey state machine, Learn mode uses text
  if (mode !== 'ask') return null;

  const lower = (message || '').toLowerCase();

  if (lower.includes('funding balance') || lower.includes('my balance')) {
    const va = await getFundingBalance();
    const posted = va?.posted ?? 0;
    return {
      toolName: 'get_funding_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Funding Account',
        vaId: va?.vaId || 'va-funding-user-001',
        subtype: 'funding',
        balance: { posted, pending: va?.pending ?? 0, available: posted },
        currency: 'USDC',
        status: va?.status || 'active',
      },
      commentary: `Your funding account balance is $${fmtUSDC(posted)} USDC. The account is active and fully available for transactions.`,
    };
  }

  if (lower.includes('last 5') || lower.includes('last five') || (lower.includes('transaction') && lower.includes('last'))) {
    const ledger = await getOracleLedger(CURRENT_USER.ref, 5);
    return {
      toolName: 'get_recent_transactions',
      data: {
        _ui: 'TransactionList',
        transactions: ledger || [],
      },
      commentary: ledger && ledger.length > 0
        ? `Here are your ${ledger.length} most recent transactions.`
        : 'No transactions found yet. Your account is new.',
    };
  }

  if (lower.includes('last deposit') || lower.includes('when was my last deposit')) {
    const ledger = await getOracleLedger(CURRENT_USER.ref, 20);
    const deposit = ledger?.find((e: any) => e.type === 'deposit_credited' || e.type?.includes('deposit'));
    return {
      toolName: 'get_deposit_status',
      data: {
        _ui: 'DepositCard',
        ...(deposit || { depositId: 'none', amount: 0, status: 'none' }),
      },
      commentary: deposit
        ? 'Here is your most recent deposit.'
        : 'No deposits found. Your account has not received any deposits yet.',
    };
  }

  if (lower.includes('assurance') || lower.includes('coverage')) {
    const assurance = await getAssuranceBalance();
    return {
      toolName: 'get_assurance_coverage',
      data: {
        _ui: 'CoverageCard',
        assurancePosted: assurance?.assurancePosted ?? 0,
        circulationSpecieCount: assurance?.circulationSpecieCount ?? 0,
        circulationValuePosted: assurance?.circulationValuePosted ?? 0,
        coveragePercent: assurance?.coveragePercent ?? 0,
      },
      commentary: assurance
        ? `Coverage is at ${assurance.coveragePercent}%. The Assurance account is backed by proceeds from all Specie issuance sales.`
        : 'Unable to fetch assurance data.',
    };
  }

  if (lower.includes('species balance') || lower.includes('asset balance') || lower.includes('specie count')) {
    const vault = await getVaultBalance();
    const vaultCount = vault?.count ?? 0;
    return {
      toolName: 'get_asset_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Species Vault',
        vaultId: vault?.vaultId || `vault-${CURRENT_USER.onliId}`,
        subtype: 'species',
        specieCount: vaultCount,
      },
      commentary: `Your Vault holds ${vaultCount.toLocaleString()} Specie.`,
    };
  }

  if (lower.includes('market') && (lower.includes('stats') || lower.includes('overview'))) {
    const [stats, listings] = await Promise.all([
      getMarketplaceStats(),
      getListings(),
    ]);
    const s = (stats || {}) as Record<string, unknown>;
    const listedSpecieCount = (listings || []).reduce((sum: number, l: any) => sum + (l.remainingQuantity || 0), 0);
    return {
      toolName: 'get_marketplace_stats',
      data: {
        _ui: 'MarketStats',
        totalOrders: s.totalOrders ?? 0,
        completedOrders: s.completedOrders ?? 0,
        totalVolumeSpecie: s.totalVolumeSpecie ?? 0,
        activeListings: s.activeListings ?? 0,
        treasuryCount: s.treasuryCount ?? 0,
        listedSpecieCount,
      },
      commentary: stats
        ? `${listedSpecieCount.toLocaleString()} species listed for sale. Treasury: ${((s.treasuryCount as number) ?? 0).toLocaleString()}.`
        : 'Unable to fetch marketplace stats.',
    };
  }

  if (lower.includes('vault')) {
    const vault = await getVaultBalance();
    const count = vault?.count ?? 0;
    return {
      toolName: 'get_vault_balance',
      data: { _ui: 'VaultCard', userId: CURRENT_USER.onliId, count },
      commentary: `Your Onli Vault holds ${count.toLocaleString()} Specie in actual possession.`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main response dispatcher
// ---------------------------------------------------------------------------
async function getResponse(message: string, mode: string, context: string, messages: Message[], chatId?: string): Promise<string | JourneyResponse> {
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
          case 'issue': return issueExecute(pending.quantity || 1000);
          case 'buy': return buyExecute(pending.quantity || 1000);
          case 'sell': return sellExecute(pending.quantity || 500);
          case 'redeem': return redeemExecute(pending.quantity || 500);
          case 'transfer': return transferExecute(pending.quantity || 100, pending.recipient);
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
        case 'issue': return issueExecute(state.quantity || 1000);
        case 'buy': return buyExecute(state.quantity || 1000);
        case 'sell': return sellExecute(state.quantity || 500);
        case 'redeem': return redeemExecute(state.quantity || 500);
        case 'transfer': return transferExecute(state.quantity || 100, state.recipient);
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
        case 'issue': return issueConfirm(state.quantity || 1000);
        case 'buy': return buyConfirm(state.quantity || 1000);
        case 'sell': return sellConfirm(state.quantity || 500);
        case 'redeem': return redeemConfirm(state.quantity || 500);
        case 'transfer': return transferConfirm(state.quantity || 100, state.recipient || 'Pepper Potts');
        case 'sendout': return sendoutConfirm(state.amount || 2000, state.destination);
      }
    }

    // Transfer with quantity but needs recipient
    if (state.phase === 'transfer_need_recipient') {
      // Store quantity in pending so when user provides name, we can confirm
      setPendingJourney(cid, {
        journey: 'transfer',
        quantity: state.quantity,
        timestamp: Date.now(),
      });
      return transferStart(state.quantity);
    }

    if (state.phase === 'start') {
      switch (state.journey) {
        case 'fund': return fundStart();
        case 'issue': return issueStart();
        case 'buy': return buyStart();
        case 'sell': return sellStart();
        case 'redeem': return redeemStart();
        case 'transfer': return transferStart();
        case 'sendout': return sendoutStart();
      }
    }

    return 'Welcome to Species Market! I can help you:\n\n' +
      '- **Fund** \u2014 Deposit USDC into your account\n' +
      '- **Issue** \u2014 Buy Specie from Treasury (proceeds \u2192 Assurance)\n' +
      '- **Buy** \u2014 Purchase Specie from a marketplace listing\n' +
      '- **Sell** \u2014 List your Specie for sale on the marketplace\n' +
      '- **Redeem** \u2014 Sell back to MarketMaker (Assurance buyback)\n' +
      '- **Transfer** \u2014 Send Specie to a contact\n' +
      '- **Withdraw** \u2014 Send USDC to an external wallet\n\n' +
      'What would you like to do?';
  }

  // ============================================
  // LEARN MODE
  // ============================================
  if (mode === 'develop') {
    // Journey walkthroughs — technical API flow
    if (lower.includes('walk me through') && lower.includes('buy') || (lower.includes('how does') && lower.includes('buy') && !lower.includes('buy back'))) {
      return '## Buy Journey — API Pipeline\n\n' +
        '**1. Submit** — `POST /marketplace/v1/eventRequest`\n' +
        '```json\n{ "intent": "buy", "quantity": 1000, "idempotencyKey": "buy-1000-abc" }\n```\n' +
        'Species Marketplace receives the order and assigns an `eventId`.\n\n' +
        '**2. Authenticate** — `SM` verifies identity via **Onli You** authorization\n\n' +
        '**3. Validate** — `SM` checks buyer has sufficient funding balance via `GET /va/{userRef}`\n\n' +
        '**4. Match** — `SM` finds seller listing or draws from Treasury\n' +
        '`GET /marketplace/v1/listings` → selects best match\n\n' +
        '**5. Stage Asset** — `OC` prepares Genome for transfer\n' +
        '`POST /onli-cloud/changeOwner` → moves asset to Settlement Vault\n\n' +
        '**6. Process Payment** — `MB` Cashier settles USDC\n' +
        '`POST /cashier/post-batch` → up to 5 atomic transfers\n\n' +
        '**7. Deliver to Vault** — `OC` ChangeOwner to buyer\'s Vault\n' +
        '`POST /onli-cloud/changeOwner` → asset now in buyer\'s possession\n\n' +
        '**8. Oracle Verify** — `OC` confirms possession, logs audit trail\n\n' +
        '**9. Complete** — `SM` finalizes order, emits `journey-complete` event\n\n' +
        '---\n' +
        'Switch to **Trade mode** to execute this journey live.';
    }

    if (lower.includes('walk me through') && lower.includes('sell') || (lower.includes('how does') && lower.includes('sell') && !lower.includes('sell back'))) {
      return '## Sell Journey — API Pipeline\n\n' +
        '**1. Submit** — `POST /marketplace/v1/eventRequest`\n' +
        '```json\n{ "intent": "sell", "quantity": 500, "pricePerUnit": 1000000 }\n```\n' +
        'Species Marketplace receives the listing request.\n\n' +
        '**2. Authenticate** — `SM` verifies identity via **Onli You** authorization\n\n' +
        '**3. Validate** — `SM` checks seller has sufficient Specie in Vault\n' +
        '`GET /onli-cloud/vault/{onliId}` → confirms count ≥ quantity\n\n' +
        '**4. Escrow Asset** — `OC` moves seller\'s Specie to Escrow Vault\n' +
        '`POST /onli-cloud/changeOwner` → asset held until sold or cancelled\n\n' +
        '**5. Create Listing** — `SM` adds to active marketplace listings\n' +
        '`POST /marketplace/v1/listings` → visible to buyers\n\n' +
        '**6. When Matched** — Buyer triggers buy pipeline (stages 5-9)\n' +
        'Payment flows from buyer → seller via Cashier\n\n' +
        '**7. Settlement** — `MB` Cashier atomic transfer\n' +
        '`POST /cashier/post-batch` → seller receives USDC, no fees on sell\n\n' +
        '**8. Complete** — Listing removed, balances updated\n\n' +
        '---\n' +
        'Switch to **Trade mode** to execute this journey live.';
    }

    if (lower.includes('walk me through') && lower.includes('transfer') || (lower.includes('how does') && lower.includes('transfer'))) {
      return '## Transfer Journey — API Pipeline\n\n' +
        '**1. Submit** — `POST /marketplace/v1/eventRequest`\n' +
        '```json\n{ "intent": "transfer", "quantity": 100, "recipientOnliId": "onli-user-456" }\n```\n' +
        'Species Marketplace receives the peer-to-peer transfer request.\n\n' +
        '**2. Authenticate** — `SM` verifies sender identity via **Onli You**\n\n' +
        '**3. Validate** — `SM` checks:\n' +
        '- Sender has sufficient Specie: `GET /onli-cloud/vault/{senderOnliId}`\n' +
        '- Recipient exists: `GET /onli-cloud/vault/{recipientOnliId}`\n\n' +
        '**4. Stage Asset** — `OC` prepares Genome\n' +
        '`POST /onli-cloud/changeOwner` → asset to Settlement Vault\n\n' +
        '**5. Process Payment** — `MB` No USDC movement (free transfer)\n' +
        'Cashier logs the transfer event but no funds move.\n\n' +
        '**6. Deliver to Vault** — `OC` ChangeOwner to recipient\n' +
        '`POST /onli-cloud/changeOwner` → asset in recipient\'s Vault\n\n' +
        '**7. Oracle Verify** — `OC` confirms new possession state\n\n' +
        '**8. Complete** — Both parties\' Vault balances updated\n\n' +
        '---\n' +
        'Switch to **Trade mode** to execute this journey live.';
    }

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
        '7. **Cashier (MarketSB)** \u2014 atomic settlement\n' +
        '8. **Asset Delivery** \u2014 ChangeOwner to buyer\'s Vault\n' +
        '9. **FloorManager** \u2014 Oracle verify, compose receipt\n\n' +
        'The key insight: assets are **pre-staged** before money moves, so if staging fails, no funds are charged.';
    }

    if (lower.includes('assurance') || lower.includes('backing')) {
      return 'The **100% Assurance Model** guarantees that every Specie in circulation is fully backed by USDC:\n\n' +
        '- When Specie is **issued** (bought), the purchase proceeds flow to the **Assurance Account** (VA code 500, subtype: assurance)\n' +
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
  // ASK MODE (default) — canon-based Q&A + live data
  // ============================================

  // Canon Q&A — match user question to canonical answers from onli-canon.md
  const canonAnswer = matchCanonQuestion(lower);
  if (canonAnswer) return canonAnswer;

  // Data queries (balances, transactions, etc.)
  if (lower.includes('funding balance') || lower.includes('my balance')) {
    const va = await getFundingBalance();
    const bal = va ? fmtUSDC(va.posted) : '$0.00';
    return `Your current **Funding Balance** is:\n\n**$${bal} USDC**\n\nThis is the available balance in your MarketSB Funding VA (Code 500). You can use these funds to buy Specie or transfer to contacts.`;
  }

  if (lower.includes('last 5') || lower.includes('last five') || (lower.includes('transaction') && lower.includes('last'))) {
    const ledger = await getOracleLedger(CURRENT_USER.ref, 5);
    if (ledger && ledger.length > 0) {
      const rows = ledger.map((e: any, i: number) =>
        `| ${i + 1} | ${e.type || 'unknown'} | ${e.ref || '-'} | ${fmtUSDC(Number(e.amount ?? 0))} | ${e.timestamp?.slice(0, 10) || '-'} |`
      ).join('\n');
      return `Here are your last ${ledger.length} transactions:\n\n| # | Type | Ref | Amount | Date |\n|---|---|---|---|---|\n${rows}`;
    }
    return 'No transactions found yet. Your account is new.';
  }

  if (lower.includes('last deposit') || lower.includes('when was my last deposit')) {
    const ledger = await getOracleLedger(CURRENT_USER.ref, 20);
    const deposit = ledger?.find((e: any) => e.type?.includes('deposit'));
    if (deposit) {
      return `Your last deposit:\n\n- **Amount:** $${fmtUSDC(Number((deposit as any).amount ?? 0))} USDC\n- **Status:** Credited\n- **Date:** ${(deposit as any).timestamp?.slice(0, 10) || 'unknown'}`;
    }
    return 'No deposits found for your account.';
  }

  if (lower.includes('pending deposit') || lower.includes('approval')) {
    return 'Checking your MarketSB deposit queue... No pending deposits found.';
  }

  if (lower.includes('assurance') || lower.includes('coverage')) {
    const assurance = await getAssuranceBalance();
    if (assurance) {
      const pct = assurance.coveragePercent;
      return `Your current assurance coverage:\n\n- **Assurance Account:** $${fmtUSDC(assurance.assurancePosted)}\n- **Circulation value ($1 × count):** $${fmtUSDC(assurance.circulationValuePosted)}\n- **Circulation:** ${assurance.circulationSpecieCount.toLocaleString()} SPECIES\n- **Coverage:** ${pct}%\n\nCoverage is ${pct >= 100 ? 'full' : pct >= 50 ? 'partial' : 'low'} (${pct}%). The Assurance account is backed by proceeds from all Specie issuance sales.`;
    }
    return 'Unable to fetch assurance data at this time.';
  }

  if (lower.includes('history') || lower.includes('transaction')) {
    const ledger = await getOracleLedger(CURRENT_USER.ref, 5);
    if (ledger && ledger.length > 0) {
      const items = ledger.map((e: any, i: number) =>
        `${i + 1}. **${e.type || 'unknown'}** — $${fmtUSDC(Number(e.amount ?? 0))} — ${e.timestamp?.slice(0, 10) || '-'}`
      ).join('\n');
      return `Here are your recent transactions:\n\n${items}`;
    }
    return 'No transactions found yet.';
  }

  if (lower.includes('risk') || lower.includes('alert') || lower.includes('escalate')) {
    const assurance = await getAssuranceBalance();
    const coverage = assurance?.coveragePercent ?? 0;
    return `No critical coverage shortfalls detected. Current status:\n\n- Coverage: ${coverage}% (${coverage >= 100 ? 'Healthy' : coverage >= 50 ? 'Watch' : 'Warning'})\n- Last reconciliation: Pass\n\nAll systems operating normally.`;
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

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Check if this query should render a generative UI tool card
      const toolResult = await getToolResult(lastText, mode);

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
      const response = await getResponse(lastText, mode, conversationContext, messages, chatId);

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
        const res = await fetch(`${MARKETSB_ORIGIN}/api/v1/virtual-accounts/va-funding-user-001`);
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
      'Get the user\'s Specie count from their Onli Vault (species-sim). Returns vault ID and count.',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      try {
        const vaultRes = await fetch('http://localhost:3102/marketplace/v1/vault/onli-user-001');
        const vault = await vaultRes.json();
        return { vaultId: vault.vaultId, specieCount: vault.count };
      } catch {
        return { vaultId: 'vault-onli-user-001', specieCount: 8500 };
      }
    },
  });

  const get_assurance_coverage = tool({
    description:
      'Get assurance-global posted balance, user-vault circulation (Specie count), circulation USDC value at $1 per Specie, and coverage % (assurance ÷ circulation value, capped at 100).',
    inputSchema: z.object({}),
    outputSchema: z.any(),
    execute: async () => {
      const snap = await getAssuranceBalance();
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
    inputSchema: z.object({
      limit: z.number().int().positive().optional().describe('Number of transactions to return (default 5)'),
    }),
    outputSchema: z.any(),
    execute: async ({ limit }: { limit?: number }) => {
      try {
        const res = await fetch(`${MARKETSB_ORIGIN}/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger`);
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
        const res = await fetch(`${MARKETSB_ORIGIN}/api/v1/deposits/${deposit_id || 'dep-001'}`);
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
        const res = await fetch('http://localhost:3102/marketplace/v1/stats');
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

  // ========== SIMULATION TOOLS (auto-executed, mutate sim state) ==========

  const simulate_deposit = tool({
    description:
      `Simulate a USDC deposit (fund) into the user's Funding Account via MarketSB. USDC is sent to the Incoming Account (${INCOMING_ACCOUNT}) for the benefit of account ${USER_ACCOUNT_NUMBER}. IMPORTANT: Do NOT call this tool immediately. First: (1) Ask the user how much USDC they want to deposit if not specified. (2) Show them a summary: amount, incoming account, FBO reference. (3) Ask "Shall I proceed?" (4) Only call this tool AFTER the user confirms with "yes", "confirm", or similar.`,
    inputSchema: z.object({
      amount: z.number().positive().describe('Amount in USDC dollars (e.g. 5000 for $5,000)'),
    }),
    outputSchema: z.any(),
    execute: async ({ amount }: { amount: number }) => {
      const baseUnits = Math.round(amount * 1_000_000);
      const vaId = `va-funding-${CURRENT_USER.ref}`;
      const result = await simulateDeposit(vaId, baseUnits, USER_ACCOUNT_NUMBER);
      if (!result.ok) return { success: false, error: 'Deposit failed — sim may not be running' };
      const data = result.data as Record<string, unknown>;
      return {
        success: true,
        depositId: data.depositId,
        deposited: `$${fmt(amount)}`,
        incomingAccount: INCOMING_ACCOUNT,
        forBenefitOf: USER_ACCOUNT_NUMBER,
        newBalance: data.newBalance,
        lifecycle: data.lifecycle,
      };
    },
  });

  const simulate_withdrawal = tool({
    description:
      `Simulate a USDC withdrawal from the user's Funding Account (${USER_ACCOUNT_NUMBER}) via MarketSB. IMPORTANT: Do NOT call this tool immediately. First: (1) Ask the user how much and destination address. (2) Show a summary. (3) Ask "Shall I proceed?" (4) Only call after user confirms.`,
    inputSchema: z.object({
      amount: z.number().positive().describe('Amount in USDC dollars (e.g. 2000 for $2,000)'),
      destination: z.string().optional().describe('Destination wallet address (e.g. 0x...)'),
    }),
    outputSchema: z.any(),
    execute: async ({ amount, destination }: { amount: number; destination?: string }) => {
      const baseUnits = Math.round(amount * 1_000_000);
      const vaId = `va-funding-${CURRENT_USER.ref}`;
      const result = await simulateWithdrawal(vaId, baseUnits, destination);
      if (!result.ok) return { success: false, error: 'Insufficient balance or sim not running' };
      const data = result.data as Record<string, unknown>;
      return {
        success: true,
        withdrawalId: data.withdrawalId,
        withdrawn: `$${fmt(amount)}`,
        from: USER_ACCOUNT_NUMBER,
        to: destination || 'external wallet',
        newBalance: data.newBalance,
        lifecycle: data.lifecycle,
      };
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
    simulate_deposit,
    simulate_withdrawal,
    submit_buy_order,
    submit_sell_order,
    transfer_usdc,
    transfer_specie,
  };
}

async function handleRealChat(messages: Message[], mode: string): Promise<Response> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseURL: 'https://api.anthropic.com/v1',
  });

  // Convert UI messages to ModelMessage format
  // The useChat hook may send messages with `parts` arrays instead of `content` strings
  const cleaned = messages.map((m: any) => {
    // If content is already a string, use as-is
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content };
    }
    // If content is an array (model message format), pass through
    if (Array.isArray(m.content)) {
      return { role: m.role, content: m.content };
    }
    // If it has parts (UI message format), extract text
    if (Array.isArray(m.parts)) {
      const text = m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text || '')
        .join('');
      return { role: m.role, content: text || '' };
    }
    return { role: m.role, content: '' };
  }).filter((m: any) => m.content !== '');

  console.log(`[REAL AI] Model: claude-3-haiku-20240307 | System prompt length: ${getSystemPrompt(mode).length} | Messages: ${cleaned.length} | Tools: ${Object.keys(buildTools()).length}`);

  try {
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: getSystemPrompt(mode),
      messages: cleaned as Parameters<typeof streamText>[0]['messages'],
      tools: buildTools(),
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (err: any) {
    console.error('[REAL AI] Error:', err.message || err);
    throw err;
  }
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

  // Trade mode uses the mock journey engine (stateful state machine)
  // Ask + Learn modes use real AI (Sonnet) when API key is available
  if (USE_REAL_AI && mode !== 'trade') {
    return handleRealChat(messages, mode);
  }

  return handleMockChat(messages, mode, chatId);
}
