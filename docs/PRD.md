# Product Requirements Document -- Onli Synth

**Version:** 2.0
**Date:** April 7, 2026
**Status:** Living document — reflects current implementation

---

## 1. Product Vision

Onli Synth is an AI-native dashboard for the Onli platform. Users interact with a conversational AI assistant (Synth) across three distinct modes -- Ask, Trade, and Develop -- to query account state, execute financial transactions, and learn the underlying API architecture. The UI is a three-panel layout with mode-aware content that adapts every panel to the active context.

### Target Users

| User Type | Description |
|-----------|-------------|
| **Owners** | Onli platform participants who hold USDC funding and Specie digital assets |
| **Developers** | Teams building on Onli who need to understand APIs, pipelines, and architecture |

---

## 2. Architecture Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2 + Turbopack | App Router, React 19 |
| AI Chat | Vercel AI SDK 6 (`ai` package) | `useChat` hook + `streamText` server route, SSE streaming |
| Animations | GSAP 3.14 | Cover page transition, card entrance, counter animations |
| State | Zustand 5 | `useTabStore` — mode, panel tabs, chat lock, dev journey |
| Sim: Funding | MarketSB sim (:4001) | USDC balances, deposits, withdrawals, cashier settlement |
| Sim: Assets | Species sim (:4012) | Buy/sell matching, vaults, 9-stage pipeline, Oracle |
| Tests | Vitest 4.1 | 73 integration tests across 15 test files |
| Deployment | Fly.io | Production hosting |

### System Topology

```
                     Synth (AI Orchestrator :3000)
                    /              |              \
              MarketSB          Species         Onli Cloud
              (:4001)          Marketplace       (sim :4012)
                |                (:4012)            |
          USDC balances      Buy/sell/match     Vaults, Gene auth,
          Cashier batches    9-stage pipeline   ChangeOwner
          Deposits/withdrawals  Listings        Asset delivery
```

**Authorization:** Onli You (simulated -- indicated on confirm/pipeline cards but not enforced in playground).

---

## 3. Current State -- What Exists and Works

### 3.1 Three-Panel Layout

| Panel | Component | Content |
|-------|-----------|---------|
| **Panel 1 (Left)** | `OnliAiPanel` | User image card, mode selector pill switch, system gen-ui cards, people gallery (Ask only) |
| **Panel 2 (Center)** | `ChatPanel` | AI chat with hello animation, mode-specific welcome, floating glassmorphic input bar |
| **Panel 3 (Right)** | `RightPanel` | Tabbed: Info / Canvas / Blog -- all mode-aware |

### 3.2 Three Modes

| Mode | Purpose | Panel 1 | Panel 2 (Chat) | Panel 3 Info | Panel 3 Canvas | Panel 3 Blog |
|------|---------|---------|-----------------|--------------|----------------|--------------|
| **Ask** | Read-only queries | System cards + People gallery | Balance/state queries | Onli info cards + video + Onli You ad | Guided walkthrough (tap-to-ask questions) | Deep dive articles (5 posts) |
| **Trade** | Journey execution | System cards (no People) | Multi-step journeys with confirm/pipeline cards | Marketplace info + assurance + trade video | Code reference (Buy/List/Redeem/Transfer) | Marketplace news (3 posts) |
| **Develop** | API learning | System cards (no People) | Technical walkthroughs, bridge to Canvas | Developer concepts + Onli You ad + architecture video | API reference synced to chat journey | Whitepapers (4 papers) |

### 3.3 Cover Page

- Full-screen overlay with p5.js sphere animation
- GSAP parallax exit transition (scale down 0.85 + fade, inner counter-scale 1.3)
- Shows on every visit; dashboard renders underneath
- `MobileGate` component blocks access on small screens

### 3.4 Hello Animation

- Apple TV screensaver-style greeting with SVG ellipses
- Appears in Ask mode on fresh chat (no messages)
- Slower animation pace; calls `onComplete` when finished to show welcome state

### 3.5 Chat Interface

- **Floating glassmorphic input bar**: `bg-white/70 backdrop-blur-xl`, rounded-full, box-shadow with inset highlight
- **Mode dropdown**: Inline in input bar, opens upward, selects Ask/Trade/Develop
- **Voice input**: Web Speech API with real-time waveform visualization (`VoiceWave`), auto-sends on transcript finalize
- **Chat lock**: Input disabled during active journey execution
- **New Chat button**: Clears messages, appears when messages exist
- **Mode-specific placeholders**: Different input placeholder per mode
- **Inline gen-ui**: ConfirmCard, PipelineCard, LifecycleCard render inside chat bubbles

### 3.6 User Image Card (Panel 1)

- Glassmorphic double-border card with portrait photo
- `Alex Morgan` hardcoded user with "Logged in" status + green dot
- Gradient overlays for text legibility

