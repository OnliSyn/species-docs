# Test Report — April 8, 2026

## Summary
- **Total Tests**: 91
- **Passed**: 91
- **Failed**: 0
- **Critical Failures**: 0
- **Status**: ✅ PASS

## Test Suites (19 files)

### Balance Tests (Financial Correctness)
| Test | Status | Time |
|------|--------|------|
| TRD-BUY-001 — USDC decreases and Specie increases by exact amount | ✅ | 3.6s |
| TRD-BUY-004 — Treasury buy includes issuance + liquidity fee | ✅ | 3.5s |
| TRD-BUY-002 — Buy with $0 balance: cashier rejects | ✅ | 2.6s |
| TRD-RED-001 — Specie decreases, USDC increases by (gross - 1% fee) | ✅ | 3.1s |
| TRD-RED-002 — Redeem with 0 Specie: no USDC credit | ✅ | 0.5s |
| TRD-RED-003 — Fee math exact: 1% of gross, integer arithmetic | ✅ | 0ms |
| TRD-SELL-001 — Listing created, no USDC change, Specie escrowed | ✅ | 3.6s |
| TRD-XFER-001 — Sender decreases, no USDC movement | ✅ | 2.6s |
| TRD-XFER-003 — Transfer with 0 Specie: rejected by vault validation | ✅ | 0.5s |
| TRD-FUND-001 — Deposit increases USDC by exact amount | ✅ | 43ms |
| TRD-FUND-002 — Specie balance unchanged after deposit | ✅ | 3ms |
| TRD-SEND-001 — USDC decreases by withdrawal amount | ✅ | 50ms |

### Pipeline Flow (Refactored Architecture)
| Test | Status | Time |
|------|--------|------|
| PIPE-001 — Buy creates order in species-sim | ✅ | 3.6s |
| PIPE-002 — Buy: funding decreases, vault increases | ✅ | 3.5s |
| PIPE-003 — Sell: vault decreases (escrowed) | ✅ | 7.0s |
| PIPE-004 — Transfer: sender vault decreases | ✅ | 6.0s |
| PIPE-005 — No species VAs created in MarketSB | ✅ | 3.5s |

### Cashier Cash-Only Verification
| Test | Status | Time |
|------|--------|------|
| CASH-001 — No species VAs exist after reset | ✅ | 35ms |
| CASH-002 — Only funding VAs exist for users | ✅ | 3ms |
| CASH-003 — System accounts are cash-only | ✅ | 1ms |
| CASH-004 — Deposit doesn't create species VA | ✅ | 4ms |

### E2E Observable Behavior
| Test | Status | Time |
|------|--------|------|
| E2E-001 — Oracle has funding entries after buy | ✅ | 3.6s |
| E2E-002 — Oracle has ChangeOwner entries after buy | ✅ | 3.5s |
| E2E-003 — Oracle proxy returns entries | ✅ | 3.5s |
| E2E-004 — Vault balance matches expected count | ✅ | 3.5s |
| E2E-005 — Assurance balance increased after buy | ✅ | 3.5s |
| E2E-006 — Marketplace stats updated after buy | ✅ | 3.5s |
| E2E-010 — Funding VA visible after deposit | ✅ | 1ms |
| E2E-011 — Oracle has deposit entry | ✅ | 1ms |

### Reconciliation
| Test | Status | Time |
|------|--------|------|
| REC-001 — After buy: USDC + Specie deltas match | ✅ | 3.6s |
| REC-005 — After fund: USDC up, Specie unchanged | ✅ | 3ms |

### Idempotency
| Test | Status | Time |
|------|--------|------|
| IDEMP-001 — Two buys produce two distinct changes | ✅ | 7.1s |
| IDEMP-002 — Transfer twice: both execute | ✅ | 9.0s |
| IDEMP-003 — Redeem twice: correct fee each time | ✅ | 7.0s |

### Mode Safety
| Test | Status | Time |
|------|--------|------|
| MODE-001..005 — Mode integrity (4 tests) | ✅ | <1ms |
| LEAK-001..005 — No trade from Ask/Develop (5 tests) | ✅ | <50ms |
| ROUTE-001..011 — Journey routing correct (12 tests) | ✅ | <5ms |
| AUTH-001..008 — Confirm gate enforcement (8 tests) | ✅ | <5ms |
| DEV-001..008 — Develop safety (8 tests) | ✅ | <50ms |

### Ask Mode Queries
| Test | Status | Time |
|------|--------|------|
| ASK-001..006 — Read-only queries (7 tests) | ✅ | <60ms |

### Markdown Rendering
| Test | Status | Time |
|------|--------|------|
| MD-001..022 — Bullet preprocessing (13 tests) | ✅ | <5ms |

## Browser Verification (Deployed Site)
| Test | Status | Notes |
|------|--------|-------|
| Cover page loads | ✅ | GSAP animation runs |
| Ask mode panels | ✅ | All 3 panels correct |
| Trade mode layout | ✅ | Funding, Vault, Marketplace, Assurance cards |
| Fund journey | ✅ | Deposit credited, balance updates |
| Buy journey | ✅ | Pipeline completes, vault increases |
| Oracle Canvas | ✅ | Entries display via proxy after trades |
| Fee breakdown | ✅ | $1.00 + $0.05 issuance + $0.01 liquidity = $1.06/Specie |

## Architecture Verification
- MarketSB: 13 VAs total (6 funding + 5 system + 2 cashier fee accounts)
- Zero species VAs in MarketSB ✅
- All journeys route through species-sim eventRequest ✅
- Cashier handles cash only ✅
- Assurance funded from buy proceeds ✅

## Recommendation
**PASS — Clear to deploy.**
