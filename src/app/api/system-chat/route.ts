// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const USE_REAL_AI = !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Tool result interface
// ---------------------------------------------------------------------------
interface SystemToolResult {
  toolName: string;
  data: Record<string, unknown>;
  commentary: string;
}

// ---------------------------------------------------------------------------
// Mock tool matching — mirrors chat route getToolResult but works for all modes
// ---------------------------------------------------------------------------
function matchPromptToTool(prompt: string): SystemToolResult | null {
  const lower = prompt.toLowerCase();

  // Balance
  if (lower.includes('funding balance') || lower.includes('my balance') || lower.includes('current funding')) {
    return {
      toolName: 'get_funding_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Funding Account',
        vaId: 'va-funding-user-001',
        subtype: 'funding',
        balance: { posted: 12450000000, pending: 0, available: 12450000000 },
        currency: 'USDC',
        status: 'active',
      },
      commentary: 'Your funding account is active and fully available for transactions.',
    };
  }

  // Trading account balance (dark variant)
  if (lower.includes('trading') && lower.includes('balance')) {
    return {
      toolName: 'get_trading_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Trading Account',
        vaId: 'va-trading-user-001',
        subtype: 'trading',
        balance: { posted: 8500000000, pending: 0, available: 8500000000 },
        currency: 'USDC',
        status: 'active',
        specieCount: 8500,
        variant: 'dark',
      },
      commentary: 'Your trading account holds 8,500 SPECIES.',
    };
  }

  // Assurance / Buy Back Guarantee
  if (lower.includes('assurance') || lower.includes('coverage') || lower.includes('buy back') || lower.includes('guarantee')) {
    return {
      toolName: 'get_assurance_coverage',
      data: {
        _ui: 'CoverageCard',
        balance: 950000000000,
        outstanding: 1000000000000,
        coverage: 95,
      },
      commentary: 'Coverage is healthy at 95%.',
    };
  }

  // Transactions
  if (lower.includes('transaction') || lower.includes('last 5') || lower.includes('last five')) {
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

  // Market stats
  if (lower.includes('market') && (lower.includes('stat') || lower.includes('overview'))) {
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

  // Definition of Onli (canonical)
  if (lower.includes('definition') && lower.includes('onli')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'What is Onli?',
        body: 'Onli is a possession-based system for true digital ownership. It makes it possible for a digital asset to exist as a one-of-one object that is held in possession, transferred directly, and not duplicated. Traditional digital systems are based on access. Onli is based on possession.',
      },
      commentary: 'Onli is a possession-based digital asset system.',
    };
  }

  // Interesting fact (canonical)
  if (lower.includes('interesting fact') || lower.includes('fun fact')) {
    const facts = [
      'A blockchain moves records about ownership. Onli moves the actual asset. That is the fundamental difference.',
      'In Onli, actual possession means the asset resides in your Vault and is bound to your Gene. You hold the asset itself, not a claim.',
      'The core problem Onli solves is the Uniqueness-Quantification Problem: digital data is normally copyable, which makes true ownership impossible unless singularity is enforced at the data level.',
      'Onli uses tensors — multi-dimensional data structures — because they support the structural model required for singular digital containers better than flat file metaphors.',
      'Appliances are applications built on Onli Cloud APIs. They orchestrate interactions but do not own or control the asset itself. Only the Owner can authorize movement.',
      'A ledger can describe ownership claims, but it cannot create singular digital reality. That is why Onli replaces ledgers with possession.',
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'Did you know?',
        body: fact,
      },
      commentary: fact,
    };
  }

  // Genome (canonical)
  if (lower.includes('genome')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'Genomes',
        body: 'A Genome is the underlying hyper-dimensional container structure that makes an asset possible. It is arranged using tensor-based structures and designed to evolve in state rather than be duplicated. The asset is the thing you talk about philosophically and commercially. The Genome is the technical container structure beneath it.',
      },
      commentary: 'Genomes are the technical substrate beneath assets.',
    };
  }

  // Species pipeline
  if (lower.includes('pipeline') || (lower.includes('species') && lower.includes('marketplace'))) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'Species Marketplace Pipeline',
        body: 'The 9-stage pipeline: Submit, Authenticate, Validate, Match, Stage Asset, Process Payment, Deliver to Vault, Oracle Verify, Complete. Each stage is tracked in real-time. Transfer moves the asset itself — it leaves one Vault and appears in another. No duplicate remains.',
      },
      commentary: 'The pipeline has 9 stages.',
    };
  }

  // What is actual possession (canonical)
  if (lower.includes('possession') || lower.includes('custodial')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'Actual Possession vs Custodial',
        body: 'Actual possession means the asset resides in your Vault and is bound to your Gene — you hold it, control it, and can transfer or destroy it. Custodial possession means a third party holds the asset and gives you a ledger entry. Your rights depend on their honesty and solvency. Onli enables actual possession.',
      },
      commentary: 'Possession vs custodial distinction.',
    };
  }

  // What are Appliances (canonical)
  if (lower.includes('appliance')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'InfoCard',
        title: 'Appliances',
        body: 'Appliances are applications built on Onli Cloud APIs. They connect users to services, orchestrate transactions, and enforce business logic. But Appliances do not possess the asset and cannot unilaterally move it. Only the Owner, through the appropriate control path, can authorize movement.',
      },
      commentary: 'Appliances orchestrate but do not own.',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mode, prompts, welcomePrompt } = body as { mode: string; prompts: string[]; welcomePrompt?: string };

  if (!prompts || !Array.isArray(prompts)) {
    return NextResponse.json({ error: 'prompts array required' }, { status: 400 });
  }

  // TODO: When USE_REAL_AI is true, send prompts to Claude with tool definitions
  // For now, use mock tool matching for all cases

  const results: SystemToolResult[] = [];
  for (const prompt of prompts) {
    const result = matchPromptToTool(prompt);
    if (result) {
      results.push(result);
    }
  }

  return NextResponse.json({ mode, results, welcomeMessage: welcomePrompt || null });
}
