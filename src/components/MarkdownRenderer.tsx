'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Pre-process: fix common LLM formatting issues
  let cleaned = content;

  // Step 1: Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Fix bullet patterns — multiple passes to catch all variants
  // Pattern: "•\n" or "• \n" followed by text on next line
  cleaned = cleaned.replace(/[•·●]\s*\n\s*/g, '- ');
  // Pattern: "•" at start of line followed by text on same line
  cleaned = cleaned.replace(/^[•·●]\s*/gm, '- ');
  // Pattern: lone "•" on a line (orphaned bullet)
  cleaned = cleaned.replace(/^\s*[•·●]\s*$/gm, '');

  // Step 3: Ensure blank lines before Markdown block elements
  cleaned = cleaned.replace(/([^\n])\n(- )/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(#{1,3} )/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(\*\*[A-Z])/g, '$1\n\n$2');
  cleaned = cleaned.replace(/([^\n])\n(\d+\. )/g, '$1\n\n$2');

  // Step 4: Clean up excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return (
    <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <span className="font-bold">{children}</span>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
        code: ({ children, className: codeClassName }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return <code className="px-1 py-0.5 bg-black/5 rounded text-xs font-mono">{children}</code>;
          }
          return (
            <pre className="bg-black/5 rounded-lg p-3 overflow-x-auto mb-2">
              <code className="text-xs font-mono">{children}</code>
            </pre>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3 rounded-lg border border-[var(--color-border)]">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[var(--color-bg-card)]">{children}</thead>,
        th: ({ children }) => <th className="border-b border-[var(--color-border)] px-3 py-2 font-semibold text-left text-[var(--color-text-secondary)]">{children}</th>,
        td: ({ children }) => <td className="border-b border-[var(--color-border)] px-3 py-2">{children}</td>,
        tr: ({ children }) => <tr className="hover:bg-[var(--color-bg-card)]/50">{children}</tr>,
      }}
    >
      {cleaned}
    </ReactMarkdown>
    </div>
  );
}
