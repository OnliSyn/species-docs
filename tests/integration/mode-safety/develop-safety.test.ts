/**
 * DEVELOP MODE SAFETY — No trade execution, explanation only
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  expectNoMutation,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { detectJourneyState } from '@/lib/journey-engine';
import { getSystemPrompt } from '@/lib/system-prompts';

function buildMessages(userText: string) {
  return [{ role: 'user' as const, content: userText, id: 'msg-1' }];
}

describe('DEVELOP MODE — No trade execution', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 10_000);
    await adjustVault('onli-user-001', 1000, 'test-setup');
  });

  it('DEV-001 — System prompt explicitly forbids execution', () => {
    const prompt = getSystemPrompt('develop');
    expect(prompt).toContain('NOT trying to trade');
    expect(prompt).toContain('NEVER attempt to execute');
  });

  it('DEV-002 — "Walk me through Buy" does not trigger execute', () => {
    const state = detectJourneyState(buildMessages('Walk me through the Buy journey'));
    expect(state.phase).not.toBe('execute');
  });

  it('DEV-003 — "How does sell work" does not trigger execute', () => {
    const state = detectJourneyState(buildMessages('How does sell work'));
    expect(state.phase).not.toBe('execute');
  });

  it('DEV-004 — "Show me the transfer API" does not trigger execute', () => {
    const state = detectJourneyState(buildMessages('Show me the transfer API'));
    expect(state.phase).not.toBe('execute');
  });

  it('DEV-005 — "Buy 1000 species" in Develop context: detection only, no mutation', async () => {
    const before = await getBalanceSnapshot();

    // Journey engine detects intent but does NOT execute
    const state = detectJourneyState(buildMessages('Buy 1000 species'));
    expect(state.phase).not.toBe('execute');

    const after = await getBalanceSnapshot();
    expectNoMutation(before, after);
  });

  it('DEV-006 — "Fund my account" in Develop context: no deposit', async () => {
    const before = await getBalanceSnapshot();

    const state = detectJourneyState(buildMessages('Fund my account'));
    expect(state.phase).not.toBe('execute');

    const after = await getBalanceSnapshot();
    expectNoMutation(before, after);
  });

  it('DEV-007 — "Redeem all species" in Develop context: no redeem', async () => {
    const before = await getBalanceSnapshot();

    const state = detectJourneyState(buildMessages('Redeem all species'));
    expect(state.phase).not.toBe('execute');

    const after = await getBalanceSnapshot();
    expectNoMutation(before, after);
  });

  it('DEV-008 — Develop prompt is distinct from Trade prompt', () => {
    const develop = getSystemPrompt('develop');
    const trade = getSystemPrompt('trade');

    expect(develop).toContain('developer');
    expect(trade).not.toContain('NOT trying to trade');
  });
});
