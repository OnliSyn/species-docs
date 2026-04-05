# Live Integration Guide — MarketSB + Species Marketplace

This guide explains how to connect Onli Synth to live MarketSB and Species Marketplace backends, replacing the current mock data.

## Prerequisites

- MarketSB API running (TigerBeetle-backed USDC payment engine)
- Species Marketplace API running (9-stage pipeline + Onli Cloud)
- Valid `ANTHROPIC_API_KEY` for real AI chat (optional — mock works without it)

## Overview of Mock Data Paths

All mock data lives in two places:

| File | Mock Data | Replaces |
|------|-----------|----------|
| `src/app/api/chat/route.ts` | `MOCK_STATE`, `getToolResult()` | Chat tool results |
| `src/app/api/system-chat/route.ts` | `matchPromptToTool()` | System card data |
| `src/api/marketsb.ts` | `withMockFallback()` wrappers | MarketSB API calls |
| `src/api/species.ts` | `withMockFallback()` wrappers | Species API calls |

## Step 1: Environment Variables

```env
# Required for real AI chat
ANTHROPIC_API_KEY=sk-ant-...

# MarketSB backend
MARKETSB_API_URL=https://api.marketsb.example.com
MARKETSB_API_KEY=...

# Species Marketplace
SPECIES_API_URL=https://marketplace.species.example.com
SPECIES_API_KEY=...

# Disable mock mode
NEXT_PUBLIC_MOCK_MARKETSB=false
NEXT_PUBLIC_MOCK_SPECIES=false
```

## Step 2: Wire System Cards to Live Data

The system card panel (left panel GenUISlot) is the most important integration point. It is powered by `userSystem.md` prompts processed by `/api/system-chat/route.ts`.

### IMPORTANT: Writing userSystem.md

The `src/config/userSystem.md` file controls what system cards appear in each mode. **The developer team must write this file** for their deployment. The prompts must match tool-matching logic in the system-chat route.

**Format:**
```markdown
# onLoad
- Welcome message text here

# ask
- Natural language prompt that maps to a tool result
- Another prompt

# trade
- What is my current funding balance?
- What is the buy back guarantee ratio?

# learn
- Educational prompt
```

**Each prompt must have a corresponding match** in `matchPromptToTool()` in `/api/system-chat/route.ts`.

### Replace matchPromptToTool() with Live API Calls

Current (mock):
```ts
function matchPromptToTool(prompt: string): SystemToolResult | null {
  if (lower.includes('funding balance')) {
    return {
      toolName: 'get_funding_balance',
      data: { _ui: 'BalanceCard', balance: { posted: 12450000000, ... } },
      commentary: '...',
    };
  }
}
```

Live replacement:
```ts
import { getVirtualAccount } from '@/api/marketsb';
import { getMarketplaceStats } from '@/api/species';

async function matchPromptToTool(prompt: string, token: string): Promise<SystemToolResult | null> {
  const lower = prompt.toLowerCase();

  if (lower.includes('funding balance')) {
    const va = await getVirtualAccount('va-funding-user-001', token);
    return {
      toolName: 'get_funding_balance',
      data: {
        _ui: 'BalanceCard',
        label: 'Funding Account',
        balance: { posted: va.posted_balance, pending: va.pending_balance, available: va.available_balance },
        currency: 'USDC',
        status: va.status,
      },
      commentary: `Funding balance: $${(va.posted_balance / 1_000_000).toFixed(2)}`,
    };
  }

  if (lower.includes('market stat')) {
    const stats = await getMarketplaceStats(token);
    return {
      toolName: 'get_marketplace_stats',
      data: { _ui: 'MarketStats', ...stats },
      commentary: `${stats.activeListings} active listings`,
    };
  }

  // ... other prompts
}
```

**Key change**: `matchPromptToTool` becomes `async` and receives an auth token.

### Update POST Handler

```ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mode, prompts } = body;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  const results: SystemToolResult[] = [];
  for (const prompt of prompts) {
    const result = await matchPromptToTool(prompt, token);
    if (result) results.push(result);
  }

  return NextResponse.json({ mode, results });
}
```

### Update useSystemChat to Send Auth

In `src/hooks/useSystemChat.ts`, add auth header to the fetch:

```ts
const token = useAuthStore.getState().platformToken;
const res = await fetch('/api/system-chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ mode, prompts }),
});
```

## Step 3: Wire Chat Tools to Live Data

In `src/app/api/chat/route.ts`:

### Replace getToolResult() (Ask Mode)

The `getToolResult()` function returns mock tool data. Replace each case with a live API call:

