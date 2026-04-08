# Circle USDC Testnet Integration Plan

> Status: DRAFT -- awaiting review before implementation
> Date: 2026-04-08

---

## 1. Overview

Replace the simulated deposit flow (`POST /sim/simulate-deposit`) with real Circle
Programmable Wallets on testnet so users can deposit **actual testnet USDC** into
their MarketSB funding VA.

**Scope**: Testnet only. No real money. The API key is a sandbox key.

---

## 2. Circle MCP Setup

### 2.1 Add the MCP server (user-scoped)

```bash
claude mcp add --transport http circle https://api.circle.com/v1/codegen/mcp \
  --scope user testnet faucet
```

This registers the Circle MCP as a code-generation assistant inside Claude Code.
It does **not** directly execute Circle API calls at runtime -- it helps generate
the integration code.

### 2.2 Runtime API key

Store the testnet API key as an environment variable (never commit it):

```env
# .env.local (gitignored)
CIRCLE_API_KEY=TEST_API_KEY:8e38eb3dabfd471573152a47d1fb1331:3c7992304d6886ee114b799657fab442
```

### 2.3 What the Circle MCP exposes

The MCP server at `https://api.circle.com/v1/codegen/mcp` is a **code-generation
helper** -- it generates Circle SDK code for:

- Programmable Wallets (create wallet, get balance, list wallets)
- CCTP cross-chain transfers
- Smart Contract Platform
- Faucet (testnet token requests)

For runtime operations, the app calls Circle REST APIs directly using the
`@circle-fin/w3s` SDK or plain `fetch`.

---

## 3. Circle Testnet Concepts

### 3.1 Programmable Wallets

Circle Programmable Wallets use MPC (multi-party computation) key management.
Two models:

| Model | Control | Use case |
|-------|---------|----------|
| **Developer-controlled** | Server holds key share | Backend wallets, treasury |
| **User-controlled** | User holds key share via SDK | End-user wallets |

For this integration we use **developer-controlled wallets** -- the Onli backend
creates and manages deposit wallets on behalf of users. This is simpler and
matches the existing VA model where MarketSB controls the funds.

### 3.2 Testnet Chains Supported

- Ethereum Sepolia
- Base Sepolia
- Arbitrum Sepolia
- Polygon Amoy
- Avalanche Fuji
- Sonic, Linea, Worldchain, Unichain Sepolia

**Recommendation**: Use **Base Sepolia** -- it matches the existing sim's `chain: 'base'`
field and is fast/cheap.

### 3.3 Testnet Faucet

- Web UI: `https://faucet.circle.com/` -- 20 USDC per request, per address, per
  chain, every 2 hours
- API: `POST /v1/faucet/drips` -- requires mainnet upgrade (not available on
  testnet-only keys)
- Developer Console: `console.circle.com/faucet` -- for wallets created via
  Circle platform

**User flow**: User visits Circle faucet web page, pastes their deposit address,
receives 20 testnet USDC.

### 3.4 Deposit Detection

Circle provides two mechanisms:

1. **Webhooks** (preferred): Register a URL at `console.circle.com`. Circle POSTs
   a notification when an inbound transfer is confirmed. Payload includes transfer
   ID, amount, token, destination address, and blockchain.

2. **Polling**: `GET /v1/w3s/wallets/{walletId}/balances` -- poll periodically to
   check for balance changes.

---

## 4. Deposit Flow (New)

### 4.1 Happy Path

```
User: "fund my account"
  |
  v
Synth (Trade mode):
  1. Call Circle API -> get/create deposit wallet for user
  2. Return wallet address + chain (Base Sepolia)
  3. Show faucet link: https://faucet.circle.com/
  |
  v
User: visits faucet, sends 20 USDC to deposit address
  |
  v
Circle: confirms on-chain transfer
  |
  v  (webhook or polling)
Onli Backend:
  4. Detect incoming USDC on Circle wallet
  5. Call MarketSB: credit user's funding VA with equivalent base units
  6. Write oracle entry (deposit_credited, source: circle_testnet)
  |
  v
Synth: "Your account has been funded with 20.00 USDC"
```

