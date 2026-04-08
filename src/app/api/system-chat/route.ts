// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import {
  getFundingBalance,
  getVaultBalance,
  getAssuranceBalance,
  getOracleLedger,
  getAssetOracleLedger,
  getMarketplaceStats,
  getListings,
  fmtUSDC,
  CURRENT_USER,
} from '@/lib/sim-client';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Tool result interface
// ---------------------------------------------------------------------------
interface SystemToolResult {
  toolName: string;
  data: Record<string, unknown>;
  commentary: string;
}

// ---------------------------------------------------------------------------
// Live tool matching — fetches from sims, falls back to static responses
// ---------------------------------------------------------------------------
async function matchPromptToTool(prompt: string): Promise<SystemToolResult | null> {
  const lower = prompt.toLowerCase();

  // Balance
  if (lower.includes('funding balance') || lower.includes('my balance') || lower.includes('current funding')) {
    const va = await getFundingBalance();
    const posted = va?.posted ?? 0;
    return {
      toolName: 'get_funding_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Funding Account',
        vaId: va?.vaId || `va-funding-${CURRENT_USER.ref}`,
        subtype: 'funding',
        balance: { posted, pending: va?.pending ?? 0, available: posted },
        currency: 'USDC',
        status: va?.status || 'active',
      },
      commentary: `Your funding account balance is $${fmtUSDC(posted)} USDC.`,
    };
  }

  // Trading account balance (dark variant) — species tracked in vault, not VA
  if (lower.includes('trading') && lower.includes('balance')) {
    const vault = await getVaultBalance();
    const count = vault?.count ?? 0;
    return {
      toolName: 'get_trading_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Species Vault',
        vaultId: vault?.vaultId || `vault-${CURRENT_USER.onliId}`,
        subtype: 'species',
        specieCount: count,
        variant: 'dark',
      },
      commentary: `Your vault holds ${count.toLocaleString()} Specie.`,
    };
  }

  // Assurance / Buy Back Guarantee
  if (lower.includes('assurance') || lower.includes('coverage') || lower.includes('buy back') || lower.includes('guarantee')) {
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
        ? `Coverage is at ${assurance.coverage}%.`
        : 'Unable to fetch assurance data.',
    };
  }

  // Transactions — both funding and asset ledgers
  if (lower.includes('transaction') || lower.includes('last 5') || lower.includes('last five')) {
    const [fundingLedger, assetLedger] = await Promise.all([
      getOracleLedger(CURRENT_USER.ref, 5),
      getAssetOracleLedger(CURRENT_USER.onliId, 5),
    ]);
    return {
      toolName: 'get_recent_transactions',
      data: {
        _ui: 'TransactionList',
        funding: fundingLedger || [],
        asset: assetLedger || [],
      },
      commentary: 'Recent funding and asset transactions.',
    };
  }

  // Market stats
  if (lower.includes('market') && (lower.includes('stat') || lower.includes('overview'))) {
    const [stats, listings] = await Promise.all([
      getMarketplaceStats(),
      getListings(),
    ]);
    const s = (stats || {}) as Record<string, unknown>;
    // Sum remaining quantity across active listings
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
        ? `${listedSpecieCount.toLocaleString()} species listed for sale across ${s.activeListings ?? 0} listings. Treasury holds ${((s.treasuryCount as number) ?? 0).toLocaleString()}.`
        : 'Unable to fetch marketplace stats.',
    };
  }

  // Definition of Onli (canonical)
  if (lower.includes('definition') && lower.includes('onli')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'RotatingFactCard',
        facts: [
          'Onli is a possession-based system for true digital ownership. It makes it possible for a digital asset to exist as a one-of-one object that is held in possession, transferred directly, and not duplicated.',
          'Traditional digital systems are based on access. Onli is based on possession. That is the paradigm shift.',
          'Onli is for any use case where digital assets must be singular, ownable, and directly transferable — credentials, licenses, financial instruments, data, and more.',
        ],
        title: 'What is Onli?',
      },
      commentary: 'Onli is a possession-based digital asset system.',
    };
  }

  // How does Onli work
  if (lower.includes('how does onli work') || (lower.includes('how') && lower.includes('onli') && lower.includes('work'))) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'RotatingFactCard',
        facts: [
          'Onli works through four core elements: Assets (things you own), Genomes (tensor-based containers), Genes (control credentials), and Vaults (secure holding environments).',
          'When an asset transfers in Onli, it leaves one Vault and appears in another. The transfer is direct — no copy remains. No ledger substitutes for the movement.',
          'Onli binds a singular asset to a control credential and a secure holding environment, so transfer means movement of the asset itself rather than movement of a claim.',
        ],
        title: 'How It Works',
      },
      commentary: 'Onli works through assets, genomes, genes, and vaults.',
    };
  }

  // Paradigm shift
  if (lower.includes('paradigm shift') || (lower.includes('paradigm') && lower.includes('shift'))) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'RotatingFactCard',
        facts: [
          'The paradigm shift: traditional digital systems provide access. Onli provides possession. You hold the asset, not a promise.',
          'With Onli, you control it directly — not through platform permission. True scarcity is enforced at the data level, not just recorded in a ledger.',
          'A blockchain moves records about ownership. Onli moves the actual asset. That is the fundamental difference.',
        ],
        title: 'The Paradigm Shift',
      },
      commentary: 'From access to possession.',
    };
  }

  // Interesting facts (canonical) — rotating carousel
  if (lower.includes('interesting fact') || lower.includes('fun fact')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'RotatingFactCard',
        facts: [
          'A blockchain moves records about ownership. Onli moves the actual asset. That is the fundamental difference.',
          'In Onli, actual possession means the asset resides in your Vault and is bound to your Gene. You hold the asset itself, not a claim.',
          'The core problem Onli solves is the Uniqueness-Quantification Problem: digital data is normally copyable, which makes true ownership impossible unless singularity is enforced at the data level.',
          'Onli uses tensors — multi-dimensional data structures — because they support the structural model required for singular digital containers better than flat file metaphors.',
          'Appliances are applications built on Onli Cloud APIs. They orchestrate interactions but do not own or control the asset itself. Only the Owner can authorize movement.',
          'A ledger can describe ownership claims, but it cannot create singular digital reality. That is why Onli replaces ledgers with possession.',
          'A key is proof of access, not proof of ownership. In Onli, the Gene is bound to a Vault where the asset physically resides — proving control of the possession environment, not just an access point.',
          'Others tried to solve ownership at the permission layer or the ledger layer. Onli solves it at the asset layer — the solution is built into the structure of the data container itself.',
        ],
      },
      commentary: 'Rotating facts about Onli.',
    };
  }

  // How to get started
  if (lower.includes('get started') || lower.includes('how do i')) {
    return {
      toolName: 'system_info',
      data: {
        _ui: 'RotatingFactCard',
        facts: [
          'How do I check my balance? Switch to Trade mode and type or say "what\'s my balance".',
          'How do I buy Specie? In Trade mode, just say "buy" and the assistant will walk you through it.',
          'How do I fund my account? Switch to Trade mode and say "fund my account" to simulate a USDC deposit.',
          'How do I sell? In Trade mode, say "sell" and choose how many Specie to list on the marketplace.',
        ],
        title: 'How To',
      },
      commentary: 'Getting started with Specie.',
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

  const results: SystemToolResult[] = [];
  for (const prompt of prompts) {
    const result = await matchPromptToTool(prompt);
    if (result) {
      results.push(result);
    }
  }

  return NextResponse.json({ mode, results, welcomeMessage: welcomePrompt || null });
}
