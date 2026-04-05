# Onli Synth — Engineering Specification

## 1. System Overview

Onli Synth is a 3-panel AI-driven dashboard for managing USDC funding and Specie digital assets. The UI is powered by a prompt-driven generative UI system where developers define prompts in a markdown file and the system auto-generates cards without manual UI design.

### Architecture

```
userSystem.md          ->  useSystemChat hook  ->  /api/system-chat  ->  GenUISlot
(prompts per mode)        (polls every 30s)       (tools + AI)        (renders cards)
```

### Panel Layout

```
+----------------------------------------------------------+
| dark outer background (#0A0A0A)                          |
| +----------+  +-------------------+  +----------------+  |
| | Left     |  |                   |  | Right          |  |
| | 280px    |  | Center (flex-1)   |  | 340px          |  |
| |          |  |                   |  |                |  |
| | Welcome  |  | Chat Messages     |  | Content Feed   |  |
| | Onli ID  |  | (text only)       |  | (news cards)   |  |
| | Mode     |  |                   |  |                |  |
| | -------- |  |                   |  |                |  |
| | System   |  | [floating input]  |  |                |  |
| | Cards    |  |                   |  |                |  |
| +----------+  +-------------------+  +----------------+  |
+----------------------------------------------------------+
```

- **Left Panel**: OnliAiPanel (welcome card, Onli ID, mode dropdown, system gen-ui cards)
- **Center Panel**: ChatPanel (mode-specific chat with voice input)
- **Right Panel**: ContentFeed (dynamic news/content cards)
- **Outer**: Dark bg with 12px gap, white panels with 24px border-radius

## 2. Component Hierarchy

```
HomePage (page.tsx)
  DashboardLayout
    OnliAiPanel (left)
      Welcome card (title + description from userSystem.md onLoad)
      Onli ID card (user name, login status)
      Mode selector (dropdown: Ask / Trade / Learn)
      Divider
      GenUISlot (system cards from useSystemChat)
        [BalanceCard, CoverageCard, TransactionList, MarketStats, InfoCard, ...]
    ChatPanel (center)
      Welcome state OR message stream
      VoiceWave overlay (when listening)
      Floating input bar (text + mic + send)
    ContentFeed (right)
      FeaturedCard, AccentCard, DarkCard, ArticleCard
```

## 3. State Management

### Zustand Stores

| Store | Purpose | Key State |
|-------|---------|-----------|
| `useTabStore` | UI mode + panel state | chatMode, leftPanelTab, balanceView, chatLocked |
| `useAuthStore` | Authentication | platformToken, onliIdentity, speciesApiKey |
| `useGenUIStore` | (legacy) Gen-UI cards from chat | cards[], confirmations[] |

### Custom Hooks

| Hook | Purpose | Polling |
|------|---------|---------|
| `useSystemChat` | Fetch system cards from /api/system-chat | 30s interval + mode switch |
| `useOnliChat` | Vercel AI SDK chat transport | N/A (streaming) |
| `useSpeechToText` | Web Speech API mic input | N/A (event-driven) |
| `useJourneyTracker` | Detect trade journey state in chat | N/A (message scan) |

## 4. Prompt-Driven System UI

### How It Works

1. Developer writes prompts in `src/config/userSystem.md` organized by mode
2. `useSystemChat` reads prompts for the current mode
3. Sends POST to `/api/system-chat` with `{ mode, prompts }`
4. Route matches each prompt to a tool result with `_ui` field
5. `GenUISlot` renders each result as a registered gen-ui component
6. Cards refresh every 30s and on mode switch

### userSystem.md Structure

```markdown
# onLoad
- Welcome message displayed below "Welcome to Onli Ai" heading

# ask
- Prompt for Ask mode card 1
- Prompt for Ask mode card 2

# trade
- Prompt for Trade mode card 1
- Prompt for Trade mode card 2

# learn
- Prompt for Learn mode card 1
```

### Adding a New System Card

1. Add prompt line in userSystem.md under the appropriate mode
2. Add matching case in `/api/system-chat/route.ts` `matchPromptToTool()`
3. Return `{ toolName, data: { _ui: 'ComponentName', ...fields }, commentary }`
4. If new `_ui` type needed: create component in `src/components/ai/gen-ui/`, register it, import in index.ts

### Available _ui Types

| Type | Component | Data Shape |
|------|-----------|-----------|
| `BalanceCard` | balance-card.tsx | label, balance.posted, currency, status |
| `CoverageCard` | coverage-card.tsx | balance, outstanding, coverage |
| `TransactionList` | transaction-list.tsx | transactions[] |
| `MarketStats` | market-stats-card.tsx | totalOrders, completedOrders, etc. |
| `InfoCard` | info-card.tsx | title, body |
| `DepositCard` | deposit-card.tsx | depositId, amount, status, lifecycle[] |
| `PipelineCard` | pipeline-card.tsx | stages[], receipt |
| `ConfirmCard` | confirm-card.tsx | title, lines[], warning? |
| `LifecycleCard` | lifecycle-card.tsx | title, amount, steps[] |
| `VaultCard` | vault-card.tsx | userId, count |
| `ReceiptCard` | receipt-card.tsx | (unused currently) |

### Card Design Guidelines

