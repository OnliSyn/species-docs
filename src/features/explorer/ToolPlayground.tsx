'use client';
import { useState } from 'react';
import type { McpTool, McpToolResult } from '@/types/mcp';
import { cn } from '@/lib/utils';

interface Props {
  tool: McpTool;
  serviceId: string;
}

export function ToolPlayground({ tool, serviceId }: Props) {
  const properties = tool.inputSchema.properties ?? {};
  const required = tool.inputSchema.required ?? [];

  const [values, setValues] = useState<Record<string, unknown>>(
    Object.fromEntries(Object.keys(properties).map((k) => [k, properties[k].type === 'boolean' ? false : '']))
  );
  const [result, setResult] = useState<McpToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/mcp/${serviceId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tool.name, arguments: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties).map(([key, prop]) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={key} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {key} {required.includes(key) ? '*' : ''}
          </label>
          {prop.type === 'boolean' ? (
            <input
              id={key}
              type="checkbox"
              checked={values[key] as boolean}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
              className="w-4 h-4"
            />
          ) : prop.type === 'number' || prop.type === 'integer' ? (
            <input
              id={key}
              type="number"
              value={values[key] as string}
              onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
              className="px-3 py-2 rounded-[var(--radius-input)] border border-[var(--color-border)] text-sm bg-white"
            />
          ) : (
            <input
              id={key}
              type="text"
              value={values[key] as string}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="px-3 py-2 rounded-[var(--radius-input)] border border-[var(--color-border)] text-sm bg-white"
            />
          )}
          {prop.description && (
            <span className="text-xs text-[var(--color-text-secondary)]">{prop.description}</span>
          )}
        </div>
      ))}

      <button
        onClick={run}
        disabled={running}
        className={cn(
          'px-4 py-2 rounded-[var(--radius-button)] text-sm font-medium bg-[var(--color-cta-primary)] text-white',
          running && 'opacity-50 cursor-not-allowed'
        )}
      >
        {running ? 'Running…' : 'Run'}
      </button>

      {error && (
        <pre className="text-xs text-[var(--color-accent-red)] bg-red-50 p-3 rounded-lg overflow-auto">{error}</pre>
      )}

      {result && (
        <pre className="text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 rounded-lg overflow-auto max-h-64">
          {result.content.map((c) =>
            c.type === 'text' ? c.text : `[image: ${c.mimeType}]`
          ).join('\n')}
        </pre>
      )}
    </div>
  );
}