```ts
async function getToolResult(message: string, mode: string, token: string): Promise<ToolResult | null> {
  if (mode !== 'ask') return null;
  const lower = message.toLowerCase();

  if (lower.includes('funding balance')) {
    const va = await getVirtualAccount('va-funding-user-001', token);
    return {
      toolName: 'get_funding_balance',
      data: { _ui: 'BalanceCard', label: 'Funding Account', balance: va, currency: 'USDC', status: va.status },
      commentary: 'Your funding account balance.',
    };
  }
  // ... etc
}
```

### Replace MOCK_STATE (Trade Mode)

The journey state machine uses `MOCK_STATE.fundingBalance` and `MOCK_STATE.specieBalance`. Replace with live queries:

```ts
// Before each journey phase, fetch current balances
const currentBalance = await getVirtualAccount(fundingVaId, token);
const fundingBalance = currentBalance.posted_balance / 1_000_000;
```

### Replace Journey Execute Functions

The `buyExecute()`, `sellExecute()`, etc. functions mutate `MOCK_STATE`. Replace with actual API calls:

```ts
async function buyExecute(quantity: number, token: string): Promise<JourneyResponse> {
  // 1. Submit order to Species Marketplace
  const order = await submitOrder({
    type: 'buy',
    specie_amount: quantity,
    from_va: fundingVaId,
  }, token);

  // 2. Stream pipeline events via SSE
  // 3. Return PipelineCard data from real receipt
  const receipt = await getOrderReceipt(order.event_id, token);
  return { type: 'tool', toolName: 'journey_execute', data: { _ui: 'PipelineCard', ...receipt } };
}
```

## Step 4: MarketSB API Endpoints Required

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `GET /api/v1/virtual-accounts/:id` | GET | Fetch VA balance | BalanceCard, journey checks |
| `GET /api/v1/virtual-accounts?owner_ref=:ref` | GET | List user VAs | Account overview |
| `GET /api/v1/deposits/:id` | GET | Deposit status | DepositCard |
| `POST /api/v1/transfers` | POST | Execute transfer | Journey execute |
| `POST /api/v1/withdrawals` | POST | Execute withdrawal | Sendout journey |
| `GET /api/v1/oracle/ledger/:vaId` | GET | Oracle audit trail | Verification |
| `GET /api/v1/reconciliation` | GET | System reconciliation | Admin |

## Step 5: Species Marketplace API Endpoints Required

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `POST /marketplace/v1/events` | POST | Submit buy/sell/transfer order | Journey execute |
| `GET /marketplace/v1/events/:id/receipt` | GET | Order receipt + pipeline stages | PipelineCard |
| `GET /marketplace/v1/stats` | GET | Marketplace statistics | MarketStats card |
| `GET /marketplace/v1/events/:id/stream` | SSE | Real-time pipeline updates | Live stepper |
| `GET /marketplace/v1/vault/:userId` | GET | Vault specie count | VaultCard |

## Step 6: Assurance Account Data

The Buy Back Guarantee card (CoverageCard) needs:

```json
{
  "balance": 950000000000,     // Assurance Account balance (base units)
  "outstanding": 1000000000000, // Total circulation (base units)
  "coverage": 95               // percentage
}
```

**Source**: This may come from MarketSB's assurance VA or a dedicated oracle endpoint. Coordinate with the backend team on which endpoint provides this data.

**Calculation**: ratio = assurance_balance / circulation. Displayed as dollar amount (e.g., $0.95).

## Step 7: Real AI Mode

When `ANTHROPIC_API_KEY` is set, the chat endpoint uses Claude for natural language understanding. The system-chat route currently has a TODO for this:

```ts
// TODO: When USE_REAL_AI is true, send prompts to Claude with tool definitions
```

To enable: pass prompts to `streamText()` with tool definitions matching the mock tools. Claude will decide which tools to call based on the prompt.

## Checklist

- [ ] Set environment variables (API keys, URLs)
- [ ] Write `userSystem.md` for your deployment's data needs
- [ ] Replace `matchPromptToTool()` in system-chat route with live API calls
- [ ] Replace `getToolResult()` in chat route with live API calls
- [ ] Replace `MOCK_STATE` mutations with real API calls in journey functions
- [ ] Add auth token forwarding to useSystemChat fetch
- [ ] Test each mode: Ask (balance queries), Trade (full buy journey), Learn (educational)
- [ ] Verify system cards refresh every 30s with live data
- [ ] Verify amount conversions (base units / 1,000,000 = display dollars)