- White background, rounded-2xl, 1px border (--color-border), subtle shadow
- No icons or emojis — text and data only
- Section headers: uppercase 10px, tracking-[0.15em], secondary color
- Hero numbers: font-extralight, 32-48px
- Secondary text: text-[var(--color-text-secondary)]
- Compact layout — minimal padding

## 5. Chat System

### Modes

| Mode | System Prompt Focus | Welcome Actions | Chat ID |
|------|-------------------|-----------------|---------|
| Ask | Balances, transactions, account status | Balance, Transactions, Deposit | chat-ask |
| Trade | Buy/sell/transfer journeys step-by-step | Fund, Buy, Sell, Transfer | chat-trade |
| Learn | Onli concepts: Genomes, Genes, Vaults, etc. | What is Onli, Genomes, Pipeline, Assurance | chat-learn |

### Journey State Machine (Trade Mode)

```
Intent Detection -> Start -> Amount/Quantity -> Confirm -> Execute
                                                  |
                                                  v
                                                Cancel
```

Journeys: fund, buy, sell, transfer, sendout (withdraw)

### Tool Results in Chat

- Tool parts use `tool-{toolName}` as part type (Vercel AI SDK behavior)
- Output with `_ui` field was previously rendered inline (now deprecated)
- Chat shows text parts only + "Processing..." indicator for tool calls
- System cards in left panel show persistent tool data

### Voice Input

- Web Speech API (SpeechRecognition) for speech-to-text
- Web Audio API (AnalyserNode) for real-time waveform visualization
- macOS optimized: permission pre-check, AudioContext resume, specific error messages
- Flow: click mic -> request permission -> listen with waveform -> auto-send on speech end

## 6. API Endpoints

### POST /api/chat (streaming)

Vercel AI SDK streaming endpoint. Handles both mock (no API key) and real AI modes.

**Request body**: `{ mode, messages[] }`
**Response**: SSE stream with text-delta, tool-input-start, tool-output-available events

### POST /api/system-chat (JSON)

Lightweight prompt-to-tool-result endpoint for system cards.

**Request**: `{ mode, prompts[], welcomePrompt? }`
**Response**: `{ mode, results: [{ toolName, data, commentary }], welcomeMessage }`

## 7. Amount Handling

- All USDC amounts stored as integers in base units (1 USDC = 1,000,000 base units)
- Display conversion: `baseUnits / 1_000_000`
- No floating-point arithmetic on monetary values
- Fees: Issuance $0.01/Specie, Liquidity 2%

## 8. Design Tokens

```css
--color-bg-outer: #0A0A0A        /* dark shell */
--color-bg-primary: #FFFFFF       /* panel background */
--color-bg-card: #FAFAFA          /* card/input background */
--color-cta-primary: #2D2D2D      /* primary button */
--color-accent-green: #C5DE8A     /* brand green */
--color-text-primary: #1A1A1A
--color-text-secondary: #6B6B6B
--color-border: #E5E5E5
--radius-panel: 24px
--radius-card: 20px
--radius-button: 12px
--font-family: 'Manrope', sans-serif
```

## 9. File Structure

```
src/
  app/
    page.tsx                    # Root page composition
    globals.css                 # Design tokens + animations
    api/
      chat/route.ts             # AI chat endpoint (streaming)
      system-chat/route.ts      # System card endpoint (JSON)
  layouts/
    DashboardLayout.tsx         # 3-panel flex layout
  components/
    OnliAiPanel.tsx             # Left panel composition
    GenUISlot.tsx               # System card renderer
    ContentFeed.tsx             # Right panel feed
    OnliAiNav.tsx               # (legacy) Nav sections
    ai/gen-ui/
      index.ts                  # Component registration imports
      balance-card.tsx           # BalanceCard
      coverage-card.tsx          # Buy Back Guarantee
      info-card.tsx              # InfoCard
      transaction-list.tsx       # TransactionList
      market-stats-card.tsx      # MarketStats
      pipeline-card.tsx          # PipelineCard
      confirm-card.tsx           # ConfirmCard
      lifecycle-card.tsx         # LifecycleCard
      deposit-card.tsx           # DepositCard
      vault-card.tsx             # VaultCard
      receipt-card.tsx           # ReceiptCard
  features/chat/
    ChatPanel.tsx               # Center panel chat UI
    hooks/
      useOnliChat.ts            # Chat transport (Vercel AI SDK)
      useSpeechToText.ts        # Voice input hook
      useTextToSpeech.ts        # (legacy, unused)
      useJourneyTracker.ts      # Journey state detection
    components/
      VoiceWave.tsx             # Voice waveform animation
      ToolResultRenderer.tsx    # (legacy, unused)
    types.ts                    # Web Speech API type augmentations
  hooks/
    useSystemChat.ts            # System card polling hook
    useGenUIBridge.ts           # (legacy, unused)
  stores/
    tab-store.ts                # UI mode + panel state
    auth-store.ts               # Authentication state
    genui-store.ts              # (legacy) Gen-UI card store
  config/
    userSystem.md               # Prompt-driven system UI config
  lib/ai/
    ui-registry.ts              # Gen-UI component registry
  api/
    marketsb.ts                 # MarketSB API client
    species.ts                  # Species API client
    onli-cloud.ts               # Onli Cloud API client
  types/
    feed.ts                     # ContentFeed card types
    marketsb.ts                 # MarketSB type definitions
packages/
  marketsb-sim/                 # MarketSB simulator
  species-sim/                  # Species simulator
```
