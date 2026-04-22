'use client';
import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SERVICES } from '@/config/services';
import { useMcpTools } from '@/hooks/useMcpTools';
import { HubNode } from './HubNode';
import { ServiceNode } from './ServiceNode';
import { ServicePanel } from './ServicePanel';

const NODE_TYPES = { hub: HubNode, service: ServiceNode };

const POSITIONS = [
  { x: -260, y: -80 },
  { x:  160, y: -80 },
  { x: -260, y:  80 },
  { x:  160, y:  80 },
];

const INITIAL_EDGES: Edge[] = SERVICES.map((svc) => ({
  id: `hub-${svc.id}`,
  source: 'hub',
  target: svc.id,
  style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
}));

export function ExplorerPage() {
  const { tools, status } = useMcpTools();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  useEffect(() => {
    const hub: Node = { id: 'hub', type: 'hub', position: { x: -32, y: -32 }, data: {} };
    const serviceNodes: Node[] = SERVICES.map((svc, i) => ({
      id: svc.id,
      type: 'service',
      position: POSITIONS[i],
      data: {
        label: svc.label,
        url: svc.url,
        toolCount: tools[svc.id]?.length ?? 0,
        status: status[svc.id] ?? 'loading',
        onClick: () => setSelectedServiceId(svc.id),
      },
    }));
    setNodes([hub, ...serviceNodes]);
  }, [tools, status, setNodes]);

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) ?? null;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold">Species MCP Explorer</span>
        <div className="flex items-center gap-4">
          {SERVICES.map((svc) => (
            <div key={svc.id} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status[svc.id] === 'live' ? 'var(--color-accent-green)' : status[svc.id] === 'error' ? 'var(--color-accent-red)' : '#ccc' }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">{svc.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        style={{ paddingTop: 52 }}
      >
        <Background gap={24} color="var(--color-border)" />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {selectedService && (
        <ServicePanel
          service={selectedService}
          tools={tools[selectedService.id] ?? []}
          status={status[selectedService.id] ?? 'loading'}
          onClose={() => setSelectedServiceId(null)}
        />
      )}
    </div>
  );
}