### 4.2 Wallet Mapping

Each MarketSB user gets ONE Circle developer-controlled wallet. The mapping is:

```
user-001 (Alex Morgan)
  -> MarketSB VA: va-funding-user-001
  -> Circle Wallet: circle-wallet-{walletSetId}-{idx}
  -> Deposit Address: 0x... (Base Sepolia)
```

Store the mapping in MarketSB sim state (new field on `VirtualAccountState`):

```typescript
interface VirtualAccountState {
  // ... existing fields
  circleWalletId?: string;      // Circle wallet UUID
  circleDepositAddress?: string; // On-chain address (replaces mock depositAddress)
}
```

---

## 5. Architecture

### 5.1 New Module: `src/lib/circle-client.ts`

A thin wrapper around Circle's REST API (or `@circle-fin/w3s` SDK):

```typescript
// Core operations needed:
createWalletSet()          // One-time setup
createWallet(walletSetId)  // Per-user, on Base Sepolia
getWalletBalance(walletId) // Check USDC balance
getWalletAddress(walletId) // Get deposit address
listTransfers(walletId)    // Check incoming transfers
```

### 5.2 New API Route: `src/app/api/circle-deposit/route.ts`

Handles the bridge between Circle and MarketSB:

```
POST /api/circle-deposit/create-address
  -> Creates Circle wallet for user (if not exists)
  -> Returns { address, chain, faucetUrl }

POST /api/circle-deposit/check
  -> Polls Circle for new deposits on user's wallet
  -> If found, credits MarketSB VA
  -> Returns { credited: boolean, amount?, newBalance? }

POST /api/circle-deposit/webhook (future)
  -> Receives Circle webhook notifications
  -> Credits MarketSB VA automatically
```

### 5.3 Deposit Detection Strategy

**Phase 1 (MVP)**: Polling

- After user says they sent funds, Synth calls `/api/circle-deposit/check`
- Polls Circle `GET /wallets/{id}/balances` to see if USDC arrived
- If balance > last known balance, credit the delta to MarketSB VA
- Simple, no webhook infrastructure needed

**Phase 2 (Later)**: Webhooks

- Register webhook URL at Circle console
- Circle POSTs on every inbound transfer
- Auto-credits MarketSB VA in real-time
- Requires publicly accessible URL (ngrok for dev, deployed URL for prod)

### 5.4 Integration Points

```
                    Circle Testnet (Base Sepolia)
                           |
                    [Circle REST API]
                           |
                  src/lib/circle-client.ts
                           |
              src/app/api/circle-deposit/route.ts
                           |
                  src/lib/sim-client.ts
                      (simulateDeposit)
                           |
              packages/marketsb-sim (VA credit)
```

---

## 6. Files to Modify

### New Files

| File | Purpose |
|------|---------|
| `src/lib/circle-client.ts` | Circle API wrapper (wallet create, balance, transfers) |
| `src/app/api/circle-deposit/route.ts` | API route bridging Circle to MarketSB |
| `.env.local` | `CIRCLE_API_KEY` env var (gitignored) |

### Modified Files

| File | Change |
|------|--------|
| `packages/marketsb-sim/src/state.ts` | Add `circleWalletId` and `circleDepositAddress` to `VirtualAccountState` |
| `packages/marketsb-sim/src/seed.ts` | Optionally seed Circle wallet IDs for dev users |
| `src/lib/sim-client.ts` | Add `createCircleDepositAddress()` and `checkCircleDeposit()` functions |
| `src/lib/system-prompts.ts` | Update Trade mode prompt to include Circle deposit instructions |
| `src/lib/journey-engine.ts` | Add `fund_circle` journey type that creates address + polls for deposit |
| `src/components/BalanceView.tsx` | Show deposit address when user requests funding |
| `src/features/trade/AccountPanel.tsx` | Add "Fund via Circle" button/action |
| `package.json` | Add `@circle-fin/w3s` dependency (or use raw fetch) |

### Unchanged (but relevant)

