'use client';
import type { McpTool } from '@/types/mcp';

interface Props {
  tools: McpTool[];
  onSelect: (tool: McpTool) => void;
}

export function ToolList({ tools, onSelect }: Props) {
  if (tools.length === 0) {
    return <p className="text-xs text-[var(--color-text-secondary)]">No tools loaded.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {tools.map((tool) => (
        <li key={tool.name}>
          <button
            onClick={() => onSelect(tool)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-colors"
          >
            <div className="text-sm font-medium">{tool.name}</div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">{tool.description}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
