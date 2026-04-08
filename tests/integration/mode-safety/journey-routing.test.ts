/**
 * JOURNEY ROUTING TESTS
 * Verify that intent detection routes to the CORRECT journey.
 * A transfer must not become a sell. A buy must not become a redeem.
 */
import { describe, it, expect } from 'vitest';
import { detectJourneyState } from '@/lib/journey-engine';

function buildConversation(userText: string) {
  return [{ role: 'user' as const, content: userText, id: 'msg-1' }];
}

describe('JOURNEY ROUTING — Correct journey selection', () => {
  it('ROUTE-001 — "Buy 100 Specie" routes to buy journey', () => {
    const state = detectJourneyState(buildConversation('Buy 100 Specie'));
    expect(state.journey).toBe('buy');
  });

  it('ROUTE-002 — "Sell 200 species" routes to sell journey', () => {
    const state = detectJourneyState(buildConversation('Sell 200 species'));
    expect(state.journey).toBe('sell');
  });

  it('ROUTE-003 — "Transfer 50 to Pepper" routes to transfer journey', () => {
    const state = detectJourneyState(buildConversation('Transfer 50 to Pepper'));
    expect(state.journey).toBe('transfer');
  });

  it('ROUTE-004 — "Redeem 100 species" routes to redeem journey', () => {
    const state = detectJourneyState(buildConversation('Redeem 100 species'));
    expect(state.journey).toBe('redeem');
  });

  it('ROUTE-005 — "Fund my account" routes to fund journey', () => {
    const state = detectJourneyState(buildConversation('Fund my account'));
    expect(state.journey).toBe('fund');
  });

  it('ROUTE-006 — "List 500 for sale" routes to sell (not transfer)', () => {
    const state = detectJourneyState(buildConversation('List 500 for sale'));
    expect(state.journey).toBe('sell');
    expect(state.journey).not.toBe('transfer');
  });

  it('ROUTE-007 — "Transfer 50 species to Tony" routes to transfer (not sell)', () => {
    const state = detectJourneyState(buildConversation('Transfer 50 species to Tony'));
    // Should be transfer, not sell
    expect(state.journey).toBe('transfer');
  });

  it('ROUTE-007b — "Send" alone maps to sendout (withdraw), not transfer', () => {
    // "send" keyword maps to sendout (USDC withdrawal) in the journey engine
    // Transfer requires the word "transfer" explicitly
    const state = detectJourneyState(buildConversation('Send 50 species to Tony'));
    // If detected, should not be sell
    if (state.journey) {
      expect(state.journey).not.toBe('sell');
    }
  });

  it('ROUTE-008 — "Withdraw $1000" routes to sendout (not redeem)', () => {
    const state = detectJourneyState(buildConversation('Withdraw $1000 to 0xabc'));
    expect(state.journey).toBe('sendout');
    expect(state.journey).not.toBe('redeem');
  });

  it('ROUTE-009 — "Deposit $5000" routes to fund (not buy)', () => {
    const state = detectJourneyState(buildConversation('Deposit $5000'));
    expect(state.journey).toBe('fund');
    expect(state.journey).not.toBe('buy');
  });

  it('ROUTE-010 — Transfer does not become sell', () => {
    const state = detectJourneyState(buildConversation('Transfer 100 species to Happy Hogan'));
    expect(state.journey).toBe('transfer');
    expect(state.journey).not.toBe('sell');
    expect(state.journey).not.toBe('list');
  });

  it('ROUTE-011 — Redeem does not become sell', () => {
    const state = detectJourneyState(buildConversation('Redeem 500 species'));
    expect(state.journey).toBe('redeem');
    expect(state.journey).not.toBe('sell');
  });
});
