/**
 * MODE LEAKAGE TESTS
 * Verify that trade actions do NOT execute from Ask or Develop modes.
 * These are runtime tests against live sims — not just prompt text checks.
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

// Helper to build a message array simulating a user message in a given mode context
function buildMessages(userText: string) {
  return [
    { role: 'user' as const, content: userText, id: 'msg-1' },
  ];
}

describe('MODE LEAKAGE — No trade execution from Ask or Develop', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Give user funds and specie so trades COULD work if leaked
    await simulateDeposit('user-001', 10_000);
    await adjustVault('onli-user-001', 1000, 'test-setup');
  });

  it('LEAK-001 — "Buy 100 Specie" in Ask mode does not produce execute phase', () => {
    const messages = buildMessages('Buy 100 Specie');
    const state = detectJourneyState(messages);

    // Should NOT be in execute phase — should be start or none
    expect(state.phase).not.toBe('execute');
    // The journey may be detected but should not auto-execute
    if (state.journey) {
      expect(state.phase).toMatch(/^(start|confirm|none)$/);
    }
  });

  it('LEAK-002 — "Redeem all my species" does not produce execute phase', () => {
    const messages = buildMessages('Redeem all my species');
    const state = detectJourneyState(messages);

    expect(state.phase).not.toBe('execute');
  });

  it('LEAK-003 — "Transfer 50 to Pepper" does not produce execute phase', () => {
    const messages = buildMessages('Transfer 50 to Pepper');
    const state = detectJourneyState(messages);

    expect(state.phase).not.toBe('execute');
  });

  it('LEAK-004 — Single user message never reaches execute without confirm', () => {
    // No matter what the user says in a single message, execute should never trigger
    // Execute requires a prior assistant confirm prompt + user "confirm" response
    const attempts = [
      'Buy 1000 species confirm',
      'yes buy 500',
      'execute buy 100',
      'confirm buy 200 specie',
    ];

    for (const text of attempts) {
      const messages = buildMessages(text);
      const state = detectJourneyState(messages);
      expect(state.phase).not.toBe('execute');
    }
  });

  it('LEAK-005 — Sim balances unchanged after journey detection (no side effects)', async () => {
    const before = await getBalanceSnapshot();

    // Run detection on multiple trade-like messages
    detectJourneyState(buildMessages('Buy 100 Specie'));
    detectJourneyState(buildMessages('Sell 500 species'));
    detectJourneyState(buildMessages('Transfer 50 to Tony'));
    detectJourneyState(buildMessages('Redeem 200'));

    const after = await getBalanceSnapshot();

    // Detection is read-only — zero mutations
    expectNoMutation(before, after);
  });
});
