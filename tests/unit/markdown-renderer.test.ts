/**
 * MARKDOWN RENDERING TESTS
 * Verify that LLM bullet patterns are properly converted to Markdown.
 * These test the exact preprocessing pipeline in MarkdownRenderer.
 */
import { describe, it, expect } from 'vitest';

// Replicate the exact preprocessing from MarkdownRenderer.tsx
function preprocessMarkdown(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/[•·●]\s*\n\s*/g, '- ');
  cleaned = cleaned.replace(/^[•·●]\s*/gm, '- ');
  cleaned = cleaned.replace(/^\s*[•·●]\s*$/gm, '');
  cleaned = cleaned.replace(/([^\n])\n(- )/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(#{1,3} )/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(\*\*[A-Z])/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(\d+\. )/g, '$1\n\n$2');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

describe('MARKDOWN — Bullet character preprocessing', () => {
  it('MD-001 — "•\\nText" pattern converts to "- Text"', () => {
    const input = 'Key points:\n•\n**Teaching tool** - description\n•\n**Demo** - shows how';
    const result = preprocessMarkdown(input);
    expect(result).not.toContain('•');
    expect(result).toContain('- **Teaching tool**');
    expect(result).toContain('- **Demo**');
  });

  it('MD-002 — "• Text" inline pattern converts to "- Text"', () => {
    const input = '• First item\n• Second item\n• Third item';
    const result = preprocessMarkdown(input);
    expect(result).not.toContain('•');
    expect(result).toContain('- First item');
    expect(result).toContain('- Second item');
    expect(result).toContain('- Third item');
  });

  it('MD-003 — Orphaned bullet on own line is removed', () => {
    const input = 'Header\n•\n\nSome text';
    const result = preprocessMarkdown(input);
    expect(result).not.toContain('•');
  });

  it('MD-004 — Windows line endings (\\r\\n) handled', () => {
    const input = '•\r\n**Item** - text\r\n•\r\n**Item2** - text2';
    const result = preprocessMarkdown(input);
    expect(result).not.toContain('•');
    expect(result).not.toContain('\r');
    expect(result).toContain('- **Item**');
  });

  it('MD-005 — Middle dot (·) and filled circle (●) also converted', () => {
    const input = '· Item one\n● Item two';
    const result = preprocessMarkdown(input);
    expect(result).not.toContain('·');
    expect(result).not.toContain('●');
    expect(result).toContain('- Item one');
    expect(result).toContain('- Item two');
  });

  it('MD-006 — Blank line inserted before list items', () => {
    const input = 'Some text\n- First\n- Second';
    const result = preprocessMarkdown(input);
    expect(result).toContain('Some text\n\n- First');
  });

  it('MD-007 — Blank line inserted before headings', () => {
    const input = 'Paragraph text\n## Heading';
    const result = preprocessMarkdown(input);
    expect(result).toContain('Paragraph text\n\n## Heading');
  });

  it('MD-008 — Blank line inserted before bold headings', () => {
    const input = 'Paragraph text\n**Core Concepts**';
    const result = preprocessMarkdown(input);
    expect(result).toContain('Paragraph text\n\n**Core Concepts**');
  });

  it('MD-009 — Excessive blank lines collapsed to double', () => {
    const input = 'Text\n\n\n\n\nMore text';
    const result = preprocessMarkdown(input);
    expect(result).toBe('Text\n\nMore text');
  });

  it('MD-010 — Real LLM output: full bullet list with bold labels', () => {
    const input = `Species teaches Onli concepts through hands-on experience:

**Direct Experience**
•
You actually hold, transfer, and trade Specie assets
•
No theoretical explanations needed

**Core Concepts Demonstrated**
•
**True ownership** — Assets live in your Vault
•
**Direct transfer** — When you send Specie, it leaves your possession
•
**No intermediaries** — No company holds your assets "for you"`;

    const result = preprocessMarkdown(input);

    // No bullet characters should remain
    expect(result).not.toContain('•');

    // Should have proper list items
    expect(result).toContain('- You actually hold');
    expect(result).toContain('- No theoretical');
    expect(result).toContain('- **True ownership**');
    expect(result).toContain('- **Direct transfer**');
    expect(result).toContain('- **No intermediaries**');
  });
});

describe('MARKDOWN — Proper Markdown passes through unchanged', () => {
  it('MD-020 — Standard Markdown list preserved', () => {
    const input = 'Items:\n\n- First\n- Second\n- Third';
    const result = preprocessMarkdown(input);
    expect(result).toContain('- First');
    expect(result).toContain('- Second');
    expect(result).toContain('- Third');
    expect(result).not.toContain('•');
  });

  it('MD-021 — Numbered list preserved', () => {
    const input = 'Steps:\n\n1. First\n2. Second\n3. Third';
    const result = preprocessMarkdown(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
    expect(result).toContain('3. Third');
  });

  it('MD-022 — Code blocks with dashes unchanged', () => {
    const input = '```\nsome-code-with-dashes\n```';
    const result = preprocessMarkdown(input);
    expect(result).toContain('some-code-with-dashes');
  });
});
