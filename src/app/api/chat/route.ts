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
  getUserState,
  getFundingBalance,
  getSpeciesVABalance,
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
  cashierRedeem,
  cashierList,
  createSpeciesListing,
  fmtUSDC,
  CURRENT_USER,
  type UserState,
} from '@/lib/sim-client';

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

let SPECIES_CANON = '';
try {
  SPECIES_CANON = readFileSync(join(process.cwd(), 'src/config/species-canon.md'), 'utf-8');
} catch {
  console.warn('[chat] Could not load species-canon.md');
}

const FULL_CANON = ONLI_CANON + '\n\n---\n\n' + SPECIES_CANON;

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
- Fees: Issuance $0.01/Specie, Liquidity 1%, Listing $50 flat
- Sell = list on marketplace (listing fee). Redeem = sell back to MarketMaker (liquidity fee, assurance pays 1:1)
- Always use the tools to get real data, don't make up numbers
- For write operations (buy, sell, transfer, redeem), present a clear summary and ask for confirmation`;

  if (mode === 'ask')
    return base + `\nYou are in Ask mode — general information about Onli.

CRITICAL RESPONSE RULES:
- Keep answers SHORT — 2-4 sentences max for simple questions
- Use bullet points, not paragraphs
- No headers or markdown sections unless the user asks for detail
- If the user asks "what is X" give ONE clear sentence, then 2-3 bullet points max
- Never repeat the question back
- Never say "Great question!" or similar filler
- For balance/data queries, just show the number with minimal commentary

Use the Onli Canon below as your foundational knowledge — never contradict it. Use the baseball card analogy when simplifying.

--- ONLI CANON ---
${FULL_CANON}
--- END CANON ---`;
  if (mode === 'trade')
    return base + '\nYou are in Trade mode. Guide users through fund/buy/sell/redeem/transfer journeys step by step. Ask for the amount, show fee breakdowns, and confirm before executing. Sell = list for sale on marketplace ($50 listing fee, species escrowed). Redeem = sell back to MarketMaker (1% liquidity fee, assurance pays 1:1).';
  if (mode === 'learn')
    return base + `\nYou are in Learn mode — developer-focused and technical.

RESPONSE RULES:
- Keep answers focused and practical — 3-5 bullet points preferred over long paragraphs
- Reference specific API endpoints (POST /eventRequest, POST /cashier/post-batch, etc.)
- Show data flow, not theory
- When explaining pipeline stages, list them concisely
- Use code-like formatting for endpoint paths and field names

Help developers understand the Onli architecture, APIs, and how to build Appliances. Explain the Species pipeline, Cashier settlement, Vault operations, ChangeOwner, AskToMove, and the dual-sim architecture (MarketSB for funding, Species-sim for assets).

--- ONLI CANON ---
${FULL_CANON}
--- END CANON ---`;
  return base;
}

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
    answer: 'Onli can be used anywhere true digital ownership matters:\n\n- Digital credentials and licenses\n- Legal documents, titles, and deeds\n- Private identity data\n- Financial instruments\n- Branded currencies or commodities\n- AI-native data structures\n- Proprietary models and intellectual property\n- Controlled data exchange\n\n**The general rule:** if the digital thing needs to be owned, transferred, restricted, verified, or held in possession — Onli is the right model.',
  },
  {
    keywords: ['what are appliances', 'appliances'],
    answer: '**Appliances** are applications built on Onli Cloud APIs.\n\nThey are the interface layer that developers create for real-world workflows. Appliances can:\n- Connect users to services\n- Orchestrate transactions\n- Enforce business logic\n- Request issuance, transfer, or settlement\n\nBut Appliances **do not possess the asset** and cannot unilaterally move it. Only the Owner, through the appropriate control path, can authorize movement.\n\n> Appliances orchestrate interactions but do not own or control the asset itself.',
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
// Live user state — fetched from sims, with fallback defaults
// ---------------------------------------------------------------------------
const FALLBACK_STATE: UserState = {
  fundingBalance: 0,
  specieCount: 0,
  fundingVA: null,
  vaultBalance: null,
};

async function getLiveState(): Promise<UserState> {
  try {
    return await getUserState();
  } catch {
    return FALLBACK_STATE;
  }
}

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
  if (lastUserLower.includes('issue') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('treasury'))) {
    return { phase: 'start', journey: 'issue' };
  }
  if (lastUserLower.includes('buy') && (lastUserLower.includes('specie') || lastUserLower.includes('species') || lastUserLower.includes('market'))) {
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
const INCOMING_ACCOUNT = '0x7F4e...2A9d'; // System incoming USDC address
const USER_ACCOUNT_NUMBER = 'MSB-VA-500-0x8F3a...7B2c'; // Alex's FBO reference

function fundStart(): string {
  return `To fund your account, send USDC to:\n\n` +
    `**Incoming Account:** \`${INCOMING_ACCOUNT}\`\n` +
    `**Memo / Notes:** For Benefit Of \`${USER_ACCOUNT_NUMBER}\`\n\n` +
    `**This is a simulation — do NOT send real USDC.** We will simulate the deposit for testing purposes.\n\n` +
    `How much USDC would you like to simulate depositing?`;
}

