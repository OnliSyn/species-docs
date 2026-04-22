import { Handle, Position } from '@xyflow/react';

export function HubNode() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-cta-primary)] text-white text-xs font-semibold shadow-lg">
      MCP
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
