'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { ToolList } from './ToolList';
import { ToolDetail } from './ToolDetail';
import type { McpService } from '@/config/services';
import type { McpTool } from '@/types/mcp';

interface Props {
  service: McpService;
  tools: McpTool[];
  status: 'loading' | 'live' | 'error';
  onClose: () => void;
}

export function ServicePanel({ service, tools, status, onClose }: Props) {
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);

  return (
    <div
      data-testid="service-panel"
      className="fixed top-0 right-0 h-full w-[390px] bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-xl flex flex-col z-50"
      style={{ animation: 'slideIn 200ms ease-out' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-sm font-semibold">{service.label}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-[280px]">{service.url}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: status === 'live' ? 'var(--color-accent-green)' : status === 'error' ? 'var(--color-accent-red)' : '#ccc' }}
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-sidebar)]">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedTool ? (
          <ToolDetail
            tool={selectedTool}
            serviceId={service.id}
            onBack={() => setSelectedTool(null)}
          />
        ) : (
          <ToolList tools={tools} onSelect={setSelectedTool} />
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
