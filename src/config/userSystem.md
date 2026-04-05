# userSystem.md — Prompt-Driven System UI Configuration
#
# This file defines the prompts that power the GenUI system cards
# in the left panel. The system auto-runs these prompts against
# /api/system-chat and renders the tool results as gen-ui cards.
#
# ## How to add a new system card:
#
# 1. Add a prompt line under the appropriate mode section below
# 2. In /api/system-chat/route.ts, add a matching case in
#    matchPromptToTool() that returns { toolName, data, commentary }
# 3. The `data._ui` field must match a registered gen-ui component
#    (see src/components/ai/gen-ui/ for available components)
# 4. If you need a new card type, create a component in gen-ui/,
#    call registerUIComponent(), and import it in gen-ui/index.ts
#
# ## Available _ui types:
#   BalanceCard     — funding/asset balance display
#   CoverageCard    — buy back guarantee with ratio
#   TransactionList — recent transaction list
#   MarketStats     — marketplace statistics
#   InfoCard        — text info card (title + body)
#   DepositCard     — deposit lifecycle
#   PipelineCard    — order pipeline stepper
#   VaultCard       — vault specie count
#
# ## Card design guidelines:
#   - Cards use white bg, rounded-2xl, 1px border, subtle shadow
#   - No icons or emojis — text and data only
#   - Use uppercase 10px tracking labels for section headers
#   - Hero numbers use font-extralight at 32-48px
#   - Secondary text uses text-[var(--color-text-secondary)]
#   - Cards should be compact — no unnecessary padding
#
# ## Onli Canon:
#   The Onli Canon (src/config/onli-canon.md) is loaded into
#   the chat LLM system prompt for Ask and Learn modes.
#   All canonical definitions and facts in system-chat route
#   should match the canon. When updating InfoCard content,
#   reference the canon for correct language.
#
# ## Polling:
#   Cards refresh every 30 seconds and on mode switch.
#   Dismissed cards (X button) reappear on next poll.
#

# onLoad
- Welcome to Onli Ai. Your intelligent assistant for managing digital assets, exploring the Onli ecosystem, and trading on the Species Marketplace.

# ask
- What is the definition of Onli?
- Give me an interesting fact about Onli

# trade
- What is my current funding balance?
- What is the assurance balance and buy back guarantee ratio?
- Show me my last 5 transactions
- What are the current market statistics?

# learn
- What is a Genome in the Onli system?
- Explain the Species marketplace pipeline
