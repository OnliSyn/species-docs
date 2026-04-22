'use client';
import { ToolPlayground } from './ToolPlayground';
import type { McpTool } from '@/types/mcp';

interface Props {
  tool: McpTool;
  serviceId: string;
  onBack: () => void;
}

export function ToolDetail({ tool, serviceId, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] w-fit"
      >
        ← Back
      </button>
      <div>
        <h3 className="text-sm font-semibold">{tool.name}</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{tool.description}</p>
      </div>
      <ToolPlayground tool={tool} serviceId={serviceId} />
    </div>
  );
}