function fundConfirm(amount: number): JourneyResponse {
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

async function fundExecute(amount: number): Promise<JourneyResponse> {
  // Simulate deposit through MarketSB lifecycle
  const baseUnits = Math.round(amount * 1_000_000);
  const vaId = `va-funding-${CURRENT_USER.ref}`;
  await simulateDeposit(vaId, baseUnits, USER_ACCOUNT_NUMBER);

  // Fetch updated balance
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

function buyStart(): string {
  return 'How many Specie would you like to buy?\n\nEach Specie is priced at **$1.00 USDC**. Just tell me the quantity.';
}

async function buyConfirm(quantity: number): Promise<JourneyResponse> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const state = await getLiveState();

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
      from: `Funding Account ($${fmt(state.fundingBalance)})`,
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

async function buyExecute(quantity: number): Promise<JourneyResponse> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const fees = issuanceFee + liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  // Execute via MarketSB cashier (handles funding VA debit + species VA credit + fees)
  const USDC = 1_000_000;
  const cashierResult = await postCashierBatch({
    eventId,
    matchId: `match-${eventId}`,
    intent: 'buy',
    quantity,
    buyerVaId: `va-funding-${CURRENT_USER.ref}`,
    unitPrice: USDC,
    fees: { issuance: true, liquidity: true },
  });
  console.log(`[BUY] cashier result: ok=${cashierResult.ok}, quantity=${quantity}`);

  // Only adjust vaults if cashier succeeded (keep USDC + species in sync)
  if (cashierResult.ok) {
    await Promise.all([
      adjustVault(CURRENT_USER.onliId, quantity, 'buy'),
      adjustVault('treasury', -quantity, 'buy-decrement'),
    ]);
  }

  // Fetch updated balances
  const state = await getLiveState();
  const newFunding = state.fundingBalance;
  const newSpecies = state.specieCount;

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
      balances: { funding: `$${fmt(newFunding)}`, species: `${newSpecies.toLocaleString()} SPECIES` },
    },
    followUp: `Order complete! You bought ${quantity.toLocaleString()} SPECIES for $${fmt(total)}.`,
  };
}

// ---------------------------------------------------------------------------
// ISSUE journey — buy from treasury, proceeds → assurance
// ---------------------------------------------------------------------------

function issueStart(): string {
  return 'How many Specie would you like to issue from the Treasury?\n\nEach Specie costs **$1.00 USDC** plus fees (Issuance: $0.01/Specie, Liquidity: 2%).\n\n100% of the asset cost goes to the **Assurance Account** to back the buy-back guarantee.';
}

async function issueConfirm(quantity: number): Promise<JourneyResponse> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `ISSUE ${quantity.toLocaleString()} SPECIES FROM TREASURY`,
      lines: [
        { label: 'Asset Cost', value: `$${fmt(cost)}` },
        { label: 'Issuance Fee ($0.01/Specie)', value: `$${fmt(issuanceFee)}` },
        { label: 'Liquidity Fee (2%)', value: `$${fmt(liquidityFee)}` },
        { label: 'Total Debit', value: `$${fmt(total)}`, bold: true },
        { label: '', value: '' },
        { label: 'Proceeds to Assurance', value: `$${fmt(cost)}` },
        { label: 'Fees to Operating', value: `$${fmt(issuanceFee + liquidityFee)}` },
      ],
      from: `Funding Account ($${fmt(state.fundingBalance)})`,
      warning: 'This issues new Specie from the Treasury. The full asset cost flows to the Assurance Account.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

