# Onli Synth -- Architecture

> Single-container simulation platform: Next.js frontend + two in-memory
> financial simulators, deployed to Fly.io.

---

## 1. Deployment Topology

```
 Fly.io  (iad region, 1 shared CPU, 1 GB RAM)
+----------------------------------------------------------+
|  Docker Container (multi-stage build)                    |
|                                                          |
|  +-----------------+  +---------------+  +-------------+ |
|  | Next.js App     |  | MarketSB Sim  |  | Species Sim | |
|  | :8080           |  | :4001         |  | :4012       | |
|  +-----------------+  +---------------+  +-------------+ |
|        |                    ^                  ^          |
|        |  HTTP calls        |   HTTP calls     |          |
|        +--------------------+------------------+          |
|                                    |                     |
|                     Species calls MarketSB               |
|                     cashier for settlement                |
+----------------------------------------------------------+
         |
         | HTTPS (:8080 exposed)
         v
      Internet
```

- **Entrypoint** starts all three processes inside one container.
- `fly.toml`: auto-stop/start enabled, single region (iad).
- No external database -- all state lives in-memory Maps and resets on deploy.

---

## 2. High-Level Component Architecture

```
+------------------------------------------------------------------+
|                        Browser (React 19)                        |
|                                                                  |
|  CoverPage                                                       |
|  (p5.js sphere + GSAP parallax exit)                             |
|                                                                  |
|  DashboardLayout                                                 |
|  +-------------+  +---------------------+  +------------------+  |
|  | Left 280px  |  | Center flex-1       |  | Right 390px      |  |
|  |             |  |                     |  |                  |  |
|  | OnliAiPanel |  | ChatPanel           |  | RightPanel       |  |
|  |   |         |  |   |                 |  |  InfoTab         |  |
|  |   v         |  |   v                 |  |  CanvasTab       |  |
|  | GenUISlot   |  | useOnliChat         |  |  BlogTab         |  |
|  | (ui-reg.)   |  | (Vercel AI SDK)     |  |  (mode-aware)    |  |
|  +-------------+  +---------------------+  +------------------+  |
|                                                                  |
|  State: Zustand stores (client-side)                             |
+------------------------------------------------------------------+
```

### Panel Responsibilities

| Panel | Width | Role |
|-------|-------|------|
| **Left -- OnliAiPanel** | 280 px | System cards rendered via `GenUISlot` + `ui-registry`. Cards auto-refresh on `balance-changed` events. |
| **Center -- ChatPanel** | flex-1 | Streaming chat powered by `useOnliChat` (Vercel AI SDK `useChat`). Sends to `/api/chat` via SSE. |
| **Right -- RightPanel** | 390 px | Context panel with mode-aware tabs (Info, Canvas, Blog). Content switches based on active chat mode. |

---

## 3. Data Flow

```
 User
  |
  |  1. types message
  v
 useOnliChat (Vercel AI SDK)
  |
  |  2. POST /api/chat  (SSE stream)
  v
 /api/chat route
  |
  |  3. calls Claude with mode-specific
  |     system prompt + tool definitions
  v
 Claude (Anthropic API)
  |
  |  4. returns tool_calls
  v
 journey-engine
  |
  |  5. executes against Species Sim
  v
 Species Sim (:4012)
  |  9-stage pipeline
  |  WebSocket stage events
  |
  |  6. calls MarketSB cashier
  |     for payment settlement
  v
 MarketSB Sim (:4001)
  |  Cashier engine
  |  Oracle log
  |
  |  7. settlement complete
  v
 Post-transaction
  |  - audit runs (invariant checks)
  |  - balance-changed event fires
  |  - system cards refresh in GenUISlot
```

### Step-by-step

1. User types in `ChatPanel`.
2. `useOnliChat` streams a `POST` to `/api/chat` (SSE).
3. The route calls Claude with a **mode-specific system prompt** (Ask, Trade, or Learn) and available tool definitions.
4. Claude returns tool calls; the journey-engine executes them against the sims.
5. The journey-engine calls the **Species Sim pipeline** for order/listing operations.
6. Species Sim calls the **MarketSB cashier** for USDC payment settlement.
7. After settlement, an audit runs, a `balance-changed` event fires, and system cards refresh.

---

## 4. Sim Architecture

### 4.1 MarketSB Sim (:4001)

Simulates MarketSB-USDC banking infrastructure with TigerBeetle-style virtual accounts.

```
MarketSB Sim
+-----------------------------------------------+
|  Express Server                               |
|                                               |
|  Virtual Accounts (in-memory Map)             |
|  +------------------------------------------+ |
|  | vaId -> VirtualAccountState               | |
|  |   { vaId, posted: bigint,                 | |
|  |     pending: bigint, subtype }            | |
|  +------------------------------------------+ |
|                                               |
|  Cashier Engine                               |
|    - Integer fee calculation                  |
|    - 5-transfer batch settlement              |
|                                               |
|  Deposit/Withdrawal Lifecycle                 |
|    - Timer-based state transitions            |
|                                               |
|  FundingOracle                                |
|    - Append-only ledger log                   |
|    - Reconciliation queries                   |
|                                               |
+-----------------------------------------------+
```