### 3.7 People Gallery (Ask Mode Only)

- Horizontal scrollable row pinned to bottom of Panel 1
- Three contacts: Pepper Potts, Tony Stark, Happy Hogan
- Online status indicator (green dot)

### 3.8 Video Cards

- Dark card variant with Vimeo thumbnail (via vumbnail.com)
- Fullscreen overlay with portal (`createPortal`), Escape to close
- URL-to-embed conversion for Vimeo
- Three videos: Ask (Onli Symplr), Trade (Species Trading), Develop (Onli Architecture)

### 3.9 Onli You Ad Card

- Image background card with gradient overlay
- Links to https://www.onli.you
- Appears in Ask and Develop Info tabs

### 3.10 Trade Journeys

Seven journeys supported by the journey engine:

| Journey | Trigger Keywords | Fee | USDC Effect | Specie Effect |
|---------|-----------------|-----|-------------|---------------|
| **Fund** | "fund", "deposit" | None | +amount | None |
| **Buy** | "buy" | None (free) | -cost | +quantity |
| **Sell** | "sell", "list" | None (free) | None (until matched) | Escrowed |
| **Transfer** | "transfer" | None (free) | None | Sender -qty, Receiver +qty |
| **Redeem** | "redeem", "buyback" | 1% liquidity fee | +gross minus 1% fee | -quantity (to treasury) |
| **SendOut** | "withdraw" | None | -amount | None |
| **Issue** | "issue" + "treasury" | $0.05/Specie issuance fee | -cost | +quantity (from treasury) |

**Journey state machine:** Intent -> Start -> Amount/Quantity -> Confirm -> Execute/Cancel

**Confirmation flow:**
1. Journey engine detects intent from conversation history
2. Presents ConfirmCard with line-item breakdown
3. User types "confirm" or "cancel"
4. On confirm: executes via sim APIs, returns PipelineCard/LifecycleCard
5. Onli You authorization badge shown on confirm and pipeline cards

### 3.11 Generative UI Components

| Component | Purpose |
|-----------|---------|
| `ConfirmCard` | Pre-execution breakdown with line items, fees, totals |
| `PipelineCard` | 9-stage pipeline progression after execution |
| `LifecycleCard` | Asset lifecycle state display |
| `BalanceCard` | USDC and/or Specie balance display |
| `GenUISlot` | Auto-renders registered components from tool results |

### 3.12 Develop Mode Bridge

- When user clicks a journey preset in Develop welcome (e.g., "How does a Buy work?"):
  - Chat sends the question and AI responds with technical walkthrough
  - Right panel automatically switches to Canvas tab
  - `devJourney` store value syncs Canvas to show matching API code
- Canvas shows empty state ("Ask about a journey in chat") until a journey is selected

### 3.13 Canvas Tab Content

| Mode | Canvas Content |
|------|---------------|
| **Ask** | Guided walkthrough: 16 tap-to-ask questions in 3 sections (Getting Started, How It Works, Go Deeper) |
| **Trade** | Code reference: Buy, List, Redeem, Transfer -- dark terminal-style code blocks with syntax highlighting and copy button |
| **Develop** | API reference synced to chat journey selection; same code examples as Trade but triggered by `devJourney` store |

### 3.14 Blog Tab Content

| Mode | Label | Content |
|------|-------|---------|
| **Ask** | "Blog" | 5 long-form articles about Onli concepts with hero image, article detail view with push transition |
| **Trade** | "News" | 3 marketplace news posts (settlement, assurance, fees) |
| **Develop** | "Whitepapers" | 4 academic-style papers (UQP, Genome Architecture, Possession Model, Physics of Finance) |

### 3.15 State Management (`useTabStore`)

| State | Type | Default | Behavior |
|-------|------|---------|----------|
| `chatMode` | `'ask' \| 'trade' \| 'develop'` | `'ask'` | Resets leftPanelTab, rightPanelTab, fundWizardStep on change |
| `rightPanelTab` | `'info' \| 'canvas' \| 'blog'` | `'info'` | Auto-switches to `'canvas'` when entering Develop mode |
| `chatLocked` | `boolean` | `false` | Disables input during journey execution |
| `devJourney` | `'buy' \| 'sell' \| 'transfer' \| 'redeem' \| 'fund' \| null` | `null` | Syncs Develop Canvas to selected journey |
| `balanceView` | `'funding' \| 'asset'` | `'funding'` | Toggle for balance display |

---

## 4. Fee Structure

| Operation | Fee | Calculation |
|-----------|-----|-------------|
| Buy | Free | $0.00 |
| Sell / List | Free | $0.00 |
| Transfer | Free | $0.00 |
| Fund (Deposit) | Free | $0.00 |
| SendOut (Withdraw) | Free | $0.00 |
| Redeem | 1% liquidity fee | `quantity * $1.00 * 0.01` |
| Issue (from treasury) | $0.05 per Specie issuance fee | `quantity * $0.05` |

