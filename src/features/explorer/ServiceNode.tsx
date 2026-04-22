import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export interface ServiceNodeData {
  label: string;
  url: string;
  toolCount: number;
  status: 'loading' | 'live' | 'error';
  onClick: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  live: 'var(--color-accent-green)',
  error: 'var(--color-accent-red)',
  loading: '#ccc',
};

export function ServiceNode({ data }: NodeProps) {
  const d = data as unknown as ServiceNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <button
        onClick={d.onClick}
        className="flex flex-col gap-1 px-4 py-3 rounded-[var(--radius-card)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-[var(--shadow-card)] hover:shadow-md transition-shadow text-left min-w-[160px]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{d.label}</span>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLOR[d.status] ?? '#ccc' }}
          />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[140px]">{d.url.replace('https://', '')}</span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{d.toolCount} tools</span>
      </button>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  );
}