**Key properties:**
- All amounts are **bigint** (1 USDC = 1,000,000 base units, 6 decimals).
- No floating-point arithmetic anywhere in the money path.
- Idempotency keys on all mutating operations.

### 4.2 Species Sim (:4012)

Simulates the Species Marketplace and Onli Cloud (Vault, ChangeOwner, AskToMove).

```
Species Sim
+-----------------------------------------------+
|  Express Server + WebSocket                   |
|                                               |
|  Orders (in-memory Map)                       |
|  +------------------------------------------+ |
|  | eventId -> OrderState                     | |
|  |   { eventId, intent, status,              | |
|  |     completedStages[] }                   | |
|  +------------------------------------------+ |
|                                               |
|  Listings (in-memory Map)                     |
|  +------------------------------------------+ |
|  | listingId -> ListingState                 | |
|  |   { sellerOnliId, remainingQuantity }     | |
|  +------------------------------------------+ |
|                                               |
|  Vaults (in-memory Map)                       |
|  +------------------------------------------+ |
|  | treasury, settlement, user vaults         | |
|  +------------------------------------------+ |
|                                               |
|  9-Stage Pipeline                             |
|    (WebSocket events per stage)               |
|                                               |
|  FIFO Matching Engine                         |
|  AskToMove (asset transfer)                   |
|                                               |
+-----------------------------------------------+
        |
        |  HTTP -> MarketSB Cashier
        v
   MarketSB Sim (:4001)
```

### 4.3 Inter-Sim Communication

```
Species Sim                        MarketSB Sim
+-----------+                      +------------+
| Pipeline  | -- HTTP cashier -->  | Cashier    |
| Stage N   |    settlement call   | Engine     |
|           | <-- 200 + receipt -- |            |
+-----------+                      +------------+
```

Species Sim owns **order lifecycle and asset custody**.
MarketSB Sim owns **money movement and ledger truth**.

---

## 5. API Surface

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Multi-mode AI chat (SSE streaming) |
| `/api/system-chat` | POST | System card data for GenUISlot |
| `/api/audit` | GET | Invariant checks (200 ok / 409 violation / 502 sim down) |
| `/api/verify-balances` | GET | Balance snapshot across both sims |
| `/api/oracle` | GET | Ledger proxy (MarketSB FundingOracle) |
| `/api/health` | GET | Health check (all 3 services) |
| `/api/seed` | POST | Reset both sims to initial state |

---

## 6. State Management

```
+-------------------+     +------------------------+
|  Client (Browser) |     |  Server (Node.js)      |
|                   |     |                        |
|  Zustand stores:  |     |  MarketSB in-memory:   |
|  - chat state     |     |  - VA Map (bigint)     |
|  - mode (Ask/     |     |  - Oracle log          |
|    Trade/Learn)   |     |                        |
|  - UI state       |     |  Species in-memory:    |
|  - balance cache  |     |  - Orders Map          |
|                   |     |  - Listings Map        |
|                   |     |  - Vaults Map          |
+-------------------+     +------------------------+
```

- Client state is ephemeral -- page refresh resets it.
- Server state persists across requests but resets on deploy/restart.
- `/api/seed` resets server state on demand.

---

## 7. Security and Guardrails

| Guardrail | Description |
|-----------|-------------|
| **Mode isolation** | Ask and Learn modes cannot execute trades. Only Trade mode exposes mutation tools to Claude. |
| **Confirmation required** | All financial mutations require explicit user confirmation via confirmation cards before execution. |
| **Post-transaction audit** | After every trade, the audit endpoint runs invariant checks with server-side logging. |
| **No real money** | Simulation disclaimer. All USDC and Specie balances are simulated. |
| **Integer arithmetic** | All money operations use bigint. No floating-point in the money path. |

---

## 8. Build and Deployment

### Dockerfile (multi-stage)

```
Stage 1: deps        -- install node_modules
Stage 2: builder     -- next build + compile sims
Stage 3: runner      -- minimal production image
```

### fly.toml

```
app region:   iad
machine:      1 shared CPU, 1 GB RAM
auto-stop:    enabled
auto-start:   enabled
exposed port: 8080 (HTTPS)
```

### Startup Sequence

```
entrypoint.sh
  |
  +-- start MarketSB Sim (:4001)   [background]
  +-- start Species Sim  (:4012)   [background]
  +-- start Next.js App  (:8080)   [foreground]
```

---

## 9. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2, React 19 |
| AI | Vercel AI SDK, Anthropic Claude |
| State (client) | Zustand |
| State (server) | In-memory Maps (bigint values) |
| Styling | Tailwind CSS |
| Animation | p5.js (cover sphere), GSAP (transitions) |
| Transport | SSE (chat), WebSocket (pipeline events), HTTP (sim APIs) |
| Deployment | Docker, Fly.io |
| Region | iad (US East) |