**Amount precision:** All USDC amounts in integer base units (1 USDC = 1,000,000 units). No floating-point arithmetic on monetary values.

---

## 5. Known Issues and Bugs

| ID | Severity | Description | Impact |
|----|----------|-------------|--------|
| BUG-001 | High | `buyFromMarket` credits Specie to vault before cashier payment check completes | Atomicity gap -- user could receive Specie without payment succeeding |
| BUG-002 | Medium | `adjustVault` allows negative balances (no validation in sim) | Vault can go below zero in edge cases |
| BUG-003 | Low | Trade/Develop mode Vimeo videos use placeholder IDs (744624297, 801385676) | Videos may not be the intended content; user has not provided real links |
| BUG-004 | Low | "Send" keyword maps to sendout (withdraw), not transfer | Users saying "send species to Pepper" get withdrawal flow instead of transfer |
| BUG-005 | Low | System cards poll every 5s; fetch failures occur when sims restart | Console errors during sim downtime, cards show stale data |

---

## 6. Feature Gaps -- What Can Be Better

| Area | Gap | Notes |
|------|-----|-------|
| Authentication | Onli You is indicated but not enforced | No real auth flow; user is always "Alex Morgan" |
| Real-time | No WebSocket real-time updates | System cards poll via fetch; pipeline stages not streamed |
| Responsive | No mobile responsive layout | `MobileGate` blocks small screens entirely |
| Blog images | Unsplash placeholder paths (`/images/blog-abstract-*.jpg`) | Static local images, not real content |
| Develop Canvas | Only shows code when user clicks a preset or chat triggers `devJourney` | Not reactive to free-form chat about journeys |
| Error handling | No error boundary UI for failed API calls | Fetch failures silently caught, no user-facing feedback |
| Loading states | No loading skeletons for slow responses | Cards appear abruptly; no intermediate states |
| Panel 3 overflow | Bottom content can get clipped on smaller screens | Especially in Blog tab with long article lists |
| Cover page | Mode display shows static "Ask/Trade/Develop" text | Not interactive; no mode preview on cover |
| People contacts | Hardcoded 3 contacts | Not fetched from API; cannot add/remove |
| Chat history | Per-mode history not persisted across page reloads | Zustand state is in-memory only |

---

## 7. Test Coverage Summary

**Framework:** Vitest 4.1
**Total tests:** 73 across 15 test files, covering all 3 contexts
**All tests passing**

### Test Files by Category

#### Mode Safety (39 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `mode-integrity.test.ts` | 4 | MODE-001 through MODE-004: mode switch resets state, prevents cross-mode actions |
| `mode-leakage.test.ts` | 6 | MODE-005 through MODE-010: trade actions blocked from Ask/Develop |
| `unauthorized-execution.test.ts` | 8 | Confirm required before every mutation; no silent execution |
| `journey-routing.test.ts` | 12 | Intent classification: correct journey maps from natural language |
| `develop-safety.test.ts` | 9 | DEV-001 through DEV-009: Develop mode explains but never executes |

#### Balance / Journey Tests (16 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `buy.test.ts` | 3 | TRD-BUY-001, fee verification, cancel |
| `sell.test.ts` | 2 | TRD-SELL-001, insufficient Specie |
| `fund.test.ts` | 4 | TRD-FUND-001, amount validation, idempotency |
| `redeem.test.ts` | 3 | TRD-RED-001, fee calculation (1%), insufficient Specie |
| `transfer.test.ts` | 1 | TRD-XFER-001: successful peer-to-peer |
| `sendout.test.ts` | 2 | TRD-SEND-001, insufficient USDC |
| `insufficient-funds.test.ts` | 3 | Cross-journey insufficient balance rejection |

#### Ask Mode (8 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `ask-queries.test.ts` | 8 | ASK-001 through ASK-008: balance queries, listings, stats, history, safety redirects |

#### Cross-System (8 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `reconciliation.test.ts` | 4 | REC-001 through REC-004: post-mutation balance consistency |
| `idempotency.test.ts` | 4 | IDEMP-001 through IDEMP-004: duplicate request handling |

### QA Plan Reference

Full test strategy documented in `docs/QA-PLAN.md` including:
- Three testing contexts (Ask, Trade, Develop)
- Layer 1: Mode integrity tests
- Layer 2: Per-mode test suites
- Cross-system control boundary tests (CTRL-001 through CTRL-008)
- Reconciliation tests (REC-001 through REC-007)
- Intent classification matrix
- Highest-risk failure ranking

---

## 8. Design System

