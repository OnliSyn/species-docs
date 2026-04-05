# Product Requirements Document — Onli Synth

## Product Vision

Onli Synth is an AI-native dashboard where the UI is generated from prompts rather than hand-designed. Developers write natural language prompts in a configuration file, and the system automatically generates, renders, and keeps up-to-date the corresponding UI cards. This eliminates the traditional design-implement-iterate cycle for data display components.

## Target Users

- **End users**: Onli platform participants who hold USDC funding and Specie digital assets
- **Developers**: Teams building on Onli who need to add new dashboard cards without UI design work

## Core Features

### F1: Prompt-Driven System UI

Developers define prompts in `src/config/userSystem.md`. The system processes these prompts every 30 seconds and renders the results as gen-ui cards in the left panel.

**Acceptance criteria:**
- Prompts are organized by mode (ask, trade, learn) and onLoad
- Each prompt maps to a tool result with a `_ui` field
- Cards render automatically without page reload
- Cards can be dismissed with an X button (reappear on next poll)
- New cards can be added by editing userSystem.md + adding a tool match

### F2: Three-Mode Chat Interface

The center panel provides an AI chat assistant (Synth) with three distinct modes:

| Mode | Purpose | System Prompt Focus |
|------|---------|-------------------|
| Ask (Create) | Query account data | Balances, transactions, account status |
| Trade | Execute transactions | Step-by-step buy/sell/transfer journeys |
| Learn | Educational content | Onli concepts, architecture, assurance model |

**Acceptance criteria:**
- Mode switch via dropdown in left panel
- Welcome state shows mode-specific quick actions
- Chat history is per-mode (switching modes preserves each mode's history)
- Trade mode supports multi-step journeys with confirmation cards

### F3: Trade Journey Engine

Trade mode guides users through financial transactions with a state machine:

```
Intent -> Start -> Amount/Quantity -> Confirm -> Execute/Cancel
```

**Supported journeys:**
- Fund (deposit USDC)
- Buy (purchase Specie)
- Sell (sell Specie)
- Transfer (send Specie to contact)
- Withdraw (send USDC to external wallet)

**Acceptance criteria:**
- Fee calculations: Issuance $0.01/Specie, Liquidity 2%
- Confirmation card shows full breakdown before execution
- Cancel at any confirm step aborts without state mutation
- Pipeline card shows 9-stage progression after execution

### F4: Generative UI Component Registry

A registry pattern where components self-register with a key. When tool results include a `_ui` field matching a registered key, the corresponding component renders automatically.

**Registered components:** BalanceCard, CoverageCard (Buy Back Guarantee), TransactionList, MarketStats, InfoCard, DepositCard, PipelineCard, ConfirmCard, LifecycleCard, VaultCard, ReceiptCard

**Acceptance criteria:**
- New components register by calling `registerUIComponent(key, component)`
- GenUISlot auto-renders any registered component from tool results
- Unknown `_ui` values fall back to raw JSON display
- All cards follow design system (white bg, rounded-2xl, no icons, text-only)

### F5: Voice Input

Users can speak to the chat using their microphone. Speech is transcribed to text and auto-sent.

**Acceptance criteria:**
- Click mic button to start
- Browser requests microphone permission
- Real-time waveform visualization during listening
- Interim transcript shown below waveform
- Final transcript auto-sends as chat message
- macOS-specific error messages for permission issues
- No text-to-speech output (was removed — accessibility conflict)

### F6: Onli Identity Card

Persistent card in left panel showing the logged-in user's name and status.

**Acceptance criteria:**
- Displays user initials avatar, full name, "Logged in" status with green dot
- Pinned between welcome card and mode selector

### F7: Content Feed (Right Panel)

Dynamic content feed with multiple card styles for news, announcements, media, and articles.

**Card variants:** featured, accent (green), dark, article

**Acceptance criteria:**
- Static placeholder content for now
- Typed data model (`FeedCard`) ready for API integration
- Scrollable panel with 4+ cards

### F8: Buy Back Guarantee Card

Displays the assurance-to-circulation ratio as a hero number, with supporting data.

**Acceptance criteria:**
- Shows ratio (e.g., $0.95) in large ultrathin font (48px)
- Assurance Account balance and Circulation count below
- Health badge: Healthy (green, >= 50%), Warning (amber, >= 25%), Critical (red, < 25%)
- GSAP counter animation on load

## Non-Functional Requirements

### Performance
- System card polling: 30s interval with AbortController cancellation
- Chat streaming: Vercel AI SDK SSE transport
- Voice waveform: 60fps canvas animation via requestAnimationFrame
- GSAP animations on card entrance (0.3-0.8s)

### Amount Precision
- All USDC amounts in integer base units (1 USDC = 1,000,000 units)
- No floating-point arithmetic on monetary values
- Display conversion: baseUnits / 1,000,000

### Browser Support
- Speech Recognition: Chrome, Edge (Web Speech API)
- Voice waveform: All modern browsers (Web Audio API)
- Layout: CSS flex with fixed + flexible panels

### Design System
- Font: Manrope (Google Fonts)
- Colors: Dark outer (#0A0A0A), white panels, green accent (#C5DE8A)
- Radius: Panels 24px, cards 20px, buttons 12px, inputs 10px
- No icons or emojis in system cards

## Future Considerations

- Real AI for system-chat (Claude interprets prompts and decides which tools to call)
- API-driven content feed (replace static cards)
- WebSocket for real-time balance updates (replace polling)
- Multi-user Onli ID with authentication flow
- Mobile responsive layout