async function issueExecute(quantity: number): Promise<JourneyResponse> {
  const cost = quantity * 1.00;
  const issuanceFee = quantity * 0.01;
  const liquidityFee = cost * 0.02;
  const total = cost + issuanceFee + liquidityFee;
  const fees = issuanceFee + liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  const batchId = `tb-batch-${crypto.randomUUID().slice(0, 6)}`;

  // Execute via MarketSB cashier (same as buy — treasury issuance)
  const USDC = 1_000_000;
  const cashierResult = await postCashierBatch({
    eventId,
    matchId: `match-${eventId}`,
    intent: 'buy',
    quantity,
    buyerVaId: `va-funding-${CURRENT_USER.ref}`,
    unitPrice: USDC,
    fees: { issuance: true, liquidity: true },
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
// SELL journey — list species for sale on marketplace (flat listing fee)
// ---------------------------------------------------------------------------

async function sellStart(): Promise<string> {
  const state = await getLiveState();
  return `How many Specie would you like to list for sale?\n\nYou currently hold **${state.specieCount.toLocaleString()} Specie** in your Vault.\n\nA **$50.00 listing fee** is charged per listing. Your species will be held in escrow until a buyer purchases them.`;
}

async function sellConfirm(quantity: number): Promise<JourneyResponse> {
  const listingFee = 50.00;
  const listingValue = quantity * 1.00;
  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_confirm',
    data: {
      _ui: 'ConfirmCard',
      title: `LIST ${quantity.toLocaleString()} SPECIES FOR SALE`,
      lines: [
        { label: 'Quantity', value: `${quantity.toLocaleString()} SPECIES` },
        { label: 'Listing Price', value: `$${fmt(listingValue)} ($1.00/Specie)` },
        { label: 'Listing Fee', value: `$${fmt(listingFee)}`, bold: true },
      ],
      from: `Funding Account ($${fmt(state.fundingBalance)})`,
      warning: 'Species will be moved to escrow until sold. Listing fee is non-refundable.',
    },
    followUp: 'Type **confirm** to proceed or **cancel** to abort.',
  };
}

async function sellExecute(quantity: number): Promise<JourneyResponse> {
  const listingFee = 50.00;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;

  // 1. Charge listing fee via cashier spec
  const listResult = await cashierList({
    sellerRef: CURRENT_USER.ref,
    metadata: { quantity, eventId },
    idempotencyKey: `list-${eventId}`,
  });
  console.log(`[SELL/LIST] cashier list result: ok=${listResult.ok}`);

  // 2. Create listing in Species sim (moves species to escrow)
  if (listResult.ok) {
    await createSpeciesListing({
      sellerOnliId: CURRENT_USER.onliId,
      quantity,
    });
  }

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `LIST ${quantity.toLocaleString()} SPECIES`,
      eventId,
      batchId: null,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Listing fee charged', system: 'MB', status: 'done' },
        { label: 'Species escrowed', system: 'OC', status: 'done' },
        { label: 'Listing active', system: 'SM', status: 'done' },
      ],
      receipt: { quantity, cost: `$${fmt(quantity * 1.00)}`, fees: `$${fmt(listingFee)}`, total: `$${fmt(listingFee)}` },
      balances: { funding: `$${fmt(state.fundingBalance)}`, species: `${state.specieCount.toLocaleString()} SPECIES` },
    },
    followUp: `Listing created! ${quantity.toLocaleString()} SPECIES listed for sale at $1.00/Specie. Listing fee: $${fmt(listingFee)}.`,
  };
}

// ---------------------------------------------------------------------------
// REDEEM journey — sell back to MarketMaker (assurance buyback)
// ---------------------------------------------------------------------------

async function redeemStart(): Promise<string> {
  const state = await getLiveState();
  return `How many Specie would you like to redeem?\n\nYou currently hold **${state.specieCount.toLocaleString()} Specie** in your Vault.\n\nThe MarketMaker will buy back at **$1.00/Specie** from the Assurance Account. A **1% liquidity fee** is charged.`;
}

