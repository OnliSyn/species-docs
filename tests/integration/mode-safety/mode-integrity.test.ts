import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '@/lib/system-prompts';

describe('MODE — Mode Integrity Tests', () => {
  it('MODE-001 — Ask mode system prompt forbids trade execution', () => {
    const prompt = getSystemPrompt('ask');
    expect(prompt).toContain('switch to Trade mode');
    expect(prompt).not.toContain('execute');
  });

  it('MODE-002 — Trade mode system prompt enables journey execution', () => {
    const prompt = getSystemPrompt('trade');
    expect(prompt.toLowerCase()).toContain('journey');
    expect(prompt.toLowerCase()).toContain('confirm');
  });

  it('MODE-003 — Develop mode system prompt forbids live execution', () => {
    const prompt = getSystemPrompt('develop');
    expect(prompt).toContain('NOT trying to trade');
    expect(prompt).toContain('NEVER attempt to execute');
  });

  it('MODE-005 — Each mode produces distinct system prompt', () => {
    const ask = getSystemPrompt('ask');
    const trade = getSystemPrompt('trade');
    const develop = getSystemPrompt('develop');

    expect(ask).not.toBe(trade);
    expect(trade).not.toBe(develop);
    expect(ask).not.toBe(develop);
  });
});