| File | Why |
|------|-----|
| `packages/marketsb-sim/src/handlers/deposits.ts` | Deposit lifecycle logic stays the same -- Circle just triggers it |
| `packages/marketsb-sim/src/control.ts` | `simulate-deposit` remains as fallback for testing without Circle |

---

## 7. Security Considerations

1. **Testnet only** -- The API key is a sandbox key. No real USDC can be sent or
   received. The faucet dispenses worthless testnet tokens.

2. **API key storage** -- Stored in `.env.local` (gitignored), loaded via
   `process.env.CIRCLE_API_KEY`. Never exposed to the browser.

3. **Server-side only** -- All Circle API calls happen in Next.js API routes
   (server-side). The browser never sees the Circle API key.

4. **Idempotency** -- Each deposit detection uses Circle's transfer ID as an
   idempotency key to prevent double-crediting.

5. **Amount validation** -- Only credit the exact USDC amount reported by Circle.
   Use bigint math (6 decimals, 1 USDC = 1,000,000 base units).

6. **No withdrawals yet** -- Phase 1 is deposit-only. Withdrawals (sending testnet
   USDC back out) are a future concern.

---

## 8. Implementation Phases

### Phase 1: MVP Deposit (This Sprint)

1. Create `circle-client.ts` with wallet creation + balance checking
2. Create `/api/circle-deposit` route
3. Update journey engine with `fund_circle` flow
4. Update Trade mode prompt to offer Circle funding
5. Manual polling: user says "check my deposit" and Synth polls Circle

### Phase 2: Better UX

1. Auto-polling with interval (check every 10s after address is shown)
2. Show deposit address as a copyable component in chat
3. Show QR code for deposit address
4. Webhook integration for instant detection

### Phase 3: Full Circle Integration

1. Withdrawals (send testnet USDC from MarketSB to external address)
2. Cross-chain deposits via CCTP
3. Multiple token support (EURC)

---

## 9. Circle API Calls Reference

Base URL: `https://api.circle.com/v1/w3s`

### Create Wallet Set (one-time)
```
POST /developer/walletSets
Headers: Authorization: Bearer {API_KEY}
Body: { "name": "onli-synth-testnet" }
```

### Create Wallet (per user)
```
POST /developer/wallets
Headers: Authorization: Bearer {API_KEY}
Body: {
  "walletSetId": "{walletSetId}",
  "blockchains": ["BASE-SEPOLIA"],
  "count": 1,
  "metadata": [{ "name": "userRef", "refId": "user-001" }]
}
```

### Get Wallet Balance
```
GET /wallets/{walletId}/balances
Headers: Authorization: Bearer {API_KEY}
```

### List Transfers (inbound)
```
GET /transfers?walletIds={walletId}&direction=inbound
Headers: Authorization: Bearer {API_KEY}
```

### Faucet (if available)
```
POST /faucet/drips
Headers: Authorization: Bearer {API_KEY}
Body: { "address": "0x...", "blockchain": "BASE-SEPOLIA", "usdc": true }
```

---

## 10. Open Questions

1. **Wallet model**: Developer-controlled vs user-controlled? Plan assumes
   developer-controlled for simplicity. User-controlled would require the Circle
   Web SDK on the frontend.

2. **Faucet access**: The `POST /v1/faucet/drips` API may require a mainnet-tier
   key. If so, users must use the web faucet manually. Verify with the test key.

3. **Webhook URL**: For Phase 2, we need a publicly accessible URL. Options:
   ngrok (dev), Vercel preview URL (staging), or production domain.

4. **Wallet persistence**: Since MarketSB sim is in-memory, Circle wallet IDs
   are lost on restart. Options: persist to a JSON file, or re-query Circle API
   on startup using metadata tags.

5. **Multi-chain**: Should we support deposits on multiple chains from day one,
   or lock to Base Sepolia only?

---

## 11. Dependencies

- `@circle-fin/w3s` npm package (optional -- can use raw fetch)
- Circle Developer Console account (for webhook config in Phase 2)
- Test API key (provided): `TEST_API_KEY:8e38eb3d...`