| Token | Value |
|-------|-------|
| Font | Manrope (Google Fonts) |
| Background | `#0A0A0A` (outer dark), white panels |
| Accent green | `#C5DE8A` |
| Panel radius | 24px |
| Card radius | 20px (`--radius-card`) |
| Button radius | 12px (`--radius-button`) |
| Input radius | 10px (`--radius-input`) |
| Glassmorphism | `bg-white/70 backdrop-blur-xl` with inset `rgba(255,255,255,0.6)` highlight |
| Card shadow | `0px 16px 48px rgba(0,0,0,0.10)` |
| Animations | GSAP entrance (0.3-0.8s), `animate-slide-in-left`, `animate-slide-in-right` |

---

## 9. Future Roadmap

### Phase 1: Foundation (Near-term)

| Feature | Description | Priority |
|---------|-------------|----------|
| Real Onli You authentication | OAuth/passkey flow replacing simulated indicator | Critical |
| Error boundary UI | User-facing error states for failed API calls, sim downtime | High |
| Loading skeletons | Shimmer placeholders for slow card/chat responses | High |
| Fix atomicity gap | Ensure cashier payment confirms before Specie credit in buy flow | High |
| Vault balance validation | Prevent negative balances in `adjustVault` | High |

### Phase 2: Real-time and Responsiveness

| Feature | Description | Priority |
|---------|-------------|----------|
| WebSocket integration | Real-time balance + pipeline stage updates (replace polling) | High |
| Mobile responsive layout | Single-column with swipe between panels | High |
| Chat history persistence | Persist per-mode chat history across page reloads | Medium |
| Live marketplace stats | Fetched (not static) data in Trade Info tab | Medium |

### Phase 3: Content and Developer Experience

| Feature | Description | Priority |
|---------|-------------|----------|
| Blog CMS integration | Replace static posts with API-driven content | Medium |
| Oracle ledger viewer | Interactive ledger explorer in Trade Canvas | Medium |
| Process trace visualization | Animated pipeline diagram in Develop Canvas | Medium |
| Reactive Develop Canvas | Auto-detect journey from free-form chat, not just presets | Medium |

### Phase 4: Platform Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-user support | User profiles, contacts fetched from API | Medium |
| Notification system | Trade complete, balance change, listing matched | Medium |
| Assurance dashboard | Coverage ratio chart, pool history, health trends | Medium |
| Export transaction history | CSV/PDF export of Oracle ledger entries | Low |

### Phase 5: Polish

| Feature | Description | Priority |
|---------|-------------|----------|
| Dark mode | Full theme toggle with `prefers-color-scheme` support | Low |
| Internationalization | i18n framework for multi-language support | Low |
| Keyboard shortcuts | `Cmd+K` command palette for power users | Low |
| Interactive cover page | Mode preview/selection from cover before entering | Low |

---

## 10. File Map

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | App entry: 3-panel layout + cover page overlay |
| `src/features/chat/ChatPanel.tsx` | Chat UI: messages, input bar, mode dropdown, voice |
| `src/features/chat/hooks/useOnliChat.ts` | AI chat hook (Vercel AI SDK) |
| `src/features/chat/hooks/useSpeechToText.ts` | Web Speech API voice input |
| `src/features/chat/hooks/useJourneyTracker.ts` | Tracks active journey from messages |
| `src/features/chat/components/HelloGreeting.tsx` | Apple TV-style hello animation |
| `src/features/chat/components/VoiceWave.tsx` | Real-time waveform visualization |
| `src/features/chat/components/PipelineWalkthrough.tsx` | Pipeline stage walkthrough UI |
| `src/lib/journey-engine.ts` | Journey state machine: detection, confirmation, execution |
| `src/lib/sim-client.ts` | API client for MarketSB + Species sims |
| `src/components/OnliAiPanel.tsx` | Panel 1: user card, mode selector, gen-ui, people |
| `src/components/RightPanel.tsx` | Panel 3: tabbed container (Info/Canvas/Blog) |
| `src/components/right-panel/InfoTab.tsx` | Mode-aware info/ad cards with video overlay |
| `src/components/right-panel/CanvasTab.tsx` | Mode-aware canvas: walkthrough / code / API ref |
| `src/components/right-panel/BlogTab.tsx` | Mode-aware blog/news/whitepapers |
| `src/components/GenUISlot.tsx` | Auto-renders gen-ui components from tool results |
| `src/components/CoverPage.tsx` | p5.js sphere animation cover |
| `src/components/MobileGate.tsx` | Blocks mobile access |
| `src/stores/tab-store.ts` | Zustand store: mode, tabs, chat lock, dev journey |
| `src/layouts/DashboardLayout.tsx` | 3-column flex layout shell |
| `docs/QA-PLAN.md` | Full test strategy and test case definitions |
| `tests/integration/` | 73 Vitest integration tests across 15 files |
