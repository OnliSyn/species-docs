/**
 * UNAUTHORIZED EXECUTION TESTS
 * Verify that the confirm gate cannot be bypassed.
 * Execute phase requires: assistant confirm prompt + user "confirm" response.
 */
import { describe, it, expect } from 'vitest';
import { detectJourneyState } from '@/lib/journey-engine';

type Message = { role: 'user' | 'assistant'; content: string; id: string };

function msg(role: 'user' | 'assistant', content: string, id: string): Message {
  return { role, content, id };
}

describe('UNAUTHORIZED EXECUTION — Confirm gate enforcement', () => {
  it('AUTH-001 — Execute requires assistant confirm prompt before user confirm', () => {
    // User says "confirm" without prior assistant asking for confirmation
    const messages: Message[] = [
      msg('user', 'confirm', 'msg-1'),
    ];
    const state = detectJourneyState(messages);
    expect(state.phase).not.toBe('execute');
  });

  it('AUTH-002 — Proper confirm flow: assistant asks → user confirms → execute', () => {
    const messages: Message[] = [
      msg('user', 'Buy 100 species', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed or **cancel** to abort.\n\nBUY 100 SPECIES\nAsset Cost: $100.00\nTotal: $100.00', 'msg-2'),
      msg('user', 'confirm', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    expect(state.phase).toBe('execute');
    expect(state.journey).toBe('buy');
  });

  it('AUTH-003 — Cancel aborts the journey', () => {
    const messages: Message[] = [
      msg('user', 'Buy 100 species', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed or **cancel** to abort.\n\nBUY 100 SPECIES', 'msg-2'),
      msg('user', 'cancel', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    expect(state.phase).toBe('cancelled');
  });

  it('AUTH-004 — "no" also cancels', () => {
    const messages: Message[] = [
      msg('user', 'Redeem 50', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed.\n\nREDEEM 50 SPECIES', 'msg-2'),
      msg('user', 'no', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    expect(state.phase).toBe('cancelled');
  });

  it('AUTH-005 — Random text after confirm prompt does NOT execute', () => {
    const messages: Message[] = [
      msg('user', 'Buy 200 species', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed or **cancel** to abort.\n\nBUY 200 SPECIES', 'msg-2'),
      msg('user', 'actually tell me about Onli instead', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    // Should not execute — user didn't say confirm/yes
    expect(state.phase).not.toBe('execute');
  });

  it('AUTH-006 — "yes" is accepted as confirmation', () => {
    const messages: Message[] = [
      msg('user', 'Transfer 100 to Pepper', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed.\n\nTRANSFER 100 SPECIES to Pepper Potts', 'msg-2'),
      msg('user', 'yes', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    expect(state.phase).toBe('execute');
    expect(state.journey).toBe('transfer');
  });

  it('AUTH-007 — Confirm for one journey cannot execute a different journey', () => {
    const messages: Message[] = [
      msg('user', 'Buy 100 species', 'msg-1'),
      msg('assistant', 'Type **confirm** to proceed.\n\nBUY 100 SPECIES', 'msg-2'),
      msg('user', 'confirm', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    // Should execute buy, not anything else
    expect(state.phase).toBe('execute');
    expect(state.journey).toBe('buy');
    expect(state.journey).not.toBe('sell');
    expect(state.journey).not.toBe('redeem');
    expect(state.journey).not.toBe('transfer');
  });

  it('AUTH-008 — Double confirm does not double-execute', () => {
    // After a journey completes, saying "confirm" again should not re-execute
    const messages: Message[] = [
      msg('user', 'Buy 100 species', 'msg-1'),
      msg('assistant', 'Order complete! You bought 100 SPECIES for $100.00.', 'msg-2'),
      msg('user', 'confirm', 'msg-3'),
    ];
    const state = detectJourneyState(messages);
    // The assistant message doesn't contain a confirm prompt, so this should NOT execute
    expect(state.phase).not.toBe('execute');
  });
});