async function redeemConfirm(quantity: number): Promise<JourneyResponse> {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.01; // 1% (matches cashier default 100 bps)
  const net = gross - liquidityFee;
  const state = await getLiveState();

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

async function redeemExecute(quantity: number): Promise<JourneyResponse> {
  const gross = quantity * 1.00;
  const liquidityFee = gross * 0.01;
  const net = gross - liquidityFee;
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;

  // 1. Execute redeem via cashier spec (fee + assurance payout)
  const redeemResult = await cashierRedeem({
    sellerRef: CURRENT_USER.ref,
    redeemAmount: gross.toFixed(2),
    metadata: { quantity, eventId },
    idempotencyKey: `redeem-${eventId}`,
  });
  console.log(`[REDEEM] cashier result: ok=${redeemResult.ok}`);

  // 2. Adjust Species vaults (user → treasury) only if cashier succeeded
  if (redeemResult.ok) {
    await Promise.all([
      adjustVault(CURRENT_USER.onliId, -quantity, 'redeem'),
      adjustVault('treasury', quantity, 'redeem-return'),
    ]);
  }

  const state = await getLiveState();

  return {
    type: 'tool',
    toolName: 'journey_execute',
    data: {
      _ui: 'PipelineCard',
      title: `REDEEM ${quantity.toLocaleString()} SPECIES`,
      eventId,
      batchId: null,
      stages: [
        { label: 'Submitted', system: 'SM', status: 'done' },
        { label: 'Validated', system: 'SM', status: 'done' },
        { label: 'Liquidity fee charged', system: 'MB', status: 'done' },
        { label: 'Assurance payout', system: 'MB', status: 'done' },
        { label: 'Species returned to MarketMaker', system: 'OC', status: 'done' },
        { label: 'Oracle verified', system: 'SM', status: 'done' },
        { label: 'Complete', system: 'SM', status: 'done' },
      ],
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

async function transferExecute(quantity: number, recipient?: string): Promise<JourneyResponse> {
  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;

  // Resolve recipient onliId
  const contacts: Record<string, string> = {
    'pepper': 'onli-user-456', 'pepper potts': 'onli-user-456',
    'tony': 'onli-user-789', 'tony stark': 'onli-user-789',
    'happy': 'onli-user-012', 'happy hogan': 'onli-user-012',
  };
  const recipientOnliId = contacts[(recipient || '').toLowerCase()] || 'onli-user-456';

  // Adjust Species vaults (sender → recipient)
  await Promise.all([
    adjustVault(CURRENT_USER.onliId, -quantity, `transfer-to-${recipientOnliId}`),
    adjustVault(recipientOnliId, quantity, `transfer-from-${CURRENT_USER.onliId}`),
  ]);

  const state = await getLiveState();
  const newSpecies = state.specieCount;

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
      balances: { species: `${newSpecies.toLocaleString()} SPECIES` },
    },
    followUp: `Transfer complete! ${quantity.toLocaleString()} SPECIES sent.`,
  };
}

function sendoutStart(): string {
  return `To withdraw, USDC is debited from your Funding Account and sent from the Outgoing Account to your destination address.\n\n` +
    `How much USDC and where? (e.g. "2000 to 0x9876...fedc")`;
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

async function sendoutExecute(amount: number): Promise<JourneyResponse> {
  // Simulate withdrawal through MarketSB lifecycle
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
        balance: assurance?.balance ?? 0,
        outstanding: assurance?.outstanding ?? 0,
        coverage: assurance?.coverage ?? 0,
      },
      commentary: assurance
        ? `Coverage is at ${assurance.coverage}%. The Assurance account is backed by proceeds from all Specie issuance sales.`
        : 'Unable to fetch assurance data.',
    };
  }

  if (lower.includes('species balance') || lower.includes('asset balance') || lower.includes('specie count')) {
    const [specVA, vault] = await Promise.all([
      getSpeciesVABalance(),
      getVaultBalance(),
    ]);
    const vaultCount = vault?.count ?? 0;
    return {
      toolName: 'get_asset_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Species Account',
        vaId: specVA?.vaId || 'va-species-user-001',
        subtype: 'species',
        balance: { posted: specVA?.posted ?? 0, pending: specVA?.pending ?? 0, available: specVA?.posted ?? 0 },
        currency: 'USDC',
        status: specVA?.status || 'active',
        vaultCount,
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
      return `Your current assurance coverage:\n\n- **Assurance Balance:** $${fmtUSDC(assurance.balance)}\n- **Total Outstanding:** $${fmtUSDC(assurance.outstanding)}\n- **Coverage:** ${assurance.coverage}%\n\nCoverage is ${assurance.coverage >= 50 ? 'healthy' : 'low'} (${assurance.coverage}%). The Assurance account is backed by proceeds from all Specie issuance sales.`;
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
    const coverage = assurance?.coverage ?? 0;
    return `No critical coverage shortfalls detected. Current status:\n\n- Coverage: ${coverage}% (${coverage >= 50 ? 'Healthy' : 'Warning'})\n- Last reconciliation: Pass\n\nAll systems operating normally.`;
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
          fetch('http://localhost:4012/marketplace/v1/vault/onli-user-001'),
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
        const res = await fetch('http://localhost:4012/marketplace/v1/stats');
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
      `Simulate a USDC deposit (fund) into the user's Funding Account via MarketSB. USDC is sent to the Incoming Account (${INCOMING_ACCOUNT}) for the benefit of account ${USER_ACCOUNT_NUMBER}. The deposit flows through: incoming wallet → FBO match → compliance → credit to Funding VA. Use this when the user says "fund", "deposit", "simulate deposit", or wants to add USDC. Ask the user how much if they haven't specified an amount.`,
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
      `Simulate a USDC withdrawal from the user's Funding Account (${USER_ACCOUNT_NUMBER}) via MarketSB. Debits the Funding VA, routes through compliance, sends from the Outgoing Account. Use when the user says "withdraw", "send out", or "simulate withdrawal". Ask the user how much and where if not specified.`,
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

  if (USE_REAL_AI) {
    return handleRealChat(messages, mode);
  }

  return handleMockChat(messages, mode, chatId);
}
